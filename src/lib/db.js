// Data access. One small interface with two implementations:
//   - Supabase (shared, multi-user) when VITE_SUPABASE_* is configured
//   - localStorage (single browser) otherwise, so the app works with no setup.
//
// Tables are prefixed `adm_` so they never collide with the Dashboard's tables
// when both apps share one Supabase project.

import { supabase, hasSupabase } from './supabaseClient.js'
import { DEFAULT_FEES, DEFAULT_CALENDAR } from './fees.js'

const TABLES = {
  families: 'adm_families',
  students: 'adm_students',
  invoices: 'adm_invoices',
  payments: 'adm_payments',
  settings: 'adm_settings',
}

const genId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

// ---------------- localStorage adapter ----------------
const LS_KEY = 'pra-admin-db-v1'
function lsRead() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function lsWrite(data) { localStorage.setItem(LS_KEY, JSON.stringify(data)) }

const localAdapter = {
  mode: 'local',
  async list(table) {
    const d = lsRead()
    return (d[table] || []).slice()
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
  async remove(table, id) {
    const d = lsRead()
    d[table] = (d[table] || []).filter((r) => r.id !== id)
    if (table === TABLES.invoices) d[TABLES.payments] = (d[TABLES.payments] || []).filter((p) => p.invoice_id !== id)
    lsWrite(d)
  },
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
  async list(table) {
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: true })
    throwIf(error)
    return data || []
  },
  async get(table, id) {
    const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
    throwIf(error)
    return data
  },
  async upsert(table, row) {
    const r = { ...row, id: row.id || genId(), updated_at: new Date().toISOString() }
    delete r.created_at
    const { data, error } = await supabase.from(table).upsert(r).select().single()
    throwIf(error)
    return data
  },
  async remove(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    throwIf(error)
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
export const db = {
  families: {
    list: () => A.list(TABLES.families),
    get: (id) => A.get(TABLES.families, id),
    save: (row) => A.upsert(TABLES.families, row),
    remove: (id) => A.remove(TABLES.families, id),
  },
  students: {
    list: () => A.list(TABLES.students),
    get: (id) => A.get(TABLES.students, id),
    save: (row) => A.upsert(TABLES.students, row),
    remove: (id) => A.remove(TABLES.students, id),
  },
  invoices: {
    list: () => A.list(TABLES.invoices),
    get: (id) => A.get(TABLES.invoices, id),
    save: (row) => A.upsert(TABLES.invoices, row),
    remove: (id) => A.remove(TABLES.invoices, id),
  },
  payments: {
    list: () => A.list(TABLES.payments),
    get: (id) => A.get(TABLES.payments, id),
    save: (row) => A.upsert(TABLES.payments, row),
    remove: (id) => A.remove(TABLES.payments, id),
  },
  async getFees() {
    const v = await A.getSetting('fees')
    return { ...DEFAULT_FEES, ...(v || {}) }
  },
  setFees: (v) => A.setSetting('fees', v),
  async getCalendar() {
    const v = await A.getSetting('calendar')
    return v || DEFAULT_CALENDAR
  },
  setCalendar: (v) => A.setSetting('calendar', v),

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
}
