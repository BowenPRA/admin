import { db } from '../db'
import { cohortAverages } from './utils'

const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0)

/** Everything the printed document needs for one report. */
export async function loadReportBundle(id) {
  const report = await db.reports.get(id)
  if (!report) throw new Error('Report not found')
  const [sections, student, yearReports, cohortReports, courseNotes] = await Promise.all([
    db.sections.list({ report_id: id }),
    report.student_id ? db.students.get(report.student_id) : null,
    report.student_id ? db.reports.list({ student_id: report.student_id, school_year: report.school_year }) : [report],
    db.reports.list({ school_year: report.school_year, period_label: report.period_label, year_group: report.year_group }),
    db.courseNotes.list({ school_year: report.school_year, period_label: report.period_label, year_group: report.year_group }),
  ])
  const otherIds = yearReports.map((r) => r.id).filter((x) => x !== id)
  const cohortIds = cohortReports.map((r) => r.id)
  const [histSections, cohortSections] = await Promise.all([
    otherIds.length ? db.sections.list({ report_id: otherIds }) : [],
    cohortIds.length ? db.sections.list({ report_id: cohortIds }) : [],
  ])
  sections.sort(bySort)
  const history = yearReports.map((r) => ({ report: r, sections: r.id === id ? sections : histSections.filter((s) => s.report_id === r.id).sort(bySort) }))
  return {
    report, sections, student: student || { full_name: report.student_name }, history, courseNotes,
    cohortAvg: cohortAverages(cohortSections), summativeAvg: cohortAverages(cohortSections, 'summative_pct'),
  }
}

/** The student's sections from the most recent earlier period this school year (for "previous level"). */
export async function loadPreviousSections(studentId, schoolYear, periodIndex) {
  const reports = (await db.reports.list({ student_id: studentId, school_year: schoolYear }))
    .filter((r) => Number(r.period_index) < Number(periodIndex)).sort((a, b) => b.period_index - a.period_index)
  if (!reports.length) return []
  return db.sections.list({ report_id: reports[0].id })
}
