// Offline preview only (`npm run dev -- --mode offline`): made-up answers for everything
// learn.js asks PRA Learn, so the student logins and the results on a lesson request can be
// tried without the database or the learn-accounts function. learn.js imports this file only
// when there is no Supabase. Logins made here live in this browser's localStorage
// ('pra-admin-learn-offline'); delete that key to start again. No real names: a class with no
// students in the offline database gets twelve made-up learners.
//
// It follows the function's rules where they matter for trying the page (make skips students
// who have a login, at most 60 at once; reset needs a login; PINs are never easy), but it does
// not check who is asking: the page's own buttons do that offline.

import { db } from './db'
import { splitSubjectKey } from '../data/staff'
import { statusOf } from './studentRecords'
import { hasLearnParts } from './learn'

const KEY = 'pra-admin-learn-offline'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
const write = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* ignore */ } }
const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms))

const WORDS = ['otter', 'mango', 'rocket', 'panda', 'comet', 'kite', 'lemon', 'gecko', 'island', 'robin', 'lantern', 'turtle', 'cloud', 'melon', 'violin', 'anchor', 'koala', 'pepper', 'planet', 'shell']
const DIGITS = '23456789'
const pick = (s) => s[Math.floor(Math.random() * s.length)]
function easyPin(pin) {
  const d = [...pin].map(Number)
  if (d.every((x) => x === d[0])) return true
  if (d.every((x, i) => i === 0 || x === (d[i - 1] + 1) % 10) || d.every((x, i) => i === 0 || x === (d[i - 1] + 9) % 10)) return true
  return d[0] === d[2] && d[1] === d[3]
}
function makePin() { for (;;) { const p = Array.from({ length: 4 }, () => String(Math.floor(Math.random() * 10))).join(''); if (!easyPin(p)) return p } }
function makeUsername(taken) { for (;;) { const u = pick(WORDS) + pick(DIGITS) + pick(DIGITS); if (!taken.has(u)) return u } }

// Twelve made-up learners for a class with nobody in the offline database (fixed ids, so logins stick).
const MADE_UP = 'ABCDEFGHIJKL'.split('').map((c, i) => ({ id: `1ea70000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, name: `Learner ${c}`, full_name: `Learner ${c}` }))

async function classStudents(classKey) {
  const yg = splitSubjectKey(classKey)[1]
  const all = await db.students.list().catch(() => [])
  const mine = all.filter((s) => s.level === yg && statusOf(s) !== 'inactive')
    .map((s) => ({ id: s.id, name: (s.nickname || '').trim() || (s.first_name || '').trim() || s.full_name, full_name: s.full_name }))
    .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)))
  return mine.length ? mine : MADE_UP
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

export async function offlineClassLogins(classKey) {
  await wait(250)
  const { accounts = {} } = read()
  return (await classStudents(classKey)).map((s) => {
    const a = accounts[s.id]
    return { ...s, username: a?.username || null, login: !a ? 'none' : a.active ? 'on' : 'off', last_seen: a && hash(s.id) % 3 ? daysAgo(hash(s.id) % 6) : null }
  })
}

export async function offlineStudentLogin(studentId) {
  await wait(150)
  const a = read().accounts?.[studentId]
  return a ? { username: a.username, active: a.active, created_at: a.created_at, created_by: a.created_by, pin_set_at: a.pin_set_at, pin_set_by: a.pin_set_by } : null
}

/** The learn-accounts function, offline. */
export async function offlineAccounts(body) {
  await wait()
  const d = read()
  const accounts = d.accounts || {}
  const now = new Date().toISOString()
  const by = 'Offline'
  if (body.action === 'make') {
    if (!/^[a-z_]+:[A-Za-z0-9 ]+$/.test(body.class_key || '')) throw new Error('Say which class: class_key like "math:Year 5".')
    let students = (await classStudents(body.class_key)).filter((s) => !accounts[s.id])
    if (body.student_ids) {
      // One student made from the student window may be outside the made-up list: take them from the database.
      const all = await db.students.list().catch(() => [])
      const known = new Set(students.map((s) => s.id))
      const extra = all.filter((s) => body.student_ids.includes(s.id) && !known.has(s.id) && !accounts[s.id])
        .map((s) => ({ id: s.id, name: (s.nickname || '').trim() || (s.first_name || '').trim() || s.full_name }))
      students = [...students, ...extra].filter((s) => body.student_ids.includes(s.id))
    }
    if (students.length > 60) throw new Error('At most 60 logins at a time; pick some students.')
    const taken = new Set(Object.values(accounts).map((a) => a.username))
    const made = students.map((s) => {
      const username = makeUsername(taken)
      taken.add(username)
      accounts[s.id] = { username, active: true, created_at: now, created_by: by, pin_set_at: now, pin_set_by: by }
      return { student_id: s.id, name: s.name, username, pin: makePin() }
    })
    write({ ...d, accounts })
    return { made, failed: [] }
  }
  const a = accounts[body.student_id]
  if (!a) throw new Error('This student has no login yet. Make one first.')
  // Signing the student out of other devices "fails" on every second New PIN or Disable, so the warning can be seen.
  const signOut = () => {
    const n = (d.signOuts || 0) + 1
    return { n, out: n % 2 === 0 ? { signed_out: false, sessions_ended: 0, warning: 'Offline test: devices already signed in were not signed out.' } : { signed_out: true, sessions_ended: 1 } }
  }
  if (body.action === 'reset') {
    const so = signOut()
    accounts[body.student_id] = { ...a, pin_set_at: now, pin_set_by: by }
    write({ ...d, accounts, signOuts: so.n })
    return { student_id: body.student_id, username: a.username, pin: makePin(), ...so.out }
  }
  if (body.action === 'disable') {
    const so = signOut()
    accounts[body.student_id] = { ...a, active: false }
    write({ ...d, accounts, signOuts: so.n })
    return { student_id: body.student_id, active: false, ...so.out }
  }
  if (body.action === 'enable') {
    accounts[body.student_id] = { ...a, active: true }
    write({ ...d, accounts })
    return { student_id: body.student_id, active: true }
  }
  throw new Error('Unknown action. Use make, reset, disable or enable.')
}

// Made-up questions for the "most missed" list, by subject.
const MISSES = {
  math: [
    ['review', 'c3', 'The temperature is -2 °C. It rises 5 degrees. What is it now?', 'Nhiệt độ là -2 °C, rồi tăng 5 độ. Bây giờ là bao nhiêu độ?'],
    ['practice', 'p07', 'Work out 3 - (-4).', 'Tính 3 - (-4).'],
    ['practice', 'p11', 'A diver is 6 m below the surface and goes down 3 m more. Where is she now?', 'Một thợ lặn ở dưới mặt nước 6 m và lặn thêm 3 m. Bây giờ cô ấy ở đâu?'],
    ['review', 'c6', 'Which is colder, -7 °C or -3 °C?', 'Nhiệt độ nào lạnh hơn, -7 °C hay -3 °C?'],
  ],
  science: [
    ['review', 'c2', 'What does sound need to travel through?', 'Âm thanh cần gì để truyền đi?'],
    ['practice', 'p04', 'Why is the string telephone louder when the string is tight?', 'Vì sao điện thoại dây nghe to hơn khi dây căng?'],
    ['review', 'c5', 'Does sound travel faster in air or in water?', 'Âm thanh truyền nhanh hơn trong không khí hay trong nước?'],
  ],
  english: [
    ['review', 'c1', 'Which sentence is the claim?', 'Câu nào là luận điểm?'],
    ['practice', 'p03', 'Add a reason to this claim.', 'Thêm một lý do cho luận điểm này.'],
  ],
}

/** learn_request_results, offline: one pack for a request whose links point at PRA Learn. */
export async function offlineRequestResults(requestId) {
  await wait(300)
  const x = await db.lessons.list().then((rows) => rows.find((r) => r.id === requestId)).catch(() => null)
  if (!x || !hasLearnParts(x)) return { request_id: requestId, packs: [] }
  const [subject] = splitSubjectKey(x.class_key)
  const roster = await classStudents(x.class_key)
  const { accounts = {} } = read()
  const students = roster.length
  const logins = roster.filter((s) => accounts[s.id]?.active).length || Math.max(0, students - 1)
  const h = hash(requestId)
  // A request the teacher approved has a pack open to the class; one still being checked is a draft.
  const published = ['done', 'changes'].includes(x.status)
  const kinds = ['review', 'practice'].filter((k) => String(x.outputs?.[k] || '').includes('learn.pra.edu.vn'))
  // Most of the class has done the review; fewer have finished the practice (it is the homework).
  const parts = kinds.map((k, i) => {
    const total = k === 'review' ? 8 : 12
    const started = published ? Math.max(1, Math.min(logins, students) - ((h >>> (i * 3)) % 2) - i) : 0
    const finished = published ? Math.max(0, started - 1 - ((h >>> (i * 5)) % 2) - i) : 0
    return { id: k, kind: k, total, started, finished, avg_first_score: finished ? Number((0.58 + ((h >>> (i * 7)) % 25) / 100).toFixed(2)) : null }
  })
  const misses = published
    ? (MISSES[subject] || MISSES.english).filter(([part]) => kinds.includes(part)).map(([part, id, en, vi], i) => {
      const asked = parts.find((p) => p.id === part)?.started || 1
      return { part, id, asked, wrong_first: Math.max(1, Math.round(asked * (0.55 - i * 0.12))), slips: {}, label: { en, vi } }
    })
    : []
  const slug = `${subject.replace(/_/g, '-')}-${String(x.class_key.split(':')[1] || '').toLowerCase().replace(/\s+/g, '')}-request-${x.number || 0}`
  return {
    request_id: requestId,
    packs: [{
      id: `1ea7aaaa-0000-4000-8000-${String(x.number || 0).padStart(12, '0')}`, slug, title: x.source?.topic || `Request ${x.number}`, class_key: x.class_key,
      status: published ? 'published' : 'draft', due_on: x.details?.homework_due || null, version: 1,
      links: { pack: `https://learn.pra.edu.vn/#/p/${slug}`, review: `https://learn.pra.edu.vn/#/p/${slug}/review`, practice: `https://learn.pra.edu.vn/#/p/${slug}/practice` },
      students, logins, parts, misses,
    }],
  }
}
