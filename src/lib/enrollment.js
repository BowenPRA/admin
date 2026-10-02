import { fmtDay } from './leads'
import { ageOf } from './studentRecords'

// Enrollment forms: the form on pra.edu.vn/admissions/enroll/ saves each one
// here itself (supabase/updates-2026-09-30-enrollments.sql). Each row of
// adm_enrollments has the answers in `data`; ID numbers, documents and the
// signature are in adm_enrollment_private, which only the super admin can read.
// The questions below are the form's, in its order. [English, Vietnamese].

export const ENROLLMENT_SENDER = 'enrollment form'

const YES_NO = { yes: ['Yes', 'Có'], no: ['No', 'Không'] }
/** 'Yes' / 'No' in the reader's language; anything else as written. */
export const yesNo = (v, lang = 'en') => YES_NO[String(v || '').toLowerCase()]?.[lang === 'vi' ? 1 : 0] ?? (v || '')
export const isYes = (v) => String(v || '').toLowerCase() === 'yes'

export const STUDENT_FIELDS = [
  ['full_name', ['Full name', 'Họ và tên']],
  ['first_name', ['First name', 'Tên']],
  ['dob', ['Date of birth', 'Ngày sinh'], 'date'],
  ['gender', ['Gender', 'Giới tính']],
  ['nationality', ['Nationality', 'Quốc tịch']],
  ['languages', ['Languages spoken', 'Ngôn ngữ sử dụng']],
  ['address', ['Home address', 'Địa chỉ nhà']],
  ['start_date', ['Intended start date', 'Ngày dự kiến nhập học'], 'date'],
]

export const PARENT_FIELDS = [
  ['name', ['Name', 'Họ và tên']],
  ['relation', ['Relationship to student', 'Quan hệ với học viên']],
  ['phone', ['Phone', 'Số điện thoại'], 'phone'],
  ['email', ['Email', 'Email'], 'email'],
  ['language', ['Language preference', 'Ngôn ngữ liên lạc']],
  ['nationality', ['Nationality', 'Quốc tịch']],
  ['profession', ['Profession', 'Nghề nghiệp']],
  ['address', ['Home address', 'Địa chỉ nhà']],
]

export const PERSON_FIELDS = [
  ['name', ['Name', 'Họ và tên']],
  ['relation', ['Relationship to student', 'Quan hệ với học viên']],
  ['phone', ['Phone', 'Số điện thoại'], 'phone'],
  ['email', ['Email', 'Email'], 'email'],
]

export const BACKGROUND_QUESTIONS = [
  ['repeated', ['Repeated a year or grade', 'Đã từng học lại một năm']],
  ['academic', ['Academic issues', 'Khó khăn về học tập']],
  ['behavioral', ['Behavioral issues', 'Vấn đề về hành vi']],
  ['developmental', ['Developmental issues', 'Vấn đề về phát triển']],
  ['disciplinary', ['Subjected to disciplinary action', 'Từng bị kỷ luật']],
]

export const HEALTH_QUESTIONS = [
  ['surgery', ['Major surgery', 'Từng phẫu thuật lớn']],
  ['physician', ['Under a physician\'s care', 'Đang được bác sĩ theo dõi']],
  ['emotional', ['History of emotional health issues', 'Tiền sử vấn đề tâm lý']],
  ['exercise', ['Issues that affect physical exercise', 'Hạn chế khi vận động thể chất']],
  ['glasses', ['Glasses or contact lenses', 'Đeo kính hoặc kính áp tròng']],
  ['dental', ['Dental caps, bridges, braces or plates', 'Răng bọc, cầu răng, niềng răng hoặc hàm giả']],
  ['allergy_medication', ['Allergic to a medication', 'Dị ứng thuốc']],
  ['allergy_food', ['Allergic to a food', 'Dị ứng thực phẩm']],
  ['dietary', ['Dietary restrictions', 'Chế độ ăn kiêng']],
]

export const CONSENT = {
  total: { en: 'Total use', vi: 'Sử dụng rộng rãi', hint: ['Publications, website, social media and presentations.', 'Ấn phẩm, trang web, mạng xã hội và bài thuyết trình.'] },
  private: { en: 'Private use only', vi: 'Chỉ dùng nội bộ', hint: ['Class chat and internal use only. Not for the website or Facebook: add this child to the no-photo list.', 'Chỉ dùng trong nhóm lớp và nội bộ. Không đăng lên trang web hay Facebook: hãy thêm học viên này vào danh sách không đăng ảnh.'] },
}

/** What the form asks about each previous school, after its name. */
export const SCHOOL_FIELDS = [
  ['years', ['Years attended', 'Năm học']],
  ['grades', ['Grade levels', 'Lớp đã học']],
  ['language', ['Language of instruction', 'Ngôn ngữ giảng dạy']],
]

/** The form's document questions: a file's `kind` says which one it answers (none on forms sent before 2 October 2026). */
export const DOC_KINDS = {
  photo: ['Student photo', 'Ảnh học viên'],
  student_id: ['Student\'s passport or ID', 'Hộ chiếu hoặc căn cước của học viên'],
  parent_id: ['Parent\'s passport or ID', 'Hộ chiếu hoặc căn cước của phụ huynh'],
  report: ['Academic report', 'Học bạ hoặc báo cáo học tập'],
}

export const ID_FIELDS = [
  ['id_number', ['ID / passport number', 'Số CCCD / hộ chiếu']],
  ['issue_date', ['Issue date', 'Ngày cấp'], 'date'],
  ['issue_place', ['Place of issue', 'Nơi cấp']],
]

/** A value as shown on the page: dates as '5 Oct 2020', the rest as written. */
export function showValue(v, kind, lang = 'en') {
  if (v == null || v === '') return ''
  if (kind === 'date') return /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? fmtDay(String(v).slice(0, 10), lang) : String(v)
  return String(v)
}

/** '5 Oct 2020 · 5 years old' */
export function birthdayLine(dob, lang = 'en') {
  if (!dob) return ''
  const age = ageOf(String(dob).slice(0, 10))
  return `${fmtDay(String(dob).slice(0, 10), lang)}${age == null ? '' : lang === 'vi' ? ` · ${age} tuổi` : ` · ${age} ${age === 1 ? 'year' : 'years'} old`}`
}

/** Where a form stands with the student list: 'added' (this form made the pending student), 'linked' (already there), 'none'. */
export const placeOf = (e) => (e.student_id ? (e.made_student ? 'added' : 'linked') : 'none')

/** Forms nobody has looked over yet, newest first; then the rest, newest first. */
export function byReceived(a, b) {
  if (!a.checked_at !== !b.checked_at) return a.checked_at ? 1 : -1
  return String(b.submitted_at || b.created_at || '').localeCompare(String(a.submitted_at || a.created_at || ''))
}

/** The answers a reader should not miss: every "Yes" in the health and background questions, and allergies. */
export function flagsOf(e, lang = 'en') {
  const d = e.data || {}
  const i = lang === 'vi' ? 1 : 0
  return [
    ...HEALTH_QUESTIONS.filter(([k]) => isYes(d.health?.[k])).map(([, l]) => l[i]),
    ...BACKGROUND_QUESTIONS.filter(([k]) => isYes(d.background?.[k])).map(([, l]) => l[i]),
  ]
}

/** A message someone in the office can act on. */
export function enrollmentError(e) {
  const m = e?.message || String(e)
  if (/adm_enrollment/.test(m) && /(does not exist|schema cache|PGRST202|Could not find)/i.test(m)) return 'Enrollment forms are not set up yet: run supabase/updates-2026-09-30-enrollments.sql in Supabase > SQL Editor.'
  return m
}
