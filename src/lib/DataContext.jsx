/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { db } from './db'

// Loads the reference data every screen needs (families, students, fee
// schedule, calendar) once, and exposes a `refresh` so screens that change
// them can update everyone else.
const Ctx = createContext(null)

export function DataProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: null, families: [], students: [], teachers: [], fees: null, calendar: null, reportSettings: null })

  const refresh = useCallback(async () => {
    try {
      const [families, students, fees, calendar, teachers, reportSettings] = await Promise.all([
        db.families.list(), db.students.list(), db.getFees(), db.getCalendar(),
        db.teachers.list().catch(() => []), db.getReportSettings(),
      ])
      setState({ loading: false, error: null, families, students, teachers, fees, calendar, reportSettings })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message || String(e) }))
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return <Ctx.Provider value={{ ...state, refresh }}>{children}</Ctx.Provider>
}

export function useData() {
  return useContext(Ctx)
}
