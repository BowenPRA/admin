// Dates for the newsletter: which quarter and week an issue is, how a date reads
// in each language, and "Add to calendar" links. Pure functions (no browser),
// so the PDF and email builders can use them anywhere.

import { EDITIONS } from './constants.js'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DOW_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const DOW_VI_FULL = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MON_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** 'YYYY-MM-DD' as a UTC date, so no time zone moves the day. */
export const toDate = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)) }
export const isoOf = (dt) => dt.toISOString().slice(0, 10)
export const addDays = (iso, n) => isoOf(new Date(toDate(iso).getTime() + n * 864e5))
export const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))

/** Today in Hội An, 'YYYY-MM-DD'. */
export function todayHoiAn(now = new Date()) {
  return isoOf(new Date(now.getTime() + 7 * 3600e3))
}

/** The Friday on or after `iso`. */
export function fridayOf(iso) {
  const d = toDate(iso).getUTCDay()
  return addDays(iso, (5 - d + 7) % 7)
}

/** "Fri 9 Oct" / "T6, 9/10". */
export const enDay = (iso) => { const x = toDate(iso); return `${DOW[x.getUTCDay()]} ${x.getUTCDate()} ${MON[x.getUTCMonth()]}` }
export const viDay = (iso) => { const x = toDate(iso); return `${DOW_VI[x.getUTCDay()]}, ${x.getUTCDate()}/${x.getUTCMonth() + 1}` }

/** "Fri 9 to Wed 14 Oct", "Fri 18 Dec to Mon 4 Jan" / "T6, 9/10 đến T4, 14/10". */
export function dateRange(iso, end, lang) {
  if (lang === 'vi') return end && end !== iso ? `${viDay(iso)} đến ${viDay(end)}` : viDay(iso)
  if (!end || end === iso) return enDay(iso)
  const a = toDate(iso), b = toDate(end)
  if (a.getUTCMonth() === b.getUTCMonth()) return `${DOW[a.getUTCDay()]} ${a.getUTCDate()} to ${DOW[b.getUTCDay()]} ${b.getUTCDate()} ${MON[b.getUTCMonth()]}`
  return `${enDay(iso)} to ${enDay(end)}`
}

/** "Friday 9 October 2026" / "Thứ Sáu, ngày 9 tháng 10 năm 2026". */
export function longDay(iso, lang) {
  const x = toDate(iso)
  if (lang === 'vi') return `${DOW_VI_FULL[x.getUTCDay()]}, ngày ${x.getUTCDate()} tháng ${x.getUTCMonth() + 1} năm ${x.getUTCFullYear()}`
  return `${DOW_FULL[x.getUTCDay()]} ${x.getUTCDate()} ${MON_FULL[x.getUTCMonth()]} ${x.getUTCFullYear()}`
}

/** '15:30' -> '3:30 PM'. */
export function enTime(t) {
  if (!t) return ''
  let [h, m] = String(t).split(':').map(Number)
  const pm = h >= 12
  h = h % 12 || 12
  return `${h}:${String(m || 0).padStart(2, '0')} ${pm ? 'PM' : 'AM'}`
}
/** A time or a span: "3:30–4:15 PM" / "15:30–16:15". */
export function timeSpan(t1, t2, lang) {
  if (!t1) return ''
  if (lang === 'vi') return t2 ? `${t1}–${t2}` : t1
  const a = enTime(t1), b = enTime(t2)
  if (!b) return a
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`
}

/**
 * The quarter and week an issue's Friday falls in, from the calendar The Current
 * keeps (db.getCalendar: quarters with start and end). Week 1 is the week the
 * quarter starts in (counted from its Monday). Between quarters (a holiday), the
 * quarter that has just ended, counting on.
 */
export function quarterWeek(iso, calendar) {
  const qs = (calendar?.quarters || []).filter((q) => q.start).sort((a, b) => a.start.localeCompare(b.start))
  let q = qs[0]
  for (const x of qs) if (x.start <= iso) q = x
  if (!q) return { quarter: 1, week: 1 }
  const start = toDate(q.start)
  const monday = new Date(start.getTime() - ((start.getUTCDay() + 6) % 7) * 864e5)
  const week = Math.max(1, Math.floor((toDate(iso) - monday) / (7 * 864e5)) + 1)
  return { quarter: Number(String(q.id || '').replace(/\D/g, '')) || qs.indexOf(q) + 1, week }
}

/** '2026-2027' -> '2026-27'. */
export const yearShort = (schoolYear) => String(schoolYear || '').replace(/^(\d{4})-\d{2}(\d{2})$/, '$1-$2')

/** The issue's address on the website: '2026-27-q1-week-10' or '2026-27-q1-week-10-early-years'. */
// A special issue on another day than Friday gets its day in the address too, so it can sit beside that week's regular issue.
export const slugFor = ({ edition, school_year, quarter, week, issue_date }) => {
  const d = issue_date ? toDate(String(issue_date).slice(0, 10)) : null
  const day = d && d.getUTCDay() !== 5 ? `-${MON[d.getUTCMonth()].toLowerCase()}-${d.getUTCDate()}` : ''
  return `${yearShort(school_year)}-q${quarter}-week-${week}${day}${EDITIONS[edition]?.slugSuffix || ''}`
}

/** "Quarter 1 · Week 10" / "Quý 1 · Tuần 10". */
export const issueLabel = ({ quarter, week }, lang) => (lang === 'vi' ? `Quý ${quarter} · Tuần ${week}` : `Quarter ${quarter} · Week ${week}`)

/**
 * A Google Calendar link that opens "add this event" with the date filled in.
 * All-day events end the day after (Google's rule); timed ones are in Hội An time.
 */
export function calendarLink({ iso, end, t1, t2, title, details = '' }) {
  const ymd = (d) => d.replace(/-/g, '')
  let dates
  if (t1) {
    const hm = (t) => `${String(t).replace(':', '')}00`
    dates = `${ymd(iso)}T${hm(t1)}/${ymd(iso)}T${hm(t2 || t1)}`
  } else {
    dates = `${ymd(iso)}/${ymd(addDays(end || iso, 1))}`
  }
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates, ctz: 'Asia/Ho_Chi_Minh', location: 'Palm River Academy, Hội An' })
  if (details) q.set('details', details)
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}
