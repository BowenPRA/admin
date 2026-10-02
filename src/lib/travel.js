// Students who are traveling. A family tells PRA that a student will be away:
// from which day, to which day, and where. That is one trip (a row of
// adm_travel, supabase/updates-2026-10-01-travel.sql). On every day inside a
// trip the student counts as A(T), Absent (Traveling), without anyone marking
// it: nothing is written into the attendance marks, so changing a trip
// corrects every day at once. A Present or Late mark on such a day stands
// (the student came back early); an Absent mark, or no mark, reads as A(T).

export const TRAVEL = 'travel'

const byStart = (a, b) => String(a.from_date).localeCompare(String(b.from_date))

/** One student's trips, the earliest first. */
export const tripsOf = (trips, studentId) => (trips || []).filter((x) => x.student_id === studentId).sort(byStart)

/** The trip a student is on that day ('YYYY-MM-DD'), or null. */
export const tripOn = (trips, studentId, date) => (trips || []).find((x) => x.student_id === studentId && x.from_date <= date && date <= x.to_date) || null

/** What a day counts as: 'present' | 'late' | 'absent' | 'travel', or null when there is no mark and no trip. */
export const statusOn = (mark, trip) => (trip && (!mark || mark.status === 'absent') ? TRAVEL : mark?.status || null)

/** A trip that has not ended yet. */
export const isAhead = (trip, today) => trip.to_date >= today

const dayText = (date, lang) => new Date(`${date}T00:00:00`).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

/** 'Thu 15 Oct to Fri 30 Oct' (or one day) */
export const tripDates = (trip, lang = 'en') => (trip.from_date === trip.to_date
  ? dayText(trip.from_date, lang)
  : `${dayText(trip.from_date, lang)} ${lang === 'vi' ? 'đến' : 'to'} ${dayText(trip.to_date, lang)}`)

/** 'Australia · until Fri 30 Oct': what the attendance row says under a traveling student's name. */
export const tripLine = (trip, lang = 'en') => [trip.place, `${lang === 'vi' ? 'đến hết' : 'until'} ${dayText(trip.to_date, lang)}`].filter(Boolean).join(' · ')

/** Who is away on a day: [{ s, trip }], by name. Only students in `students`. */
export function travelingOn(trips, students, date) {
  return students
    .map((s) => ({ s, trip: tripOn(trips, s.id, date) }))
    .filter((x) => x.trip)
    .sort((a, b) => (a.s.nickname || a.s.full_name).localeCompare(b.s.nickname || b.s.full_name))
}

/** A new trip for a student, starting on `from`. */
export const blankTrip = (studentId, from) => ({ student_id: studentId, from_date: from || '', to_date: from || '', place: '', note: '' })

/** A trip needs both days, and cannot end before it starts. */
export const tripProblem = (trip) => (!trip.from_date || !trip.to_date ? 'tripNeedsDates' : trip.to_date < trip.from_date ? 'tripEndsEarly' : '')

/** A message someone can act on. */
export function travelError(e) {
  const m = e?.message || String(e)
  if (/adm_travel/.test(m) && /(does not exist|schema cache|PGRST205|Could not find)/i.test(m)) return 'Traveling is not set up yet: run supabase/updates-2026-10-01-travel.sql in Supabase > SQL Editor.'
  if (/row-level security/i.test(m)) return 'Your account can add trips only for students in the classes whose attendance you take.'
  return m
}
