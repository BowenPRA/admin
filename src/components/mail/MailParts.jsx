import { useState } from 'react'
import { CircleAlert, CircleCheck, Inbox } from 'lucide-react'
import { renderFamily, sampleVars, SPOTS, MAILER_LATE_MINUTES } from '../../lib/mail'
import { Segmented } from '../ui'

// The pieces of the Emails page (src/pages/Emails.jsx): the wording of the two
// thank-yous with a preview, who gets the office alerts, and whether the mailer
// script in admin@ is running.

/** The wording of one thank-you (`k`: enroll_family or web_family), with what the family gets. */
export function FamilyTab({ k, value, onChange, L, readOnly }) {
  const [lang, setLang] = useState('en')
  const v = value
  const preview = renderFamily(v, lang, sampleVars(k, 'en'), sampleVars(k, 'vi'))
  const box = (field, l, rows) => (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{field === 'subject' ? L('Subject', 'Tiêu đề') : L('Email', 'Nội dung')} · {l === 'vi' ? 'Tiếng Việt' : 'English'}</span>
      {rows ? <textarea className="input font-[inherit] leading-relaxed" rows={rows} value={v[field]?.[l] || ''} disabled={readOnly} onChange={(e) => onChange((t) => { t[field] = { ...t[field], [l]: e.target.value }; return t })} />
        : <input className="input" value={v[field]?.[l] || ''} disabled={readOnly} onChange={(e) => onChange((t) => { t[field] = { ...t[field], [l]: e.target.value }; return t })} />}
    </label>
  )
  return (
    <div className="space-y-4 text-sm">
      <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <input type="checkbox" className="mt-0.5" checked={v.on !== false} disabled={readOnly} onChange={(e) => onChange((t) => ({ ...t, on: e.target.checked }))} />
        <span><b className="block text-slate-800">{k === 'enroll_family' ? L('Send a thank-you when a family sends the enrollment form', 'Gửi thư cảm ơn khi gia đình gửi đơn đăng ký học') : L('Send a thank-you when a family books a tour or writes through the contact form', 'Gửi thư cảm ơn khi gia đình đặt lịch tham quan hoặc gửi tin nhắn liên hệ')}</b>
          <span className="text-slate-600">{L('It goes to the address on the form within about five minutes, in the language they used first, then the other one. One address gets at most one thank-you a day (siblings’ enrollment forms each get theirs). The office alert goes every time.', 'Thư được gửi đến địa chỉ trong đơn trong khoảng năm phút, bằng ngôn ngữ gia đình đã dùng trước, rồi đến ngôn ngữ còn lại. Mỗi địa chỉ nhận tối đa một thư cảm ơn mỗi ngày (đơn đăng ký của anh chị em vẫn được cảm ơn riêng từng đơn). Thông báo cho văn phòng luôn được gửi.')}</span></span>
      </label>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          {box('subject', 'en')}
          {box('body', 'en', 10)}
          {box('subject', 'vi')}
          {box('body', 'vi', 10)}
          <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
            <b className="mb-1 block text-slate-700">{L('Filled in for each family', 'Tự điền cho từng gia đình')}</b>
            <ul className="space-y-0.5">{SPOTS[k].map((s) => <li key={s.key}><code className="code">{`{${s.key}}`}</code> {L(s.en, s.vi)}</li>)}</ul>
            <p className="mt-1.5">{L('A blank line starts a new paragraph. Web addresses become links.', 'Một dòng trống bắt đầu đoạn mới. Địa chỉ web sẽ thành đường link.')}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600">{L('What the family gets (made-up details)', 'Gia đình sẽ nhận được (thông tin mẫu)')}</span>
            <Segmented value={lang} onChange={setLang} options={[{ value: 'en', label: L('Filled in in English', 'Điền bằng tiếng Anh') }, { value: 'vi', label: L('Filled in in Vietnamese', 'Điền bằng tiếng Việt') }]} />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600"><b className="text-slate-800">{preview.subject}</b><br />{L('From Palm River Academy, admin@', 'Từ Palm River Academy, admin@')}</div>
            <div className="max-h-[34rem] overflow-y-auto" dangerouslySetInnerHTML={{ __html: preview.html }} />
          </div>
          {v.updated_at && <p className="text-xs text-slate-400">{L('Last changed', 'Sửa lần cuối')} {new Date(v.updated_at).toLocaleString()}{v.updated_by ? ` · ${v.updated_by}` : ''}</p>}
        </div>
      </div>
    </div>
  )
}

/** Who gets the office alerts and the newsletter notes. */
export function OfficeTab({ value, onChange, L, readOnly }) {
  return (
    <div className="space-y-4 text-sm">
      <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <input type="checkbox" className="mt-0.5" checked={value.on !== false} disabled={readOnly} onChange={(e) => onChange((t) => ({ ...t, on: e.target.checked }))} />
        <span><b className="block text-slate-800">{L('Email the office about each form', 'Gửi email cho văn phòng về mỗi đơn')}</b>
          <span className="text-slate-600">{L('Who sent it, how to reach them, and a link to it in The Current. Health details and documents stay in The Current.', 'Ai gửi, cách liên hệ, và đường link mở đơn trong The Current. Thông tin sức khỏe và giấy tờ chỉ có trong The Current.')}</span></span>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-600">{L('Form alerts go to', 'Thông báo về đơn gửi đến')}</span>
        <input className="input" value={value.to || ''} disabled={readOnly} onChange={(e) => onChange((t) => ({ ...t, to: e.target.value }))} />
        <span className="mt-1 block text-xs text-slate-500">{L('Addresses separated by commas. Alerts sent to admin@ also reach the inbox triage.', 'Các địa chỉ cách nhau bằng dấu phẩy. Thông báo gửi đến admin@ cũng được hệ thống phân loại thư đọc.')}</span>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-600">{L('Newsletters to approve, and newsletters not sent, go to', 'Bản tin cần duyệt và bản tin chưa gửi được báo cho')}</span>
        <input className="input" value={value.approvers || ''} disabled={readOnly} onChange={(e) => onChange((t) => ({ ...t, approvers: e.target.value }))} />
        <span className="mt-1 block text-xs text-slate-500">{L('Who may approve is set by the account (head or super admin), not by this list.', 'Ai được duyệt là do tài khoản (head hoặc super admin), không phải danh sách này.')}</span>
      </label>
    </div>
  )
}

/** Whether the mailer script in admin@ is running: it checks in every five minutes. `status` comes through withAge. */
export function MailerLine({ status, L }) {
  if (!status) return null
  if (status.offline) return <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-600"><Inbox size={16} />{L('Offline copy: nothing is sent from here.', 'Bản ngoại tuyến: không gửi gì từ đây.')}</p>
  const mins = status.mins ?? null
  if (mins === null) return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900"><CircleAlert size={16} className="mt-0.5 flex-none" />
      {L(`The mailer in admin@ has never checked in, so nothing has been sent yet${status.ready ? ` (${status.ready} waiting)` : ''}. It is set up once: scripts/mailer/README.md in The Current's code.`, `Trình gửi thư trong admin@ chưa chạy lần nào, nên chưa gửi gì${status.ready ? ` (${status.ready} thư đang chờ)` : ''}. Cài đặt một lần: scripts/mailer/README.md trong mã nguồn The Current.`)}
    </p>
  )
  if (mins > MAILER_LATE_MINUTES) return (
    <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800"><CircleAlert size={16} className="mt-0.5 flex-none" />
      {L(`The mailer in admin@ last checked in ${fmtAgo(mins, L)}. It should every five minutes: emails are waiting. Tell Bowen, or see "When something goes wrong" in scripts/mailer/README.md.`, `Trình gửi thư trong admin@ chạy lần cuối ${fmtAgo(mins, L)}. Lẽ ra năm phút chạy một lần: thư đang bị chờ. Hãy báo thầy Bowen, hoặc xem mục "When something goes wrong" trong scripts/mailer/README.md.`)}
    </p>
  )
  return <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-green-800"><CircleCheck size={16} />{L(`The mailer in admin@ is running: last checked in ${fmtAgo(mins, L)}.`, `Trình gửi thư trong admin@ đang chạy: lần cuối ${fmtAgo(mins, L)}.`)}{status.failed > 0 && <span className="text-red-700"> · {L(`${status.failed} not sent in the last two weeks`, `${status.failed} thư chưa gửi được trong hai tuần qua`)}</span>}</p>
}
const fmtAgo = (mins, L) => (mins < 2 ? L('just now', 'vừa xong') : mins < 90 ? L(`${mins} minutes ago`, `${mins} phút trước`) : mins < 48 * 60 ? L(`${Math.round(mins / 60)} hours ago`, `${Math.round(mins / 60)} giờ trước`) : L(`${Math.round(mins / 1440)} days ago`, `${Math.round(mins / 1440)} ngày trước`))
