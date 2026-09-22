// Weekly timetable for 2026-2027, from the workbook "Schedule 2026-2027"
// (sheets Nursery+Kindy, SubjectTeacher Year 1-HS and Duty). These are only the
// starting values: once someone edits the schedule in the app it is stored in
// adm_settings (key 'schedule') and that copy is used instead.
//
// A row is either one thing for the whole week ({ time, all, kind }) or five
// cells, Monday to Friday ({ time, days: [cell × 5] }). A cell is
// { s: subject, t: [teachers], kind? }; `kind` marks the rows that are not
// lessons: 'routine' (arrival, pick-up), 'homeroom', 'break' or 'lunch'.

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
export const DAYS_VI = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu']

const c = (s, ...t) => ({ s, t })
const week = (cell) => DAYS.map(() => ({ ...cell, t: [...(cell.t || [])] }))
const all = (time, label, kind, t = []) => ({ time, all: label, kind, t })
const SNACK = { s: 'Snack / Break', t: [], kind: 'break' }

const SOLO = 'Ms. Solo'
const CALEB = 'Mr. Caleb'
const KIU = 'Ms. Kiu'
const DAVID = 'Mr. David'
const BOWEN = 'Mr. Bowen'
const SETH = 'Mr. Seth'
const DUYEN = 'Ms. Duyen'
const THAM_V = 'Ms. Thắm V'
const THAM_N = 'Ms. Tham N'
const THANH = 'Ms. Thanh'
const THOA = 'Ms. Thoa'
const CHIEN = 'Mr. Chiến'

const primaryMorning = (homeroom, p1, p2, p3) => [
  all('8:00–8:30', 'Arrival / Soft Start', 'routine'),
  all('8:30–8:45', 'Homeroom', 'homeroom', [homeroom]),
  { time: '8:45–9:35', days: week(p1) },
  { time: '9:35–10:25', days: week(p2) },
  all('10:25–10:45', 'Snack / Break', 'break'),
  { time: '10:45–11:35', days: week(p3) },
]

// Years 2 to 5 share their afternoons.
const afternoonY2to5 = () => [
  all('11:35–12:25', 'Lunch', 'lunch'),
  { time: '12:25–13:15', days: [c('Review', THAM_V), c('Movement & Exercise', CHIEN), c('Dance', CALEB), c('Movement & Exercise', CHIEN), c('Everyday Experts', CALEB)] },
  { time: '13:15–14:05', days: [c('Book Worms', CALEB), c('Wellbeing', KIU), c('Craft', THAM_V), c('Review', THAM_V), c('Craft, then snack at 13:45', THAM_V)] },
  { time: '14:05–14:25', days: [SNACK, SNACK, SNACK, SNACK, c('Cooking', SETH)].map((x) => ({ ...x })) },
  { time: '14:25–15:15', days: [c('Technology', CALEB), c('Everyday Experts', CALEB), c('Boredom', THAM_V), c('Art', CALEB), c('Cooking', SETH)] },
]

export const DEFAULT_SCHEDULE = {
  version: 1,
  schoolYear: '2026-2027',
  classes: [
    {
      key: 'nursery', name: 'Nursery', yearGroups: ['Nursery'], room: 'Room 1.3', homeroom: THAM_N,
      rows: [
        all('8:00–8:30', 'Welcome / Drop-off', 'routine'),
        { time: '8:30–9:15', days: week(c('Learning time', THAM_N, THOA)) },
        { time: '9:15–10:00', days: week(c('Learning time', THAM_N, THOA)) },
        all('10:00–10:30', 'Snack and play', 'break'),
        { time: '10:30–11:15', days: week(c('Learning time', THAM_N, THOA)) },
        all('11:15–13:45', 'Lunch and nap', 'lunch'),
        { time: '13:45–14:30', days: week(c('Learning time', SOLO, THOA)) },
        all('14:30–15:15', 'Snack and play', 'break'),
        all('15:15–15:30', 'Goodbye / Pick-up', 'routine'),
        all('15:30–16:00', 'Teacher time', 'routine'),
      ],
    },
    {
      key: 'kindergarten', name: 'Kindergarten', yearGroups: ['Kindergarten'], room: 'Room 1.4', homeroom: THANH,
      rows: [
        all('8:00–8:30', 'Welcome / Drop-off', 'routine'),
        { time: '8:30–9:15', days: week(c('Outside play', THANH)) },
        { time: '9:15–10:00', days: week(c('Phonics and Math', THANH)) },
        all('10:00–10:30', 'Snack and play', 'break'),
        { time: '10:30–11:15', days: week(c('Literacy', KIU)) },
        all('11:15–13:45', 'Lunch and nap', 'lunch'),
        { time: '13:45–14:45', days: week(c('Understanding the World', THANH)) },
        all('14:45–15:15', 'Snack and play', 'break'),
        all('15:15–15:30', 'Goodbye / Pick-up', 'routine'),
        all('15:30–16:00', 'Teacher time', 'routine'),
      ],
    },
    {
      key: 'year1', name: 'Year 1', yearGroups: ['Year 1'], room: '', homeroom: SOLO,
      rows: [
        ...primaryMorning(SOLO, c('English', SOLO), c('Math', SOLO), c('Science', SOLO)),
        all('11:35–12:25', 'Lunch', 'lunch'),
        { time: '12:25–13:15', days: [c('Boredom', DUYEN), c('Practice, Presentation & Play', SOLO), c('Technology', DUYEN), c('Cooking', SETH), c('Crafts', DUYEN)] },
        { time: '13:15–14:05', days: [c('Movement & Exercise', CHIEN), c('Master Minds', SETH), c('Movement & Exercise', CHIEN), c('Cooking', SETH), c('Review', DUYEN)] },
        all('14:05–14:25', 'Snack / Break', 'break'),
        { time: '14:25–15:15', days: [c('Practice, Presentation & Play', SOLO), c('Boredom', DUYEN), c('Crafts', DUYEN), c('Technology', DUYEN), c('Boredom', SOLO)] },
      ],
    },
    {
      key: 'year2_3', name: 'Year 2–3', yearGroups: ['Year 2', 'Year 3'], room: '', homeroom: CALEB,
      rows: [...primaryMorning(CALEB, c('English', CALEB), c('Math', CALEB), c('Science', CALEB)), ...afternoonY2to5()],
    },
    {
      key: 'year5', name: 'Year 5', yearGroups: ['Year 4', 'Year 5', 'Year 6'], room: '', homeroom: KIU,
      rows: [...primaryMorning(KIU, c('English', KIU), c('Science', KIU), c('Math', DAVID)), ...afternoonY2to5()],
    },
    {
      key: 'year7', name: 'Year 7', yearGroups: ['Year 7'], room: '', homeroom: BOWEN,
      rows: [
        all('8:00–8:30', 'Arrival / Soft Start', 'routine'),
        all('8:30–8:45', 'Homeroom', 'homeroom', [BOWEN]),
        { time: '8:45–9:35', days: week(c('Math', BOWEN)) },
        { time: '9:35–10:25', days: week(c('English', DAVID)) },
        all('10:25–10:45', 'Snack / Break', 'break'),
        { time: '10:45–11:35', days: week(c('Science', BOWEN)) },
        { time: '11:35–12:25', days: [c('History', KIU), c('Executive Function', KIU), c('History', KIU), c('Executive Function', KIU), c('Review: History / Executive Function', KIU)] },
        all('12:25–13:15', 'Lunch', 'lunch'),
        { time: '13:15–14:05', days: [c('Art of Science', SETH), c('Movement', CALEB), c('Art of Science', SETH), c('Movement', CALEB), c('Art of Science', SETH)] },
        all('14:05–14:25', 'Snack / Break', 'break'),
        { time: '14:25–15:20', days: [c('Review', DAVID), c('Maker Space', DAVID), c('Maker Space', DAVID), c('Review', BOWEN), c('Wellbeing', KIU)] },
      ],
    },
    {
      key: 'teens', name: 'Teens', yearGroups: ['Year 8', 'Year 9', 'Upper Secondary'], room: '', homeroom: DAVID,
      note: 'Blocks 1 and 2 follow each student’s own program.',
      rows: [
        all('8:00–8:30', 'Arrival / Soft Start', 'routine'),
        all('8:30–8:45', 'Homeroom', 'homeroom', [DAVID]),
        { time: '8:45–9:35', days: week(c('Block 1', DAVID)) },
        { time: '9:35–10:25', days: week(c('Block 1', BOWEN)) },
        all('10:25–10:45', 'Snack / Break', 'break'),
        { time: '10:45–11:35', days: week(c('Block 2', SETH)) },
        { time: '11:35–12:25', days: week(c('Block 2', BOWEN)) },
        all('12:25–13:15', 'Lunch', 'lunch'),
        { time: '13:15–14:05', days: [c('Study time', DAVID), c('Movement', CALEB), c('Study time', DAVID), c('Movement', CALEB), c('Art of Science or Study time', DAVID)] },
        all('14:05–14:25', 'Snack / Break', 'break'),
        { time: '14:25–15:20', days: [c('Study time', DUYEN), c('Study time', BOWEN), c('Maker Space or Study time', SETH), c('Wellbeing', KIU), c('Study time', DUYEN)] },
      ],
    },
  ],
  // Playground and gate duty: who is where, Monday to Friday.
  duties: [
    { time: '8:00–8:30', area: 'Gate', classes: 'All', who: week({ t: [DUYEN] }).map((x) => x.t) },
    { time: '8:00–8:30', area: 'Treehouse', classes: 'All', who: week({ t: [THAM_V] }).map((x) => x.t) },
    { time: '8:00–8:30', area: 'Yard', classes: 'All', who: week({ t: [THANH, THAM_N] }).map((x) => x.t) },
    { time: '8:30–8:45', area: 'Gate (late arrivals)', classes: 'All', who: week({ t: ['Ms. Khuyen'] }).map((x) => x.t) },
    { time: '10:25–10:45', area: 'Yard', classes: 'Year 1 – Teens', who: [[DAVID], [DUYEN], [DUYEN], [DAVID], [SETH]] },
    { time: '10:25–10:45', area: 'Jungle', classes: 'Year 1 – Teens', who: [[DUYEN], [CALEB], [SOLO], [DUYEN], [DUYEN]] },
    { time: '11:35–12:10', area: 'Cafeteria (lunch)', classes: 'Year 1–5', who: week({ t: [THAM_V] }).map((x) => x.t) },
    { time: '12:10–12:25', area: 'Treehouse and yard', classes: 'Year 1–5', who: [[CALEB], [SOLO], [DAVID], [SOLO], [THAM_V]] },
    { time: '12:25–13:15', area: 'Cafeteria, yard and treehouse', classes: 'Year 7 – Teens', who: [[KIU], [SETH], [KIU], [BOWEN], [BOWEN]] },
    { time: '14:05–14:25', area: 'Cafeteria, yard and treehouse', classes: 'Year 1 – Teens', who: [[CALEB], [DUYEN], [THAM_V], [KIU], [DAVID]] },
  ],
}
