// The new-student checklist (To-Do #38). Each new student has one: every pending
// student, and an enrolled one whose checklist was started and is not yet closed.
// Each line is either worked out from the records (student ID, year group, start date,
// family, parent email, Leads, the admission-fee box, a first invoice, an enrollment
// form) or ticked by a person (supply check, mailing lists, the no-photo list). A tick
// records who and when.
//
// What people tick, and the checklist's own dates, are kept on the student in
// `onboarding` (jsonb, supabase/updates-2026-10-02-student-dates-onboarding.sql):
//   { started_at, started_by, from?, returning?, closed_at?, closed_by?,
//     steps: { supply: { at, by, draft?, todo? }, groups: { at, by }, photos: { at, by },
//              no_fee: { at, by }, invoice_elsewhere: { at, by }, form_elsewhere: { at, by } } }
// A student made in The Current from now on starts one (Add student, a lead, the website
// form); for anyone else the office can start it from the student window.
//
// Nothing here changes an amount: the admission-fee line only shows whether the
// "New student" box is ticked and lets the office tick it.

import { isEnrolled, isPending, contactsOf, endDateOf, startsLater } from './studentRecords'
import { normalizeCode, codeTakenBy, nextStudentCode } from './studentIds'
import { emailIssues, addressesIn } from './emailCheck'
import { emailsOf as leadEmails, todayIso } from './leads'
import { suggestClass } from './placement'
import { dayText } from './studentDates'

export const onboardingOf = (s) => (s?.onboarding && typeof s.onboarding === 'object' && !Array.isArray(s.onboarding) ? s.onboarding : null)
/** On the checklist: every pending student, and an enrolled one whose checklist was started and is not closed. */
export const onChecklist = (s) => isPending(s) || (isEnrolled(s) && !!onboardingOf(s) && !onboardingOf(s).closed_at)
/** A step a person ticked, as { at, by, ... }, or null. */
export const stepOf = (s, key) => onboardingOf(s)?.steps?.[key] || null
/** The checklist's starting record, for a student made in The Current. */
export const startedBy = (by, extra = {}) => ({ started_at: new Date().toISOString(), started_by: by || '', ...extra })

const isoDay = (v) => String(v || '').slice(0, 10)
const daysApart = (a, b) => Math.round((Date.parse(`${a}T00:00:00`) - Date.parse(`${b}T00:00:00`)) / 86400000)
const validIso = (iso) => { const d = new Date(`${iso}T00:00:00`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso }

/** The family's parent addresses (contacts, then the family's email box), or the student's own when there is no family. */
export function parentEmails(s, fam, students = []) {
  if (!fam) return addressesIn(s?.parents_email).map((e) => e.toLowerCase())
  const kids = students.filter((k) => k.family_id === fam.id)
  const list = [...contactsOf(fam, kids).map((c) => c.email), ...addressesIn(fam.email)]
  return [...new Set(list.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))]
}

/** The lead a student belongs to: the one linked, or else one with a parent's address (offered for linking). */
export function leadFor(s, leads, emails) {
  if (!leads) return { lead: null, match: null }
  const lead = s?.lead_id ? leads.find((l) => l.id === s.lead_id) || null : null
  const match = lead ? null : leads.find((l) => leadEmails(l.email).some((e) => emails.includes(e))) || null
  return { lead, match }
}

/** The earliest invoice in The Current with this student on it (void ones do not count). */
export function firstInvoice(s, invoices) {
  if (!invoices || !s?.id) return null
  return invoices.filter((i) => i.status !== 'void' && (i.student_ids || []).includes(s.id))
    .sort((a, b) => String(a.issue_date || a.created_at || '').localeCompare(String(b.issue_date || b.created_at || '')))[0] || null
}

/** An invoice in The Current (not void) that already carries this student's admission-fee row. */
export function feeInvoice(s, invoices) {
  if (!invoices || !s?.id) return null
  const feeRow = (r) => r.meta?.studentId === s.id && /admission fee|phí nhập học/i.test(String(r.cells?.desc || ''))
  return invoices.find((i) => i.status !== 'void' && (i.doc?.sections || []).some((sec) => sec.kind === 'fees' && (sec.rows || []).some(feeRow))) || null
}

/** The newest enrollment form linked to this student. */
export function formFor(s, enrollments) {
  if (!enrollments || !s?.id) return null
  return enrollments.filter((e) => e.student_id === s.id)
    .sort((a, b) => String(b.submitted_at || b.created_at || '').localeCompare(String(a.submitted_at || a.created_at || '')))[0] || null
}

/**
 * Warnings about a start date: an enrolled student whose start is still to come, a
 * date before the enrollment form was sent, a date other than the one the form asks
 * for, one far from today, an end date before it, and a day and month that look swapped.
 * Each is [key, vars].
 */
export function startDateWarnings(s, form, lang = 'en', today = todayIso()) {
  const start = isoDay(s?.start_date)
  if (!start) return []
  const out = []
  const sent = form ? isoDay(form.submitted_at || form.created_at) : ''
  const asked = form ? isoDay(form.data?.student?.start_date) : ''
  if (startsLater(s, today)) out.push(['obStartLater', { date: dayText(start, lang) }])
  if (sent && start < sent) out.push(['obStartBeforeForm', { date: dayText(start, lang), sent: dayText(sent, lang) }])
  if (asked && asked !== start) out.push(['obStartFormSays', { date: dayText(asked, lang) }])
  const far = Math.abs(daysApart(start, today)) > 270
  if (far) out.push(['obStartFar', { date: dayText(start, lang) }])
  const end = endDateOf(s)
  if (end && end < start) out.push(['endBeforeStart', {}])
  // 08 Nov typed for 11 Aug: offered only when something already looks off and the swap fits better.
  const [y, m, d] = start.split('-')
  const swapped = `${y}-${d}-${m}`
  if (out.length && Number(d) <= 12 && d !== m && validIso(swapped)) {
    const better = (asked && swapped === asked) || Math.abs(daysApart(swapped, today)) < Math.abs(daysApart(start, today)) || (isEnrolled(s) && swapped <= today && start > today)
    if (better) out.push(['obStartSwap', { date: dayText(swapped, lang) }])
  }
  return out
}

/**
 * The checklist for one student. `ctx` holds what the lines are worked out from:
 * { students, families, invoices, enrollments, leads, schoolYear } (a list that could
 * not be read is null, and its line says so or is left out). Returns
 * { lines, open, total, complete }. Each line is
 * { id, state: 'done' | 'warn' | 'open' | 'info', label, detail: [key, vars], notes: [[key, vars]],
 *   record (who ticked it), actions }. 'warn' counts as done but asks for a look;
 * 'info' lines do not count.
 */
export function checklistFor(s, ctx = {}, lang = 'en', today = todayIso()) {
  const { students = [], families = [], invoices = null, enrollments = null, leads = null, schoolYear } = ctx
  const lines = []
  const add = (line) => lines.push({ notes: [], actions: [], record: null, ...line })
  if (!s?.id) {
    add({ id: 'record', state: 'open', label: 'obRecord', detail: ['obRecordNone', {}], actions: ['makeStudent'] })
    return summary(lines)
  }
  const ob = onboardingOf(s) || {}
  const fam = families.find((f) => f.id === s.family_id) || null
  const form = formFor(s, enrollments)
  const emails = parentEmails(s, fam, students)

  add({ id: 'record', state: 'done', label: 'obRecord', detail: ['obRecordDone', { status: isPending(s) ? 'pending' : 'enrolled' }] })

  // Student ID: every new student gets an S number. A returning student keeps an older (BLE) one.
  const code = normalizeCode(s.student_code)
  const taken = code ? codeTakenBy(students, code, s.id) : null
  if (!code) add({ id: 'code', state: 'open', label: 'obCode', detail: ['obCodeNone', { next: nextStudentCode(students) }] })
  else if (taken) add({ id: 'code', state: 'open', label: 'obCode', detail: ['obCodeTaken', { code, name: taken.full_name }] })
  else if (!/^S\d+$/.test(code) && !ob.returning) add({ id: 'code', state: 'warn', label: 'obCode', detail: ['obCodeValue', { code }], notes: [['obCodeNotS', { code, next: nextStudentCode(students.filter((x) => x.id !== s.id)) }]] })
  else add({ id: 'code', state: 'done', label: 'obCode', detail: ['obCodeValue', { code }] })

  // Year group (the class): set, and a word when the birthday points elsewhere.
  if (!s.level) add({ id: 'class', state: 'open', label: 'obClass', detail: ['obClassNone', {}] })
  else {
    // Quiet when the class is the birthday's year group, or the class that year group sits in this year.
    const g = s.dob ? suggestClass(s, students, schoolYear) : null
    const notes = g && g.level !== s.level && g.yearGroup !== s.level ? [['obClassBirthday', { level: g.yearGroup }]] : []
    add({ id: 'class', state: notes.length ? 'warn' : 'done', label: 'obClass', detail: ['obClassValue', { level: [s.level, s.class_group && s.class_group !== s.level ? s.class_group : ''].filter(Boolean).join(' · ') }], notes })
  }

  // On the register: a pending student is set to Enrolled on their first day.
  if (isPending(s)) add({ id: 'register', state: 'open', label: 'obRegister', detail: s.start_date ? ['obRegisterPendingOn', { date: dayText(isoDay(s.start_date), lang) }] : ['obRegisterPending', {}] })
  else add({ id: 'register', state: 'done', label: 'obRegister', detail: ['obRegisterDone', {}] })

  // Start date, with the warnings the end-date work added and a few more.
  if (!s.start_date) add({ id: 'start', state: 'open', label: 'obStart', detail: ['obStartNone', {}] })
  else {
    const notes = startDateWarnings(s, form, lang, today)
    add({ id: 'start', state: notes.length ? 'warn' : 'done', label: 'obStart', detail: ['obDate', { date: dayText(isoDay(s.start_date), lang) }], notes })
  }
  // Expected end date: optional, never holds the checklist up.
  const end = endDateOf(s)
  add({ id: 'end', state: 'info', label: 'endDate', detail: end ? ['obDate', { date: dayText(end, lang) }] : ['obEndNone', {}] })

  // Family, and a parent address that looks right.
  if (!fam) add({ id: 'family', state: 'open', label: 'obFamily', detail: ['obFamilyNone', {}] })
  else {
    const named = contactsOf(fam, students.filter((k) => k.family_id === fam.id)).some((c) => String(c.name || '').trim())
    add({ id: 'family', state: named ? 'done' : 'warn', label: 'obFamily', detail: ['obFamilyValue', { name: fam.name }], notes: named ? [] : [['obFamilyNoNames', {}]] })
  }
  const issues = emailIssues(emails.join(', '))
  if (!emails.length) add({ id: 'email', state: 'open', label: 'obEmail', detail: [fam ? 'obEmailNone' : 'obEmailNoneStudent', {}] })
  else if (issues.slips.length || issues.bad.length) {
    // A likely slip ("gmai.com") is a warning: the address may be right, and it must not hold the
    // checklist open for ever. Something that is not an address at all is still a step to do.
    add({ id: 'email', state: issues.bad.length ? 'open' : 'warn', label: 'obEmail', detail: ['obEmailValue', { emails: emails.join(', ') }],
      notes: [...issues.slips.map((x) => ['emailSlip', { typed: x.domain, suggestion: x.suggestion }]), ...issues.bad.map((e) => ['emailNotAddress', { email: e }])], actions: fam ? ['editFamily'] : [] })
  } else add({ id: 'email', state: 'done', label: 'obEmail', detail: ['obEmailValue', { emails: emails.join(', ') }] })

  // On the Leads list, linked, so the lead and the student cannot drift apart.
  if (leads) {
    const { lead, match } = leadFor(s, leads, emails)
    if (lead) add({ id: 'lead', state: 'done', label: 'obLead', detail: ['obLeadValue', { name: lead.family }], actions: ['openLead'], lead })
    else if (match) add({ id: 'lead', state: 'open', label: 'obLead', detail: ['obLeadMatch', { name: match.family }], actions: ['linkLead'], lead: match })
    else add({ id: 'lead', state: 'open', label: 'obLead', detail: ['obLeadNone', {}], actions: ['addLead'] })
  }

  // The admission fee: the "New student" box decides whether the invoice builder adds it.
  // Once an invoice carries the fee, the box is usually unticked and the line is done: ticking
  // it again would put the fee on the next invoice too.
  const noFee = stepOf(s, 'no_fee')
  const feeOn = feeInvoice(s, invoices)
  if (s.is_new) add({ id: 'fee', state: 'done', label: 'obFee', detail: ['obFeeTicked', {}] })
  else if (feeOn) add({ id: 'fee', state: 'done', label: 'obFee', detail: ['obFeeOnInvoice', { number: feeOn.number || '—' }], actions: ['openInvoice'], invoice: feeOn })
  else if (noFee) add({ id: 'fee', state: 'done', label: 'obFee', detail: ['obFeeNone', {}], record: noFee, actions: ['undoNoFee'] })
  else add({ id: 'fee', state: 'open', label: 'obFee', detail: ['obFeeOpen', {}], actions: ['tickFee', 'noFee'] })

  // A first invoice in The Current (or billed outside it, said by a person).
  const inv = firstInvoice(s, invoices)
  const billedElsewhere = stepOf(s, 'invoice_elsewhere')
  if (inv) add({ id: 'invoice', state: 'done', label: 'obInvoice', detail: ['obInvoiceValue', { number: inv.number || '—', status: inv.status || 'draft' }], actions: ['openInvoice'], invoice: inv })
  else if (billedElsewhere) add({ id: 'invoice', state: 'done', label: 'obInvoice', detail: ['obInvoiceElsewhere', {}], record: billedElsewhere, actions: ['undoInvoiceElsewhere'] })
  else if (invoices) add({ id: 'invoice', state: 'open', label: 'obInvoice', detail: ['obInvoiceNone', {}], actions: ['newInvoice', 'invoiceElsewhere'] })

  // The enrollment form, on file in The Current (or kept elsewhere, said by a person).
  const formElsewhere = stepOf(s, 'form_elsewhere')
  if (form) add({ id: 'form', state: 'done', label: 'obForm', detail: ['obFormValue', { date: dayText(isoDay(form.submitted_at || form.created_at), lang) }], actions: ['openForm'], form })
  else if (formElsewhere) add({ id: 'form', state: 'done', label: 'obForm', detail: ['obFormElsewhere', {}], record: formElsewhere, actions: ['undoFormElsewhere'] })
  else add({ id: 'form', state: 'open', label: 'obForm', detail: ['obFormNone', {}], actions: ['formElsewhere'] })

  // Steps a person does outside The Current.
  if (form?.photo_consent === 'private') {
    const r = stepOf(s, 'photos')
    add({ id: 'photos', state: r ? 'done' : 'open', label: 'obPhotos', detail: ['obPhotosHint', {}], record: r, actions: [r ? 'untick' : 'tick'], hand: true })
  }
  const supply = stepOf(s, 'supply')
  add({ id: 'supply', state: supply ? 'done' : 'open', label: 'obSupply', detail: [supply?.todo ? 'obSupplyDone' : 'obSupplyHint', { n: supply?.todo || '' }], record: supply, actions: supply ? ['untick', 'supply'] : ['supply', 'tick'], hand: true })
  const groups = stepOf(s, 'groups')
  add({ id: 'groups', state: groups ? 'done' : 'open', label: 'obGroups', detail: ['obGroupsHint', {}], record: groups, actions: [groups ? 'untick' : 'tick', ...(emails.length ? ['copyEmails'] : [])], hand: true })

  add({ id: 'photo', state: 'info', label: 'obPhoto', detail: [s.photo ? 'obPhotoOn' : 'obPhotoNone', {}] })
  return summary(lines)
}

function summary(lines) {
  const counted = lines.filter((l) => l.state !== 'info')
  const open = counted.filter((l) => l.state === 'open').length
  return { lines, open, total: counted.length, complete: open === 0 }
}

/** New students with steps still open: on the checklist and not complete. */
export function withOpenSteps(students, ctx, today = todayIso()) {
  return students.filter(onChecklist).map((s) => ({ s, r: checklistFor(s, { ...ctx, students }, 'en', today) })).filter((x) => !x.r.complete)
}

// ---------------------------------------------------------------------------
// Writing

/** The database file has not run yet: the student saved, but without `onboarding`. */
export class ChecklistSetupError extends Error {}

/**
 * Writes `onboarding` for one student, merged with what is in the database now, so two
 * people ticking different steps keep both. `change(ob)` returns the new object.
 */
export async function writeOnboarding(db, student, change) {
  const fresh = await db.students.get(student.id).catch(() => null)
  const ob = { ...(onboardingOf(fresh) || onboardingOf(student) || {}) }
  const next = change({ ...ob, steps: { ...(ob.steps || {}) } })
  const saved = await db.students.patch(student.id, { onboarding: next })
  // Before supabase/updates-2026-10-02-student-dates-onboarding.sql the column is not there and
  // db.js leaves it out of the write: the row comes back without it.
  if (saved && !('onboarding' in saved)) throw new ChecklistSetupError('onboarding')
  return saved
}

/** Ticks (or unticks) a step, noting who and when. */
export const setStep = (db, student, key, on, by, extra = {}) => writeOnboarding(db, student, (ob) => {
  if (!ob.started_at) Object.assign(ob, startedBy(by))
  if (on) ob.steps[key] = { at: new Date().toISOString(), by: by || '', ...extra }
  else delete ob.steps[key]
  return ob
})

/** Starts a checklist for a student who has none (an enrolled student added before this existed). */
export const startChecklist = (db, student, by) => writeOnboarding(db, student, (ob) => ({ ...startedBy(by), steps: ob.steps || {} }))

/** Closes an enrolled student's checklist once every line is done, so it does not come back later. */
export const closeChecklist = (db, student, by) => writeOnboarding(db, student, (ob) => ({ ...ob, closed_at: new Date().toISOString(), closed_by: by || '' }))
