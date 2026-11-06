import { Gamepad2, ListChecks, MonitorPlay, Presentation, Printer } from 'lucide-react'
import { useT } from './i18n'
import { splitSubjectKey } from '../data/staff'
import { fmtDay, todayIso } from './leads'

// Lessons: teachers ask for a lesson for one of their classes, whoever runs PRA's
// Claude account builds it (pra-triage/the_current_lessons.py + the teacher-lessons
// skill), and the links come back on the request. One row per request in
// adm_lesson_requests, what the builder should know about a class in
// adm_class_profiles, the book catalogue in adm_sources.
// See supabase/updates-2026-11-05-lessons.sql.

// The Lessons tab is being tried first by Mr. Bowen and Mr. David (Bowen, 5 Nov 2026).
// Only these logins see it: the menu entry, the page, the Home card and the PRA Learn
// login line in the student window. To open it to more teachers, add their login
// address here and say so in handbook chapter 20.
export const LESSONS_PILOT = ['bowen@pra.edu.vn', 'david@pra.edu.vn']
/** Whether this login is in the Lessons pilot. */
export const inLessonsPilot = (email) => LESSONS_PILOT.includes(String(email || '').trim().toLowerCase())

/** Words in the language the app is shown in: L('English', 'Tiếng Việt'). */
export function useL() {
  const { lang } = useT()
  return { L: (en, vi) => (lang === 'vi' && vi ? vi : en), lang }
}

// Each status has one colour, used for its pill, the left edge of its row and its
// button in the request window: `tone` light, `solid` when picked, `bar` the row edge.
// `teacher` is the hint a teacher reads; `office` the one the office reads.
export const LESSON_STATUSES = [
  { id: 'draft', en: 'Draft', vi: 'Nháp', tone: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400', solid: 'bg-slate-600 text-white', bar: 'border-l-slate-300', hover: 'hover:bg-slate-50',
    teacher: ['Not in the queue yet. Send it when it is ready.', 'Yêu cầu chưa được gửi đi. Thầy cô bấm Gửi khi đã xong.'],
    office: ['Not sent yet.', 'Chưa gửi.'] },
  { id: 'sent', en: 'Sent', vi: 'Đã gửi', tone: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500', solid: 'bg-sky-600 text-white', bar: 'border-l-sky-400', hover: 'hover:bg-sky-50',
    teacher: ['In the queue. Nobody has started it yet, so you can still change or cancel it.', 'Đang chờ trong danh sách. Chưa ai bắt đầu soạn nên thầy cô vẫn có thể sửa hoặc hủy.'],
    office: ['Waiting to be built.', 'Đang chờ soạn.'] },
  { id: 'building', en: 'Building', vi: 'Đang soạn', tone: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', solid: 'bg-amber-500 text-white', bar: 'border-l-amber-400', hover: 'hover:bg-amber-50',
    teacher: ['The lesson is being made.', 'Bài giảng đang được soạn.'],
    office: ['Someone is building it.', 'Đang có người soạn.'] },
  { id: 'question', en: 'Question for you', en_office: 'Waiting on the teacher', vi: 'Cần thầy cô trả lời', vi_office: 'Chờ giáo viên trả lời', tone: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500', solid: 'bg-violet-600 text-white', bar: 'border-l-violet-400', hover: 'hover:bg-violet-50',
    teacher: ['There is a question for you below. Your answer sends the request back to the builder.', 'Có một câu hỏi bên dưới. Khi thầy cô trả lời, yêu cầu sẽ được chuyển lại cho người soạn.'],
    office: ['A question was asked. It comes back when the teacher answers.', 'Đã hỏi giáo viên. Yêu cầu quay lại khi giáo viên trả lời.'] },
  { id: 'ready', en: 'Ready to check', vi: 'Sẵn sàng để xem', tone: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500', solid: 'bg-teal-600 text-white', bar: 'border-l-teal-500', hover: 'hover:bg-teal-50',
    teacher: ['Open each part and look through it. Approve it, or ask for changes.', 'Thầy cô mở từng phần để xem. Duyệt, hoặc yêu cầu sửa.'],
    office: ['Built. The teacher checks it.', 'Đã soạn xong. Giáo viên đang xem lại.'] },
  { id: 'changes', en: 'Changes asked', vi: 'Đã yêu cầu sửa', tone: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500', solid: 'bg-orange-500 text-white', bar: 'border-l-orange-400', hover: 'hover:bg-orange-50',
    teacher: ['Your changes are with the builder.', 'Phần cần sửa đã được gửi cho người soạn.'],
    office: ['The teacher asked for changes. See the comments.', 'Giáo viên yêu cầu sửa. Xem phần trao đổi.'] },
  { id: 'done', en: 'Done', vi: 'Hoàn tất', tone: 'bg-green-100 text-green-800', dot: 'bg-green-600', solid: 'bg-green-600 text-white', bar: 'border-l-green-500', hover: 'hover:bg-green-50',
    teacher: ['Approved. The links stay here.', 'Đã duyệt. Các đường dẫn vẫn ở đây.'],
    office: ['Approved by the teacher.', 'Giáo viên đã duyệt.'] },
  { id: 'cancelled', en: 'Cancelled', vi: 'Đã hủy', tone: 'bg-stone-100 text-stone-500', dot: 'bg-stone-400', solid: 'bg-stone-500 text-white', bar: 'border-l-stone-300', hover: 'hover:bg-stone-50',
    teacher: ['Cancelled. You can send it again.', 'Đã hủy. Thầy cô có thể gửi lại.'],
    office: ['Cancelled.', 'Đã hủy.'] },
]
export const statusOf = (id) => LESSON_STATUSES.find((s) => s.id === id) || LESSON_STATUSES[1]
export const statusLabel = (id, lang, office = false) => {
  const s = statusOf(id)
  return lang === 'vi' ? (office && s.vi_office) || s.vi : (office && s.en_office) || s.en
}
export const statusHint = (id, lang, office = false) => statusOf(id)[office ? 'office' : 'teacher'][lang === 'vi' ? 1 : 0]

/** What a teacher can ask for. The first three are ticked on a new request. */
export const WANTS = [
  { id: 'slides', en: 'Slides for class', vi: 'Slide trình chiếu trên lớp', hint: ['Slides to teach from, with a one-page plan.', 'Slide để dạy trên lớp, kèm giáo án một trang.'] },
  { id: 'review', en: 'Guided review', vi: 'Ôn tập có hướng dẫn', hint: ['Students go back through the slides and answer questions.', 'Học viên xem lại slide và trả lời câu hỏi.'] },
  { id: 'practice', en: 'Online practice / homework', vi: 'Luyện tập trực tuyến / bài tập về nhà', hint: ['Problems like the Workbook\'s, one step at a time, on learn.pra.edu.vn.', 'Bài tập giống Workbook, làm từng bước, trên learn.pra.edu.vn.'] },
  { id: 'worksheet', en: 'Printed worksheet', vi: 'Phiếu bài tập in', hint: ['An A4 sheet to print, with answers for you.', 'Phiếu A4 để in, kèm đáp án cho giáo viên.'] },
  { id: 'game', en: 'Review game', vi: 'Trò chơi ôn tập', hint: ['A quick game for the whole class.', 'Trò chơi ngắn cho cả lớp.'] },
]
/** How much homework, as the form offers it. */
export const HOMEWORK = [
  { id: '', en: 'No homework', vi: 'Không có bài tập về nhà' },
  { id: 'small', en: 'Small (about 10 minutes)', vi: 'Ít (khoảng 10 phút)' },
  { id: 'medium', en: 'Medium (about 20 minutes)', vi: 'Vừa (khoảng 20 phút)' },
  { id: 'large', en: 'Large (30 minutes or more)', vi: 'Nhiều (từ 30 phút trở lên)' },
]
export const homeworkText = (id, lang) => { const h = HOMEWORK.find((x) => x.id === id); return h ? (lang === 'vi' ? h.vi : h.en) : id }

/** The icon for each of WANTS. */
export const WANT_ICON = { slides: Presentation, review: ListChecks, practice: MonitorPlay, worksheet: Printer, game: Gamepad2 }

export const DEFAULT_WANTS = ['slides', 'review', 'practice']
export const wantOf = (id) => WANTS.find((w) => w.id === id)

/** The links that come back, in the order they are shown, with the button wording. */
export const OUTPUTS = [
  { id: 'slides', en: 'Open slides', vi: 'Mở slide', tone: 'bg-pra-blue text-white hover:bg-pra-navy' },
  { id: 'plan', en: 'Print plan', vi: 'In giáo án', tone: 'bg-slate-700 text-white hover:bg-slate-800' },
  { id: 'review', en: 'Try the review', vi: 'Thử phần ôn tập', tone: 'bg-teal-600 text-white hover:bg-teal-700' },
  { id: 'practice', en: 'Practice', vi: 'Luyện tập', tone: 'bg-green-600 text-white hover:bg-green-700' },
  { id: 'worksheet', en: 'Worksheet', vi: 'Phiếu bài tập', tone: 'bg-amber-500 text-white hover:bg-amber-600' },
  { id: 'game', en: 'Game', vi: 'Trò chơi', tone: 'bg-violet-600 text-white hover:bg-violet-700' },
]
export const hasOutputs = (x) => OUTPUTS.some((o) => !!x?.outputs?.[o.id])

/** Short names for the learning areas, as teachers say them. */
const SUBJECT_NAMES = {
  english: ['English', 'Tiếng Anh'], math: ['Maths', 'Toán'], science: ['Science', 'Khoa học'],
  history: ['Social Studies', 'Khoa học xã hội'], art_of_science: ['Art of Science', 'Art of Science'],
  wellbeing: ['Wellbeing', 'Wellbeing'], executive_function: ['Everyday Life', 'Cuộc sống hằng ngày'],
  everyday_experts: ['Everyday Life', 'Cuộc sống hằng ngày'], technology: ['Technology', 'Công nghệ'],
  art_craft: ['Art & Crafts', 'Mỹ thuật & Thủ công'], cooking: ['Cooking', 'Nấu ăn'], movement: ['Movement', 'Movement'],
  master_minds: ['Master Minds', 'Master Minds'], presentation_play: ['Presentation & Play', 'Presentation & Play'],
  applied_english: ['Applied English', 'Tiếng Anh ứng dụng'], communication: ['Communication & Language', 'Giao tiếp & Ngôn ngữ'],
  understanding_world: ['Understanding the World', 'Hiểu biết về thế giới'], physical: ['Physical Development', 'Phát triển thể chất'],
  expressive_arts: ['Expressive Arts & Design', 'Nghệ thuật & Sáng tạo'],
}
export const subjectName = (key, lang = 'en') => SUBJECT_NAMES[key]?.[lang === 'vi' ? 1 : 0] || String(key || '').replace(/_/g, ' ')
/** 'math:Year 5' -> 'Maths · Year 5'. */
export function className(classKey, lang = 'en') {
  const [subject, group] = splitSubjectKey(classKey)
  return group ? `${subjectName(subject, lang)} · ${group}` : subjectName(subject, lang)
}

const GROUP_ORDER = ['Nursery', 'Kindergarten', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Upper Secondary']
const groupRank = (g) => { const i = GROUP_ORDER.indexOf(g); return i < 0 ? 99 : i }
export const byClass = (a, b) => groupRank(splitSubjectKey(a)[1]) - groupRank(splitSubjectKey(b)[1]) || a.localeCompare(b)

// The classes Lessons and PRA Learn are for (Bowen, 6 November 2026): English, Maths, Science
// and Technology, from Year 1 up (Year 1 to Year 9 and Upper Secondary). Every other class
// (Wellbeing, Movement, Cooking…, and all of Nursery and Kindergarten) gets no class card, is
// not in the request form's class list and not in Student logins. PRA Learn has the same rule
// (learn src/data/subjects.js isLearnClass): change both together.
export const LESSON_SUBJECTS = ['english', 'math', 'science', 'technology']
const YEAR_ONE_UP = /^(Year\s*([1-9]|1[0-3])|Upper Secondary)$/i
export const isLessonClass = (k) => {
  const [subject, group = ''] = String(k || '').split(':')
  return LESSON_SUBJECTS.includes(subject) && YEAR_ONE_UP.test(group.trim())
}
/** The classes a person teaches, from the Teachers page ('english:Year 5'), in the lesson learning areas. */
export const myClasses = (me) => [...new Set((me?.subjects || []).filter(isLessonClass))].sort(byClass)
/** Every class someone teaches in the lesson learning areas, for the office. */
export const allClasses = (teachers = []) => [...new Set(teachers.filter((t) => t.active !== false).flatMap((t) => t.subjects || []).filter(isLessonClass))].sort(byClass)
/** The teachers of a class who sign in. */
export const teachersOf = (classKey, teachers = []) => teachers.filter((t) => t.active !== false && String(t.email || '').includes('@') && (t.subjects || []).includes(classKey))

/** "Ms. Kiu" for an email, or the first part of it. */
export function teacherName(email, teachers = []) {
  const e = String(email || '').toLowerCase()
  if (!e) return ''
  const t = teachers.find((x) => String(x.email || '').toLowerCase() === e)
  if (t) return [t.title, t.name].filter(Boolean).join(' ')
  const part = e.split('@')[0].split('.')[0]
  return part.charAt(0).toUpperCase() + part.slice(1)
}

// A catalogue row's year group can be one year ('Year 5'), several ('Year 2, Year 3') or a
// stage ('Primary', 'Lower Secondary'). A stage counts as the class's own year.
const STAGES = {
  'Early Years': ['Nursery', 'Kindergarten'], Primary: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'],
  'Lower Secondary': ['Year 7', 'Year 8', 'Year 9'],
}
const groupsOf = (yg) => String(yg || '').split(',').map((g) => g.trim()).filter(Boolean).flatMap((g) => STAGES[g] || [g])
/** The kinds a teacher picks a lesson from. Tests, answers and frameworks stay for the builder. */
export const PICKABLE_KINDS = ['workbook', 'learners_book', 'teachers_resource', 'scheme_of_work', 'teacher_folder', 'other']

/**
 * Books for a class: the same learning area, the class's own year (or its stage) first, then
 * the years either side, then rows with no year group. Each has `near` set when it is for
 * another year. Tests, answer keys and frameworks are left out (PICKABLE_KINDS).
 */
export function booksFor(classKey, sources = []) {
  const [subject, group] = splitSubjectKey(classKey)
  const at = groupRank(group)
  const distance = (s) => {
    const gs = groupsOf(s.year_group)
    if (!gs.length) return 0
    if (gs.includes(group)) return 0
    return Math.min(...gs.map((g) => Math.abs(groupRank(g) - at)))
  }
  return sources
    .filter((s) => s.subject === subject && PICKABLE_KINDS.includes(s.kind) && distance(s) <= 1)
    .map((s) => ({ ...s, near: distance(s) > 0 }))
    .sort((a, b) => Number(a.near) - Number(b.near) || PICKABLE_KINDS.indexOf(a.kind) - PICKABLE_KINDS.indexOf(b.kind) || groupRank(groupsOf(a.year_group)[0]) - groupRank(groupsOf(b.year_group)[0]) || String(a.title).localeCompare(String(b.title)))
}

export const KINDS = {
  workbook: ['Workbook', 'Workbook'], learners_book: ['Learner\'s Book', 'Learner\'s Book'], teachers_resource: ['Teacher\'s Resource', 'Teacher\'s Resource'],
  answer_key: ['Answers', 'Đáp án'], scheme_of_work: ['Scheme of work', 'Kế hoạch giảng dạy'], framework: ['Curriculum framework', 'Khung chương trình'],
  test: ['Test', 'Bài kiểm tra'], teacher_folder: ['Teacher\'s folder', 'Thư mục giáo viên'], other: ['Other', 'Khác'],
}

const pagesText = (p) => (Array.isArray(p) && p.length ? (p[0] === p[1] || p.length === 1 ? `${p[0]}` : `${p[0]}-${p[1]}`) : '')
export { pagesText }
/** Page numbers as a person reads them: 'pp. 44–47', 'p. 12' / 'tr. 44–47'. Takes [44, 47] or '44-47'. */
export function pagesLabel(p, lang = 'en') {
  const t = Array.isArray(p) ? pagesText(p) : String(p || '').trim()
  if (!t) return ''
  const range = /[-–]/.test(t)
  return `${lang === 'vi' ? 'tr.' : range ? 'pp.' : 'p.'} ${t.replace(/\s*[-–]\s*/, '–')}`
}

/** Units and sections of a book, flat, in order: [{ unit, section?, label, pages }]. */
export function bookSteps(book) {
  const out = []
  for (const u of book?.units || []) {
    if (u.sections?.length) for (const s of u.sections) out.push({ unit: String(u.n), section: String(s.id), title: s.title, unitTitle: u.title, pages: s.pages })
    else out.push({ unit: String(u.n), section: '', title: u.title, unitTitle: u.title, pages: u.pages })
  }
  return out
}

/** The step after this one in the book (the next section, or the next unit), or null. */
export function nextStep(book, unit, section) {
  const steps = bookSteps(book)
  if (!steps.length) return null
  let i = section ? steps.findIndex((s) => s.unit === String(unit) && s.section === String(section)) : -1
  if (i < 0 && unit) {
    // Only a unit was given: the first step of the next unit.
    const later = steps.findIndex((s) => Number(s.unit) > Number(unit))
    return later < 0 ? null : steps[later]
  }
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null
}

/** The request in a few words: "Unit 5.2 Negative numbers · pp. 44-47" or the topic. */
export function requestTitle(x, sources = [], lang = 'en') {
  const s = x?.source || {}
  const book = sources.find((b) => b.id === s.book_id)
  const unit = book?.units?.find((u) => String(u.n) === String(s.unit))
  const sec = unit?.sections?.find((q) => String(q.id) === String(s.section))
  const vi = lang === 'vi'
  if (s.section) return [`${vi ? 'Bài' : 'Unit'} ${s.section}`, sec?.title].filter(Boolean).join(' ')
  // A topic says more than a unit's name ("Addition and subtraction"), so it comes first.
  if (s.topic) return s.topic
  if (s.unit) return [`${vi ? 'Chương' : 'Unit'} ${s.unit}`, unit?.title].filter(Boolean).join(' ')
  if (book) return book.title
  if (s.links?.length) return vi ? 'Từ đường dẫn Drive' : 'From a Drive link'
  if (x?.files?.length) return vi ? 'Từ tệp của thầy cô' : 'From your files'
  return vi ? 'Yêu cầu chưa có nội dung' : 'Request with no source yet'
}

/** Whether the request names something to build from: a book, a file, a link or a topic. */
export const hasSource = (x) => {
  const s = x?.source || {}
  return !!(s.book_id || String(s.topic || '').trim() || (s.links || []).some((l) => String(l).trim()) || (x?.files || []).length)
}

export const isOpen = (x) => !['done', 'cancelled'].includes(x?.status)
/** Teachers can change a request until it is done; the office any time. */
export const canEditRequest = (x, manager) => manager || ['draft', 'sent', 'cancelled'].includes(x?.status)
/** The person who added it, while it is a draft or sent; Bowen and Seth any. Same rule as the database. */
export function canDeleteRequest(x, me) {
  if (!x?.id || !me) return false
  if (me.reportHead || ['super_admin', 'head'].includes(me.access)) return true
  return String(x.created_by || '').toLowerCase() === String(me.email || '').toLowerCase() && ['draft', 'sent'].includes(x.status)
}

/** Most pressing first: the teaching date (none last), then the number. */
export function byNeeded(a, b) {
  if (!a.needed_by !== !b.needed_by) return a.needed_by ? -1 : 1
  return String(a.needed_by || '').localeCompare(String(b.needed_by || '')) || (a.number || 0) - (b.number || 0)
}
/** Newest first. */
export const byNewest = (a, b) => (b.number || 0) - (a.number || 0)

/** The office's queue tabs. */
export const QUEUE_TABS = [
  { id: 'build', en: 'To build', vi: 'Cần soạn', statuses: ['sent', 'changes'], on: 'border-sky-600 text-sky-700', badge: 'bg-sky-600 text-white', soft: 'bg-sky-100 text-sky-800' },
  { id: 'building', en: 'Building', vi: 'Đang soạn', statuses: ['building'], on: 'border-amber-500 text-amber-700', badge: 'bg-amber-500 text-white', soft: 'bg-amber-100 text-amber-800' },
  { id: 'question', en: 'Questions', vi: 'Câu hỏi', statuses: ['question'], on: 'border-violet-600 text-violet-700', badge: 'bg-violet-600 text-white', soft: 'bg-violet-100 text-violet-800' },
  { id: 'ready', en: 'Ready to check', vi: 'Sẵn sàng để xem', statuses: ['ready'], on: 'border-teal-600 text-teal-700', badge: 'bg-teal-600 text-white', soft: 'bg-teal-100 text-teal-800' },
  { id: 'done', en: 'Done', vi: 'Hoàn tất', statuses: ['done'], on: 'border-green-600 text-green-700', badge: 'bg-green-600 text-white', soft: 'bg-green-100 text-green-800' },
]

/** The order a teacher's own requests are grouped in: what needs them first. */
export const TEACHER_GROUPS = ['question', 'ready', 'changes', 'sent', 'building', 'draft', 'done', 'cancelled']

/** The teaching date as people say it: "Today", "Tomorrow", "Thu 12 Nov", "3 days ago". */
const WEEKDAYS = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] }
export function dayText(iso, lang = 'en', today = todayIso()) {
  if (!iso) return ''
  const vi = lang === 'vi'
  const n = Math.round((new Date(`${String(iso).slice(0, 10)}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
  if (n === 0) return vi ? 'Hôm nay' : 'Today'
  if (n === 1) return vi ? 'Ngày mai' : 'Tomorrow'
  const day = fmtDay(iso, lang)
  if (n < 0 || n > 13) return day
  const wd = WEEKDAYS[vi ? 'vi' : 'en'][new Date(`${String(iso).slice(0, 10)}T00:00:00`).getDay()]
  return vi ? `${wd}, ${day}` : `${wd} ${day}`
}
/** Colour of the teaching-date chip: red when past and still open, orange within 2 days. */
export function dayTone(x, today = todayIso()) {
  if (!x?.needed_by) return ''
  if (!isOpen(x)) return 'bg-slate-100 text-slate-600'
  if (x.needed_by < today) return 'bg-red-100 text-red-700'
  const n = Math.round((new Date(`${x.needed_by}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)
  return n <= 2 ? 'bg-orange-100 text-orange-800' : 'bg-indigo-50 text-indigo-700'
}

/** A blank request for a class. */
export const blankRequest = (classKey = '', teacherEmail = '') => ({
  class_key: classKey, teacher_email: teacherEmail, status: 'sent', wants: [...DEFAULT_WANTS],
  source: {}, details: {}, files: [], outputs: {}, updates: [], previous_id: null,
})

/**
 * "Next lesson": the form filled from the teacher's last request for this class: the same
 * book and what they asked for, the next section and its pages, previous_id set.
 */
export function nextRequest(last, sources = []) {
  const s = last.source || {}
  const book = sources.find((b) => b.id === s.book_id)
  const step = book ? nextStep(book, s.unit, s.section) : null
  const keep = ['length_min', 'homework_amount'].reduce((o, k) => (last.details?.[k] ? { ...o, [k]: last.details[k] } : o), {})
  return {
    ...blankRequest(last.class_key, last.teacher_email),
    wants: last.wants?.length ? [...last.wants] : [...DEFAULT_WANTS],
    source: s.book_id ? { book_id: s.book_id, ...(step ? { unit: step.unit, section: step.section, pages: pagesText(step.pages) } : {}) } : {},
    details: keep,
    previous_id: last.id,
  }
}

/**
 * What "Next lesson" will ask for, in a few words ("Unit 5.3 Adding negatives · pp. 48–51"),
 * or '' when the last request was not from a book or the book has nothing after it.
 */
export function nextPreview(last, sources = [], lang = 'en') {
  if (!last?.source?.book_id) return ''
  const next = nextRequest(last, sources)
  if (!next.source.unit) return ''
  const title = requestTitle({ source: { ...next.source, pages: '' } }, sources, lang)
  return [title, pagesLabel(next.source.pages, lang)].filter(Boolean).join(' · ')
}

/** Counts by status for a list of requests: { sent: 2, ready: 1, ... }. */
export const countByStatus = (rows) => rows.reduce((o, x) => ({ ...o, [x.status]: (o[x.status] || 0) + 1 }), {})

export const DEVICES = [
  { id: 'all', en: 'All', vi: 'Tất cả' }, { id: 'most', en: 'Most', vi: 'Phần lớn' },
  { id: 'some', en: 'Some', vi: 'Một số' }, { id: 'few', en: 'Few', vi: 'Rất ít' },
]
export const profileFilled = (p) => !!p && Object.values(p.profile || {}).some((v) => (Array.isArray(v) ? v.length : v !== '' && v != null))

const setupHint = 'Lessons are not set up in the database yet. Run supabase/updates-2026-11-05-lessons.sql in Supabase, then reload.'
/** Turns "no such table / bucket / function" into something the office can act on. */
export const lessonsError = (e) => {
  const msg = e?.message || String(e)
  return /adm_lesson|adm_class_profiles|adm_sources|adm-lessons|bucket not found|schema cache/i.test(msg) && /does not exist|not found|schema cache|could not find/i.test(msg) ? `${setupHint} (${msg})` : msg
}
