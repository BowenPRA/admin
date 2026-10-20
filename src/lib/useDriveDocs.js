// Students' documents on Drive, for the student window and the Documents summary
// (lib/driveDocs.js does the working out). The folder's list and the office's
// corrections are read once per tab and shared by every window that asks.

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { db } from './db'
import { useData } from './DataContext'
import { googleToken, hasGoogleToken } from './gmail'
import { DRIVE_SCOPE, DriveError, listDriveTree, matchDocuments, websiteDocs } from './driveDocs'

const EMPTY = { loaded: false, loading: false, files: [], links: [], check: null, error: null, forms: [], privates: [] }
let state = EMPTY
let checking = false
const listeners = new Set()
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()) }
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }

/** The tables are not there until supabase/updates-2026-10-19-drive-docs.sql has run. */
export const notSetUp = (e) => /adm_drive_(files|doc_links)/.test(e?.message || '') && /(does not exist|schema cache|PGRST205|Could not find)/i.test(e?.message || '')

/** What went wrong reading Drive or saving a correction, in words the office can act on. `t` from useT(). */
export function driveMessage(e, t) {
  if (e instanceof DriveError && e.code !== 'drive_other') return t(`docsErr_${e.code}`)
  if (notSetUp(e)) return t('docsSetup')
  return e?.message || String(e)
}

/** Reads the list and the corrections again (`force`), or the first time something asks. */
export async function loadDriveDocs(force = false) {
  if ((state.loaded && !force) || state.loading) return
  set({ loading: true })
  try {
    // Forms from the website count too; before their tables exist there are none.
    const [files, links, check, forms, privates] = await Promise.all([
      db.driveFiles.list(), db.driveDocLinks.list(), db.getDriveCheck().catch(() => null),
      db.enrollments.list().catch(() => []), db.enrollments.allPrivate().catch(() => []),
    ])
    set({ loaded: true, loading: false, files, links, check, forms, privates, error: null })
  } catch (e) {
    set({ loaded: true, loading: false, error: notSetUp(e) ? 'setup' : e.message })
  }
}

/**
 * Reads the folder on Drive and saves its list. Call it from a click: the first time in a
 * session Google asks which account to use (admin@palmriveracademy.edu.vn can open the folder).
 * Throws a DriveError with a code the page turns into words (drive_off, drive_no_access, drive_signin).
 */
export async function checkDrive(by) {
  if (checking) return null
  checking = true
  set({ checking: true })
  try {
    const token = await googleToken(DRIVE_SCOPE)
    const rows = await listDriveTree(token)
    // A folder that comes back empty is a sign-in or sharing problem, not a folder without files:
    // keep the last list rather than wiping it.
    if (!rows.some((r) => !r.is_folder)) throw new DriveError('drive_empty', 'drive_empty')
    await db.driveFiles.replaceAll(rows)
    const check = { at: new Date().toISOString(), by: by || '', files: rows.filter((r) => !r.is_folder).length }
    await db.setDriveCheck(check).catch(() => {})
    await loadDriveDocs(true)
    return check
  } finally {
    checking = false
    set({ checking: false })
  }
}

/** Saves a correction, then reads the corrections again. */
export async function saveDocLink(row) {
  await db.driveDocLinks.save(row)
  set({ links: await db.driveDocLinks.list() })
}

// Checked within the last half hour: no need to read Drive again on its own.
const FRESH_MS = 30 * 60 * 1000
/** While this tab already holds a Drive token, a list older than half an hour is refreshed quietly. */
export function refreshIfStale(by) {
  const at = Date.parse(state.check?.at || '') || 0
  if (!hasGoogleToken(DRIVE_SCOPE) || checking || Date.now() - at < FRESH_MS) return
  checkDrive(by).catch(() => {})
}

/**
 * { files, links, check, error, loading, checking, match, web }: match is matchDocuments() over
 * every student in The Current (worked out again when the list or the students change), web is
 * websiteDocs() for the forms sent from pra.edu.vn.
 */
export function useDriveDocs() {
  const s = useSyncExternalStore(subscribe, () => state)
  const { students } = useData()
  useEffect(() => { loadDriveDocs() }, [])
  const match = useMemo(() => matchDocuments(s.files, students, s.links), [s.files, s.links, students])
  const web = useMemo(() => websiteDocs(s.forms, s.privates), [s.forms, s.privates])
  return { ...s, match, web }
}
