// Default fee schedule and school calendar for 2026-2027.
// Everything here is a *default*: the Settings page lets you edit a copy that is
// stored in the database, and the invoice builder always reads the stored copy.
// Amounts are VND.

export const SCHOOL_YEAR = '2026-2027'

export const LEVELS = [
  'Nursery',
  'Kindergarten',
  'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6',
  'Year 7', 'Year 8', 'Year 9',
  'Upper Secondary',
]

// Year 9 students moved up to Upper Secondary in 2026-2027, so Year 9 is invoiced
// like Upper Secondary: a pathway fee plus the online (Acellus) fee.
export function isUpperSecondary(level) {
  return level === 'Upper Secondary' || level === 'Year 9'
}

// The level a student moves up to for the next school year.
export function nextLevel(level) {
  const i = LEVELS.indexOf(level)
  return i < 0 ? level : LEVELS[Math.min(i + 1, LEVELS.length - 1)]
}

// Which tuition band a level belongs to.
export function bandFor(level) {
  if (level === 'Nursery') return 'nursery'
  if (level === 'Kindergarten') return 'kindergarten'
  if (isUpperSecondary(level)) return 'upper'
  const n = Number(String(level).replace('Year ', ''))
  if (n >= 1 && n <= 6) return 'y1_6'
  if (n >= 7 && n <= 9) return 'y7_9'
  return 'y1_6'
}

export const PROGRAMS = [
  { id: 'regular', en: 'Regular Program', vi: 'Chương trình chính khoá' },
  { id: 'global', en: 'Global Program', vi: 'Chương trình Global' },
  { id: 'vocational', en: 'Vocational Program', vi: 'Chương trình hướng nghiệp' },
  { id: 'hybrid', en: 'Hybrid Pathway', vi: 'Lộ trình Hybrid' },
  { id: 'independent', en: 'Independent Pathway', vi: 'Lộ trình Independent' },
  { id: 'staff', en: 'Staff child', vi: 'Con nhân viên' },
  { id: 'none', en: 'No program', vi: 'Không theo chương trình' },
]

// A student with no program pays no tuition: the invoice bills only the extras
// (meals, transport, admission and other fees).
export function hasProgram(student) {
  return (student?.program || 'regular') !== 'none'
}

export const DEFAULT_FEES = {
  schoolYear: SCHOOL_YEAR,
  // Tuition per band. quarter = Q1..Q3 amount, quarter4 = Q4 amount.
  tuition: {
    nursery:      { earlyBird: 100_500_000, standard: 109_000_000, quarter: 33_500_000, quarter4: 16_750_000 },
    kindergarten: { earlyBird: 132_000_000, standard: 142_000_000, quarter: 44_000_000, quarter4: 22_000_000 },
    y1_6:         { earlyBird: 168_000_000, standard: 182_000_000, quarter: 56_000_000, quarter4: 28_000_000 },
    y7_9:         { earlyBird: 183_000_000, standard: 197_000_000, quarter: 61_000_000, quarter4: 30_500_000 },
  },
  // Upper Secondary pathways are flat annual amounts.
  upper: {
    hybrid: 150_000_000,
    independent: 80_000_000,
    acellus: 110_000_000, // online fee, every Upper Secondary student: paid by PRA on the family's behalf, reimbursed in cash
  },
  legacyEarlyBird: 150_000_000, // returning "legacy" students keep last year's price
  meals: {
    earlyYears: 75_000, // Nursery + Kindergarten
    primarySecondary: 80_000,
    vocational: 65_000,
  },
  transport: {
    hoiAn: 2_000_000,
    vinhDien: 2_650_000,
    daNang: 4_000_000,
  },
  newStudentFee: 10_000_000,
  trialDay: 1_600_000,
  weekly: {
    globalNursery: 5_000_000,
    vocationalY1_6: 4_500_000,
    vocationalY7_9: 4_800_000,
    summerUpper: 4_000_000,
  },
  staff: {
    materialsPerMonth: 500_000,
    developmentFee: 10_000_000,
  },
  siblingDiscountPct: 5,
  deadlines: {
    earlyBird: '2026-05-20',
    standard: '2026-06-30',
    q1: '2026-07-28',
    q2: '2026-10-08',
    q3: '2026-12-17',
    q4: '2027-03-22',
    semester2: '2026-12-10',
  },
  bank: {
    holder: 'CN CTY TNHH Palm River TAI HOI AN',
    number: '040103245445',
    swift: 'SGTTVNVX',
    branch: 'Sacombank- Hội An',
    addressEn: 'Thanh Nhi Hamlet, Hoi An Dong Ward, Da Nang City, Vietnam',
    addressVi: 'Thôn Thanh Nhì, Phường Hội An Đông, T.P Đà Nẵng, Việt Nam',
  },
  school: {
    nameEn: 'Palm River Academy English Language Center',
    nameVi: 'Trung tâm Anh ngữ Palm River Academy',
    email: 'admin@palmriveracademy.edu.vn',
    addressEn: 'Hoi An Dong Ward, Danang City, Vietnam',
    addressVi: 'Phường Hội An Đông, thành phố Đà Nẵng, Việt Nam',
    legalName: 'Chi Nhánh Công Ty TNHH Palm River tại Hội An',
    taxCode: '0401916181-001',
    receiptAddress: '2 Vong Nhi 2, Hoi An Dong ward, Da Nang city, Viet Nam',
  },
}

// School days per month, August 2026 to June 2027, from the academic calendar.
// Quarter boundaries: Q1 Aug 4-Oct 8, Q2 Oct 15-Dec 17, Q3 Jan 5-Mar 24, Q4 Mar 29-Jun 4.
// October and March are split between two quarters, so those months carry two numbers.
export const DEFAULT_CALENDAR = {
  schoolYear: SCHOOL_YEAR,
  firstDay: '2026-08-04',
  lastDay: '2027-06-04',
  months: [
    { key: '2026-08', en: 'August', vi: 'Tháng 8', days: 19 },
    { key: '2026-09', en: 'September', vi: 'Tháng 9', days: 20 },
    { key: '2026-10', en: 'October', vi: 'Tháng 10', days: 18 },
    { key: '2026-11', en: 'November', vi: 'Tháng 11', days: 20 },
    { key: '2026-12', en: 'December', vi: 'Tháng 12', days: 13 },
    { key: '2027-01', en: 'January', vi: 'Tháng 1', days: 18 },
    { key: '2027-02', en: 'February', vi: 'Tháng 2', days: 9 },
    { key: '2027-03', en: 'March', vi: 'Tháng 3', days: 21 },
    { key: '2027-04', en: 'April', vi: 'Tháng 4', days: 17 },
    { key: '2027-05', en: 'May', vi: 'Tháng 5', days: 21 },
    { key: '2027-06', en: 'June', vi: 'Tháng 6', days: 4 },
  ],
  quarters: [
    { id: 'q1', en: 'Quarter 1', vi: 'Quý 1', start: '2026-08-04', end: '2026-10-08', days: 45, months: 3, // Aug 19 + Sep 20 + Oct 6
      rangeEn: 'August 4th to October 8th, 2026', rangeVi: '04.08.2026 - 08.10.2026' },
    { id: 'q2', en: 'Quarter 2', vi: 'Quý 2', start: '2026-10-15', end: '2026-12-17', days: 45, months: 3, // Oct 12 + Nov 20 + Dec 13
      rangeEn: 'October 15th to December 17th, 2026', rangeVi: '15.10.2026 - 17.12.2026' },
    { id: 'q3', en: 'Quarter 3', vi: 'Quý 3', start: '2027-01-05', end: '2027-03-24', days: 45, months: 3, // Jan 18 + Feb 9 + Mar 18
      rangeEn: 'January 5th to March 24th, 2027', rangeVi: '05.01.2027 - 24.03.2027' },
    { id: 'q4', en: 'Quarter 4', vi: 'Quý 4', start: '2027-03-29', end: '2027-06-04', days: 45, months: 3, // Mar 3 + Apr 17 + May 21 + Jun 4
      rangeEn: 'March 29th to June 4th, 2027', rangeVi: '29.03.2027 - 04.06.2027' },
  ],
}

export function totalSchoolDays(cal = DEFAULT_CALENDAR) {
  return cal.months.reduce((s, m) => s + Number(m.days || 0), 0)
}

// Days + months for a billing period id: 'year', 'sem1', 'sem2', 'q1'..'q4'.
export function periodInfo(periodId, cal = DEFAULT_CALENDAR) {
  const q = Object.fromEntries(cal.quarters.map((x) => [x.id, x]))
  switch (periodId) {
    case 'year':
      return { days: totalSchoolDays(cal), months: cal.months.length - 1, // 10 transport months (June is 4 days)
        rangeEn: 'August 4th, 2026 to June 4th, 2027', rangeVi: '04.08.2026 - 04.06.2027', en: 'the year', vi: 'năm học' }
    case 'sem1':
      return { days: q.q1.days + q.q2.days, months: 5,
        rangeEn: 'August 4th to December 17th, 2026', rangeVi: '04.08.2026 - 17.12.2026', en: 'Semester 1', vi: 'Học kỳ 1' }
    case 'sem2':
      return { days: q.q3.days + q.q4.days, months: 5,
        rangeEn: 'January 5th to June 4th, 2027', rangeVi: '05.01.2027 - 04.06.2027', en: 'Semester 2', vi: 'Học kỳ 2' }
    default: {
      const x = q[periodId]
      if (!x) return { days: 0, months: 0, rangeEn: '', rangeVi: '', en: periodId, vi: periodId }
      return { days: x.days, months: x.months, rangeEn: x.rangeEn, rangeVi: x.rangeVi, en: x.en, vi: x.vi }
    }
  }
}

export function mealRateFor(level, program, fees = DEFAULT_FEES) {
  if (program === 'vocational') return fees.meals.vocational
  const band = bandFor(level)
  if (band === 'nursery' || band === 'kindergarten') return fees.meals.earlyYears
  return fees.meals.primarySecondary
}
