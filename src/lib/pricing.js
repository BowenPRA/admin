// The pricing engine. Takes the choices made in the invoice builder and
// produces an invoice *document*: a list of editable sections (tables), each
// with columns and rows, plus deductions and notes. The editor and the print
// view only ever look at the document, so anything the engine gets wrong can be
// fixed by hand without fighting the code.
//
// Document shape:
// {
//   lang, schoolYear, periodId, periodLabel, subtitle,
//   sections: [{ id, kind, heading, subheading, columns:[{key,label,type}], rows:[{id,cells:{}}],
//                billedKeys:[...money column keys that count toward the summary], summaryLabel, note }],
//   deductions: [{ id, label, amount }],
//   notes: [string], flags: { bank, qr, forceMajeure }
// }

import { bandFor, hasProgram, mealRateFor, periodInfo, PROGRAMS } from './fees.js'
import { pct, fmtDate, todayISO } from './money.js'
import { normalizeCode } from './studentIds.js'
import { ROSTER_CODES as ROSTER_CODE_LIST, ROSTER_NAME_HASHES } from '../data/rosterIndex.js'

let seq = 0
const uid = (p = 'r') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`

const L = (lang, en, vi) => (lang === 'vi' ? vi : en)

export function programLabel(programId, lang) {
  const p = PROGRAMS.find((x) => x.id === programId)
  if (!p) return programId || ''
  return lang === 'vi' ? p.vi : p.en
}

export function studentDisplayName(s) {
  const full = (s.full_name || '').trim()
  const nick = (s.nickname || '').trim()
  if (!nick || full.toLowerCase().includes(nick.toLowerCase())) return full
  return `${full} (${nick})`
}

function curriculumLabel(s, lang) {
  if (!hasProgram(s)) return s.level || ''
  if (bandFor(s.level) === 'upper') return 'Upper Secondary'
  return `${s.level}\n(${programLabel(s.program || 'regular', lang)})`
}

// Annual tuition for one tuition item, before discounts.
export function annualTuition(student, plan, fees, item = 'main') {
  const band = bandFor(student.level)
  if (!hasProgram(student)) return 0
  if (item === 'acellus') return fees.upper.acellus
  if (band === 'upper' || student.program === 'hybrid' || student.program === 'independent') {
    return student.program === 'independent' ? fees.upper.independent : fees.upper.hybrid
  }
  const t = fees.tuition[band]
  if (student.legacy && plan === 'earlyBird') return fees.legacyEarlyBird
  if (plan === 'standard') return t.standard
  if (plan === 'earlyBird') return t.earlyBird
  // quarterly and everything else priced off the full-year quarterly total
  return t.quarter * 3 + quarter4For(student, t)
}

// Only students already enrolled when the 2026-2027 schedule was published
// (the roster) pay a reduced Quarter 4. New and reactivated students pay a full
// quarter. The invoice builder can override this per student (opts.q4Full).
function quarter4For(student, band) {
  return student.q4_full ? band.quarter : band.quarter4
}

const normName = (s) => String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
// The site is public, so the roster index carries no names, only a one-way
// fingerprint of each (FNV-1a over the UTF-8 of normName, in base 36). Keep this
// in step with name_hash() in scripts/build_roster.py, which writes the index.
function nameHash(name) {
  let h = 0x811c9dc5
  for (const b of new TextEncoder().encode(normName(name))) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36)
}
const ROSTER_CODES = new Set(ROSTER_CODE_LIST.map(normalizeCode).filter(Boolean))
const ROSTER_NAMES = new Set(ROSTER_NAME_HASHES)

/** Is this student on the 2026-2027 enrolled roster? */
export function onRoster(student) {
  const code = normalizeCode(student?.student_code || '')
  return (!!code && ROSTER_CODES.has(code)) || ROSTER_NAMES.has(nameHash(student?.full_name))
}

/** Default for the per-invoice "full Quarter 4" choice. */
export function defaultQ4Full(student) {
  return !!student.q4_full || !onRoster(student)
}

// The student as priced on this invoice: the per-invoice Q4 choice wins over the record.
const pricedStudent = (student, opts) => ({ ...student, q4_full: opts?.q4Full ?? defaultQ4Full(student) })

/**
 * Change a student's level and/or program on an invoice entry, refreshing the
 * options that depend on them (Upper Secondary fees, meal rate, weekly rate).
 */
export function withStudentChoice(entry, patch, fees) {
  const s = { ...entry.student, ...patch }
  const upper = hasProgram(s) && (bandFor(s.level) === 'upper' || ['hybrid', 'independent'].includes(s.program))
  return {
    ...entry,
    student: s,
    opts: {
      ...entry.opts,
      upper,
      // becoming Upper Secondary switches the online fee on; otherwise keep the current choice
      includeAcellus: upper && !entry.opts.upper ? true : upper && entry.opts.includeAcellus,
      includePathway: entry.opts.includePathway ?? true,
      mealRate: mealRateFor(s.level, s.program, fees),
      weeklyRate: upper ? fees.weekly.summerUpper : (bandFor(s.level) === 'y7_9' ? fees.weekly.vocationalY7_9 : bandFor(s.level) === 'nursery' ? fees.weekly.globalNursery : fees.weekly.vocationalY1_6),
    },
  }
}

function quarterAmounts(student, fees) {
  const band = bandFor(student.level)
  if (!hasProgram(student)) return [0, 0, 0, 0]
  if (band === 'upper' || student.program === 'hybrid' || student.program === 'independent') {
    const a = annualTuition(student, 'quarterly', fees)
    return [a / 4, a / 4, a / 4, a / 4]
  }
  const t = fees.tuition[band]
  return [t.quarter, t.quarter, t.quarter, quarter4For(student, t)]
}

export const PERIOD_OPTIONS = [
  { id: 'year', en: 'Full year', vi: 'Cả năm học' },
  { id: 'sem1', en: 'Semester 1', vi: 'Học kỳ 1' },
  { id: 'sem2', en: 'Semester 2', vi: 'Học kỳ 2' },
  { id: 'q1', en: 'Quarter 1', vi: 'Quý 1' },
  { id: 'q2', en: 'Quarter 2', vi: 'Quý 2' },
  { id: 'q3', en: 'Quarter 3', vi: 'Quý 3' },
  { id: 'q4', en: 'Quarter 4', vi: 'Quý 4' },
  { id: 'custom', en: 'Custom period', vi: 'Kỳ tuỳ chọn' },
]

export const PLAN_OPTIONS = [
  { id: 'earlyBird', en: 'Full year - Early Bird', vi: 'Cả năm - Early Bird' },
  { id: 'standard', en: 'Full year - Standard', vi: 'Cả năm - Tiêu chuẩn' },
  { id: 'quarterly', en: 'Pay by quarter', vi: 'Đóng theo quý' },
  { id: 'split', en: 'Installments (custom %)', vi: 'Trả góp (tỷ lệ tuỳ chọn)' },
  { id: 'weekly', en: 'Weekly (Global / Vocational / Summer)', vi: 'Theo tuần (Global / Hướng nghiệp / Hè)' },
  { id: 'trial', en: 'Trial day only', vi: 'Ngày học thử' },
  { id: 'staff', en: 'Staff child (materials + meals)', vi: 'Con nhân viên (học liệu + tiền ăn)' },
  { id: 'none', en: 'No tuition (meals / transport / fees only)', vi: 'Không có học phí (chỉ tiền ăn / xe / phí khác)' },
]

/** Default per-student options when a student is added to the builder. */
export function defaultStudentOptions(student, fees, calendar, ctx) {
  const period = periodInfo(ctx.periodId, calendar)
  const upper = hasProgram(student) && (bandFor(student.level) === 'upper' || ['hybrid', 'independent'].includes(student.program))
  return {
    tuitionOverride: '', // blank = use schedule
    q4Full: defaultQ4Full(student),
    includePathway: true, // upper secondary: hybrid / independent fee
    includeAcellus: upper, // upper secondary: online (Acellus) fee, on by default (PRA pays on behalf, cash reimbursement)
    extraDiscountPct: 0,
    meals: true,
    mealDays: period.days,
    mealRate: mealRateFor(student.level, student.program, fees),
    transport: false,
    transportMonths: period.months,
    transportRate: fees.transport.hoiAn,
    newStudentFee: !!student.is_new,
    trialDays: 0,
    weeks: 4,
    weeklyRate: upper ? fees.weekly.summerUpper : (bandFor(student.level) === 'y7_9' ? fees.weekly.vocationalY7_9 : bandFor(student.level) === 'nursery' ? fees.weekly.globalNursery : fees.weekly.vocationalY1_6),
    staffMonths: 3,
    upper,
  }
}

const QUARTERS = ['q1', 'q2', 'q3', 'q4']

/** School days in a quarter from the calendar (45 in 2026-2027). */
export function quarterDays(calendar, qid) {
  return Number(calendar?.quarters?.find((q) => q.id === qid)?.days) || 45
}

/**
 * Prorated quarters for a student: opts.prorate = { q1: 30 } means Quarter 1 is
 * charged for 30 of its school days. Returns [{ qid, days, full }].
 */
export function proratedQuarters(opts, calendar) {
  return QUARTERS.filter((k) => opts?.prorate?.[k] !== undefined && opts.prorate[k] !== '' && opts.prorate[k] !== null)
    .map((k) => ({ qid: k, days: Math.max(0, Number(opts.prorate[k]) || 0), full: quarterDays(calendar, k) }))
}

/** Meal days for the billed quarters, using prorated days where set. */
export function billedDays(billQuarters, opts, calendar) {
  return (billQuarters || []).reduce((s, k) => {
    const p = proratedQuarters(opts, calendar).find((x) => x.qid === k)
    return s + (p ? p.days : quarterDays(calendar, k))
  }, 0)
}

// Prorated amounts are rounded to the nearest 1,000 VND.
const round1000 = (v) => Math.round(v / 1000) * 1000

function dueLabel(lang, iso) {
  return L(lang, `Due ${fmtDate(iso, 'en')}`, `Hạn ${fmtDate(iso, 'vi')}`)
}

// ---------- Order of the students on an invoice ----------

/** Tuition for one student over the whole year, before the sibling discount. */
function tuitionValue(entry, inputs, fees) {
  const opts = entry.opts || {}
  const student = pricedStudent(entry.student, opts)
  const plan = inputs.plan
  if (['staff', 'trial', 'none'].includes(plan) || !hasProgram(student)) return 0
  if (plan === 'weekly') return (Number(opts.weeks) || 0) * (Number(opts.weeklyRate) || 0)
  const basePlan = plan === 'split' ? (inputs.splitBase || 'earlyBird') : plan
  let v = 0
  if (!opts.upper || opts.includePathway) {
    v += opts.tuitionOverride !== '' && opts.tuitionOverride != null ? Number(opts.tuitionOverride) || 0 : annualTuition(student, basePlan, fees)
  }
  if (opts.upper && opts.includeAcellus) v += annualTuition(student, basePlan, fees, 'acellus')
  return v
}

/** Roughly what one student costs on this invoice: tuition plus the extras. */
export function studentCost(entry, inputs, fees) {
  const opts = entry.opts || {}
  let v = tuitionValue(entry, inputs, fees)
  if (inputs.plan === 'staff') v += (Number(opts.staffMonths) || 0) * fees.staff.materialsPerMonth + fees.staff.developmentFee
  if (opts.meals) v += (Number(opts.mealDays) || 0) * (Number(opts.mealRate) || 0)
  if (opts.transport) v += (Number(opts.transportMonths) || 0) * (Number(opts.transportRate) || 0)
  if (opts.newStudentFee) v += fees.newStudentFee
  v += (Number(opts.trialDays) || (inputs.plan === 'trial' ? 1 : 0)) * fees.trialDay
  return v
}

/**
 * The students of an invoice, priciest first. Every table on the invoice follows
 * this order, and the sibling discount then lands on the child at the bottom.
 */
export function orderedStudents(inputs, fees) {
  return (inputs.students || [])
    .map((e, i) => ({ e, i, cost: studentCost(e, inputs, fees) }))
    .sort((a, b) => b.cost - a.cost || a.i - b.i)
    .map((x) => x.e)
}

const QUARTER_IDS = ['q1', 'q2', 'q3', 'q4']

/**
 * The due date these choices suggest: the deadline of the plan (or of the first
 * quarter / installment being billed). A deadline that has already gone by is no
 * use on a new invoice, so those fall back to a week after the issue date.
 */
export function smartDueDate(inputs, fees, issueDate) {
  const d = fees?.deadlines || {}
  const issue = issueDate || todayISO()
  let due = null
  switch (inputs.plan) {
    case 'earlyBird': due = d.earlyBird; break
    case 'standard': due = d.standard; break
    case 'quarterly': due = d[QUARTER_IDS.find((q) => (inputs.billQuarters || []).includes(q)) || 'q1']; break
    case 'split': due = inputs.splits?.[inputs.billSplit ?? 0]?.due; break
    default: break // weekly, trial, staff, no tuition: no deadline of their own
  }
  if (due && due >= issue) return due
  const t = new Date(`${issue}T00:00:00`)
  t.setDate(t.getDate() + 7)
  return t.toISOString().slice(0, 10)
}

/**
 * Build the document.
 * inputs = {
 *   lang, periodId, customRangeEn, customRangeVi, plan,
 *   billQuarters: ['q1'],          // quarterly plan: which quarter columns are billed now
 *   splits: [{pct:60, due:'2026-05-20'},{pct:40, due:'2026-10-08'}], billSplit: 0,
 *   siblingDiscount: true, siblingStudentId: null (auto = cheapest),
 *   students: [{ student, opts }],
 *   deductions: [{label, amount}],
 *   extraNotes: [string], cashOnly: false, flags
 * }
 */
export function buildDocument(inputs, fees, calendar) {
  const lang = inputs.lang || 'en'
  const sy = fees.schoolYear
  const period = inputs.periodId === 'custom'
    ? { days: 0, months: 0, rangeEn: inputs.customRangeEn || '', rangeVi: inputs.customRangeVi || '', en: inputs.customLabelEn || 'the period', vi: inputs.customLabelVi || 'kỳ' }
    : periodInfo(inputs.periodId, calendar)
  const plan = inputs.plan
  const sections = []
  // Priciest child first, on every table of the invoice.
  const entries = orderedStudents(inputs, fees).map((e) => ({ ...e, student: pricedStudent(e.student, e.opts) }))
  // Students with no program are billed for extras only: they get no tuition row.
  const tuitionEntries = entries.filter((e) => hasProgram(e.student))

  const periodLabelEn = period.en
  const periodLabelVi = period.vi
  const periodPhraseEn = /^the /.test(periodLabelEn) ? periodLabelEn : `the ${periodLabelEn}`

  // ---------- Sibling discount: pick the cheapest tuition among 2+ students ----------
  let discountId = null
  if (inputs.siblingDiscount && tuitionEntries.length >= 2 && !['staff', 'trial', 'none'].includes(plan)) {
    if (inputs.siblingStudentId && tuitionEntries.some((e) => e.student.id === inputs.siblingStudentId)) {
      discountId = inputs.siblingStudentId
    } else {
      let best = null
      tuitionEntries.forEach((e) => {
        const base = e.opts.tuitionOverride !== '' ? Number(e.opts.tuitionOverride) : annualTuition(e.student, plan === 'split' ? (inputs.splitBase || 'earlyBird') : plan, fees)
        // `<=` so that on a tie the discount goes to the child listed last (the younger sibling).
        if (best === null || base <= best.amount) best = { id: e.student.id, amount: base }
      })
      discountId = best?.id ?? null
    }
  }
  const sibPct = fees.siblingDiscountPct || 5

  // ---------- Tuition section ----------
  const isUpperAny = tuitionEntries.some((e) => e.opts.upper)
  const showDiscountCol = discountId !== null

  if (!['staff', 'trial', 'none'].includes(plan) && tuitionEntries.length) {
    const cols = [{ key: 'name', label: L(lang, "Student's Name", 'Tên học sinh'), type: 'text' }]
    if (isUpperAny) cols.push({ key: 'item', label: L(lang, 'Tuition Fee', 'Khoản phí'), type: 'text' })
    cols.push({ key: 'curriculum', label: L(lang, 'Curriculum', 'Chương trình'), type: 'text' })

    let billedKeys = []
    let heading = L(lang, `TUITION FEE FOR THE YEAR ${sy}`, `HỌC PHÍ CHƯƠNG TRÌNH CHÍNH KHÓA, NĂM HỌC ${sy}`)

    if (plan === 'earlyBird' || plan === 'standard') {
      const lbl = plan === 'earlyBird'
        ? L(lang, `Total Fee (VND)\nEarly Bird by ${fmtDate(fees.deadlines.earlyBird, 'en')}`, `Tổng học phí\nMức Early Bird (trước ngày ${fmtDate(fees.deadlines.earlyBird, 'vi')})`)
        : L(lang, `Total Fee (VND)\nStandard by ${fmtDate(fees.deadlines.standard, 'en')}`, `Tổng học phí\nMức tiêu chuẩn (trước ngày ${fmtDate(fees.deadlines.standard, 'vi')})`)
      cols.push({ key: 'total', label: lbl, type: 'money' })
      billedKeys = ['total']
    } else if (plan === 'quarterly') {
      const dl = fees.deadlines
      const qs = [['q1', dl.q1], ['q2', dl.q2], ['q3', dl.q3], ['q4', dl.q4]]
      qs.forEach(([k, d], i) => {
        const lbl = isUpperAny
          ? L(lang, `Payment ${i + 1}\n(${dueLabel('en', d)})\n25%`, `Đợt ${i + 1}\n(${dueLabel('vi', d)})\n25%`)
          : L(lang, `QUARTER ${i + 1}\n${dueLabel('en', d)}`, `QUÝ ${i + 1}\n${dueLabel('vi', d)}`)
        cols.push({ key: k, label: lbl, type: 'money' })
      })
      cols.push({ key: 'total', label: L(lang, 'Total', 'Tổng cộng'), type: 'money' })
      billedKeys = inputs.billQuarters?.length ? inputs.billQuarters : ['q1']
    } else if (plan === 'split') {
      const splits = inputs.splits?.length ? inputs.splits : [{ pct: 50, due: fees.deadlines.q1 }, { pct: 50, due: fees.deadlines.semester2 }]
      splits.forEach((s, i) => {
        cols.push({ key: `p${i + 1}`, label: L(lang, `Payment ${i + 1}\n(${dueLabel('en', s.due)})\n${s.pct}%`, `Đợt ${i + 1}\n(${dueLabel('vi', s.due)})\n${s.pct}%`), type: 'money' })
      })
      cols.push({ key: 'total', label: L(lang, 'Total Amount', 'Tổng cộng'), type: 'money' })
      billedKeys = [`p${(inputs.billSplit ?? 0) + 1}`]
    } else if (plan === 'weekly') {
      heading = L(lang, `TUITION FEE FOR ${(tuitionEntries[0]?.student.program === 'global' ? 'GLOBAL' : tuitionEntries[0]?.student.program === 'vocational' ? 'VOCATIONAL' : 'SHORT-TERM')} PROGRAM, YEAR ${sy}`,
        `HỌC PHÍ CHƯƠNG TRÌNH NGẮN HẠN, NĂM HỌC ${sy}`)
      cols.push({ key: 'weeks', label: L(lang, `Number of weeks\n(${period.rangeEn})`, `Số tuần\n(${period.rangeVi})`), type: 'number' })
      cols.push({ key: 'rate', label: L(lang, 'Price per week', 'Mức phí/tuần'), type: 'money' })
      cols.push({ key: 'total', label: L(lang, 'Total', 'Tổng cộng'), type: 'money' })
      billedKeys = ['total']
    }
    if (showDiscountCol) {
      cols.push({ key: 'disc', label: L(lang, `Total\n(after ${sibPct}% discount for the 2nd child)`, `Tổng cộng\n(sau khi giảm ${sibPct}% cho con thứ 2)`), type: 'money' })
    }

    const rows = []
    tuitionEntries.forEach(({ student, opts }) => {
      const items = []
      // Weekly short programmes (Global / Vocational / Summer) are one flat row: no pathway or online fee split.
      if (opts.upper && plan !== 'weekly') {
        if (opts.includePathway) items.push({ id: 'main', label: programLabel(student.program === 'independent' ? 'independent' : 'hybrid', lang) })
        if (opts.includeAcellus) items.push({ id: 'acellus', label: L(lang, 'Acellus Fee', 'Phí Acellus') })
      } else items.push({ id: 'main', label: opts.upper ? programLabel(student.program || 'regular', lang) : '' })

      items.forEach((item, idx) => {
        const isDisc = student.id === discountId && item.id === 'main'
        // Discounts never touch the Acellus fee: PRA pays it in full on the family's behalf.
        const dPct = item.id === 'main' ? (isDisc ? sibPct : 0) + Number(opts.extraDiscountPct || 0) : 0
        const cells = { name: idx === 0 ? studentDisplayName(student) + (isDisc && !showDiscountCol ? '' : '') : '', curriculum: curriculumLabel(student, lang), item: item.label }
        const override = item.id === 'main' && opts.tuitionOverride !== '' ? Number(opts.tuitionOverride) : null
        const annual = override ?? annualTuition(student, plan, fees, item.id)

        const applyDisc = (v) => (dPct ? pct(v, 100 - dPct) : v)

        if (plan === 'earlyBird' || plan === 'standard') {
          cells.total = annual
          if (showDiscountCol) cells.disc = applyDisc(annual)
          else if (dPct) cells.total = applyDisc(annual)
        } else if (plan === 'quarterly') {
          let qa = quarterAmounts(student, fees)
          if (item.id === 'acellus') qa = [annual / 4, annual / 4, annual / 4, annual / 4]
          if (override !== null) { const s = qa.reduce((a, b) => a + b, 0); qa = qa.map((x) => Math.round(override * x / s)) }
          // Joined or left mid-quarter: charge only the school days attended.
          const pro = item.id === 'main' ? proratedQuarters(opts, calendar) : []
          if (pro.length) {
            qa = qa.map((x, i) => { const p = pro.find((r) => r.qid === QUARTERS[i]); return p ? round1000(x * Math.min(p.days, p.full) / p.full) : x })
            cells.curriculum += '\n' + pro.map((p) => L(lang, `(Quarter ${p.qid.slice(1)}: ${p.days} of ${p.full} days)`, `(Quý ${p.qid.slice(1)}: ${p.days}/${p.full} ngày)`)).join('\n')
          }
          const disc = qa.map(applyDisc)
          const vals = showDiscountCol ? qa : disc
          ;['q1', 'q2', 'q3', 'q4'].forEach((k, i) => { cells[k] = vals[i] })
          cells.total = vals.reduce((a, b) => a + b, 0)
          if (showDiscountCol) cells.disc = disc.reduce((a, b) => a + b, 0)
          if (showDiscountCol && dPct) { ['q1', 'q2', 'q3', 'q4'].forEach((k, i) => { cells[k] = disc[i] }) }
        } else if (plan === 'split') {
          const splits = inputs.splits?.length ? inputs.splits : [{ pct: 50 }, { pct: 50 }]
          // Installments split the full-year price chosen in `splitBase`
          // (early bird by default, e.g. the 60/40 early-bird plans).
          const splitAnnual = override ?? annualTuition(student, inputs.splitBase || 'earlyBird', fees, item.id)
          const base = applyDisc(splitAnnual)
          let acc = 0
          splits.forEach((s, i) => {
            const v = i === splits.length - 1 ? base - acc : pct(base, s.pct)
            acc += v
            cells[`p${i + 1}`] = v
          })
          cells.total = base
          if (showDiscountCol) cells.disc = base
        } else if (plan === 'weekly') {
          cells.weeks = Number(opts.weeks || 0)
          cells.rate = Number(opts.weeklyRate || 0)
          cells.total = cells.weeks * cells.rate
          if (showDiscountCol) cells.disc = applyDisc(cells.total)
          else if (dPct) cells.total = applyDisc(cells.total)
        }
        if (dPct && !showDiscountCol) cells.curriculum += L(lang, `\n(${dPct}% discount)`, `\n(giảm ${dPct}%)`)
        rows.push({ id: uid(), cells, meta: { studentId: student.id, item: item.id, discountPct: dPct } })
      })
    })

    const notes = []
    if (plan !== 'weekly' && tuitionEntries.some((e) => e.opts.upper && e.opts.includeAcellus)) {
      notes.push(L(lang,
        'Note: PRA will make the Acellus payment on your behalf. Please reimburse PRA by paying that amount in cash.',
        'Ghi chú: PRA sẽ nộp hộ khoản phí Acellus. Phụ huynh vui lòng thanh toán lại bằng tiền mặt cho PRA.'))
    }

    sections.push({
      id: uid('s'), kind: 'tuition', heading, subheading: '',
      columns: cols, rows,
      billedKeys: showDiscountCol && billedKeys.includes('total') ? ['disc'] : billedKeys,
      summaryLabel: L(lang, 'Tuition fee', 'Học phí'),
      note: notes.join('\n'),
    })
  }

  // ---------- Trial day ----------
  if (plan === 'trial') {
    const rows = entries.map(({ student, opts }) => ({
      id: uid(), cells: { name: studentDisplayName(student), curriculum: curriculumLabel(student, lang), days: Number(opts.trialDays || 1), rate: fees.trialDay, total: Number(opts.trialDays || 1) * fees.trialDay },
      meta: { studentId: student.id },
    }))
    sections.push({
      id: uid('s'), kind: 'fees',
      heading: L(lang, `TUITION FEE FOR TRIAL DAY, YEAR ${sy}`, `PHÍ NGÀY HỌC THỬ, NĂM HỌC ${sy}`),
      subheading: period.rangeEn && inputs.periodId === 'custom' ? `(${L(lang, period.rangeEn, period.rangeVi)})` : '',
      columns: [
        { key: 'name', label: L(lang, "Student's Name", 'Tên học sinh'), type: 'text' },
        { key: 'curriculum', label: L(lang, 'Curriculum', 'Chương trình'), type: 'text' },
        { key: 'days', label: L(lang, 'Number of days', 'Số ngày'), type: 'number' },
        { key: 'rate', label: L(lang, 'Price per day', 'Đơn giá'), type: 'money' },
        { key: 'total', label: L(lang, 'Total', 'Tổng cộng'), type: 'money' },
      ],
      rows, billedKeys: ['total'], summaryLabel: L(lang, 'Trial day fee', 'Phí học thử'), note: '',
    })
  }

  // ---------- Staff children: learning materials ----------
  if (plan === 'staff') {
    const rows = entries.map(({ student, opts }) => ({
      id: uid(), cells: { name: studentDisplayName(student), curriculum: student.level, months: Number(opts.staffMonths || 0), rate: fees.staff.materialsPerMonth, total: Number(opts.staffMonths || 0) * fees.staff.materialsPerMonth },
      meta: { studentId: student.id },
    }))
    sections.push({
      id: uid('s'), kind: 'fees',
      heading: L(lang, `LEARNING MATERIALS FEE, ${periodPhraseEn.toUpperCase()} ${sy}`, `PHÍ HỌC LIỆU, ${periodLabelVi.toUpperCase()} ${sy}`),
      subheading: `(${L(lang, period.rangeEn, period.rangeVi)})`,
      columns: [
        { key: 'name', label: L(lang, "Student's Name", 'Họ và tên'), type: 'text' },
        { key: 'curriculum', label: L(lang, 'Curriculum', 'Chương trình học'), type: 'text' },
        { key: 'months', label: L(lang, 'Number of months', 'Số tháng'), type: 'number' },
        { key: 'rate', label: L(lang, 'Price per month', 'Đơn giá'), type: 'money' },
        { key: 'total', label: L(lang, 'Total', 'Thành tiền'), type: 'money' },
      ],
      rows, billedKeys: ['total'], summaryLabel: L(lang, 'Learning materials', 'Phí học liệu'), note: '',
    })
  }

  // ---------- Meals ----------
  const mealEntries = entries.filter((e) => e.opts.meals)
  if (mealEntries.length) {
    sections.push({
      id: uid('s'), kind: 'meals',
      heading: L(lang, `MEAL FEE FOR ${periodPhraseEn.toUpperCase()}, YEAR ${sy}`, `PHÍ TIỀN ĂN CHO ${periodLabelVi.toUpperCase()}, NĂM HỌC ${sy}`),
      subheading: `(${L(lang, period.rangeEn, period.rangeVi)})`,
      columns: [
        { key: 'name', label: L(lang, "Student's Name", 'Tên học sinh'), type: 'text' },
        { key: 'days', label: L(lang, 'Number of days', 'Số bữa ăn'), type: 'number' },
        { key: 'rate', label: L(lang, 'Price per day', 'Đơn giá'), type: 'money' },
        { key: 'total', label: L(lang, 'Total', 'Tổng cộng'), type: 'money' },
      ],
      rows: mealEntries.map(({ student, opts }) => ({
        id: uid(), cells: { name: studentDisplayName(student), days: Number(opts.mealDays || 0), rate: Number(opts.mealRate || 0), total: Number(opts.mealDays || 0) * Number(opts.mealRate || 0) },
        meta: { studentId: student.id },
      })),
      billedKeys: ['total'], summaryLabel: L(lang, 'Meal fees', 'Phí tiền ăn'), note: '',
    })
  }

  // ---------- Transport ----------
  const trEntries = entries.filter((e) => e.opts.transport)
  if (trEntries.length) {
    sections.push({
      id: uid('s'), kind: 'transport',
      heading: L(lang, `TRANSPORTATION FEE FOR ${periodPhraseEn.toUpperCase()}, YEAR ${sy}`, `PHÍ XE ĐƯA ĐÓN CHO ${periodLabelVi.toUpperCase()}, NĂM HỌC ${sy}`),
      subheading: `(${L(lang, period.rangeEn, period.rangeVi)})`,
      columns: [
        { key: 'name', label: L(lang, "Student's Name", 'Tên học sinh'), type: 'text' },
        { key: 'months', label: L(lang, 'Number of months', 'Số tháng'), type: 'number' },
        { key: 'rate', label: L(lang, 'Price per month', 'Đơn giá/tháng'), type: 'money' },
        { key: 'total', label: L(lang, 'Total', 'Tổng cộng'), type: 'money' },
      ],
      rows: trEntries.map(({ student, opts }) => ({
        id: uid(), cells: { name: studentDisplayName(student), months: Number(opts.transportMonths || 0), rate: Number(opts.transportRate || 0), total: Number(opts.transportMonths || 0) * Number(opts.transportRate || 0) },
        meta: { studentId: student.id },
      })),
      billedKeys: ['total'], summaryLabel: L(lang, 'Transportation fee', 'Phí xe đưa đón'), note: '',
    })
  }

  // ---------- Other fees: new student admission, development fee, extra trial days ----------
  const feeRows = []
  entries.forEach(({ student, opts }) => {
    if (opts.newStudentFee) {
      feeRows.push({ id: uid(), cells: { name: studentDisplayName(student), desc: L(lang, 'New student admission fee (one-time)', 'Phí nhập học (một lần)'), total: fees.newStudentFee }, meta: { studentId: student.id } })
    }
    if (plan === 'staff') {
      feeRows.push({ id: uid(), cells: { name: studentDisplayName(student), desc: L(lang, `Development fee, year ${sy}`, `Phí phát triển năm học ${sy}`), total: fees.staff.developmentFee }, meta: { studentId: student.id } })
    }
    if (plan !== 'trial' && Number(opts.trialDays) > 0) {
      feeRows.push({ id: uid(), cells: { name: studentDisplayName(student), desc: L(lang, `Trial day fee (${opts.trialDays} day${opts.trialDays > 1 ? 's' : ''})`, `Phí ngày học thử (${opts.trialDays} ngày)`), total: Number(opts.trialDays) * fees.trialDay }, meta: { studentId: student.id } })
    }
  })
  if (feeRows.length) {
    sections.push({
      id: uid('s'), kind: 'fees',
      heading: L(lang, `ADMISSION AND OTHER FEES, YEAR ${sy}`, `PHÍ NHẬP HỌC VÀ CÁC KHOẢN PHÍ KHÁC, NĂM HỌC ${sy}`),
      subheading: '',
      columns: [
        { key: 'name', label: L(lang, "Student's Name", 'Tên học sinh'), type: 'text' },
        { key: 'desc', label: L(lang, 'Description', 'Nội dung'), type: 'text' },
        { key: 'total', label: L(lang, 'Amount', 'Số tiền'), type: 'money' },
      ],
      rows: feeRows, billedKeys: ['total'], summaryLabel: L(lang, 'Other fees', 'Phí khác'), note: '',
    })
  }

  const notes = [...(inputs.extraNotes || []).filter(Boolean)]
  if (inputs.cashOnly) notes.unshift(L(lang, 'Please pay this amount in cash.', 'Phụ huynh vui lòng thanh toán bằng tiền mặt.'))

  return {
    lang, schoolYear: sy, periodId: inputs.periodId,
    periodLabelEn, periodLabelVi,
    summaryHeading: L(lang, `TOTAL PAYMENT FOR ${periodPhraseEn.toUpperCase()}, YEAR ${sy}`, `TỔNG THANH TOÁN CHO ${periodLabelVi.toUpperCase()}, NĂM HỌC ${sy}`),
    sections,
    deductions: (inputs.deductions || []).filter((d) => d.label || d.amount).map((d) => ({ id: uid('d'), label: d.label, amount: Number(d.amount) || 0 })),
    notes,
    flags: { bank: !inputs.cashOnly, qr: !inputs.cashOnly, forceMajeure: inputs.flags?.forceMajeure ?? true },
  }
}

// ---------- Totals ----------
export function rowTotal(section, row) {
  return section.billedKeys.reduce((s, k) => s + (Number(row.cells[k]) || 0), 0)
}

export function sectionBilled(section) {
  return section.rows.reduce((s, r) => s + rowTotal(section, r), 0)
}

export function columnTotal(section, key) {
  return section.rows.reduce((s, r) => s + (Number(r.cells[key]) || 0), 0)
}

export function docTotals(doc) {
  const lines = doc.sections.map((s) => ({ label: s.summaryLabel, amount: sectionBilled(s) }))
  const subtotal = lines.reduce((s, l) => s + l.amount, 0)
  const deducted = (doc.deductions || []).reduce((s, d) => s + (Number(d.amount) || 0), 0)
  return { lines, subtotal, deducted, total: subtotal - deducted }
}

// Recompute a row's derived `total` cell after a quantity / rate edit.
export function recomputeRow(section, row) {
  const c = row.cells
  if (section.kind === 'meals') c.total = (Number(c.days) || 0) * (Number(c.rate) || 0)
  else if (section.kind === 'transport') c.total = (Number(c.months) || 0) * (Number(c.rate) || 0)
  else if (section.kind === 'fees' && 'rate' in c && ('days' in c || 'months' in c)) c.total = (Number(c.days ?? c.months) || 0) * (Number(c.rate) || 0)
  else if (section.kind === 'tuition') {
    const has = (k) => k in c
    if (has('weeks') && has('rate')) c.total = (Number(c.weeks) || 0) * (Number(c.rate) || 0)
    else {
      const partKeys = section.columns.map((x) => x.key).filter((k) => /^(q\d|p\d)$/.test(k))
      if (partKeys.length) c.total = partKeys.reduce((s, k) => s + (Number(c[k]) || 0), 0)
    }
  }
  return row
}
