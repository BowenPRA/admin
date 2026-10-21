import { useEffect, useState } from 'react'
import { LEVELS } from './fees'
import { academicCalendar } from './newsletter/calendarFeed'
import { isEnrolled, partialFrom, afterEnd } from './studentRecords'
import { hasLogin } from '../data/staff'
import { tripOn, statusOn, TRAVEL } from './travel'

// ECAs, the after-class activities (supabase/updates-2026-10-21-ecas.sql). Each quarter is a
// term with its own dates and times; each term has activities (a day of the week, a teacher,
// the year groups it is open to), each with a list of students and a register per session.
// The register is kept apart from daily attendance: it never changes an attendance rate.

export const WEEKDAYS = [
  { n: 1, en: 'Monday', vi: 'Thứ Hai', short: 'Mon', shortVi: 'T2' },
  { n: 2, en: 'Tuesday', vi: 'Thứ Ba', short: 'Tue', shortVi: 'T3' },
  { n: 3, en: 'Wednesday', vi: 'Thứ Tư', short: 'Wed', shortVi: 'T4' },
  { n: 4, en: 'Thursday', vi: 'Thứ Năm', short: 'Thu', shortVi: 'T5' },
  { n: 5, en: 'Friday', vi: 'Thứ Sáu', short: 'Fri', shortVi: 'T6' },
]
export const weekdayName = (n, lang) => { const d = WEEKDAYS.find((w) => w.n === Number(n)); return d ? (lang === 'vi' ? d.vi : d.en) : '' }
export const weekdayShort = (n, lang) => { const d = WEEKDAYS.find((w) => w.n === Number(n)); return d ? (lang === 'vi' ? d.shortVi : d.short) : '' }
/** 'Mondays' / 'Thứ Hai hằng tuần'. */
export const weekdayEvery = (n, lang) => (lang === 'vi' ? `${weekdayName(n, lang)} hằng tuần` : `${weekdayName(n, lang)}s`)

// Each weekday keeps one colour everywhere on the ECA pages (the week board, the calendar,
// an activity's heading), so Monday's activities and Wednesday's are told apart at a glance.
// The colours are the Schedule's soft tones. Whole class names, so Tailwind finds them.
export const DAY_STYLE = {
  1: { soft: 'border-sky-200 bg-sky-50 text-sky-900', solid: 'bg-sky-600 text-white', dot: 'bg-sky-500', text: 'text-sky-700', hover: 'hover:border-sky-400' },
  2: { soft: 'border-violet-200 bg-violet-50 text-violet-900', solid: 'bg-violet-600 text-white', dot: 'bg-violet-500', text: 'text-violet-700', hover: 'hover:border-violet-400' },
  3: { soft: 'border-emerald-200 bg-emerald-50 text-emerald-900', solid: 'bg-emerald-600 text-white', dot: 'bg-emerald-500', text: 'text-emerald-700', hover: 'hover:border-emerald-400' },
  4: { soft: 'border-amber-200 bg-amber-50 text-amber-900', solid: 'bg-amber-500 text-white', dot: 'bg-amber-500', text: 'text-amber-700', hover: 'hover:border-amber-400' },
  5: { soft: 'border-rose-200 bg-rose-50 text-rose-900', solid: 'bg-rose-600 text-white', dot: 'bg-rose-500', text: 'text-rose-700', hover: 'hover:border-rose-400' },
}
export const dayStyle = (n) => DAY_STYLE[Number(n)] || { soft: 'border-slate-200 bg-slate-50 text-slate-800', solid: 'bg-slate-600 text-white', dot: 'bg-slate-400', text: 'text-slate-600', hover: 'hover:border-slate-400' }

export const blankTerm = (schoolYear, last) => ({
  name: '', school_year: schoolYear || '', from_date: '', to_date: '',
  start_time: last?.start_time || '15:30', end_time: last?.end_time || '16:15', note: last?.note || '',
})
export const blankActivity = (termId, weekday = 1) => ({ term_id: termId, name: '', name_vi: '', weekday, teacher_email: '', year_groups: [], room: '', description: '' })

const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }
export const todayLocal = () => localIso(new Date())

/** Terms, the newest first. */
export const sortTerms = (terms) => [...terms].sort((a, b) => String(b.from_date).localeCompare(String(a.from_date)))

/** The term running today; else the next one to start; else the last one that ran. */
export function currentTerm(terms, today = todayLocal()) {
  const list = sortTerms(terms)
  return list.find((x) => x.from_date <= today && today <= x.to_date)
    || [...list].reverse().find((x) => x.from_date > today)
    || list[0] || null
}

const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return localIso(d) }
const mondayOf = (iso) => { const d = parse(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return localIso(d) }
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5)
export const weekdayOf = (iso) => ((parse(iso).getDay() + 6) % 7) + 1 // 1 Monday ... 7 Sunday

/**
 * The term week by week, for the calendar: the weekdays that have an activity, and for each
 * week (Monday to Friday, week 1 holding the first day) each of those days with its date,
 * whether it is in the term, whether PRA is closed, and the activities that meet.
 */
export function termCalendar(term, activities, offDays) {
  if (!term?.from_date || !term?.to_date) return { days: [], weeks: [] }
  const days = [...new Set(activities.map((a) => Number(a.weekday)))].sort((a, b) => a - b)
  const weeks = []
  for (let monday = mondayOf(term.from_date), n = 1; monday <= term.to_date && n < 60; monday = addDays(monday, 7), n++) {
    weeks.push({
      n, monday, sunday: addDays(monday, 6),
      cells: days.map((w) => {
        const date = addDays(monday, w - 1)
        const inTerm = date >= term.from_date && date <= term.to_date
        const closed = inTerm && isOff(offDays, date)
        return { weekday: w, date, inTerm, closed, activities: inTerm && !closed ? activities.filter((a) => Number(a.weekday) === w) : [] }
      }),
    })
  }
  return { days, weeks }
}

/** The week of the term a date falls in: week 1 holds the first day, as on the term calendar. */
export const weekNumber = (term, date) => (term?.from_date && date ? Math.floor(daysBetween(mondayOf(term.from_date), date) / 7) + 1 : null)

/** Where a term stands today: before it ({ days } to go), during it ({ week, weeks }) or after it. */
export function termProgress(term, today = todayLocal()) {
  if (!term?.from_date || !term?.to_date) return null
  const weeks = Math.floor(daysBetween(mondayOf(term.from_date), term.to_date) / 7) + 1
  if (today < term.from_date) return { state: 'before', days: daysBetween(today, term.from_date), weeks }
  if (today > term.to_date) return { state: 'after', weeks }
  return { state: 'during', week: Math.floor(daysBetween(mondayOf(term.from_date), today) / 7) + 1, weeks }
}

/**
 * A session's register: 'taken' (everyone marked), 'partial', 'missing' (held, nobody marked),
 * 'today' (today, nothing yet) or 'future'. `marked` is how many marks it has, `size` the list.
 */
export function sessionState(date, marked, size, today = todayLocal()) {
  if (marked && marked >= size) return 'taken'
  if (marked) return 'partial'
  if (date === today) return 'today'
  return date < today ? 'missing' : 'future'
}

/** The off days on the academic calendar, as [{ iso, end }] (loaded once, from the website). */
export function useOffDays() {
  const [off, setOff] = useState(null)
  useEffect(() => {
    let alive = true
    academicCalendar().then((events) => alive && setOff(events.filter((e) => e.tag === 'off'))).catch(() => alive && setOff([]))
    return () => { alive = false }
  }, [])
  return off
}
const isOff = (offDays, day) => (offDays || []).some((e) => day >= e.iso && day <= (e.end || e.iso))

/** The days an activity meets in its term: its weekday, from the first to the last day, less the days PRA is closed. */
export function sessionDates(activity, term, offDays) {
  if (!activity || !term?.from_date || !term?.to_date) return []
  const want = Number(activity.weekday) % 7 // Sunday is 0 in JavaScript
  const out = []
  for (const d = parse(term.from_date), end = parse(term.to_date); d <= end; d.setDate(d.getDate() + 1)) {
    const day = localIso(d)
    if (d.getDay() === want && !isOff(offDays, day)) out.push(day)
  }
  return out
}

/** The session a register opens on: today's; else the last one held (so a missed register can be caught up); else the first. */
export function defaultSession(sessions, today = todayLocal()) {
  if (!sessions.length) return null
  if (sessions.includes(today)) return today
  return [...sessions].reverse().find((d) => d < today) || sessions[0]
}

/** The next session from today (today included), or null when the term is over. */
export const nextSession = (sessions, today = todayLocal()) => sessions.find((d) => d >= today) || null

/** The year groups as a short phrase: 'Kindergarten and up', 'Years 1 to 5', 'Year 7 and up', 'All year groups'. */
export function yearGroupsText(groups, lang) {
  const idx = (groups || []).map((g) => LEVELS.indexOf(g)).filter((i) => i >= 0).sort((a, b) => a - b)
  if (!idx.length) return lang === 'vi' ? 'Mọi lớp' : 'All year groups'
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  if (!contiguous) return idx.map((i) => LEVELS[i]).join(', ')
  const first = LEVELS[idx[0]]
  const last = LEVELS[idx[idx.length - 1]]
  if (idx.length === 1) return first
  if (idx[0] === 0 && idx[idx.length - 1] === LEVELS.length - 1) return lang === 'vi' ? 'Mọi lớp' : 'All year groups'
  if (idx[idx.length - 1] === LEVELS.length - 1) return lang === 'vi' ? `${first} trở lên` : `${first} and up`
  const yr = /^Year (\d+)$/
  if (yr.test(first) && yr.test(last)) return lang === 'vi' ? `Year ${first.match(yr)[1]}–${last.match(yr)[1]}` : `Years ${first.match(yr)[1]} to ${last.match(yr)[1]}`
  return lang === 'vi' ? `${first} đến ${last}` : `${first} to ${last}`
}

/** Year groups from one level to another (inclusive), for the activity form. */
export const levelsBetween = (from, to) => {
  const a = LEVELS.indexOf(from)
  const b = to ? LEVELS.indexOf(to) : LEVELS.length - 1
  return a < 0 || b < a ? [] : LEVELS.slice(a, b + 1)
}

/** '15:30' -> '3:30' (English) or '15:30' (Vietnamese). */
const clock = (hm, lang) => {
  const [h, m] = String(hm || '').split(':').map(Number)
  if (Number.isNaN(h)) return ''
  return lang === 'vi' ? `${h}:${String(m || 0).padStart(2, '0')}` : `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')}`
}
export const startText = (term, lang) => clock(term?.start_time, lang)
export const timeText = (term, lang) => {
  if (!term?.start_time) return ''
  const pm = Number(String(term.end_time || term.start_time).split(':')[0]) >= 12
  return `${clock(term.start_time, lang)}–${clock(term.end_time, lang)}${lang === 'vi' ? '' : pm ? ' pm' : ' am'}`
}

export const activityName = (a, lang) => (lang === 'vi' && a?.name_vi ? a.name_vi : a?.name || '')

/** 'Mr. Caleb' for an activity's teacher, from the Teachers page. */
export function teacherName(email, teachers) {
  const t = (teachers || []).find((x) => hasLogin(x) && String(x.email).toLowerCase() === String(email || '').toLowerCase())
  return t ? `${t.title ? `${t.title} ` : ''}${t.name}` : (email ? String(email).split('@')[0] : '')
}

export const sameEmail = (a, b) => !!a && String(a).toLowerCase() === String(b || '').toLowerCase()

/** The activities in a term, Monday first, then by name. */
export const activitiesOf = (eca, termId) => (eca?.activities || []).filter((a) => a.term_id === termId)
  .sort((a, b) => a.weekday - b.weekday || String(a.name).localeCompare(String(b.name)))

/** An activity's list: [{ m, s }] with the student record, by name. Students no longer on file are left out. */
export function membersOf(eca, activityId, students) {
  const byId = new Map(students.map((s) => [s.id, s]))
  return (eca?.members || []).filter((m) => m.activity_id === activityId && byId.has(m.student_id))
    .map((m) => ({ m, s: byId.get(m.student_id) }))
    .sort((a, b) => (a.m.status === b.m.status ? 0 : a.m.status === 'waiting' ? 1 : -1) || nameOf(a.s).localeCompare(nameOf(b.s)))
}
const nameOf = (s) => s.nickname || s.full_name || ''

/** Whether this person runs any activity in the current term (the menu shows ECAs to them). */
export function runsEca(eca, email) {
  const term = currentTerm(eca?.terms || [])
  return !!term && activitiesOf(eca, term.id).some((a) => sameEmail(a.teacher_email, email))
}

/**
 * What to flag about a student on (or joining) an activity's list, as keys for the i18n
 * strings: Nursery, a year group the activity is not open to, a half-day student (the
 * waiting list), another activity in the same term, no longer enrolled or past their end date.
 */
export function memberFlags(s, activity, { eca, day } = {}) {
  const out = []
  if (s.level === 'Nursery') out.push('ecaFlagNursery')
  else if (activity.year_groups?.length && !activity.year_groups.includes(s.level)) out.push('ecaFlagYears')
  if (partialFrom(s)) out.push('ecaFlagHalfDay')
  if (!isEnrolled(s) || (day && afterEnd(s, day))) out.push('ecaFlagLeft')
  const others = activitiesOf(eca, activity.term_id).filter((a) => a.id !== activity.id
    && (eca?.members || []).some((m) => m.activity_id === a.id && m.student_id === s.id))
  if (others.length) out.push('ecaFlagTwo')
  return out
}

/** The other activities a student is on in the same term (for the 'also on' line). */
export const otherActivities = (s, activity, eca) => activitiesOf(eca, activity.term_id)
  .filter((a) => a.id !== activity.id && (eca?.members || []).some((m) => m.activity_id === a.id && m.student_id === s.id))

/** Students who can be added: enrolled, not on the list yet, the activity's year groups first. */
export function candidates(students, activity, eca) {
  const on = new Set((eca?.members || []).filter((m) => m.activity_id === activity.id).map((m) => m.student_id))
  const open = students.filter((s) => isEnrolled(s) && !on.has(s.id))
  const fits = (s) => !activity.year_groups?.length || activity.year_groups.includes(s.level)
  const byLevel = (a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || nameOf(a).localeCompare(nameOf(b))
  return { fit: open.filter(fits).sort(byLevel), other: open.filter((s) => !fits(s)).sort(byLevel) }
}

/** Today's sessions for the Home page: [{ a, term }] for the given activities that meet today. */
export function sessionsToday(eca, offDays, today = todayLocal()) {
  const term = currentTerm(eca?.terms || [], today)
  if (!term || today < term.from_date || today > term.to_date || isOff(offDays, today)) return { term, list: [] }
  const dow = parse(today).getDay()
  return { term, list: activitiesOf(eca, term.id).filter((a) => Number(a.weekday) % 7 === dow) }
}

/**
 * Whether a student was away from PRA on a day: marked absent on that day's register, or on a
 * trip ('travel'). The ECA register counts them absent too unless the teacher marks them, but
 * nothing is written for it: the two registers stay apart, and an ECA mark always wins.
 * `daily` is { 'studentId|date': status } from the day's register.
 */
export function awayFromPra(daily, trips, studentId, date) {
  const status = daily?.[`${studentId}|${date}`]
  const st = statusOn(status ? { status } : null, tripOn(trips, studentId, date))
  return st === 'absent' || st === TRAVEL ? st : null
}
