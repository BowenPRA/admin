// Reading the weekly timetable (src/data/schedule.js, or the edited copy in
// settings): times, who teaches what, and one teacher's own week.

import { DEFAULT_SCHEDULE, DAYS } from '../data/schedule.js'

const clone = (x) => JSON.parse(JSON.stringify(x))

/** Stored schedule, or the built-in one while nothing has been edited. */
export function normalizeSchedule(stored) {
  if (!stored || !Array.isArray(stored.classes) || !stored.classes.length) return clone(DEFAULT_SCHEDULE)
  return { ...clone(DEFAULT_SCHEDULE), ...stored, duties: Array.isArray(stored.duties) ? stored.duties : clone(DEFAULT_SCHEDULE.duties) }
}

/** "8:45–9:35" -> { start: 525, end: 575 } in minutes; afternoon times typed as "2:20" count as 14:20. */
export function parseTime(range) {
  const m = String(range || '').match(/(\d{1,2})[:.](\d{2})\s*[–—-]\s*(\d{1,2})[:.](\d{2})/)
  if (!m) return null
  const pm = (h) => (h < 7 ? h + 12 : h)
  const start = pm(Number(m[1])) * 60 + Number(m[2])
  let end = pm(Number(m[3])) * 60 + Number(m[4])
  if (end < start) end += 12 * 60
  return { start, end }
}

export const startOf = (range) => parseTime(range)?.start ?? 9999

/** Monday = 0 … Friday = 4, or -1 at the weekend. */
export const todayIndex = (d = new Date()) => (d.getDay() >= 1 && d.getDay() <= 5 ? d.getDay() - 1 : -1)
export const minutesNow = (d = new Date()) => d.getHours() * 60 + d.getMinutes()
export const isNow = (range, now = minutesNow()) => { const t = parseTime(range); return !!t && now >= t.start && now < t.end }

/** A row's cell for one day: { s, t, kind }. Whole-week rows give the same cell every day. */
export function cellOf(row, day) {
  if (row.days) return row.days[day] || { s: '', t: [] }
  return { s: row.all || '', t: row.t || [], kind: row.kind || 'routine' }
}

export const isLesson = (cell) => !!(cell?.s || '').trim() && !cell.kind

// "Ms. Thắm V" and a Teachers-page name "Thắm V" are the same person.
const bare = (name) => String(name || '').replace(/^(mr|ms|mrs|dr)\.?\s+/i, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').trim().toLowerCase()
export const sameTeacher = (a, b) => !!bare(a) && bare(a) === bare(b)

/** Everyone named anywhere in the schedule, in order of first appearance. */
export function teachersIn(schedule) {
  const seen = new Map()
  const add = (n) => { if (bare(n) && !seen.has(bare(n))) seen.set(bare(n), n) }
  for (const cls of schedule.classes || []) {
    add(cls.homeroom)
    for (const row of cls.rows || []) DAYS.forEach((_, d) => (cellOf(row, d).t || []).forEach(add))
  }
  for (const duty of schedule.duties || []) (duty.who || []).forEach((list) => (list || []).forEach(add))
  return [...seen.values()].sort((a, b) => bare(a).localeCompare(bare(b)))
}

/** The class a year group follows ("Year 3" -> the Year 2–3 class). */
export const classForYearGroup = (schedule, yg) => (schedule.classes || []).find((c) => (c.yearGroups || []).includes(yg)) || null

/**
 * One teacher's week: rows of { time, days: [[{ s, classes: [names], kind }]] }
 * sorted by start time. A lesson shared by several classes (Years 2 to 5 in
 * the afternoon) appears once, with every class listed.
 */
export function teacherWeek(schedule, name) {
  const rows = new Map()
  const rowFor = (time) => {
    if (!rows.has(time)) rows.set(time, { time, days: DAYS.map(() => []) })
    return rows.get(time)
  }
  for (const cls of schedule.classes || []) {
    for (const row of cls.rows || []) {
      DAYS.forEach((_, d) => {
        const cell = cellOf(row, d)
        if (!(cell.t || []).some((t) => sameTeacher(t, name))) return
        if (cell.kind && cell.kind !== 'homeroom') return
        const list = rowFor(row.time).days[d]
        const same = list.find((x) => x.s === cell.s && !x.duty)
        if (same) same.classes.push(cls.name)
        else list.push({ s: cell.s, classes: [cls.name], kind: cell.kind })
      })
    }
  }
  for (const duty of schedule.duties || []) {
    DAYS.forEach((_, d) => {
      if ((duty.who?.[d] || []).some((t) => sameTeacher(t, name))) rowFor(duty.time).days[d].push({ s: `Duty: ${duty.area}`, classes: [], duty: true })
    })
  }
  return [...rows.values()].sort((a, b) => startOf(a.time) - startOf(b.time))
}

/** What one teacher has on one day, in time order: [{ time, s, classes, duty, kind }]. */
export function teacherDay(schedule, name, day) {
  if (day < 0) return []
  return teacherWeek(schedule, name).flatMap((row) => row.days[day].map((x) => ({ time: row.time, ...x })))
}

// A soft colour per subject, the same everywhere it appears.
const TONES = [
  'bg-sky-50 text-sky-900 border-sky-200', 'bg-indigo-50 text-indigo-900 border-indigo-200', 'bg-emerald-50 text-emerald-900 border-emerald-200',
  'bg-amber-50 text-amber-900 border-amber-200', 'bg-rose-50 text-rose-900 border-rose-200', 'bg-violet-50 text-violet-900 border-violet-200',
  'bg-teal-50 text-teal-900 border-teal-200', 'bg-orange-50 text-orange-900 border-orange-200', 'bg-fuchsia-50 text-fuchsia-900 border-fuchsia-200',
  'bg-lime-50 text-lime-900 border-lime-200', 'bg-cyan-50 text-cyan-900 border-cyan-200',
]
const FIXED = [[/english|literacy|phonic|book/i, 0], [/math/i, 1], [/science|world/i, 2], [/review|study/i, 3], [/well/i, 4], [/art|craft/i, 5], [/techn|maker/i, 6], [/cook/i, 7], [/movement|pe\b|dance|play/i, 9], [/duty/i, 8]]
export function subjectTone(subject) {
  const s = String(subject || '')
  const fixed = FIXED.find(([re]) => re.test(s))
  if (fixed) return TONES[fixed[1]]
  return TONES[[...s.toLowerCase()].reduce((a, ch) => a + ch.charCodeAt(0), 0) % TONES.length]
}

export const KIND_TONE = {
  routine: 'bg-slate-50 text-slate-500', homeroom: 'bg-slate-100 text-slate-600', break: 'bg-amber-50/60 text-amber-800', lunch: 'bg-green-50/70 text-green-800',
}
