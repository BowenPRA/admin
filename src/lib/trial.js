// Trial students: Pending students booked to try some days in class.
//
// `trial_from` and `trial_to` are the first and last trial day ('YYYY-MM-DD'). On those
// days the register lists the student at the top of their year group (pages/Attendance.jsx),
// and Home shows them to the teachers of that class and to the office. Everything else
// treats them as Pending: no progress reports, not counted as enrolled, invoiced as usual.
// Setting them to Enrolled ends the trial; the dates stay as a record. Needs
// supabase/updates-2026-10-26-trial-students.sql (StudentModal only sends the dates once set).

import { isPending } from './studentRecords'
import { shortDate } from './printFormat'

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const parse = (s) => new Date(`${s}T00:00:00`)
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const weekend = (d) => d.getDay() === 0 || d.getDay() === 6

/** The trial's first and last day, or null when none is set. A last day before the first counts as a one-day trial. */
export function trialOf(s) {
  const from = String(s?.trial_from || '').slice(0, 10)
  const to = String(s?.trial_to || '').slice(0, 10)
  return from ? { from, to: to && to >= from ? to : from } : null
}
/** A Pending student with trial days. Enrolled and Past students are not, whatever dates they keep. */
export const isTrial = (s) => isPending(s) && !!trialOf(s)
/** On trial on this day: in class, so on the register. */
export const onTrial = (s, date) => { const tr = isTrial(s) ? trialOf(s) : null; return !!tr && tr.from <= date && date <= tr.to }

/** The day itself when it is a weekday, else the Monday after. */
export const nextSchoolDay = (date = localToday()) => { const d = parse(date); while (weekend(d)) d.setDate(d.getDate() + 1); return iso(d) }
/** The last day of `n` school days (weekdays) starting on `from`. */
export function addSchoolDays(from, n) {
  const d = parse(nextSchoolDay(from))
  for (let left = Math.max(1, n) - 1; left > 0;) { d.setDate(d.getDate() + 1); if (!weekend(d)) left-- }
  return iso(d)
}
/** Weekdays from `from` to `to`, both counted. */
export function schoolDays(from, to) {
  let n = 0
  for (const d = parse(from); iso(d) <= to; d.setDate(d.getDate() + 1)) if (!weekend(d)) n++
  return n
}
/** Which trial day `date` is: { n, of }, e.g. day 2 of 3. */
export const trialDay = (tr, date) => ({ n: schoolDays(tr.from, date), of: schoolDays(tr.from, tr.to) })

/** 'Tue 27 Oct' / 'T3, 27 thg 10'. */
export const trialDayLabel = (date, lang = 'en') => parse(date).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
/** 'Tue 27 Oct' or 'Tue 27 Oct – Thu 29 Oct'. */
export const trialLine = (tr, lang = 'en') => (tr.to === tr.from ? trialDayLabel(tr.from, lang) : `${trialDayLabel(tr.from, lang)} – ${trialDayLabel(tr.to, lang)}`)

/** '26–28 Oct', '30 Oct – 2 Nov' or '26/10 – 28/10': short enough for a tag on a list. */
export function trialShort(tr, lang = 'en') {
  if (tr.to === tr.from) return shortDate(tr.from, lang)
  if (lang !== 'vi' && tr.from.slice(0, 7) === tr.to.slice(0, 7)) return `${Number(tr.from.slice(8))}–${shortDate(tr.to, lang)}`
  return `${shortDate(tr.from, lang)} – ${shortDate(tr.to, lang)}`
}

/**
 * Trial students for Home, the first trial day first: `today` are in class today, `coming`
 * start later, and `ended` (only with `withEnded`) finished in the last two weeks and are
 * still Pending, waiting for the office to set them to Enrolled or Past.
 */
export function trialsFor(students, { groups = null, today = localToday(), withEnded = false } = {}) {
  const list = students.filter((s) => isTrial(s) && (!groups || groups.includes(s.level)))
    .map((s) => ({ s, tr: trialOf(s) }))
    .sort((a, b) => a.tr.from.localeCompare(b.tr.from) || (a.s.nickname || a.s.full_name || '').localeCompare(b.s.nickname || b.s.full_name || ''))
  const twoWeeksAgo = (() => { const d = parse(today); d.setDate(d.getDate() - 14); return iso(d) })()
  return {
    today: list.filter((x) => x.tr.from <= today && today <= x.tr.to),
    coming: list.filter((x) => x.tr.from > today),
    ended: withEnded ? list.filter((x) => x.tr.to < today && x.tr.to >= twoWeeksAgo) : [],
  }
}
