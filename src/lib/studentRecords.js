import { nextStudentCode } from './studentIds'

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/**
 * Where a student stands. 'pending' is on the way in: the office can invoice
 * them, but they are not in the register, the reports or the enrolled counts
 * until someone marks them active. Rows saved before this existed have no
 * `status`, so it is read back off the older `active` boolean; db.js keeps the
 * two in step from then on.
 */
export const STATUSES = ['active', 'pending', 'inactive']
export const statusOf = (s) => (STATUSES.includes(s?.status) ? s.status : (s?.active === false ? 'inactive' : 'active'))
export const isEnrolled = (s) => statusOf(s) === 'active'
export const isPending = (s) => statusOf(s) === 'pending'
export const isPast = (s) => statusOf(s) === 'inactive'
/** Pending students are billed like enrolled ones — that is how they start. */
export const isBillable = (s) => statusOf(s) !== 'inactive'
export const withStatus = (s, status) => ({ ...s, status, active: status === 'active' })
/**
 * A family follows its children: 'active' (enrolled) if any child is, otherwise
 * 'pending' if any child is waiting to start, and 'past' once no child is left.
 */
export const familyStatus = (kids = []) => (kids.some(isEnrolled) ? 'active' : kids.some(isPending) ? 'pending' : 'past')
/** Families with at least one enrolled student: the families counted as active, like the enrolled students. */
export const activeFamilies = (families, students) => families.filter((f) => familyStatus(students.filter((s) => s.family_id === f.id)) === 'active')

/**
 * Empty student. Pass the current students for a brand-new one: it then gets
 * the next free ID and today's start date. Without them it is only a base for
 * spreading an existing row over, so nothing is invented for that row.
 */
export const blankStudent = (students) => ({
  full_name: '', nickname: '', level: 'Year 1', program: 'regular', family_id: '', legacy: false, is_new: true,
  // Students added by hand pay a full-price Quarter 4; the roster loader turns it off.
  q4_full: true, dob: '', nationality: '', notes: '',
  // Someone new starts pending: billable, but not on the register yet. Only for
  // a brand-new student, so spreading this over an existing row leaves it alone.
  ...(students ? { status: 'pending', active: false } : {}),
  student_code: students ? nextStudentCode(students) : '', gender: '', class_group: '', parents_email: '', parent_phone: '',
  address: '', allergies: '', start_date: students ? localToday() : '', enrollment_status: '', photo: '',
})

export const ageOf = (dob) => {
  if (!dob) return null
  const d = new Date(dob), now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
  return Number.isFinite(age) ? age : null
}

export const blankFamily = () => ({ name: '', email: '', phone: '', language: 'en', notes: '', contacts: [] })

/**
 * A family's parents / guardians. Families imported before contacts existed
 * only have comma-separated email and phone text; those become one row each,
 * falling back to the parent email / phone on the children's records.
 */
export function contactsOf(f, kids = []) {
  if (Array.isArray(f?.contacts) && f.contacts.length) return f.contacts
  const emailText = f?.email || kids.map((k) => k.parents_email).filter(Boolean).join(', ')
  const phoneText = f?.phone || kids.map((k) => k.parent_phone).filter(Boolean).join(' | ')
  const emails = [...new Set(String(emailText).split(/[,;\s]+/).filter((e) => e.includes('@')))]
  const phones = [...new Set(String(phoneText).split(/\s*[|,\n]\s*/).map((p) => p.trim()).filter((p) => /\d{6,}/.test(p.replace(/\D/g, ''))))]
  const n = Math.max(emails.length, phones.length)
  return Array.from({ length: n }, (_, i) => ({ name: '', relation: '', email: emails[i] || '', phone: phones[i] || '' }))
}

export const familyMissingContact = (f, kids = []) => {
  const cs = contactsOf(f, kids)
  return !cs.some((c) => (c.email || '').includes('@')) || !cs.some((c) => /\d{6,}/.test(String(c.phone || '').replace(/\D/g, '')))
}
