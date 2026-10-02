// The supply check for a new student (To-Do #38). A button on the student's checklist
// saves a Gmail draft (lib/gmail.js: the app never sends) to the teachers of the child's
// year group who sign in, and to Hien, asking each teacher what the child needs for their
// class (books, materials) and to tell Hien; and it adds a To-Do for Hien. There is no list
// of books per year group yet, so the email asks rather than lists.

import { hasLogin, splitSubjectKey, OFFICE_ACCOUNTS } from '../data/staff'
import { legalFirstName } from './names'
import { MONTHS_LONG_EN, MONTHS_EN } from './printFormat'
import { todayIso } from './leads'

export const HIEN = 'hien.c@pra.edu.vn'
const WEEKDAYS = { en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], vi: ['Chủ nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'] }

/** 'Thursday 15 October 2026' / 'thứ Năm, 15/10/2026' */
export function longDay(iso, lang = 'en') {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const wd = WEEKDAYS[lang === 'vi' ? 'vi' : 'en'][new Date(y, m - 1, d).getDay()]
  return lang === 'vi' ? `${wd}, ${d}/${m}/${y}` : `${wd} ${d} ${MONTHS_LONG_EN[m - 1]} ${y}`
}
const shortDay = (iso) => { const [, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d} ${MONTHS_EN[m - 1]}` }

/** The name staff use for the child: the nickname, else the legal first name. */
export const callName = (s) => String(s?.nickname || '').trim() || legalFirstName(s).name || s?.full_name || ''
/** The class as staff say it: the class group when it has its own name, else the year group. */
export const className = (s) => String(s?.class_group || '').trim() || s?.level || ''

/**
 * Who the email goes to: every teacher of the child's year group who signs in (a subject
 * in it, or its homeroom; a Teachers row with no login such as Mr. Chiến is left out, and
 * the head teacher's "every homeroom" is not a class), then Hien.
 */
export function supplyRecipients(s, teachers = []) {
  const level = s?.level
  const seen = new Set([HIEN])
  const list = []
  for (const tr of teachers) {
    const email = String(tr.email || '').trim().toLowerCase()
    if (!hasLogin(tr) || tr.active === false || seen.has(email)) continue
    const teaches = (tr.subjects || []).some((k) => splitSubjectKey(k)[1] === level) || (tr.homeroom_groups || []).includes(level)
    if (!teaches) continue
    seen.add(email)
    list.push({ email, name: [tr.title, tr.name].filter(Boolean).join(' ') })
  }
  list.sort((a, b) => a.name.localeCompare(b.name))
  return { teachers: list, to: [...list.map((x) => x.email), HIEN] }
}

const hienName = () => OFFICE_ACCOUNTS.find((a) => a.email === HIEN)?.name || 'Hien'

/** Subject and text of the draft, in English or Vietnamese. */
export function supplyEmail(s, { lang = 'en', teachers = [], sender = '' } = {}) {
  const vi = lang === 'vi'
  const first = callName(s)
  const cls = className(s)
  const start = String(s?.start_date || '').slice(0, 10)
  const hien = hienName()
  const names = [...teachers.map((x) => x.name), hien]
  const greeting = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} ${vi ? 'và' : 'and'} ${names[names.length - 1]}`
  const full = [s?.full_name, s?.nickname && s.nickname !== s.full_name ? `(${s.nickname})` : ''].filter(Boolean).join(' ')
  const subject = vi
    ? `Sách vở và đồ dùng cho học viên mới: ${first}, ${cls}${start ? `, bắt đầu ${Number(start.slice(8, 10))}/${Number(start.slice(5, 7))}` : ''}`
    : `Supply check: ${first}, ${cls}${start ? `, starts ${shortDay(start)}` : ''}`
  const when = start
    ? (vi ? `từ ${longDay(start, 'vi')}` : `on ${longDay(start, 'en')}`)
    : ''
  const text = vi
    ? `Chào ${greeting},

Học viên mới ${full} sẽ bắt đầu học lớp ${cls}${when ? ` ${when}` : ''}.${start ? '' : ' Ngày bắt đầu chưa được xác định.'}

Thầy cô vui lòng kiểm tra xem ${first} cần những gì cho lớp của mình (sách, vở bài tập, đồ dùng học tập) và báo lại cho ${hien} (${HIEN}) để chuẩn bị sẵn trước buổi học đầu tiên.

Cảm ơn thầy cô,
${sender || 'Văn phòng PRA'}`
    : `Hello ${greeting},

${full} is joining ${cls}${when ? ` ${when}` : ''}.${start ? '' : ' The start date is not set yet.'}

Please check what ${first} will need for your class (books, workbooks, materials) and let ${hien} know (${HIEN}), so everything is ready for the first day.

Thank you,
${sender || 'PRA office'}`
  return { subject, text }
}

/** The To-Do for Hien: "Supply check: Mia, Year 3, starts 15 Oct". Due on the start date (today if that has passed). */
export function supplyTodo(s, { teachers = [], by = '', giver = '' } = {}) {
  const start = String(s?.start_date || '').slice(0, 10)
  const today = todayIso()
  const who = teachers.length ? teachers.map((x) => x.name).join(', ') : 'no teacher with a login for this year group'
  return {
    title: `Supply check: ${callName(s)}, ${className(s)}${start ? `, starts ${shortDay(start)}` : ''}`,
    details: `${s?.full_name || ''} is joining ${className(s)}${start ? ` on ${longDay(start, 'en')}` : ' (start date not set yet)'}. The teachers (${who}) were asked by email what they need for their classes (books, materials) and to tell you. Get it ready for the first day.`,
    status: 'open', priority: 'normal', assignee: HIEN, giver: giver || '', due_date: start && start > today ? start : today,
    files: [], updates: [], source: 'person', created_by: by || null, updated_by: by || null,
  }
}
