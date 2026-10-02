// Fees on paper (pages/PrintFees.jsx): money received, invoiced and still owed,
// for a month or the academic year.
//
// Draft and void invoices are left out everywhere: a draft has not gone to the
// family, a void one is not owed. What was owed is worked out "as of" a day
// (the month's last day, or today while the month is still running), from the
// payments' own dates, so a printout of a past month still shows what was owed
// then. An invoice's `paid` that is more than its recorded payments (paid
// before payments were recorded one by one) counts as paid from the start.

import { dayKey, monthRange, isoOf } from './printFormat'

const live = (i) => i.status !== 'draft' && i.status !== 'void'
const issuedOn = (i) => dayKey(i.issue_date || i.created_at)
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000)
export const AGE_BANDS = ['notDue', 'd1_30', 'd31_60', 'd61']
const bandOf = (late) => (late <= 0 ? 'notDue' : late <= 30 ? 'd1_30' : late <= 60 ? 'd31_60' : 'd61')

/**
 * The months to offer: every month with an invoice or a payment for this
 * academic year, and every month of the calendar, in order.
 */
export function feeMonths({ invoices, payments, calendar, schoolYear }) {
  const mine = new Set(invoices.filter((i) => i.school_year === schoolYear).map((i) => i.id))
  const keys = new Set((calendar?.months || []).map((m) => m.key))
  invoices.filter((i) => mine.has(i.id) && live(i)).forEach((i) => issuedOn(i) && keys.add(issuedOn(i).slice(0, 7)))
  payments.filter((p) => mine.has(p.invoice_id) && p.paid_on).forEach((p) => keys.add(dayKey(p.paid_on).slice(0, 7)))
  return [...keys].filter(Boolean).sort()
}

/**
 * `period`: a 'YYYY-MM' month, or 'year' for the whole academic year.
 * Returns the totals, the lists and the month-by-month figures for the chart.
 */
export function feesSummary({ invoices, payments, families = [], period, schoolYear, months, today = isoOf(new Date()) }) {
  const year = period === 'year'
  const range = year ? null : monthRange(period)
  const asOf = year ? today : (range.to < today ? range.to : today)
  const inRange = (d) => !!d && (year || (d >= range.from && d <= range.to))
  const famName = (i) => i.family_name || families.find((f) => f.id === i.family_id)?.name || ''
  const thisYear = (i) => i.school_year === schoolYear

  const byId = Object.fromEntries(invoices.map((i) => [i.id, i]))
  const paysOf = {}
  payments.forEach((p) => { (paysOf[p.invoice_id] ||= []).push(p) })
  const recorded = (i) => (paysOf[i.id] || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const earlier = (i) => Math.max(0, (Number(i.paid) || 0) - recorded(i))

  // Money that came in. For the year: every payment on this year's invoices.
  const received = payments
    .filter((p) => byId[p.invoice_id] && byId[p.invoice_id].status !== 'void' && (year ? thisYear(byId[p.invoice_id]) : inRange(dayKey(p.paid_on))))
    .map((p) => ({ ...p, day: dayKey(p.paid_on), inv: byId[p.invoice_id], family: famName(byId[p.invoice_id]) }))
    .sort((a, b) => a.day.localeCompare(b.day) || String(a.receipt_number || '').localeCompare(String(b.receipt_number || '')))
  const receivedTotal = received.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const byMethod = {}
  received.forEach((p) => { const m = p.method || 'transfer'; byMethod[m] = (byMethod[m] || 0) + (Number(p.amount) || 0) })

  // Invoices that went out.
  const issued = invoices
    .filter((i) => live(i) && (year ? thisYear(i) : inRange(issuedOn(i))))
    .map((i) => ({ ...i, day: issuedOn(i), family: famName(i) }))
    .sort((a, b) => a.day.localeCompare(b.day) || String(a.number || '').localeCompare(String(b.number || '')))
  const issuedTotal = issued.reduce((s, i) => s + (Number(i.total) || 0), 0)

  // What was still owed on `asOf`, oldest debt first.
  const owed = invoices
    .filter((i) => live(i) && issuedOn(i) && issuedOn(i) <= asOf)
    .map((i) => {
      const paid = earlier(i) + (paysOf[i.id] || []).filter((p) => p.paid_on && dayKey(p.paid_on) <= asOf).reduce((s, p) => s + (Number(p.amount) || 0), 0)
      const balance = (Number(i.total) || 0) - paid
      const due = dayKey(i.due_date)
      const late = due && due < asOf ? daysBetween(due, asOf) : 0
      return { ...i, family: famName(i), paidAsOf: paid, balance, due, late, band: bandOf(late) }
    })
    .filter((x) => x.balance > 0)
    .sort((a, b) => b.late - a.late || String(a.due || '9999').localeCompare(String(b.due || '9999')) || b.balance - a.balance)
  const owedTotal = owed.reduce((s, x) => s + x.balance, 0)
  const bands = Object.fromEntries(AGE_BANDS.map((k) => [k, { amount: 0, count: 0 }]))
  owed.forEach((x) => { bands[x.band].amount += x.balance; bands[x.band].count += 1 })
  const overdue = owed.filter((x) => x.late > 0)

  // The academic year so far: invoiced on or before `asOf`, and how much of it is in.
  const yearInvoices = invoices.filter((i) => live(i) && thisYear(i) && issuedOn(i) && issuedOn(i) <= asOf)
  const yearInvoiced = yearInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0)
  const yearPaid = yearInvoices.reduce((s, i) => s + earlier(i) + (paysOf[i.id] || []).filter((p) => p.paid_on && dayKey(p.paid_on) <= asOf).reduce((n, p) => n + (Number(p.amount) || 0), 0), 0)

  // Month by month, for the chart: invoiced and received in each month.
  const monthly = (months || []).map((k) => {
    const r = monthRange(k)
    const within = (d) => !!d && d >= r.from && d <= r.to
    return {
      key: k,
      invoiced: invoices.filter((i) => live(i) && thisYear(i) && within(issuedOn(i))).reduce((s, i) => s + (Number(i.total) || 0), 0),
      received: payments.filter((p) => byId[p.invoice_id] && byId[p.invoice_id].status !== 'void' && thisYear(byId[p.invoice_id]) && within(dayKey(p.paid_on))).reduce((s, p) => s + (Number(p.amount) || 0), 0),
    }
  })

  return {
    period, asOf, range,
    received, receivedTotal, byMethod,
    issued, issuedTotal,
    owed, owedTotal, bands, overdue, overdueTotal: overdue.reduce((s, x) => s + x.balance, 0),
    owedFamilies: new Set(owed.map((x) => x.family_id || x.family)).size,
    yearInvoiced, yearPaid, collectedPct: yearInvoiced ? Math.round((yearPaid / yearInvoiced) * 100) : null,
    monthly,
  }
}
