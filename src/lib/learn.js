// PRA Learn (learn.pra.edu.vn), the students' site, as seen from The Current: student
// logins for a class and the results of a lesson request. PRA Learn lives in this same
// Supabase project (learn_* tables beside the adm_* ones). Designed in
// C:/Users/sbowe/learn/docs/DESIGN.md; the database part is learn/supabase/learn-schema.sql
// and logins are made by the learn-accounts Edge Function (learn/supabase/functions/learn-accounts).
//
// Who may do what is decided in the database and the function (learn_can_manage_class,
// learn_can_manage_student): office, head teachers and the class's teachers. The checks
// here (canManageClass, canManageStudent) only decide what to show.
//
// Offline (`--mode offline`) every call is answered by learnOffline.js with made-up data.

import { supabase, hasSupabase } from './supabaseClient.js'
import { splitSubjectKey } from '../data/staff'
import { statusOf } from './studentRecords'

export const LEARN_SITE = 'https://learn.pra.edu.vn'
export const LEARN_HOST = 'learn.pra.edu.vn'
const FN = 'learn-accounts'

/** The class page on PRA Learn: who has done what, and the login buttons there. */
export const classLink = (classKey) => `${LEARN_SITE}/#/t/${encodeURIComponent(classKey)}`

const offline = () => import('./learnOffline.js')

// ---- who may manage logins (display only; the database decides) ----

const myClassKeys = (me) => (me?.subjects || []).filter((k) => String(k).includes(':'))
const isManager = (me) => ['super_admin', 'head', 'admin'].includes(me?.access) || !!me?.reportHead

/** Office, head teachers, and teachers of that class. */
export const canManageClass = (me, classKey) => isManager(me) || myClassKeys(me).includes(classKey)

/** Office, head teachers, and teachers of a class in the student's year group. */
export const canManageStudent = (me, student) => isManager(me) || (!!student?.level && myClassKeys(me).some((k) => splitSubjectKey(k)[1] === student.level))

/** A class to make one student's login through: one of mine in their year group, else any class of that year group. */
export function classForStudent(me, student, allClassKeys = []) {
  const yg = student?.level
  if (!yg) return ''
  const mine = myClassKeys(me).find((k) => splitSubjectKey(k)[1] === yg)
  if (mine) return mine
  if (!isManager(me)) return ''
  return allClassKeys.find((k) => splitSubjectKey(k)[1] === yg) || `english:${yg}`
}

/** Whether a student can have a login: enrolled or Pending (trial students too), not Past. */
export const canHaveLogin = (student) => statusOf(student) !== 'inactive'

// ---- errors in words the office can act on ----

const SCHEMA_HINT = 'PRA Learn is not set up in the database yet (C:/Users/sbowe/learn/supabase/learn-schema.sql has not been run).'
const FUNCTION_HINT = 'Making logins is not set up yet: the learn-accounts function has not been deployed (C:/Users/sbowe/learn/supabase/functions/learn-accounts/README.md).'

/** True when the error only means PRA Learn's database part is not there yet. */
export const notSetUp = (e) => /learn_|schema cache|PGRST202|PGRST205/i.test(e?.message || '') && /does not exist|could not find|schema cache|not found/i.test(e?.message || '')

export function learnError(e) {
  const msg = e?.message || String(e)
  return notSetUp(e) ? SCHEMA_HINT : msg
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}

async function callFunction(body) {
  const { data, error } = await supabase.functions.invoke(FN, { body })
  if (!error) return data
  let msg = error.message
  try {
    const j = await error.context?.json()
    if (j?.error) msg = j.error
    else if (error.context?.status === 404) msg = FUNCTION_HINT
  } catch { if (error.name === 'FunctionsFetchError' || error.context?.status === 404) msg = FUNCTION_HINT }
  throw new Error(msg)
}

// ---- logins ----

/**
 * A class's students with their login: [{ id, name, full_name, username, login: 'none'|'on'|'off', last_seen }].
 * From learn_class_overview, which also says which students count as the class (their year group,
 * Pending included, plus anyone given the class as an extra one).
 */
export async function classLogins(classKey) {
  if (!hasSupabase) return (await offline()).offlineClassLogins(classKey)
  const data = await rpc('learn_class_overview', { p_class: classKey })
  return data?.students || []
}

/** One student's login, or null: { username, active, created_at, created_by, pin_set_at, pin_set_by }. */
export async function studentLogin(studentId) {
  if (!hasSupabase) return (await offline()).offlineStudentLogin(studentId)
  const { data, error } = await supabase.from('learn_accounts')
    .select('username, active, created_at, created_by, pin_set_at, pin_set_by').eq('student_id', studentId).maybeSingle()
  if (error) throw error
  return data || null
}

/**
 * Makes logins for the class's students who have none (or only `studentIds`).
 * Returns { made: [{ student_id, name, username, pin }], failed: [{ student_id, name, reason }] }.
 * The PINs are in this answer only: print the cards from it.
 */
export async function makeLogins(classKey, studentIds = null) {
  const body = { action: 'make', class_key: classKey, ...(studentIds ? { student_ids: studentIds } : {}) }
  if (!hasSupabase) return (await offline()).offlineAccounts(body)
  return callFunction(body)
}

/** A new PIN, same username: { student_id, username, pin }. The PIN is in this answer only. */
export async function resetPin(studentId) {
  const body = { action: 'reset', student_id: studentId }
  if (!hasSupabase) return (await offline()).offlineAccounts(body)
  return callFunction(body)
}

/**
 * New PIN and Disable also sign the student out of devices already signed in. When that
 * step failed the function answers signed_out: false; this is the line to show then, or ''.
 */
export function signOutWarning(res, action, L) {
  if (res?.signed_out !== false) return ''
  return action === 'reset'
    ? L('New PIN set, but a device that was already signed in may keep working for up to an hour.', 'Đã cấp mã PIN mới, nhưng thiết bị đang đăng nhập có thể vẫn dùng được thêm tối đa một giờ.')
    : L('Login disabled, but a device that was already signed in may keep working for up to an hour.', 'Đã khóa tài khoản, nhưng thiết bị đang đăng nhập có thể vẫn dùng được thêm tối đa một giờ.')
}

/** Blocks (false) or unblocks (true) a login: { student_id, active }. */
export async function setLoginActive(studentId, active) {
  const body = { action: active ? 'enable' : 'disable', student_id: studentId }
  if (!hasSupabase) return (await offline()).offlineAccounts(body)
  return callFunction(body)
}

// ---- results on a lesson request ----

/** Whether a request has anything on PRA Learn to show results for. */
export const hasLearnParts = (x) => ['review', 'practice'].some((k) => String(x?.outputs?.[k] || '').includes(LEARN_HOST))

// Pack text uses the classroom markup ({{given}}, [[find]], <<found>>, **bold**, $maths$); a label needs plain words.
const plain = (s) => String(s || '').replace(/\{\{|\}\}|\[\[|\]\]|<<|>>|\*\*|\*|\$/g, '').replace(/\s+/g, ' ').trim()

/** Labels for a pack's checks and practice items: { '<part>:<id>': { en, vi } }. */
export function itemLabels(content) {
  const out = {}
  for (const p of content?.parts || []) {
    if (p.kind === 'review') {
      (p.slides || []).forEach((s) => { if (s.check?.id) out[`${p.id}:${s.check.id}`] = { en: plain(s.check.q), vi: plain(s.check.qVn) } })
    } else if (p.kind === 'practice') {
      (p.set?.items || []).forEach((it) => { if (it.id) out[`${p.id}:${it.id}`] = { en: plain(it.prompt), vi: plain(it.promptVn) } })
    }
  }
  return out
}

/**
 * The results for a request: { packs: [{ id, slug, title, class_key, status, due_on, links,
 * students, logins, parts: [{ id, kind, total, started, finished, avg_first_score }],
 * misses: [{ part, id, asked, wrong_first, slips, label? }] }] }.
 * From learn_request_results, which returns only the packs the signed-in person may see.
 * The misses get the question's words from the pack itself (also limited to who may see it).
 */
export async function requestResults(requestId) {
  if (!hasSupabase) return (await offline()).offlineRequestResults(requestId)
  const data = await rpc('learn_request_results', { p_request: requestId })
  const packs = data?.packs || []
  if (packs.some((p) => p.misses?.length)) {
    const { data: rows, error } = await supabase.from('learn_packs').select('id, content').in('id', packs.map((p) => p.id))
    if (!error) {
      for (const p of packs) {
        const labels = itemLabels(rows?.find((r) => r.id === p.id)?.content)
        p.misses = (p.misses || []).map((m) => ({ ...m, label: labels[`${m.part}:${m.id}`] || null }))
      }
    }
  }
  return { ...data, packs }
}

// ---- login cards ----

/**
 * Cards per A4 sheet and their size, by how many there are: bigger cards for a small class.
 * The printable area is 190 x 277 mm (index.css: @page A4, 10 mm margins).
 */
export function cardLayout(n) {
  const opts = [
    { max: 8, cols: 2, rows: 4, scale: 1.25 },
    { max: 10, cols: 2, rows: 5, scale: 1.12 },
    { max: 12, cols: 2, rows: 6, scale: 1 },
    { max: 18, cols: 3, rows: 6, scale: 0.86 },
    { max: 24, cols: 3, rows: 8, scale: 0.74 },
  ]
  const o = opts.find((x) => n <= x.max) || opts[opts.length - 1]
  return { ...o, perSheet: o.cols * o.rows, sheets: Math.max(1, Math.ceil(n / (o.cols * o.rows))), w: 190 / o.cols, h: 277 / o.rows }
}
