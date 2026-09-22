// Which class a student belongs in, from their birthday.
//
// Year groups follow the English system PRA uses: a school year takes children
// born 1 September to 31 August, and Year 1 in 2026-2027 is born Sep 2020 - Aug 2021.
// Kindergarten is the year below Year 1 (Reception), Nursery anything younger,
// and Year 9 and above are Upper Secondary. This matches the 2026-27 roster.
//
// PRA combines some year groups (e.g. Year 6 children sit in the Year 7 class),
// so the age-based year group is then moved to the nearest class that has
// enrolled students this year, going up on a tie.

import { LEVELS } from './fees.js'
import { isEnrolled } from './studentRecords.js'

// Position on one scale: Nursery -1, Kindergarten 0, Year n = n, Upper Secondary 9.
const rank = (level) => {
  if (level === 'Nursery') return -1
  if (level === 'Kindergarten') return 0
  if (level === 'Upper Secondary') return 9
  const n = Number(String(level || '').replace('Year ', ''))
  return Number.isFinite(n) && n > 0 ? Math.min(n, 9) : null
}
const levelForRank = (r) => (r <= -1 ? 'Nursery' : r === 0 ? 'Kindergarten' : r >= 9 ? 'Upper Secondary' : `Year ${r}`)

/** Age-based year group for a birthday, e.g. 'Year 6'. schoolYear like '2026-2027'. */
export function yearGroupForBirthday(dob, schoolYear) {
  const m = String(dob || '').match(/^(\d{4})-(\d{2})/)
  if (!m) return null
  const start = Number(String(schoolYear || '').slice(0, 4)) || new Date().getFullYear()
  // Born Sep..Dec counts with the following calendar year's cohort.
  const cohort = Number(m[1]) + (Number(m[2]) >= 9 ? 1 : 0)
  return levelForRank(Math.max(-1, Math.min(9, start - cohort - 4)))
}

/**
 * Suggested class for a student. `students` is everyone, used to see which
 * classes are running (the student themself is left out).
 * Returns { level, yearGroup, combined } or null without a birthday.
 */
export function suggestClass(student, students, schoolYear) {
  const yearGroup = yearGroupForBirthday(student?.dob, schoolYear)
  if (!yearGroup) return null
  const running = [...new Set((students || [])
    .filter((s) => s.id !== student.id && isEnrolled(s) && LEVELS.includes(s.level))
    .map((s) => (s.level === 'Year 9' ? 'Upper Secondary' : s.level)))]
  const r = rank(yearGroup)
  let level = yearGroup
  if (running.length && !running.includes(yearGroup)) {
    level = running.slice().sort((a, b) => Math.abs(rank(a) - r) - Math.abs(rank(b) - r) || rank(b) - rank(a))[0]
  }
  return { level, yearGroup, combined: level !== yearGroup }
}
