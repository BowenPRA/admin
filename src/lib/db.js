// Data access. One small interface with two implementations:
//   - Supabase (shared, multi-user) when VITE_SUPABASE_* is configured
//   - localStorage (single browser) otherwise, so the app works with no setup.
//
// Tables are prefixed `adm_` so they never collide with the Dashboard's tables
// when both apps share one Supabase project.

import { supabase, hasSupabase } from './supabaseClient.js'
import { DEFAULT_FEES, DEFAULT_CALENDAR } from './fees.js'
import { normalizeReportSettings } from './report/defaults.js'
import { STATUSES } from './studentRecords.js'
import { normalizeSchedule } from './schedule.js'
import { removeProofs, proofError } from './proof.js'

const TABLES = {
  families: 'adm_families',
  students: 'adm_students',
  invoices: 'adm_invoices',
  payments: 'adm_payments',
  settings: 'adm_settings',
  // Progress reports
  teachers: 'adm_teachers',
  reports: 'adm_reports',
  sections: 'adm_report_sections',
  courseNotes: 'adm_course_notes',
  attendance: 'adm_attendance',
  // Trips: the days a student is away traveling (anyone who takes attendance)
  travel: 'adm_travel',
  // Event photos (office only)
  photoEvents: 'adm_photo_events',
  eventPhotos: 'adm_event_photos',
  eventPosts: 'adm_event_posts',
  // Families who have asked about joining (office only)
  leads: 'adm_leads',
  // What families send from the form on pra.edu.vn (office only)
  webMessages: 'adm_web_messages',
  // Enrollment forms from the website (office); the private part is for the super admin only
  enrollments: 'adm_enrollments',
  enrollmentPrivate: 'adm_enrollment_private',
  // To-Do: tasks for staff and for Claude (office only)
  todos: 'adm_todos',
}

// Rows that come straight from form inputs may hold '' where Postgres wants
// null (date / numeric columns). Applied to the report tables and students.
const CLEAN = new Set([TABLES.students, TABLES.teachers, TABLES.reports, TABLES.sections, TABLES.courseNotes, TABLES.attendance, TABLES.travel, TABLES.photoEvents, TABLES.eventPhotos, TABLES.eventPosts, TABLES.leads, TABLES.todos])
// Invoices and payments keep their text as typed; only a date that was cleared needs to be null.
const DATE_COLS = { [TABLES.invoices]: ['issue_date', 'due_date'], [TABLES.payments]: ['paid_on'] }
const cleanRow = (table, row) => {
  if (CLEAN.has(table)) return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === '' ? null : v]))
  const dates = DATE_COLS[table]
  if (!dates?.some((k) => row[k] === '')) return row
  const r = { ...row }
  dates.forEach((k) => { if (r[k] === '') r[k] = null })
  return r
}
// The column that tells rows apart when a list is read page by page.
const ROW_KEY = { [TABLES.enrollmentPrivate]: 'enrollment_id' }
const matches = (row, filter) => Object.entries(filter || {}).every(([k, v]) => (Array.isArray(v) ? v.includes(row[k]) : row[k] === v))

/** A number that was handed out twice: the database refused the second one. */
export const isDuplicate = (e) => /duplicate key|unique constraint/i.test(e?.message || '')

export const genId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

// ---------------- localStorage adapter ----------------
const LS_KEY = 'pra-admin-db-v1'
function lsRead() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function lsWrite(data) { localStorage.setItem(LS_KEY, JSON.stringify(data)) }

const localAdapter = {
  mode: 'local',
  async list(table, filter) {
    const d = lsRead()
    return (d[table] || []).filter((r) => matches(r, filter))
  },
  async listRange(table, col, from, to) {
    const d = lsRead()
    return (d[table] || []).filter((r) => r[col] >= from && r[col] <= to)
  },
  async get(table, id) {
    const d = lsRead()
    return (d[table] || []).find((r) => r.id === id) || null
  },
  async upsert(table, row) {
    const d = lsRead()
    const rows = d[table] || []
    const now = new Date().toISOString()
    const r = { ...row, id: row.id || genId(), updated_at: now, created_at: row.created_at || now }
    const i = rows.findIndex((x) => x.id === r.id)
    if (i >= 0) rows[i] = r; else rows.push(r)
    d[table] = rows
    lsWrite(d)
    return r
  },
  async upsertMany(table, rows) { const out = []; for (const r of rows) out.push(await this.upsert(table, r)); return out },
  // Changes some fields of one row, leaving the rest as they are now (not as they were when a page loaded them).
  async patch(table, id, fields) {
    const d = lsRead()
    const rows = d[table] || []
    const i = rows.findIndex((x) => x.id === id)
    if (i < 0) throw new Error('This record no longer exists.')
    rows[i] = { ...rows[i], ...fields, updated_at: new Date().toISOString() }
    d[table] = rows
    lsWrite(d)
    return rows[i]
  },
  // Insert or replace by a natural key (e.g. one attendance mark per student per day).
  async upsertBy(table, rows, keys) {
    const d = lsRead()
    const list = d[table] || []
    const now = new Date().toISOString()
    const out = rows.map((row) => {
      const i = list.findIndex((x) => keys.every((k) => x[k] === row[k]))
      const r = { ...(i >= 0 ? list[i] : {}), ...row, id: i >= 0 ? list[i].id : row.id || genId(), updated_at: now }
      r.created_at = r.created_at || now
      if (i >= 0) list[i] = r; else list.push(r)
      return r
    })
    d[table] = list
    lsWrite(d)
    return out
  },
  async remove(table, id) {
    const d = lsRead()
    d[table] = (d[table] || []).filter((r) => r.id !== id)
    if (table === TABLES.invoices) d[TABLES.payments] = (d[TABLES.payments] || []).filter((p) => p.invoice_id !== id)
    if (table === TABLES.reports) d[TABLES.sections] = (d[TABLES.sections] || []).filter((p) => p.report_id !== id)
    if (table === TABLES.photoEvents) for (const t of [TABLES.eventPhotos, TABLES.eventPosts]) d[t] = (d[t] || []).filter((p) => p.event_id !== id)
    lsWrite(d)
  },
  async removeStrict(table, id) { return this.remove(table, id) },
  // Database functions only exist in Supabase.
  async rpc() { throw new Error('This only works when connected to the shared database.') },
  async getSetting(key) {
    const d = lsRead()
    return d.settings?.[key] ?? null
  },
  async setSetting(key, value) {
    const d = lsRead()
    d.settings = d.settings || {}
    d.settings[key] = value
    lsWrite(d)
  },
}

// ---------------- Supabase adapter ----------------
function throwIf(error) { if (error) throw new Error(error.message || String(error)) }

const supaAdapter = {
  mode: 'supabase',
  // Read page by page: Supabase returns at most 1000 rows to one request, and a
  // list cut off there would, for one, hand out invoice numbers that are taken.
  async list(table, filter) {
    const key = ROW_KEY[table] || 'id'
    const out = []
    for (let start = 0; ; start += 1000) {
      let q = supabase.from(table).select('*')
      for (const [k, v] of Object.entries(filter || {})) q = Array.isArray(v) ? q.in(k, v) : q.eq(k, v)
      const { data, error } = await q.order('created_at', { ascending: true }).order(key, { ascending: true }).range(start, start + 999)
      throwIf(error)
      out.push(...(data || []))
      if (!data || data.length < 1000) return out
    }
  },
  // Pages through the rows so long ranges are not cut off at Supabase's 1000-row limit.
  async listRange(table, col, from, to) {
    const out = []
    for (let start = 0; ; start += 1000) {
      const { data, error } = await supabase.from(table).select('*').gte(col, from).lte(col, to).order(col).order('id').range(start, start + 999)
      throwIf(error)
      out.push(...(data || []))
      if (!data || data.length < 1000) return out
    }
  },
  async get(table, id) {
    const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
    throwIf(error)
    return data
  },
  async upsert(table, row) {
    const r = cleanRow(table, { ...row, id: row.id || genId(), updated_at: new Date().toISOString() })
    delete r.created_at
    const { data, error } = await supabase.from(table).upsert(r).select().single()
    throwIf(error)
    return data
  },
  async upsertMany(table, rows) {
    if (!rows.length) return []
    const now = new Date().toISOString()
    const rs = rows.map((row) => { const r = cleanRow(table, { ...row, id: row.id || genId(), updated_at: now }); delete r.created_at; return r })
    const { data, error } = await supabase.from(table).upsert(rs).select()
    throwIf(error)
    return data || []
  },
  async patch(table, id, fields) {
    const r = cleanRow(table, { ...fields, updated_at: new Date().toISOString() })
    delete r.id; delete r.created_at
    const { data, error } = await supabase.from(table).update(r).eq('id', id).select().maybeSingle()
    throwIf(error)
    if (!data) throw new Error('This could not be saved: the record no longer exists, or your account may not change it.')
    return data
  },
  async upsertBy(table, rows, keys) {
    if (!rows.length) return []
    const now = new Date().toISOString()
    const rs = rows.map((row) => { const r = cleanRow(table, { ...row, updated_at: now }); delete r.created_at; delete r.id; return r })
    const { data, error } = await supabase.from(table).upsert(rs, { onConflict: keys.join(',') }).select()
    throwIf(error)
    return data || []
  },
  async remove(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    throwIf(error)
  },
  // Row level security hides a refused delete (no error, nothing removed), so ask for the row back.
  async removeStrict(table, id) {
    const { data, error } = await supabase.from(table).delete().eq('id', id).select('id')
    throwIf(error)
    if (!data?.length) throw new Error('This could not be removed: your account is not allowed to, or it was already removed.')
  },
  async rpc(name, args) {
    const { data, error } = await supabase.rpc(name, args)
    throwIf(error)
    return data
  },
  async getSetting(key) {
    const { data, error } = await supabase.from(TABLES.settings).select('value').eq('key', key).maybeSingle()
    throwIf(error)
    return data?.value ?? null
  },
  async setSetting(key, value) {
    const { error } = await supabase.from(TABLES.settings).upsert({ key, value, updated_at: new Date().toISOString() })
    throwIf(error)
  },
}

const A = hasSupabase ? supaAdapter : localAdapter
export const dbMode = A.mode

// ---------------- Public API ----------------
const crud = (table) => ({
  list: (filter) => A.list(table, filter),
  get: (id) => A.get(table, id),
  save: (row) => A.upsert(table, row),
  saveMany: (rows) => A.upsertMany(table, rows),
  remove: (id) => A.remove(table, id),
  patch: (id, fields) => A.patch(table, id, fields),
})

// A student's `status` is the source of truth; the older `active` boolean is
// kept in step on every write so anything still reading it stays correct.
const withStatus = (row) => {
  const status = STATUSES.includes(row.status) ? row.status : (row.active === false ? 'inactive' : 'active')
  return { ...row, status, active: status === 'active' }
}
// Until supabase/updates-2026-09-16-pending.sql has run there is no `status`
// column and Postgres rejects the write; fall back to the boolean on its own.
const noStatusColumn = (e) => /status/i.test(e?.message || '') && /(does not exist|schema cache)/i.test(e?.message || '')
const dropStatus = (row) => { const r = { ...row }; delete r.status; return r }
// Columns that a later database file adds, so the app may be live before Bowen has run it.
// Until then a write that leaves the column empty goes through without it; one that fills it
// in fails, and the page says which file to run.
//   end_date: supabase/updates-2026-10-02-student-dates-onboarding.sql (expected end date)
// SOFT_LATER columns are left out even when filled: the student still saves, and only that
// value waits for the file. The new-student checklist notices (the row comes back without the
// column) and says which file to run.
//   lead_id, onboarding: the same file, Part 2 (the lead a student came from; the checklist's ticks)
const LATER_COLUMNS = ['end_date', 'lead_id', 'onboarding']
const SOFT_LATER = ['lead_id', 'onboarding']
const missingLaterColumn = (e) => (/(does not exist|schema cache)/i.test(e?.message || '') && LATER_COLUMNS.find((c) => new RegExp(`['"]${c}['"]`).test(e.message))) || null
const isBlank = (v) => v == null || v === ''
const dropKey = (row, key) => { const r = { ...row }; delete r[key]; return r }
/** Runs `write(rows)`, again without `status` or a later column when the database does not have it yet. */
async function writeStudents(rows, write) {
  let rs = rows
  for (;;) {
    try { return await write(rs) } catch (e) {
      if (noStatusColumn(e) && rs.some((r) => 'status' in r)) { rs = rs.map(dropStatus); continue }
      const col = missingLaterColumn(e)
      if (col && rs.some((r) => col in r) && (SOFT_LATER.includes(col) || rs.every((r) => isBlank(r[col])))) { rs = rs.map((r) => dropKey(r, col)); continue }
      throw e
    }
  }
}
const saveStudent = (row) => writeStudents([withStatus(row)], ([r]) => A.upsert(TABLES.students, r))
const saveStudents = (rows) => writeStudents(rows.map(withStatus), (rs) => A.upsertMany(TABLES.students, rs))

// A change to some fields of one student. Unlike a save it is a plain update: the rest of the
// row stays as it is in the database, whatever this browser loaded earlier.
const patchStudent = (id, fields) => writeStudents(['status' in fields || 'active' in fields ? withStatus(fields) : fields], ([f]) => A.patch(TABLES.students, id, f))

// Documents parents attach to the enrollment form (supabase/updates-2026-09-30-enrollments.sql).
const ENROLLMENT_BUCKET = 'adm-enrollment'
const enrollmentPrivate = (id) => A.list(TABLES.enrollmentPrivate, { enrollment_id: id }).then((rows) => rows[0] || null)

// The record is already gone, so a file that will not delete is only logged.
const dropProofFiles = (payments) => removeProofs(payments.flatMap((p) => p.proof || [])).catch((e) => console.warn('Proof files not removed:', e.message))

export const db = {
  families: crud(TABLES.families),
  students: {
    ...crud(TABLES.students),
    save: saveStudent,
    saveMany: saveStudents,
    patch: patchStudent,
  },
  teachers: crud(TABLES.teachers),
  reports: crud(TABLES.reports),
  sections: crud(TABLES.sections),
  courseNotes: {
    ...crud(TABLES.courseNotes),
    // One note per year group, period and learning area: two editors creating it at once end up sharing it.
    save: (row) => A.upsertBy(TABLES.courseNotes, [row], ['school_year', 'period_label', 'year_group', 'subject_key']).then((r) => r[0]),
  },
  attendance: {
    list: (filter) => A.list(TABLES.attendance, filter),
    /** Marks for a date range (inclusive, 'YYYY-MM-DD'). */
    between: (from, to) => A.listRange(TABLES.attendance, 'date', from, to),
    mark: (rows) => A.upsertBy(TABLES.attendance, rows, ['student_id', 'date']),
    remove: (id) => A.remove(TABLES.attendance, id),
    /** Takes a mark off again; fails loudly if the database refuses. */
    clear: (id) => A.removeStrict(TABLES.attendance, id),
  },
  // Trips (supabase/updates-2026-10-01-travel.sql): attendance shows a student as A(T) on the days inside one.
  travel: {
    list: () => A.list(TABLES.travel),
    save: (row) => A.upsert(TABLES.travel, row),
    remove: (id) => A.removeStrict(TABLES.travel, id),
  },
  invoices: {
    list: () => A.list(TABLES.invoices),
    get: (id) => A.get(TABLES.invoices, id),
    save: (row) => A.upsert(TABLES.invoices, row),
    patch: (id, fields) => A.patch(TABLES.invoices, id, fields),
    // Its payments go with it (cascade), so their proof files are cleared too.
    async remove(id) {
      const ps = await A.list(TABLES.payments, { invoice_id: id }).catch(() => [])
      await A.remove(TABLES.invoices, id)
      await dropProofFiles(ps)
    },
  },
  payments: {
    list: () => A.list(TABLES.payments),
    /** One invoice's payments, oldest first. */
    forInvoice: (invoiceId) => A.list(TABLES.payments, { invoice_id: invoiceId }).then((ps) => ps.sort((a, b) => (a.paid_on || '').localeCompare(b.paid_on || ''))),
    get: (id) => A.get(TABLES.payments, id),
    save: (row) => A.upsert(TABLES.payments, row).catch((e) => { throw (row.proof?.length ? proofError(e) : e) }),
    patch: (id, fields) => A.patch(TABLES.payments, id, fields).catch((e) => { throw ('proof' in fields ? proofError(e) : e) }),
    async remove(id) {
      const p = await A.get(TABLES.payments, id).catch(() => null)
      await A.remove(TABLES.payments, id)
      await dropProofFiles(p ? [p] : [])
    },
  },
  // Event photos. Removing is strict: a refused delete must not look like a success.
  photoEvents: { ...crud(TABLES.photoEvents), remove: (id) => A.removeStrict(TABLES.photoEvents, id) },
  eventPhotos: {
    list: (eventId) => A.list(TABLES.eventPhotos, eventId ? { event_id: eventId } : undefined),
    saveMany: (rows) => A.upsertMany(TABLES.eventPhotos, rows),
    patch: (id, fields) => A.patch(TABLES.eventPhotos, id, fields),
    remove: (id) => A.removeStrict(TABLES.eventPhotos, id),
  },
  eventPosts: {
    list: (eventId) => A.list(TABLES.eventPosts, eventId ? { event_id: eventId } : undefined),
    save: (row) => A.upsert(TABLES.eventPosts, row),
    saveMany: (rows) => A.upsertMany(TABLES.eventPosts, rows),
    patch: (id, fields) => A.patch(TABLES.eventPosts, id, fields),
    remove: (id) => A.removeStrict(TABLES.eventPosts, id),
  },
  leads: { ...crud(TABLES.leads), remove: (id) => A.removeStrict(TABLES.leads, id) },
  // To-Do tasks (supabase/updates-2026-10-01-todos.sql). A note is added by a database function, so
  // two people adding one at the same moment both keep theirs; offline it is added to the row here.
  todos: {
    ...crud(TABLES.todos),
    // The database numbers a new task and notes when one is done; offline that is done here.
    save: async (row) => {
      if (A.mode !== 'local') return A.upsert(TABLES.todos, row)
      const all = await A.list(TABLES.todos)
      const number = row.number ?? Math.max(0, ...all.map((x) => x.number || 0)) + 1
      return A.upsert(TABLES.todos, { ...row, number, done_at: row.status === 'done' ? row.done_at || new Date().toISOString() : null })
    },
    patch: (id, fields) => A.patch(TABLES.todos, id, A.mode === 'local' && 'status' in fields ? { ...fields, done_at: fields.status === 'done' ? new Date().toISOString() : null } : fields),
    remove: (id) => A.removeStrict(TABLES.todos, id),
    addUpdate: async (id, text, by) => {
      if (A.mode === 'supabase') return A.rpc('adm_todo_add_update', { p_id: id, p_text: text })
      const row = await A.get(TABLES.todos, id)
      if (!row) throw new Error('This record no longer exists.')
      return A.patch(TABLES.todos, id, { updates: [...(row.updates || []), { at: new Date().toISOString(), by: by || '', text: String(text).trim() }] })
    },
  },
  // The website writes these itself (adm_web_submit); the office only reads them and marks them done.
  webMessages: {
    list: () => A.list(TABLES.webMessages),
    patch: (id, fields) => A.patch(TABLES.webMessages, id, fields),
    remove: (id) => A.removeStrict(TABLES.webMessages, id),
  },
  // Enrollment forms. The form on pra.edu.vn writes them itself (adm_enroll_submit); here they
  // are read, marked checked, and (super admin) deleted.
  enrollments: {
    list: () => A.list(TABLES.enrollments),
    patch: (id, fields) => A.patch(TABLES.enrollments, id, fields),
    /** Deletes a form and its documents. The documents go first: once the form is gone, nothing lists them. */
    async remove(id) {
      const priv = await enrollmentPrivate(id)
      const paths = (priv?.files || []).map((f) => f?.path).filter(Boolean)
      if (hasSupabase && paths.length) throwIf((await supabase.storage.from(ENROLLMENT_BUCKET).remove(paths)).error)
      await A.removeStrict(TABLES.enrollments, id)
    },
    /** ID numbers, the documents and the signature: a row for office accounts, nothing for anyone else. */
    private: (id) => enrollmentPrivate(id),
    /** Every form's private part at once (for the folder export). */
    allPrivate: () => A.list(TABLES.enrollmentPrivate),
    /** One document as a file, for the folder export. */
    async fileBlob(path) {
      if (!hasSupabase) throw new Error('Enrollment documents are only kept online.')
      const { data, error } = await supabase.storage.from(ENROLLMENT_BUCKET).download(path)
      throwIf(error)
      return data
    },
    /** Links to a form's documents that work for an hour, by path. The folder is private: nothing in it has a lasting link. */
    async fileUrls(paths) {
      if (!hasSupabase || !paths.length) return {}
      const { data, error } = await supabase.storage.from(ENROLLMENT_BUCKET).createSignedUrls(paths, 3600)
      throwIf(error)
      return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]))
    },
    /** Adds the pending student for a form that came in without one; returns the student's id. */
    makeStudent: (id) => A.rpc('adm_enrollment_make_student', { p_id: id }),
  },
  async getFees() {
    const v = await A.getSetting('fees')
    // `school` is merged key by key so fields added later (e.g. the center name) reach older saved settings.
    return { ...DEFAULT_FEES, ...(v || {}), school: { ...DEFAULT_FEES.school, ...(v?.school || {}) } }
  },
  setFees: (v) => A.setSetting('fees', v),
  async getCalendar() {
    const v = await A.getSetting('calendar')
    return v || DEFAULT_CALENDAR
  },
  setCalendar: (v) => A.setSetting('calendar', v),
  // Progress-report configuration: one JSON document; missing keys fall back
  // to the defaults and older saved versions are upgraded on read.
  async getReportSettings() {
    return normalizeReportSettings(await A.getSetting('reports'))
  },
  setReportSettings: (v) => A.setSetting('reports', v),
  // Weekly timetable: the built-in 2026-2027 schedule until someone edits it.
  async getSchedule() {
    return normalizeSchedule(await A.getSetting('schedule'))
  },
  setSchedule: (v) => A.setSetting('schedule', v),

  // Sequential document numbers: PRA-2627-0001 / PT-2627-0001
  async nextNumber(kind, schoolYear) {
    const yy = String(schoolYear || DEFAULT_FEES.schoolYear).replace(/(\d\d)(\d\d)-(\d\d)(\d\d)/, '$2$4')
    const prefix = kind === 'receipt' ? `PT-${yy}-` : `PRA-${yy}-`
    const rows = kind === 'receipt' ? await A.list(TABLES.payments) : await A.list(TABLES.invoices)
    const field = kind === 'receipt' ? 'receipt_number' : 'number'
    let max = 0
    rows.forEach((r) => {
      const n = String(r[field] || '')
      if (n.startsWith(prefix)) max = Math.max(max, Number(n.slice(prefix.length)) || 0)
    })
    return `${prefix}${String(max + 1).padStart(4, '0')}`
  },
}

// ---------------- Auth ----------------
export const auth = {
  enabled: hasSupabase,
  async session() {
    if (!hasSupabase) return { user: { email: 'local' } }
    const { data } = await supabase.auth.getSession()
    return data.session
  },
  onChange(cb) {
    if (!hasSupabase) return () => {}
    const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session))
    return () => data.subscription.unsubscribe()
  },
  async signIn(identifier, password) {
    // Plain email + password. If a short name is typed instead of an email it
    // is mapped onto the Dashboard's teacher-login convention so the same
    // account works in both apps.
    let email = identifier.trim()
    let pw = password
    if (!email.includes('@')) { email = `${email.toLowerCase()}@science.local`; pw = `${password.trim()}-y8s` }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) throw error
    return data
  },
  async signOut() { if (hasSupabase) await supabase.auth.signOut() },
  async changePassword(password) {
    if (!hasSupabase) throw new Error('Passwords only apply when connected to Supabase.')
    // Short-name accounts sign in with a suffix on the password (see signIn): the new one needs it too.
    const { data } = await supabase.auth.getSession()
    const short = (data.session?.user?.email || '').endsWith('@science.local')
    const { error } = await supabase.auth.updateUser({ password: short ? `${password.trim()}-y8s` : password })
    if (error) throw error
  },
}
