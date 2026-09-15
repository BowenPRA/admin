/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { auth, db, dbMode } from './db'
import { splitSubjectKey } from '../data/staff'

// Who is signed in and what they may do. The same rules are enforced in the
// database (supabase/updates-2026-09-15.sql); this only decides what to show.
//
//   access   from Supabase app_metadata.role
//     super_admin, head  everything
//     admin              office: invoices, students, families, fees, attendance
//     teacher            no office screens
//     (none)             'teacher' when listed on the Teachers page, else 'viewer'
//   Reports: head for super_admin / head (or a Teachers row with role 'head');
//   everyone else edits the `subject:Year group` pairs on their Teachers row and
//   the homeroom parts for their homeroom year groups.
const Ctx = createContext(null)
const ADMIN_EMAILS = ['sbowen209@gmail.com']
const KNOWN = ['super_admin', 'head', 'admin', 'teacher']
const VIEW_AS_KEY = 'pra-admin-view-as'

const readViewAs = () => { try { return localStorage.getItem(VIEW_AS_KEY) || '' } catch { return '' } }

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, session: null, me: null })
  const [viewAs, setViewAsState] = useState(readViewAs)

  const resolve = useCallback(async (session) => {
    if (!session) { setState({ loading: false, session: null, me: null }); return }
    const local = dbMode === 'local'
    // Offline mode can preview the app as any teacher on the list.
    const email = (local && viewAs ? viewAs : session.user?.email || '').toLowerCase()
    let row = null
    try {
      const rows = await db.teachers.list()
      row = rows.find((t) => (t.email || '').toLowerCase() === email && t.active !== false) || null
    } catch { /* table may not exist yet */ }
    const metaRole = local ? (viewAs ? '' : 'super_admin') : session.user?.app_metadata?.role
    let access = KNOWN.includes(metaRole) ? metaRole : ADMIN_EMAILS.includes(email) ? 'super_admin' : row ? 'teacher' : 'viewer'
    if (local && viewAs && row?.role === 'head') access = 'head'
    const me = {
      email,
      id: row?.id || null,
      name: row?.name || session.user?.user_metadata?.name || (local && !viewAs ? 'Offline admin' : email.split('@')[0]),
      title: row?.title || '',
      access,
      reportHead: ['super_admin', 'head'].includes(access) || row?.role === 'head',
      subjects: row?.subjects || [],
      homeroom_groups: row?.homeroom_groups || [],
      linked: !!row,
    }
    setState({ loading: false, session, me })
  }, [viewAs])

  useEffect(() => {
    let alive = true
    auth.session().then((s) => alive && resolve(s))
    const off = auth.onChange((s) => alive && resolve(s))
    return () => { alive = false; off() }
  }, [resolve])

  const value = useMemo(() => {
    const me = state.me
    const isHead = !!me?.reportHead
    const isOffice = ['super_admin', 'head', 'admin'].includes(me?.access)
    const subjects = me?.subjects || []
    const homerooms = me?.homeroom_groups || []
    const canSubject = (key, yearGroup) => {
      if (isHead) return true
      if (!yearGroup) return subjects.some((s) => splitSubjectKey(s)[0] === key)
      return subjects.includes(`${key}:${yearGroup}`)
    }
    const canHomeroom = (reportOrGroup) => {
      if (isHead || homerooms.includes('*')) return true
      const yg = typeof reportOrGroup === 'string' ? reportOrGroup : reportOrGroup?.year_group
      return !!yg && homerooms.includes(yg)
    }
    // Year groups this person teaches in (subjects or homeroom); null = all.
    const myYearGroups = isHead || homerooms.includes('*') ? null
      : [...new Set([...homerooms, ...subjects.map((s) => splitSubjectKey(s)[1]).filter(Boolean)])]
    const canAttendance = (yg) => isOffice || !myYearGroups || myYearGroups.includes(yg)
    const setViewAs = (email) => {
      try { if (email) localStorage.setItem(VIEW_AS_KEY, email); else localStorage.removeItem(VIEW_AS_KEY) } catch { /* ignore */ }
      setViewAsState(email || '')
    }
    return {
      ...state,
      isHead, isOffice, isSuper: me?.access === 'super_admin',
      canSubject, canHomeroom, canAttendance, myYearGroups,
      refreshMe: () => resolve(state.session),
      displayName: me ? `${me.title ? me.title + ' ' : ''}${me.name}` : '',
      viewAs: dbMode === 'local' ? viewAs : '', setViewAs,
    }
  }, [state, resolve, viewAs])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() { return useContext(Ctx) }
