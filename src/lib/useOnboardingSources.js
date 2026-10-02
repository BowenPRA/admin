import { useCallback, useEffect, useState } from 'react'
import { db } from './db'

/** Invoices, enrollment forms and leads; a list that cannot be read is null. */
const fetchSources = () => Promise.all([
  db.invoices.list().catch(() => null),
  db.enrollments.list().catch(() => null),
  db.leads.list().catch(() => null),
]).then(([invoices, enrollments, leads]) => ({ invoices, enrollments, leads, loaded: true }))

/**
 * What the new-student checklist reads besides the students and families: invoices,
 * enrollment forms and leads (office accounts only). A list that cannot be read (a
 * table not set up yet, or a teacher's account) is null, and its line is left out.
 */
export function useOnboardingSources(enabled = true) {
  const [src, setSrc] = useState({ invoices: null, enrollments: null, leads: null, loaded: false })
  useEffect(() => {
    if (!enabled) return
    let on = true
    fetchSources().then((s) => on && setSrc(s))
    return () => { on = false }
  }, [enabled])
  const reload = useCallback(async () => { if (enabled) setSrc(await fetchSources()) }, [enabled])
  return { ...src, reload }
}
