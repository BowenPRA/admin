import { genId } from '../db'

export const fmtDate = (d, opts) => {
  if (!d) return ''
  const dt = new Date(d.length === 10 ? `${d}T00:00:00` : d)
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short', year: 'numeric' })
}

export function subjectByKey(settings, key) {
  return (settings?.subjects || []).find((s) => s.key === key) || { key, name: key, kind: 'vocational' }
}

export function levelInfo(settings, value) {
  const v = Number(value)
  return (settings?.levels || []).find((l) => l.value === v) || null
}

export function templateForYearGroup(settings, yg) {
  return Object.values(settings?.templates || {}).find((t) => (t.yearGroups || []).includes(yg)) || null
}

export const TIER_KEYS = ['academic', 'specialist', 'vocational']

/** A section's tier comes from the current settings, so re-tiering an area applies to existing reports. */
export function tierOf(settings, section) {
  return (settings?.subjects || []).find((s) => s.key === section.subject_key)?.kind || section.kind || 'vocational'
}

/** { academic: [...], specialist: [...], vocational: [...] } in the order areas are listed in settings. */
export function sectionsByTier(settings, sections) {
  const keys = (settings?.subjects || []).map((s) => s.key)
  const order = (k) => (keys.includes(k) ? keys.indexOf(k) : keys.length)
  const sorted = [...sections].sort((a, b) => order(a.subject_key) - order(b.subject_key) || (a.sort ?? 0) - (b.sort ?? 0))
  return Object.fromEntries(TIER_KEYS.map((t) => [t, sorted.filter((s) => tierOf(settings, s) === t)]))
}

export const templateAreas = (t) => t?.areas || [...(t?.academic || []), ...(t?.specialist || []), ...(t?.vocational || [])]

/** Learning areas a report for this template and year group contains (Movement is Year 7 only, etc.). */
export function areasFor(settings, template, yearGroup) {
  return templateAreas(template).filter((k) => {
    const only = subjectByKey(settings, k).yearGroups || []
    return !only.length || only.includes(yearGroup)
  })
}

/** Areas a report should have but does not, e.g. Movement on a report created before it was added. */
export function missingAreas(settings, report, sections) {
  const template = settings?.templates?.[report.template] || templateForYearGroup(settings, report.year_group)
  if (!template) return []
  return areasFor(settings, template, report.year_group).filter((k) => !sections.some((s) => s.subject_key === k))
}

/** "Mr. Caleb" for the active teacher linked to `movement:Year 7`, or ''. */
export function teacherNameFor(teachers, key, yearGroup) {
  const t = (teachers || []).find((x) => x.active !== false && (x.subjects || []).includes(`${key}:${yearGroup}`))
  return t ? `${t.title ? `${t.title} ` : ''}${t.name}` : ''
}

export function buildSection(reportId, key, settings, { yearGroup, prev, teachers } = {}) {
  const s = subjectByKey(settings, key)
  return {
    id: genId(), report_id: reportId, subject_key: key, kind: s.kind,
    sort: Math.max(0, (settings?.subjects || []).findIndex((x) => x.key === key)), name: s.name,
    level: null, level_prev: prev?.level ?? null, comment: '', comment_vi: '', next_focus: '',
    score_raw: '', score_pct: null, class_avg: null, teacher_name: teacherNameFor(teachers, key, yearGroup),
  }
}

/** Section rows for a brand-new report. */
export function buildSections(reportId, template, settings, { yearGroup, prevSections = [], teachers = [] } = {}) {
  return areasFor(settings, template, yearGroup).map((key) =>
    buildSection(reportId, key, settings, { yearGroup, teachers, prev: prevSections.find((p) => p.subject_key === key) }))
}

/** Skeleton report row for a student + period. The student's `level` is the year group. */
export function buildReport(student, period, template, settings, homeroom = '') {
  return {
    id: genId(),
    student_id: student.id,
    student_name: student.full_name,
    school_year: settings.schoolYear,
    period_label: period.label,
    period_index: period.index,
    period_start: period.start || null,
    period_end: period.end || null,
    template: template.key,
    year_group: student.level,
    class_name: student.class_group || '',
    homeroom_teacher: homeroom,
    report_date: null,
    glance: '',
    overview_note: '',
    homeroom_note: '',
    homeroom_note_vi: '',
    experiences: [],
    student_voice: '',
    skills: {},
    skill_notes: {},
    status: 'draft',
    lang: 'en',
    show_course_notes: false,
    signatures: (settings.signatures || []).map((s) => ({ ...s })),
  }
}

/** A section is done when it has a level and, except for vocational areas, a comment. */
export function sectionDone(settings, s) {
  return !!s.level && (tierOf(settings, s) === 'vocational' || !!(s.comment || '').trim())
}

/** How much of a report is filled in: every section plus the homeroom teacher comment. */
export function completion(report, sections, settings) {
  const total = sections.length + 1
  const done = sections.filter((s) => sectionDone(settings, s)).length + ((report.homeroom_note || '').trim() ? 1 : 0)
  return { done, total, pct: Math.round((done / total) * 100) }
}

export const hasNum = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v))

/** Average per subject across a cohort's sections (ignores blanks). */
export function cohortAverages(sections, field = 'score_pct') {
  const acc = {}
  for (const s of sections) {
    if (!hasNum(s[field])) continue
    acc[s.subject_key] = acc[s.subject_key] || { sum: 0, n: 0 }
    acc[s.subject_key].sum += Number(s[field]); acc[s.subject_key].n++
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, Math.round(v.sum / v.n)]))
}

/** "45/50" -> 90; anything else -> null. */
export function pctFromRaw(raw) {
  const m = String(raw || '').match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/)
  return m && parseFloat(m[2]) > 0 ? Math.round((parseFloat(m[1]) / parseFloat(m[2])) * 100) : null
}

/** A teacher can type N/A as the raw score when a student was not reviewed. */
export const isNA = (raw) => /^\s*n\s*\/?\s*a\s*$/i.test(raw || '')

/**
 * Rows for the review score table: one per scored academic area, with a cell
 * per period plus a summative cell. Cell states:
 *   score  a percentage (with the class average as `ref` when known)
 *   tbd    still to come: a later quarter, or this quarter's score not entered yet
 *   na     not enrolled that quarter (no report), or N/A typed as the score
 *   blank  an earlier report exists but no score was recorded
 * The summative review is entered on the last period's report.
 */
export function reviewRows(settings, { report, sections, history = [], cohortAvg = {}, summativeAvg = {} }) {
  const periods = settings?.periods || []
  const cur = Number(report.period_index)
  const last = Math.max(...periods.map((p) => Number(p.index)), cur)
  const avgOr = (s, fallback) => (hasNum(s.class_avg) ? Number(s.class_avg) : fallback ?? null)
  return sectionsByTier(settings, sections).academic
    .filter((sec) => subjectByKey(settings, sec.subject_key).scored !== false)
    .map((sec) => {
      const key = sec.subject_key
      const cells = periods.map((p) => {
        const idx = Number(p.index)
        if (idx > cur) return { state: 'tbd' }
        const past = idx === cur ? { sections } : history.find((h) => Number(h.report.period_index) === idx)
        if (!past) return { state: 'na' }
        const found = past.sections.find((x) => x.subject_key === key)
        if (!found || isNA(found.score_raw)) return { state: 'na' }
        if (!hasNum(found.score_pct)) return { state: idx === cur ? 'tbd' : 'blank' }
        return { state: 'score', pct: Math.round(Number(found.score_pct)), ref: idx === cur ? avgOr(found, cohortAvg[key]) : avgOr(found) }
      })
      let summative = { state: 'tbd' }
      if (cur >= last && isNA(sec.summative_raw)) summative = { state: 'na' }
      else if (cur >= last && hasNum(sec.summative_pct)) summative = { state: 'score', pct: Math.round(Number(sec.summative_pct)), ref: summativeAvg[key] ?? null }
      return { key, name: subjectByKey(settings, key).name, icon: subjectByKey(settings, key).icon, cells, summative }
    })
}

export function avg(nums) {
  const xs = nums.filter(hasNum).map(Number)
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null
}

export const firstName = (student) => (student?.nickname || student?.full_name || '').split(' ')[0]

export const charCount = (t) => (t || '').trim().length

export function currentPeriod(settings) {
  const t = new Date().toISOString().slice(0, 10)
  const ps = settings?.periods || []
  return ps.find((p) => p.start <= t && t <= p.end) || ps.find((p) => t < p.start) || ps[ps.length - 1] || null
}
