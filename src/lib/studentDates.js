// Expected end dates against the PRA calendar (To-Do #37). The quarters come from the
// calendar the app already keeps (db.getCalendar: the copy saved in Settings, or
// DEFAULT_CALENDAR in fees.js), the same one attendance and the invoices use.
//
// The end date only informs. Attendance stops expecting the student after it
// (attendanceSummary.js, pages/Attendance.jsx, Home), the invoice builder leaves them
// out of quarters that begin after it, and Home and Students show who finishes this
// quarter. Nothing here changes a student's status, an amount, a rate or a pro-rating.

import { endDateOf, isEnrolled } from './studentRecords'
import { shortDate, fullDate } from './printFormat'

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** The calendar's quarters that have both dates, in order. */
export const quartersOf = (calendar) => (calendar?.quarters || []).filter((q) => q.start && q.end)

/**
 * The quarter "this quarter" means on `today`: the one it falls in; between two
 * quarters, the one that has just ended; before the year, the first.
 */
export function currentQuarter(calendar, today = localToday()) {
  const qs = quartersOf(calendar)
  return qs.find((q) => q.start <= today && today <= q.end) || [...qs].reverse().find((q) => q.end < today) || qs[0] || null
}

/**
 * Enrolled students expected to finish by the end of this quarter, the earliest first.
 * Someone whose end date has already gone by stays on the list until the office sets
 * them to Past: the status never changes by itself.
 */
export function finishingThisQuarter(students, calendar, today = localToday()) {
  const q = currentQuarter(calendar, today)
  if (!q) return { quarter: null, students: [] }
  const list = students.filter((s) => isEnrolled(s) && endDateOf(s) && endDateOf(s) <= q.end)
    .sort((a, b) => endDateOf(a).localeCompare(endDateOf(b)) || (a.nickname || a.full_name || '').localeCompare(b.nickname || b.full_name || ''))
  return { quarter: q, students: list }
}

/** '8 Oct' / '8/10', with the year when it is not this year's. */
export const dayText = (iso, lang = 'en', today = localToday()) => (!iso ? '' : iso.slice(0, 4) === today.slice(0, 4) ? shortDate(iso, lang) : fullDate(iso, lang))

const PERIOD_QUARTERS = { year: ['q1', 'q2', 'q3', 'q4'], sem1: ['q1', 'q2'], sem2: ['q3', 'q4'], q1: ['q1'], q2: ['q2'], q3: ['q3'], q4: ['q4'] }

/**
 * The quarters an invoice is for, from the invoice builder's choices: the quarters
 * ticked when paying by quarter, otherwise the period's. None for a custom period
 * (weekly, trial day), which has no quarter to compare with.
 */
export function invoiceQuarters(inputs, calendar) {
  const ids = inputs?.plan === 'quarterly' ? (inputs.billQuarters?.length ? inputs.billQuarters : ['q1']) : PERIOD_QUARTERS[inputs?.periodId] || []
  return quartersOf(calendar).filter((q) => ids.includes(q.id))
}

/**
 * How a student's expected end date bears on an invoice for these quarters: null when
 * it does not (no end date, no quarters, or every quarter begins on or before it).
 * Otherwise `after` are the quarters that begin after it, `first` the earliest of them,
 * and `out` is true when that is all of them: the builder then leaves the student off
 * unless someone adds them by hand.
 */
export function endOnInvoice(s, quarters) {
  const end = endDateOf(s)
  if (!end || !quarters?.length) return null
  const after = quarters.filter((q) => q.start > end)
  if (!after.length) return null
  return { end, after, first: after[0], out: after.length === quarters.length }
}
