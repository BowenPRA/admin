/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { db } from './db'
import { normalizeSchedule } from './schedule'
import { preparePhotos } from './report/photo'

// Loads the reference data every screen needs (families, students, fee
// schedule, calendar) once, and exposes a `refresh` so screens that change
// them can update everyone else. Student photos get their signed links here
// too, before the first render, and are re-signed before the links run out.
const Ctx = createContext(null)
// Data that came back the same keeps its old object, so pages (and PDFs) are not rebuilt for nothing.
const keep = (prev, next) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next)
const STALE_MS = 2 * 60 * 1000

export function DataProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: null, families: [], students: [], teachers: [], travel: [], fees: null, calendar: null, reportSettings: null, schedule: null })

  const loadedAt = useRef(0)

  // `quiet` is the refresh nobody asked for (the tab was looked at again): if it fails, what is on screen stays.
  const refresh = useCallback(async (quiet = false) => {
    try {
      const [families, students, fees, calendar, teachers, reportSettings, schedule, travel] = await Promise.all([
        db.families.list(), db.students.list(), db.getFees(), db.getCalendar(),
        db.teachers.list().catch(() => []), db.getReportSettings(), db.getSchedule().catch(() => normalizeSchedule(null)),
        // Trips: none until supabase/updates-2026-10-01-travel.sql has run.
        db.travel.list().catch(() => []),
      ])
      await preparePhotos(students.map((s) => s.photo)).catch(() => {})
      loadedAt.current = Date.now()
      const next = { families, students, teachers, travel, fees, calendar, reportSettings, schedule }
      setState((s) => ({ loading: false, error: null, ...Object.fromEntries(Object.entries(next).map(([k, v]) => [k, keep(s[k], v)])) }))
    } catch (e) {
      if (quiet !== true) setState((s) => ({ ...s, loading: false, error: e.message || String(e) }))
    }
  }, [])

  // After a trip is added, changed or removed: only the trips are read again.
  const refreshTravel = useCallback(async () => {
    const travel = await db.travel.list().catch(() => null)
    if (travel) setState((s) => ({ ...s, travel: keep(s.travel, travel) }))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // A tab left open is brought up to date when someone comes back to it, so what they
  // save next starts from what colleagues have changed in the meantime.
  useEffect(() => {
    const onShow = () => { if (document.visibilityState === 'visible' && Date.now() - loadedAt.current > STALE_MS) refresh(true) }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [refresh])

  // A tab left open all day keeps working photos: new links re-render everyone.
  const { students } = state
  useEffect(() => {
    const id = setInterval(async () => {
      if (await preparePhotos(students.map((s) => s.photo)).catch(() => false)) setState((s) => ({ ...s }))
    }, 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [students])

  return <Ctx.Provider value={{ ...state, refresh, refreshTravel }}>{children}</Ctx.Provider>
}

export function useData() {
  return useContext(Ctx)
}
