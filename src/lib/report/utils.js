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

/** Section rows for a brand-new report, ordered academic first then vocational. */
export function buildSections(reportId, template, settings, prevSections = []) {
  const keys = [...(template.academic || []), ...(template.vocational || [])]
  return keys.map((key, i) => {
    const s = subjectByKey(settings, key)
    const prev = prevSections.find((p) => p.subject_key === key)
    return {
      id: genId(), report_id: reportId, subject_key: key, kind: s.kind, sort: i, name: s.name,
      level: null, level_prev: prev?.level ?? null, comment: '', comment_vi: '', next_focus: '',
      score_raw: '', score_pct: null, class_avg: null, teacher_name: '',
    }
  })
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

/** How much of a report is filled in: levels + comments for every section, plus the two homeroom texts. */
export function completion(report, sections) {
  let total = 2, done = 0
  for (const s of sections) {
    total += 2
    if (s.level) done++
    if ((s.comment || '').trim()) done++
  }
  if ((report.glance || '').trim()) done++
  if ((report.homeroom_note || '').trim()) done++
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

export const hasNum = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v))

/** Average score per subject across a cohort's sections (ignores blanks). */
export function cohortAverages(sections) {
  const acc = {}
  for (const s of sections) {
    if (!hasNum(s.score_pct)) continue
    acc[s.subject_key] = acc[s.subject_key] || { sum: 0, n: 0 }
    acc[s.subject_key].sum += Number(s.score_pct); acc[s.subject_key].n++
  }
  return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, Math.round(v.sum / v.n)]))
}

export function avg(nums) {
  const xs = nums.filter(hasNum).map(Number)
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null
}

export const firstName = (student) => (student?.nickname || student?.full_name || '').split(' ')[0]

export function wordCount(t) { return (t || '').trim().split(/\s+/).filter(Boolean).length }

export function currentPeriod(settings) {
  const t = new Date().toISOString().slice(0, 10)
  const ps = settings?.periods || []
  return ps.find((p) => p.start <= t && t <= p.end) || ps.find((p) => t < p.start) || ps[ps.length - 1] || null
}
