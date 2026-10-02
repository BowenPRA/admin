// Attendance over a period (a month, a quarter or the academic year), worked out
// from the daily marks. Shared by the Summary tab and the printed summary
// (pages/PrintAttendance.jsx), so both always show the same numbers.

import { LEVELS } from './fees'
import { isEnrolled, endDateOf } from './studentRecords'
import { TRAVEL, tripsOf, statusOn } from './travel'

export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const parseIso = (s) => new Date(`${s}T00:00:00`)
export const todayIso = () => iso(new Date())
export const levelIndex = (l) => { const i = LEVELS.indexOf(l); return i < 0 ? 99 : i }
export const nameOf = (s) => s?.nickname || s?.full_name || ''
const byName = (a, b) => nameOf(a).localeCompare(nameOf(b))

// PRA does not use "excused" (removed 22 September 2026): older marks read as absent.
// supabase/updates-2026-09-22-no-excused.sql changes the saved rows too.
export const asMarked = (r) => (r.status === 'excused' ? { ...r, status: 'absent' } : r)

/** Below this a student's attendance is flagged. */
export const LOW_RATE = 90
/** Present or late, out of the days marked; null when nothing is marked. */
export const rateOf = (attended, marked) => (marked ? Math.round((attended / marked) * 100) : null)

/**
 * The periods the calendar offers, in order: each month, each quarter, the
 * academic year. `label` is for a picker, `title` and `range` head a printout.
 */
export function attendancePeriods(calendar, lang) {
  const cal = calendar || { months: [], quarters: [] }
  const vi = lang === 'vi'
  const months = (cal.months || []).map((m) => {
    const [y, mo] = m.key.split('-').map(Number)
    const label = vi ? `${m.vi}/${y}` : `${m.en} ${y}`
    return { key: m.key, kind: 'month', label, title: label, range: '', from: `${m.key}-01`, to: iso(new Date(y, mo, 0)), days: Number(m.days) || 0 }
  })
  const quarters = (cal.quarters || []).map((q) => ({
    key: q.id, kind: 'quarter', label: vi ? q.vi : q.en, title: vi ? q.vi : q.en, range: vi ? q.rangeVi : q.rangeEn,
    from: q.start, to: q.end, days: Number(q.days) || 0,
  }))
  const year = cal.firstDay ? [{
    key: 'year', kind: 'year', label: cal.schoolYear || 'Year', title: vi ? `Năm học ${cal.schoolYear || ''}` : `Academic year ${cal.schoolYear || ''}`,
    range: '', from: cal.firstDay, to: cal.lastDay, days: months.reduce((s, m) => s + m.days, 0),
  }] : []
  return [...months, ...quarters, ...year]
}

/** The period to open on: this month while it is in the calendar, else the first one. */
export const defaultPeriod = (periods, key) => periods.find((p) => p.key === key) || periods.find((p) => p.key === todayIso().slice(0, 7)) || periods[0] || null

/** Year groups with enrolled students, youngest first. */
export const yearGroupsOf = (students) => [...new Set(students.filter(isEnrolled).map((s) => s.level).filter(Boolean))].sort((a, b) => levelIndex(a) - levelIndex(b))

const weekdaysBetween = (from, to) => {
  const out = []
  if (!from || !to) return out
  for (const d = parseIso(from); iso(d) <= to; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0 && d.getDay() !== 6) out.push(iso(d))
  return out
}

const tally = () => ({ present: 0, late: 0, absent: 0, travel: 0, marked: 0 })
// A traveling day, A(T), is an absence with its own count: `absent` are the other absences,
// `absences` (see withRate) is both together, and the rate counts both.
const add = (c, status) => { c[status] = (c[status] || 0) + 1; c.marked += 1 }
const sumInto = (c, x) => { c.present += x.present; c.late += x.late; c.absent += x.absent; c.travel += x.travel; c.marked += x.marked }
const withRate = (c) => ({ ...c, absences: c.absent + c.travel, attended: c.present + c.late, rate: rateOf(c.present + c.late, c.marked) })

/**
 * Everything a summary shows for a period and some year groups.
 *
 * `days` are the weekdays of the period that fall inside a quarter (the breaks
 * between quarters are left out), plus any other day that has marks. A day is
 * 'class' when anyone at PRA was marked on it, 'future' when it has not come yet
 * (or is today and nobody is marked), and 'none' otherwise: a holiday, or a day
 * nobody took attendance.
 *
 * Students listed are those in the year groups who are enrolled now, and anyone
 * else with marks in the period (a student who has since left still shows in
 * the months they came). Days before a student's start date, days after an
 * enrolled student's expected end date (`until`), and for a student who has left,
 * days after their last mark, are not counted as unmarked.
 *
 * `trips` are the students' trips (lib/travel.js). A class day inside a trip
 * counts as 'travel' unless the student was marked Present or Late on it; an
 * Absent mark on such a day reads as 'travel' too. A travel day is an absence:
 * it is in `travel` (not in `absent`), in `absences`, and in `marked`, so it
 * lowers the rate like any other absence.
 */
export function summarizeAttendance({ rows, students, groups, period, calendar, trips = [], today = todayIso() }) {
  const marks = (rows || []).map(asMarked).filter((r) => r.date >= period.from && r.date <= period.to)
  const first = calendar?.firstDay && calendar.firstDay > period.from ? calendar.firstDay : period.from
  const last = calendar?.lastDay && calendar.lastDay < period.to ? calendar.lastDay : period.to
  const quarters = calendar?.quarters || []
  const inTerm = (d) => !quarters.length || quarters.some((q) => d >= q.start && d <= q.end)
  const markedDates = new Set(marks.map((r) => r.date))
  const dates = [...new Set([...weekdaysBetween(first, last).filter(inTerm), ...markedDates])].sort()
  const days = dates.map((date) => ({ date, state: markedDates.has(date) ? 'class' : date >= today ? 'future' : 'none' }))
  const classDays = days.filter((d) => d.state === 'class').map((d) => d.date)

  // Months of the period, for the quarter and year views.
  const months = (calendar?.months || []).filter((m) => m.key >= period.from.slice(0, 7) && m.key <= period.to.slice(0, 7)).map((m) => m.key)

  const byStudent = new Map()
  for (const r of marks) {
    if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, {})
    byStudent.get(r.student_id)[r.date] = r
  }

  const inGroups = students.filter((s) => groups.includes(s.level) && (isEnrolled(s) || byStudent.has(s.id)))
  const studentRow = (s) => {
    const mine = { ...(byStudent.get(s.id) || {}) }
    // An enrolled student's expected end date (studentRecords.endDateOf): after it they are
    // not expected, so a trip does not turn an unmarked day into A(T). A mark still counts.
    const until = isEnrolled(s) ? endDateOf(s) : ''
    const away = tripsOf(trips, s.id)
    if (away.length) {
      classDays.forEach((d) => {
        if (until && d > until && !mine[d]) return
        const trip = away.find((x) => x.from_date <= d && d <= x.to_date)
        if (trip && statusOn(mine[d], trip) === TRAVEL) mine[d] = { ...(mine[d] || { student_id: s.id, date: d }), status: TRAVEL, trip }
      })
    }
    const c = tally()
    const perMonth = Object.fromEntries(months.map((k) => [k, tally()]))
    Object.values(mine).forEach((r) => { add(c, r.status); if (perMonth[r.date.slice(0, 7)]) add(perMonth[r.date.slice(0, 7)], r.status) })
    const start = s.start_date && s.start_date > first ? s.start_date : null
    // Someone who has left is only expected up to the last day they were marked; an
    // enrolled student with an expected end date, up to that day.
    const end = isEnrolled(s) ? until || null : Object.keys(mine).sort().pop() || ''
    const expected = (date) => (!start || date >= start) && (end == null || date <= end)
    const unmarked = classDays.filter((d) => !mine[d] && expected(d)).length
    const absentOn = Object.values(mine).filter((r) => r.status === 'absent' || r.status === TRAVEL).map((r) => r.date).sort()
    return {
      s, marks: mine, expected, until, unmarked, absentOn,
      ...withRate(c),
      months: Object.fromEntries(months.map((k) => [k, withRate(perMonth[k])])),
    }
  }

  const groupRows = groups.map((g) => {
    const list = inGroups.filter((s) => s.level === g).sort(byName).map(studentRow)
    const c = tally()
    list.forEach((x) => sumInto(c, x))
    const daily = Object.fromEntries(days.map((d) => [d.date, tally()]))
    list.forEach((x) => Object.values(x.marks).forEach((r) => daily[r.date] && add(daily[r.date], r.status)))
    // Class days on which this year group was expected but nobody in it was marked.
    const notTaken = classDays.filter((d) => !daily[d]?.marked && list.some((x) => x.expected(d)))
    const notes = list.flatMap((x) => Object.values(x.marks).filter((r) => (r.note || '').trim()).map((r) => ({ s: x.s, date: r.date, status: r.status, note: r.note.trim() })))
      .sort((a, b) => a.date.localeCompare(b.date) || byName(a.s, b.s))
    const monthRates = Object.fromEntries(months.map((k) => {
      const m = tally()
      list.forEach((x) => sumInto(m, x.months[k]))
      return [k, withRate(m)]
    }))
    return {
      g, students: list, daily, notTaken, notes, months: monthRates,
      daysMarked: new Set(list.flatMap((x) => Object.keys(x.marks))).size,
      unmarked: list.reduce((n, x) => n + x.unmarked, 0),
      perfect: list.filter((x) => x.marked && !x.absences && !x.late).length,
      ...withRate(c),
    }
  })

  const everyone = groupRows.flatMap((x) => x.students)
  const total = tally()
  everyone.forEach((x) => sumInto(total, x))
  const daily = Object.fromEntries(days.map((d) => [d.date, tally()]))
  everyone.forEach((x) => Object.values(x.marks).forEach((r) => daily[r.date] && add(daily[r.date], r.status)))

  return {
    period, days, classDays, months, groups: groupRows, daily,
    students: everyone.length,
    perfect: everyone.filter((x) => x.marked && !x.absences && !x.late).length,
    absentStudents: everyone.filter((x) => x.absences).length,
    travelStudents: everyone.filter((x) => x.travel).length,
    lateStudents: everyone.filter((x) => x.late).length,
    unmarked: everyone.reduce((n, x) => n + x.unmarked, 0),
    low: everyone.filter((x) => x.rate != null && x.rate < LOW_RATE).sort((a, b) => a.rate - b.rate || levelIndex(a.s.level) - levelIndex(b.s.level) || byName(a.s, b.s)),
    ...withRate(total),
  }
}
