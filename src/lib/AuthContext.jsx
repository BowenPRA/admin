/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { auth, db, dbMode } from './db'

// Who is signed in and what they may do.
//   isOffice – Supabase app_metadata.role is 'teacher' or 'admin': the office
//              accounts that handle invoices and settings (unchanged from before)
//   role     – for progress reports:
//              'head'    everything (also anyone whose app_metadata.role is 'admin')
//              'teacher' the subjects on their adm_teachers row, plus the homeroom
//                        parts of reports for the year groups in homeroom_groups
//              'viewer'  signed in but not listed as a teacher: read only
const Ctx = createContext(null)
const ADMIN_EMAILS = ['sbowen209@gmail.com']

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, session: null, me: null })

  const resolve = useCallback(async (session) => {
    if (!session) { setState({ loading: false, session: null, me: null }); return }
    const email = session.user?.email || ''
    const metaRole = session.user?.app_metadata?.role
    const isAdmin = dbMode === 'local' || metaRole === 'admin' || ADMIN_EMAILS.includes(email.toLowerCase())
    let row = null
    try {
      const rows = await db.teachers.list()
      row = rows.find((t) => (t.email || '').toLowerCase() === email.toLowerCase()) || null
    } catch { /* table may not exist yet */ }
    const me = {
      email,
      id: row?.id || null,
      name: row?.name || (dbMode === 'local' ? 'Head Teacher (offline)' : email.split('@')[0]),
      title: row?.title || '',
      role: 'head',
      subjects: row?.subjects || [],
      homeroom_groups: row?.homeroom_groups || ['*'],
      isOffice: true,
    }
    setState({ loading: false, session, me })
  }, [])

  useEffect(() => {
    let alive = true
    auth.session().then((s) => alive && resolve(s))
    const off = auth.onChange((s) => alive && resolve(s))
    return () => { alive = false; off() }
  }, [resolve])

  const me = state.me
  const isHead = me?.role === 'head'
  const canSubject = (key) => isHead || (me?.subjects || []).includes(key)
  const canHomeroom = (report) => isHead || (me?.homeroom_groups || []).includes('*') || (!!report && (me?.homeroom_groups || []).includes(report.year_group))
  const refreshMe = () => resolve(state.session)
  const displayName = me ? `${me.title ? me.title + ' ' : ''}${me.name}` : ''

  return <Ctx.Provider value={{ ...state, isHead, isOffice: !!me?.isOffice, canSubject, canHomeroom, refreshMe, displayName }}>{children}</Ctx.Provider>
}

export function useAuth() { return useContext(Ctx) }
