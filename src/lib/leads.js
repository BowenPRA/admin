import * as XLSX from 'xlsx'
import { OFFICE_ACCOUNTS } from '../data/staff'

// Leads: families who have asked about joining, one row per family. This took
// over from the "Inquiries Tracker" spreadsheet on 30 September 2026; its Leads
// and Archive tabs are one list here, split by `archived`. The daily inbox
// triage adds and updates rows through its own account (TRIAGE_EMAIL).

export const TRIAGE_EMAIL = 'triage@pra.edu.vn'
// What the database records as the account when the form on pra.edu.vn adds a family (adm_web_submit).
export const WEBSITE_SENDER = 'website'

export const STAGES = [
  { id: 'new', en: 'New', vi: 'Mới', tone: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500',
    hint: ['Enquiry received, no reply sent yet.', 'Đã nhận yêu cầu, chưa trả lời.'] },
  { id: 'contacted', en: 'Contacted', vi: 'Đã liên hệ', tone: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500',
    hint: ['We have replied (information, brochure, fees). Waiting on the family or on us.', 'Đã trả lời (thông tin, tài liệu, học phí). Đang chờ gia đình hoặc chờ PRA.'] },
  { id: 'tour_booked', en: 'Tour/call booked', vi: 'Đã hẹn tham quan/gọi', tone: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500',
    hint: ['A visit or video call is booked. Put its date in Tour / call.', 'Đã hẹn buổi tham quan hoặc gọi video. Ghi ngày vào ô Tham quan / gọi.'] },
  { id: 'tour_done', en: 'Tour/call done', vi: 'Đã tham quan/gọi', tone: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-500',
    hint: ['The visit or call has happened. Next is usually a trial day or enrollment.', 'Đã tham quan hoặc gọi. Bước tiếp theo thường là học thử hoặc nhập học.'] },
  { id: 'trial', en: 'Trial', vi: 'Học thử', tone: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500',
    hint: ['Trial day(s) booked or under way.', 'Đã hẹn hoặc đang học thử.'] },
  { id: 'enrolled', en: 'Enrolled', vi: 'Đã nhập học', tone: 'bg-green-100 text-green-800', dot: 'bg-green-600',
    hint: ['Enrollment form received and/or fees paid.', 'Đã nhận đơn nhập học và/hoặc đã đóng học phí.'] },
  { id: 'lost', en: 'Lost / no reply', vi: 'Không tiếp tục', tone: 'bg-slate-200 text-slate-600', dot: 'bg-slate-400',
    hint: ['Chose elsewhere, or no reply after following up. Usually archived.', 'Đã chọn nơi khác hoặc không phản hồi sau khi liên hệ lại. Thường được lưu trữ.'] },
]

export const LEAD_PROGRAMS = [
  { id: 'global', en: 'Global Program', vi: 'Chương trình Global',
    hint: ['Short-term, 3 weeks to 3 months.', 'Ngắn hạn, từ 3 tuần đến 3 tháng.'] },
  { id: 'year', en: 'Academic year', vi: 'Cả năm học',
    hint: ['Regular enrollment for the rest of the academic year or longer.', 'Nhập học chính thức cho phần còn lại của năm học hoặc lâu hơn.'] },
  { id: 'nursery', en: 'Nursery', vi: 'Nursery',
    hint: ['Nursery / Early Years families looking at longer-term enrollment.', 'Gia đình có con ở độ tuổi Nursery / Early Years, dự định học dài hạn.'] },
  { id: 'summer', en: 'Summer Program', vi: 'Chương trình hè', hint: ['Summer Program only.', 'Chỉ Chương trình hè.'] },
]

export const SOURCES = [
  { id: 'email', en: 'Email', vi: 'Email' },
  { id: 'website', en: 'Website form', vi: 'Form trên trang web' },
  { id: 'walk_in', en: 'Walk-in', vi: 'Đến trực tiếp' },
  { id: 'whatsapp_zalo', en: 'WhatsApp / Zalo', vi: 'WhatsApp / Zalo' },
  { id: 'facebook', en: 'Facebook', vi: 'Facebook' },
  { id: 'other', en: 'Other', vi: 'Khác' },
]

export const labelOf = (list, id, lang = 'en') => { const x = list.find((i) => i.id === id); return x ? (lang === 'vi' ? x.vi : x.en) : (id || '') }
export const stageOf = (id) => STAGES.find((s) => s.id === id) || STAGES[0]

/** The addresses in a family's email field. Two parents can each have one: "a@x.com, b@y.com". */
export const emailsOf = (v) => String(v ?? '').toLowerCase().split(/[\s;,]+/).filter(Boolean)

/** First name for an office email; the triage account has its own name. */
export function personName(email, lang = 'en') {
  const e = String(email || '').toLowerCase()
  if (!e) return ''
  if (e === TRIAGE_EMAIL) return lang === 'vi' ? 'Phân loại hộp thư' : 'Inbox triage'
  if (e === WEBSITE_SENDER) return lang === 'vi' ? 'Form trên trang web' : 'Website form'
  if (e === 'enrollment form') return lang === 'vi' ? 'Đơn đăng ký học' : 'Enrollment form'
  return OFFICE_ACCOUNTS.find((a) => a.email === e)?.name || e.split('@')[0]
}

const pad = (n) => String(n).padStart(2, '0')
const fmtIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayIso = () => fmtIso(new Date())

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** '29 Sep' this year, '29 Sep 2025' otherwise (29/09 in Vietnamese). Takes a date or a timestamp. */
export function fmtDay(v, lang = 'en') {
  if (!v) return ''
  const iso = String(v).length > 10 ? (() => { const d = new Date(v); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` })() : String(v)
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return String(v)
  const thisYear = y === new Date().getFullYear()
  return lang === 'vi' ? `${pad(d)}/${pad(m)}${thisYear ? '' : `/${y}`}` : `${d} ${MONTHS_EN[m - 1]}${thisYear ? '' : ` ${y}`}`
}

/** An active family whose follow-up date has come. Enrolled and lost families are not chased. */
export const isDue = (l, today = todayIso()) => !l.archived && !!l.follow_up && l.follow_up <= today && !['enrolled', 'lost'].includes(l.stage)

/** Newest first contact first; families with no date go last. */
export function byFirstContact(a, b) {
  if (!a.first_contact !== !b.first_contact) return a.first_contact ? -1 : 1
  return String(b.first_contact || '').localeCompare(String(a.first_contact || '')) || String(a.family || '').localeCompare(String(b.family || ''))
}

export const blankLead = (owner = '') => ({
  family: '', email: '', phone: '', children: '', kids: 1, program: '', timing: '', source: 'email',
  first_contact: todayIso(), tour_date: '', stage: 'new', owner, next_step: '', follow_up: '', notes: '', archived: false,
})

/** The figures at the top of the page (the spreadsheet's Summary tab). Active families only. */
export function summarize(leads, today = todayIso()) {
  const active = leads.filter((l) => !l.archived)
  const n = (stage) => active.filter((l) => l.stage === stage).length
  return {
    active: active.length,
    archived: leads.length - active.length,
    children: active.reduce((s, l) => s + (Number(l.kids) || 0), 0),
    new: n('new'),
    toursBooked: n('tour_booked'),
    trialOrEnrolled: n('trial') + n('enrolled'),
    due: active.filter((l) => isDue(l, today)).length,
  }
}

// ---------------------------------------------------------------------------
// Messages from the form on pra.edu.vn (supabase/updates-2026-09-30-website-forms.sql).
// The website saves them itself; here they are read and marked done.

export const WEB_WANTS = [
  { id: 'tour', en: 'Campus tour', vi: 'Tham quan trung tâm', tone: 'green' },
  { id: 'call', en: 'Video call', vi: 'Gọi video', tone: 'sky' },
  { id: 'global', en: 'Global Program information', vi: 'Thông tin Global Program', tone: 'amber' },
  { id: 'question', en: 'Question', vi: 'Câu hỏi', tone: 'slate' },
]
export const wantOf = (id) => WEB_WANTS.find((w) => w.id === id) || WEB_WANTS[3]

const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAYS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const WEB_TIMES = { morning: ['morning', 'buổi sáng'], afternoon: ['afternoon', 'buổi chiều'] }

/** The day and time of day a family asked for: 'Tue 6 Oct, morning'. Empty when they named neither. */
export function askedFor(m, lang = 'en') {
  const vi = lang === 'vi'
  let day = ''
  if (m.visit_date) {
    const [y, mo, d] = String(m.visit_date).split('-').map(Number)
    const wd = new Date(y, mo - 1, d).getDay()
    day = vi ? `${DAYS_VI[wd]}, ${fmtDay(m.visit_date, lang)}` : `${DAYS_EN[wd]} ${fmtDay(m.visit_date, lang)}`
  }
  const time = WEB_TIMES[m.visit_time]?.[vi ? 1 : 0] || ''
  return [day, time].filter(Boolean).join(', ')
}

/** '30 Sep, 14:05': when a message arrived, in the reader's own time. */
export function fmtMoment(v, lang = 'en') {
  if (!v) return ''
  const d = new Date(v)
  return `${fmtDay(v, lang)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** The family a message belongs to: the one the database linked, or one with the same email address. */
export function leadForMessage(m, leads) {
  const email = String(m.email || '').toLowerCase()
  return leads.find((l) => l.id === m.lead_id) || leads.find((l) => emailsOf(l.email).includes(email)) || null
}

/** A message whose family is no longer on the list, as a new family ready to save. */
export const leadFromMessage = (m, owner = '') => ({
  ...blankLead(owner),
  family: m.name || '', email: m.email || '', phone: m.phone || '',
  children: m.child_age ? `Age ${String(m.child_age).toLowerCase()}` : '',
  kids: '', program: m.want === 'global' ? 'global' : '', source: 'website',
  first_contact: m.created_at ? fmtIso(new Date(m.created_at)) : todayIso(), notes: m.message || '',
})

/** Waiting messages first (oldest at the top: it has waited longest), then the ones already dealt with, newest first. */
export function byWaiting(a, b) {
  if (!a.done_at !== !b.done_at) return a.done_at ? 1 : -1
  const order = String(a.created_at || '').localeCompare(String(b.created_at || ''))
  return a.done_at ? -order : order
}

/** A message someone in the office can act on. */
export function leadsError(e) {
  const m = e?.message || String(e)
  if (/adm_leads/.test(m) && /(does not exist|schema cache)/i.test(m)) return 'The leads table is not set up yet: run supabase/updates-2026-09-30-leads.sql in Supabase > SQL Editor.'
  if (/adm_leads_email_key|duplicate key/i.test(m)) return 'Another family on the list already has this email address.'
  return m
}

// ---------------------------------------------------------------------------
// Moving over from the spreadsheet

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()
const low = (v) => clean(v).toLowerCase()

function isoDate(v) {
  if (v == null || v === '') return ''
  // Excel keeps dates as day numbers counted from 30 Dec 1899 (25569 is 1 Jan 1970).
  if (typeof v === 'number') return new Date(Math.floor(v - 25569) * 86400000).toISOString().slice(0, 10)
  const s = clean(v)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : ''
}

function programFrom(v) {
  const k = low(v)
  if (!k) return ''
  if (k.includes('global')) return 'global'
  if (k.includes('nursery')) return 'nursery'
  if (k.includes('summer')) return 'summer'
  return /year/.test(k) ? 'year' : ''
}
const idFrom = (list, v) => { const k = low(v); return list.find((x) => low(x.en) === k || x.id === k)?.id || '' }

// "Yvonne: follow up…" names who has the next step. A step shared between
// people ("Seth: … · Yvonne: …") keeps its wording and goes to the first name.
const OWNER_RE = new RegExp(`\\b(${OFFICE_ACCOUNTS.map((a) => a.name).join('|')})\\b(\\s*\\+\\s*[A-Z][a-z]+)?:`)
function splitNextStep(text) {
  const s = clean(text)
  const m = s.match(OWNER_RE)
  if (!m) return { owner: '', next_step: s }
  const owner = OFFICE_ACCOUNTS.find((a) => a.name === m[1]).email
  const rest = s.slice(m[0].length).trim()
  if (m.index === 0 && !m[2] && !OWNER_RE.test(rest) && rest) return { owner, next_step: rest[0].toUpperCase() + rest.slice(1) }
  return { owner, next_step: s }
}

// "…if no reply by 6 Oct" / "…before 15 Oct" becomes the follow-up date.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
function followUpFrom(text, from) {
  const m = clean(text).match(/\b(?:by|before)\s+(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i)
  if (!m) return ''
  const ref = from || todayIso()
  const y = Number(ref.slice(0, 4))
  const iso = `${y}-${pad(MONTHS.indexOf(m[2].toLowerCase()) + 1)}-${pad(m[1])}`
  // "by 5 Jan" written in December means next January; "by 29 Sep" read on 30 Sep is just overdue.
  const daysBack = (Date.parse(ref) - Date.parse(iso)) / 86400000
  return daysBack > 180 ? `${y + 1}${iso.slice(4)}` : iso
}

/**
 * Reads the Inquiries Tracker workbook (its Leads and Archive tabs) into lead
 * rows. Nothing is saved here. Every row has the same keys, as a bulk save needs.
 */
export function parseTracker(buf) {
  const wb = XLSX.read(buf, { type: 'array' })
  const out = []
  for (const name of wb.SheetNames) {
    const archived = /archive/i.test(name)
    if (!archived && !/lead/i.test(name)) continue
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' })
    const h = rows.findIndex((r) => r.some((c) => low(c) === 'family') && r.some((c) => low(c) === 'email'))
    if (h < 0) continue
    const at = (re) => rows[h].findIndex((c) => re.test(low(c)))
    const c = {
      family: at(/^family/), email: at(/^email/), phone: at(/^phone/), children: at(/^children/), kids: at(/kids/),
      program: at(/^program/), timing: at(/^timing/), source: at(/^source/), first: at(/^first contact/),
      tour: at(/^tour/), stage: at(/^stage/), next: at(/^next step/), notes: at(/^notes/),
    }
    for (const r of rows.slice(h + 1)) {
      const get = (k) => (c[k] >= 0 ? r[c[k]] : '')
      const family = clean(get('family'))
      if (!family) continue
      const first = isoDate(get('first'))
      const next = clean(get('next'))
      const kids = Number(get('kids'))
      out.push({
        family,
        email: emailsOf(get('email')).join(', '),
        phone: clean(get('phone')),
        children: clean(get('children')),
        kids: Number.isFinite(kids) && kids > 0 ? kids : '',
        program: programFrom(get('program')),
        timing: clean(get('timing')),
        source: idFrom(SOURCES, get('source')),
        first_contact: first,
        tour_date: isoDate(get('tour')),
        stage: idFrom(STAGES, get('stage')) || 'new',
        ...splitNextStep(next),
        follow_up: followUpFrom(next, first),
        notes: clean(get('notes')),
        archived,
      })
    }
  }
  return out
}

/**
 * Which spreadsheet rows to add. A family already here (an email address in
 * common, or the same name when neither has an email) is left exactly as it is,
 * so importing again never undoes a change made on the page. Within the file
 * only the email counts: two archived rows can share a surname and be two enquiries.
 */
export function planImport(parsed, existing) {
  const emails = new Set(existing.flatMap((l) => emailsOf(l.email)))
  const names = new Set(existing.filter((l) => !l.email).map((l) => low(l.family)))
  const add = []
  const skip = []
  for (const l of parsed) {
    const mine = emailsOf(l.email)
    const seen = mine.length ? mine.some((e) => emails.has(e)) : names.has(low(l.family))
    if (seen) { skip.push(l); continue }
    add.push(l)
    mine.forEach((e) => emails.add(e))
  }
  return { add, skip }
}

// ---------------------------------------------------------------------------
// Excel copy: the old tracker's columns, active families and the archive on two sheets.

const COLUMNS = [
  ['Family', 24, (l) => l.family],
  ['Email', 30, (l) => l.email || ''],
  ['Phone', 16, (l) => l.phone || ''],
  ['Children (name, DOB or age)', 36, (l) => l.children || ''],
  ['# Kids', 7, (l) => (l.kids === '' || l.kids == null ? '' : Number(l.kids))],
  ['Program', 16, (l) => labelOf(LEAD_PROGRAMS, l.program)],
  ['Timing', 26, (l) => l.timing || ''],
  ['Source', 15, (l) => labelOf(SOURCES, l.source)],
  ['First contact', 13, (l) => l.first_contact, true],
  ['Tour / call', 13, (l) => l.tour_date, true],
  ['Stage', 16, (l) => labelOf(STAGES, l.stage)],
  ['Owner', 10, (l) => personName(l.owner)],
  ['Next step', 40, (l) => l.next_step || ''],
  ['Follow up by', 13, (l) => l.follow_up, true],
  ['Notes', 60, (l) => l.notes || ''],
  ['Last changed', 13, (l) => String(l.updated_at || '').slice(0, 10), true],
  ['Changed by', 14, (l) => personName(l.updated_by)],
]

function sheetOf(leads) {
  const serial = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000 + 25569 }
  const ws = XLSX.utils.aoa_to_sheet([COLUMNS.map((c) => c[0]), ...leads.map((l) => COLUMNS.map(([, , get, date]) => { const v = get(l); return date ? (v ? serial(v) : '') : v }))])
  COLUMNS.forEach(([, , , date], ci) => {
    if (!date) return
    for (let ri = 1; ri <= leads.length; ri++) {
      const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })]
      if (cell && cell.t === 'n') cell.z = 'd mmm yyyy'
    }
  })
  ws['!cols'] = COLUMNS.map(([, wch]) => ({ wch }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(leads.length, 1), c: COLUMNS.length - 1 } }) }
  return ws
}

export function exportLeads(leads) {
  const sorted = [...leads].sort(byFirstContact)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheetOf(sorted.filter((l) => !l.archived)), 'Leads')
  XLSX.utils.book_append_sheet(wb, sheetOf(sorted.filter((l) => l.archived)), 'Archive')
  XLSX.writeFile(wb, `PRA-leads-${todayIso()}.xlsx`)
}
