// Emails The Current sends by itself (supabase/updates-2026-10-22-mail.sql): the
// thank-you and the office alert for each website form, and scheduled
// newsletters. They wait in the outbox (adm_mail_queue) until the mailer script
// in admin@ (scripts/mailer) sends them. Here: reading the outbox, the wording the
// office edits, and scheduling, approving and cancelling newsletters. Without
// Supabase (offline development) all of it is kept in this browser.

import { supabase, hasSupabase } from './supabaseClient.js'
import { SENDER } from './gmail.js'
import { genId } from './db.js'

export const MAIL_KINDS = {
  enroll_family: { en: 'Thank-you to the family', vi: 'Thư cảm ơn gửi gia đình' },
  enroll_office: { en: 'Alert to the office', vi: 'Thông báo cho văn phòng' },
  web_family: { en: 'Thank-you to the family', vi: 'Thư cảm ơn gửi gia đình' },
  web_office: { en: 'Alert to the office', vi: 'Thông báo cho văn phòng' },
  newsletter: { en: 'Newsletter', vi: 'Bản tin' },
  notice: { en: 'Note to Seth and Bowen', vi: 'Ghi chú cho Seth và Bowen' },
  test: { en: 'Newsletter test', vi: 'Bản tin gửi thử' },
}
export const MAIL_STATUS = {
  waiting: { en: 'Waiting for approval', vi: 'Chờ duyệt', tone: 'amber' },
  ready: { en: 'Waiting to go', vi: 'Chờ gửi', tone: 'sky' },
  sending: { en: 'Sending', vi: 'Đang gửi', tone: 'sky' },
  sent: { en: 'Sent', vi: 'Đã gửi', tone: 'green' },
  failed: { en: 'Not sent', vi: 'Chưa gửi được', tone: 'red' },
  cancelled: { en: 'Cancelled', vi: 'Đã hủy', tone: 'slate' },
  skipped: { en: 'Not sent', vi: 'Không gửi', tone: 'slate' },
}
/** Whether this person approves newsletters (Seth and Bowen). */
export const isApprover = (me) => ['super_admin', 'head'].includes(me?.access)
/** The mailer has not asked for work for this long: something is wrong. */
export const MAILER_LATE_MINUTES = 20

/** A sent email in admin@'s Gmail. */
export const gmailLink = (id) => `https://mail.google.com/mail/?authuser=${encodeURIComponent(SENDER)}#all/${id}`

const setupHint = 'The emails are not set up in the database yet. Run supabase/updates-2026-10-22-mail.sql in Supabase, then reload.'
export function mailError(e) {
  const msg = e?.message || String(e)
  if (/adm_mail|adm_newsletter_schedule|adm_newsletter_approve|adm_mailer/i.test(msg) && /does not exist|not find|schema cache/i.test(msg)) return new Error(`${setupHint} (${msg})`)
  return new Error(msg)
}
const throwIf = (error) => { if (error) throw mailError(error) }

// Everything but the email itself and the newsletter page it carries.
const COLS = 'id, kind, ref_id, to_addr, bcc_addr, subject, lang, send_at, status, requested_by, requested_at, approved_by, approved_at, cancelled_by, cancelled_at, tries, sent_at, message_id, error, created_at'
const NL_COLS = `${COLS}, print:extra->>print, published_at:extra->>published_at, label:extra->>label, edition:extra->>edition, name:extra->>name, build:extra->build`

// ---------------- the wording ----------------
// As inserted by the SQL file; offline only (the database holds the real ones).
export const DEFAULT_TEMPLATES = {
  enroll_family: {
    on: true,
    subject: { en: 'Enrollment form received: {child}', vi: 'PRA đã nhận được đơn đăng ký học của {child}' },
    body: {
      en: 'Dear {parent},\n\nThank you for sending the enrollment form for {child}. We received it on {date}.\n\nOur admissions team will read it and contact you about the next step.\n\nIf you have a question in the meantime, reply to this email or call us on 0968 49 42 45.\n\nThe Admissions Team\nPalm River Academy',
      vi: 'Kính gửi ba mẹ của {child},\n\nCảm ơn ba mẹ đã gửi đơn đăng ký học cho {child}. PRA đã nhận được đơn vào {date}.\n\nBộ phận tuyển sinh sẽ xem đơn và liên hệ với ba mẹ về bước tiếp theo.\n\nNếu ba mẹ có câu hỏi, vui lòng trả lời email này hoặc gọi cho PRA theo số 0968 49 42 45.\n\nBộ phận tuyển sinh\nTrung tâm Anh ngữ Palm River Academy',
    },
  },
  web_family: {
    on: true,
    subject: { en: 'We have your message', vi: 'PRA đã nhận được tin nhắn của ba mẹ' },
    body: {
      en: 'Dear {name},\n\nThank you for contacting Palm River Academy. {request}\n\nSomeone from the office will reply by email or phone.\n\nIf it is urgent, call us on 0968 49 42 45.\n\nThe Admissions Team\nPalm River Academy',
      vi: 'Kính gửi ba mẹ,\n\nCảm ơn ba mẹ đã liên hệ với Palm River Academy. {request}\n\nVăn phòng sẽ liên hệ lại với ba mẹ qua email hoặc điện thoại.\n\nNếu cần gấp, ba mẹ vui lòng gọi cho PRA theo số 0968 49 42 45.\n\nBộ phận tuyển sinh\nTrung tâm Anh ngữ Palm River Academy',
    },
  },
  office: { on: true, to: 'yvonne@pra.edu.vn, admin@palmriveracademy.edu.vn', approvers: 'seth@pra.edu.vn, bowen@pra.edu.vn' },
}

/** The {spots} each email fills in, and what the preview fills them with. */
export const SPOTS = {
  enroll_family: [
    { key: 'child', en: "the child's full name", vi: 'họ tên của con', sample: { en: 'Lê Minh Anh', vi: 'Lê Minh Anh' } },
    { key: 'first_name', en: "the child's first name", vi: 'tên của con', sample: { en: 'Minh Anh', vi: 'Minh Anh' } },
    { key: 'parent', en: "the parent's name (\"parents\" when it is missing)", vi: 'tên phụ huynh ("ba mẹ" nếu không có)', sample: { en: 'Trần Thị Lan', vi: 'Trần Thị Lan' } },
    { key: 'date', en: 'the day the form arrived', vi: 'ngày nhận đơn', sample: { en: 'Thursday 22 October 2026', vi: 'thứ Năm, 22/10/2026' } },
    { key: 'applying_for', en: 'what they are applying for', vi: 'chương trình đăng ký', sample: { en: 'Academic Year 26-27', vi: 'Academic Year 26-27' } },
  ],
  web_family: [
    { key: 'name', en: 'the name they wrote ("parents" when it is missing)', vi: 'tên ba mẹ đã ghi ("ba mẹ" nếu không có)', sample: { en: 'Anna Lee', vi: 'Anna Lee' } },
    { key: 'request', en: 'one or two sentences about what they asked for (a tour or a call and its day, the Global Program; nothing for a question)', vi: 'một hai câu về điều ba mẹ yêu cầu (tham quan hoặc gọi video và ngày hẹn, Global Program; không có gì nếu chỉ là câu hỏi)', sample: { en: 'You asked for a campus tour on Tuesday 27 October, in the morning. We will confirm the day and time with you.', vi: 'Ba mẹ đã đặt lịch tham quan vào thứ Ba, 27/10/2026, buổi sáng. PRA sẽ xác nhận lại ngày giờ với ba mẹ.' } },
    { key: 'when', en: 'the day and time they asked for', vi: 'ngày giờ ba mẹ chọn', sample: { en: 'Tuesday 27 October, in the morning', vi: 'thứ Ba, 27/10/2026, buổi sáng' } },
  ],
}
export const sampleVars = (key, lang) => Object.fromEntries((SPOTS[key] || []).map((s) => [s.key, s.sample[lang]]))

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const fill = (t, vars) => Object.entries(vars || {}).reduce((s, [k, v]) => s.split(`{${k}}`).join(v ?? ''), String(t ?? ''))
const paras = (t) => String(t ?? '').replace(/\r/g, '').split(/\n[ \t]*\n/).map((p) => p.replace(/^[ \t\n]+|[ \t\n]+$/g, '')).filter(Boolean)
  .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/(https?:\/\/[^\s<>"]*[^\s<>".,;:!?)])/g, '<a href="$1" style="color:#116DFF">$1</a>').replace(/\n/g, '<br>')}</p>`).join('')

/**
 * The family's email as the database writes it (adm_mail_family): the language the
 * family used first, then the other. For the preview in the wording window.
 */
export function renderFamily(tpl, lang, vars, varsVi) {
  const first = lang === 'vi' ? 'vi' : 'en'
  const second = first === 'vi' ? 'en' : 'vi'
  const v = (l) => (l === 'vi' ? varsVi : vars)
  const subject = fill(tpl?.subject?.[first], v(first)).trim()
  const t1 = fill(tpl?.body?.[first], v(first)).replace(/^[ \n]+|[ \n]+$/g, '')
  const t2 = fill(tpl?.body?.[second], v(second)).replace(/^[ \n]+|[ \n]+$/g, '')
  const blocks = [[first, t1], ...(t2 ? [[second, t2]] : [])]
  const html = `<div style="max-width:560px;margin:0 auto;padding:24px 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1B2A41">`
    + '<img src="https://pra.edu.vn/assets/img/logo.png" width="134" height="54" alt="Palm River Academy" style="display:block;width:134px;height:54px;border:0;margin:0 0 22px">'
    + blocks.map(([l, t]) => `<div lang="${l}">${paras(t)}</div>`).join('<hr style="border:0;border-top:1px solid #D3E4FF;margin:26px 0">') + '</div>'
  return { subject, text: t2 ? `${t1}\n\n------\n\n${t2}` : t1, html }
}

// ---------------- offline: this browser ----------------
const LS = 'pra-admin-mail-v1'
const lsRead = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}') } catch { return {} } }
const lsWrite = (d) => localStorage.setItem(LS, JSON.stringify(d))
const local = () => { const d = lsRead(); d.queue ||= []; d.templates ||= structuredClone(DEFAULT_TEMPLATES); return d }
const nowIso = () => new Date().toISOString()

// ---------------- reading ----------------
/** The outbox, newest first: `refs` (forms, messages, issues), `kinds`, `limit`. */
export async function listMail({ refs = null, kinds = null, limit = 200 } = {}) {
  if (!hasSupabase) {
    let rows = local().queue
    if (refs) rows = rows.filter((r) => refs.includes(r.ref_id))
    if (kinds) rows = rows.filter((r) => kinds.includes(r.kind))
    return rows.sort((a, b) => String(b.created_at).localeCompare(a.created_at)).slice(0, limit)
  }
  let req = supabase.from('adm_mail_queue').select(kinds?.length === 1 && kinds[0] === 'newsletter' ? NL_COLS : COLS).order('created_at', { ascending: false }).limit(limit)
  if (refs) {
    if (!refs.length) return []
    req = req.in('ref_id', refs)
  }
  if (kinds) req = req.in('kind', kinds)
  const { data, error } = await req
  throwIf(error)
  return data || []
}

/** The newsletter schedules: every issue's latest one (the live one if there is one). */
export async function listNewsletterJobs(issueIds = null) {
  const rows = (await listMail({ refs: issueIds, kinds: ['newsletter'], limit: 500 })).map(slim)
  const byIssue = {}
  const rank = (r) => (['waiting', 'ready', 'sending'].includes(r.status) ? 3 : r.status === 'sent' ? 2 : 1)
  for (const r of rows) {
    const cur = byIssue[r.ref_id]
    if (!cur || rank(r) > rank(cur) || (rank(r) === rank(cur) && String(r.created_at) > String(cur.created_at))) byIssue[r.ref_id] = r
  }
  return byIssue
}

/** One email in full, for "See the email". */
export async function getMail(id) {
  if (!hasSupabase) return local().queue.find((r) => r.id === id) || null
  const { data, error } = await supabase.from('adm_mail_queue').select('id, subject, html, body, to_addr, bcc_addr, attachments').eq('id', id).maybeSingle()
  throwIf(error)
  return data
}

/** { last_seen, ready, failed }: when the mailer script last asked for work. */
export async function mailerStatus() {
  if (!hasSupabase) return { last_seen: null, ready: local().queue.filter((r) => r.status === 'ready').length, failed: 0, offline: true }
  const { data, error } = await supabase.rpc('adm_mailer_status')
  throwIf(error)
  return data
}

/** Adds `mins`: how long ago the mailer last checked in, worked out when the status was read. */
export const withAge = (status) => (status ? { ...status, mins: status.last_seen ? Math.round((Date.now() - new Date(status.last_seen).getTime()) / 60000) : null } : status)

/** Opens an email's HTML in a new tab. */
export async function openMail(id) {
  const tab = window.open('', '_blank')
  try {
    const m = await getMail(id)
    if (!m) throw new Error('This email no longer exists.')
    const url = URL.createObjectURL(new Blob([m.html || `<pre>${esc(m.body)}</pre>`], { type: 'text/html' }))
    if (tab) tab.location.href = url; else window.open(url, '_blank')
  } catch (e) { tab?.close(); throw mailError(e) }
}

// ---------------- the wording ----------------
export async function listTemplates() {
  if (!hasSupabase) return local().templates
  const { data, error } = await supabase.from('adm_mail_templates').select('key, data, updated_by, updated_at')
  throwIf(error)
  const out = {}
  for (const r of data || []) out[r.key] = { ...r.data, updated_by: r.updated_by, updated_at: r.updated_at }
  return out
}
export async function saveTemplate(key, data) {
  const clean = Object.fromEntries(Object.entries(data).filter(([k]) => !['updated_by', 'updated_at'].includes(k)))
  if (!hasSupabase) { const d = local(); d.templates[key] = clean; lsWrite(d); return clean }
  const { data: rows, error } = await supabase.from('adm_mail_templates').update({ data: clean }).eq('key', key).select('key, data, updated_by, updated_at')
  throwIf(error)
  if (!rows?.length) throw new Error('Only the office can change the wording.')
  return { ...rows[0].data, updated_by: rows[0].updated_by, updated_at: rows[0].updated_at }
}

// ---------------- newsletters ----------------
/** A full outbox row as the list reads it: the newsletter's facts on top, the email and the page left out. */
const slim = (r) => {
  if (!r) return r
  const { extra, ...rest } = r
  delete rest.html
  delete rest.body
  return { ...rest, print: extra?.print ?? r.print, published_at: extra?.published_at ?? r.published_at, label: extra?.label ?? r.label, edition: extra?.edition ?? r.edition, name: extra?.name ?? r.name, build: extra?.build ?? r.build }
}

/**
 * Puts an issue in the outbox. `mail` = { subject, html, text, attachments: [{ url, name }] };
 * `pending` = the page to put on the website ten minutes before (null: already there).
 * `me` is only used offline, to decide whether it needs approval.
 */
export async function scheduleNewsletter({ issue, sendAt, mail, pending = null, round = null, print = null, me }) {
  if (!hasSupabase) {
    const d = local()
    const approver = isApprover(me)
    d.queue.forEach((r) => { if (r.ref_id === issue.id && r.kind === 'newsletter' && ['waiting', 'ready'].includes(r.status)) Object.assign(r, { status: 'cancelled', cancelled_by: me?.email, cancelled_at: nowIso() }) })
    const row = {
      id: genId(), kind: 'newsletter', ref_id: issue.id, to_addr: '', bcc_addr: '(the edition\'s groups)', subject: mail.subject, html: mail.html, body: mail.text,
      attachments: mail.attachments || [], lang: 'en', send_at: new Date(Math.max(Date.parse(sendAt), Date.now())).toISOString(),
      status: approver ? 'ready' : 'waiting', requested_by: me?.email, requested_at: nowIso(), approved_by: approver ? me?.email : null, approved_at: approver ? nowIso() : null,
      tries: 0, created_at: nowIso(), extra: { print, round, label: issue.quarter ? `Quarter ${issue.quarter} · Week ${issue.week}` : issue.issue_date, edition: issue.edition, pending },
    }
    d.queue.push(row)
    lsWrite(d)
    return slim(row)
  }
  const { data, error } = await supabase.rpc('adm_newsletter_schedule', { p_issue: issue.id, p_send_at: sendAt, p_mail: mail, p_pending: pending, p_round: round, p_print: print })
  throwIf(error)
  return slim(data)
}

async function change(rpc, id, offline) {
  if (!hasSupabase) {
    const d = local()
    const row = d.queue.find((r) => r.id === id)
    if (!row) throw new Error('This email no longer exists.')
    offline(row)
    lsWrite(d)
    return slim(row)
  }
  const { data, error } = await supabase.rpc(rpc, rpc === 'adm_mail_retry' ? { p_id: id } : { p_job: id })
  throwIf(error)
  return slim(data)
}
export const approveNewsletter = (id, me) => change('adm_newsletter_approve', id, (r) => {
  if (r.status !== 'waiting') throw new Error('This schedule is not waiting for approval any more. Reload the page.')
  Object.assign(r, { status: 'ready', approved_by: me?.email, approved_at: nowIso(), send_at: new Date(Math.max(Date.parse(r.send_at), Date.now())).toISOString() })
})
export const unscheduleNewsletter = (id, me) => change('adm_newsletter_unschedule', id, (r) => {
  if (!['waiting', 'ready', 'failed'].includes(r.status)) throw new Error('This schedule cannot be cancelled now. Reload the page.')
  Object.assign(r, { status: 'cancelled', cancelled_by: me?.email, cancelled_at: nowIso() })
})
/** Sends the scheduled email, as it will go, to the person signed in ("[Test]" in front of its subject). */
export async function sendTestNewsletter(id, me) {
  if (!hasSupabase) {
    const d = local()
    const j = d.queue.find((r) => r.id === id && r.kind === 'newsletter')
    if (!j) throw new Error('This schedule no longer exists. Reload the page.')
    const row = { ...j, id: genId(), kind: 'test', to_addr: me?.email || '', bcc_addr: '', subject: `[Test] ${j.subject}`, status: 'ready', send_at: nowIso(), requested_by: me?.email, created_at: nowIso(), extra: {} }
    d.queue.push(row)
    lsWrite(d)
    return slim(row)
  }
  const { data, error } = await supabase.rpc('adm_newsletter_test', { p_job: id })
  throwIf(error)
  return slim(data)
}

export const retryMail = (id) => change('adm_mail_retry', id, (r) => {
  if (!['failed', 'skipped'].includes(r.status)) throw new Error('Only an email that was not sent can be sent again.')
  Object.assign(r, { status: 'ready', send_at: nowIso(), tries: 0, error: null })
})
