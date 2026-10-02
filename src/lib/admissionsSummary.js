// Admissions on paper (pages/PrintAdmissions.jsx): families who asked about
// joining, tours and calls, and enrollment forms, for a month or the last twelve
// months. Leads keep no history of their stage, so "where they are now" is the
// stage today of the families who first got in touch in the period.

import { STAGES, SOURCES, isDue } from './leads'
import { dayKey, monthRange, isoOf } from './printFormat'

const ACTIVE = ['new', 'contacted', 'tour_booked', 'tour_done', 'trial']
const addMonths = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return isoOf(d).slice(0, 7) }
const formDay = (e) => dayKey(e.submitted_at || e.created_at)
const leadDay = (l) => dayKey(l.first_contact || l.created_at)

/** Months with an enquiry, a tour or a form, plus the last twelve, oldest first. */
export function admissionMonths({ leads, enrollments, today = isoOf(new Date()) }) {
  const now = today.slice(0, 7)
  const keys = new Set(Array.from({ length: 12 }, (_, i) => addMonths(now, -i)))
  leads.forEach((l) => { if (leadDay(l)) keys.add(leadDay(l).slice(0, 7)); if (l.tour_date) keys.add(dayKey(l.tour_date).slice(0, 7)) })
  enrollments.forEach((e) => formDay(e) && keys.add(formDay(e).slice(0, 7)))
  return [...keys].filter((k) => k <= now).sort()
}

/** `period`: a 'YYYY-MM' month, or '12m' for the twelve months up to this one. */
export function admissionsSummary({ leads, enrollments, period, today = isoOf(new Date()) }) {
  const rolling = period === '12m'
  const endMonth = rolling ? today.slice(0, 7) : period
  const range = rolling ? { from: `${addMonths(endMonth, -11)}-01`, to: monthRange(endMonth).to } : monthRange(period)
  const inRange = (d) => !!d && d >= range.from && d <= range.to
  const count = (list, key, ids) => Object.fromEntries(ids.map((id) => [id, list.filter((x) => (x[key] || '') === id).length]))

  const enquiries = leads.filter((l) => inRange(leadDay(l))).map((l) => ({ ...l, day: leadDay(l) })).sort((a, b) => a.day.localeCompare(b.day) || String(a.family).localeCompare(String(b.family)))
  const tours = leads.filter((l) => inRange(dayKey(l.tour_date))).map((l) => ({ ...l, day: dayKey(l.tour_date) })).sort((a, b) => a.day.localeCompare(b.day))
  const forms = enrollments.filter((e) => inRange(formDay(e))).map((e) => ({ ...e, day: formDay(e) })).sort((a, b) => a.day.localeCompare(b.day))
  const active = leads.filter((l) => !l.archived && ACTIVE.includes(l.stage))

  // Twelve months ending with the period's month: enquiries and forms in each.
  const monthly = Array.from({ length: 12 }, (_, i) => addMonths(endMonth, i - 11)).map((k) => {
    const r = monthRange(k)
    const within = (d) => !!d && d >= r.from && d <= r.to
    return { key: k, enquiries: leads.filter((l) => within(leadDay(l))).length, forms: enrollments.filter((e) => within(formDay(e))).length }
  })

  return {
    period, range, rolling,
    enquiries, children: enquiries.reduce((s, l) => s + (Number(l.kids) || 0), 0),
    tours, forms, formsAdded: forms.filter((e) => e.made_student).length,
    nowEnrolled: enquiries.filter((l) => l.stage === 'enrolled').length,
    stages: count(enquiries, 'stage', STAGES.map((s) => s.id)),
    sources: count(enquiries, 'source', SOURCES.map((s) => s.id)),
    active: active.length,
    // Only worth printing while the period is still running.
    due: range.to >= today ? leads.filter((l) => isDue(l, today)).sort((a, b) => String(a.follow_up).localeCompare(String(b.follow_up))) : null,
    monthly,
  }
}
