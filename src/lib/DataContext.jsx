/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { db } from './db'
import { normalizeSchedule } from './schedule'
import { preparePhotos } from './report/photo'

// Loads the reference data every screen needs (families, students, fee
// schedule, calendar) once, and exposes a `refresh` so screens that change
// them can update everyone else. Student photos get their signed links here
// too, before the first render, and are re-signed before the links run out.
const Ctx = createContext(null)

export function DataProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: null, families: [], students: [], teachers: [], fees: null, calendar: null, reportSettings: null, schedule: null })

  const refresh = useCallback(async () => {
    try {
      const [families, students, fees, calendar, teachers, reportSettings, schedule] = await Promise.all([
        db.families.list(), db.students.list(), db.getFees(), db.getCalendar(),
        db.teachers.list().catch(() => []), db.getReportSettings(), db.getSchedule().catch(() => normalizeSchedule(null)),
      ])
      await preparePhotos(students.map((s) => s.photo)).catch(() => {})
      setState({ loading: false, error: null, families, students, teachers, fees, calendar, reportSettings, schedule })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message || String(e) }))
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // A tab left open all day keeps working photos: new links re-render everyone.
  const { students } = state
  useEffect(() => {
    const id = setInterval(async () => {
      if (await preparePhotos(students.map((s) => s.photo)).catch(() => false)) setState((s) => ({ ...s }))
    }, 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [students])

  return <Ctx.Provider value={{ ...state, refresh }}>{children}</Ctx.Provider>
}

export function useData() {
  return useContext(Ctx)
}
