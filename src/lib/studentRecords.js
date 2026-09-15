import { nextStudentCode } from './studentIds'

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/**
 * Empty student. Pass the current students for a brand-new one: it then gets
 * the next free ID and today's start date. Without them it is only a base for
 * spreading an existing row over, so nothing is invented for that row.
 */
export const blankStudent = (students) => ({
  full_name: '', nickname: '', level: 'Year 1', program: 'regular', family_id: '', legacy: false, is_new: true,
  // Students added by hand pay a full-price Quarter 4; the roster loader turns it off.
  q4_full: true, active: true, dob: '', nationality: '', notes: '',
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
