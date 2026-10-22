import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Eye, Inbox, LoaderCircle, Mail, RotateCcw, Save } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { listTemplates, saveTemplate, listMail, mailerStatus, withAge, retryMail, openMail, gmailLink, renderFamily, sampleVars, SPOTS, DEFAULT_TEMPLATES, MAIL_KINDS, MAIL_STATUS, MAILER_LATE_MINUTES } from '../../lib/mail'
import { useL } from '../newsletter/bits'
import { Chip, Modal, Segmented, Spinner } from '../ui'

const TABS = ['enroll_family', 'web_family', 'office', 'outbox']

/**
 * The emails The Current sends by itself (supabase/updates-2026-10-22-mail.sql):
 * the wording of the two thank-yous, who gets the office alerts, and the outbox
 * with whether the mailer script in admin@ is running. `start` picks the first tab.
 */
export default function MailSettings({ onClose, start = 'enroll_family' }) {
  const { L } = useL()
  const toast = useToast()
  const { isOffice } = useAuth()
  const [tab, setTab] = useState(start)
  const [tpls, setTpls] = useState(null)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listTemplates().then((t) => { setTpls(t); setDraft(structuredClone(t)) }).catch((e) => setError(e.message))
  }, [])
  const dirty = tpls && draft && TABS.slice(0, 3).some((k) => JSON.stringify(strip(draft[k])) !== JSON.stringify(strip(tpls[k])))
  const save = async () => {
    setSaving(true)
    try {
      const out = { ...tpls }
      for (const k of TABS.slice(0, 3)) {
        if (JSON.stringify(strip(draft[k])) !== JSON.stringify(strip(tpls[k]))) out[k] = await saveTemplate(k, draft[k])
      }
      setTpls(out); setDraft(structuredClone(out))
      toast(L('Saved. Forms from now on use the new wording.', 'Đã lưu. Các đơn từ bây giờ dùng nội dung mới.'))
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }
  const close = () => { if (!dirty || confirm(L('Close without saving the changes?', 'Đóng mà không lưu thay đổi?'))) onClose() }
  const set = (key, fn) => setDraft((d) => ({ ...d, [key]: fn(structuredClone(d[key] || DEFAULT_TEMPLATES[key])) }))

  return (
    <Modal open wide onClose={close} title={L('Emails The Current sends', 'Email The Current tự gửi')}
      subtitle={L('A thank-you to each family who sends a form on pra.edu.vn, an alert to the office, and scheduled newsletters. They go from admin@.', 'Thư cảm ơn mỗi gia đình gửi đơn trên pra.edu.vn, thông báo cho văn phòng, và bản tin đã hẹn giờ. Tất cả gửi từ admin@.')}
      footer={tab === 'outbox' ? <button className="btn-secondary" onClick={close}>{L('Close', 'Đóng')}</button> : (
        <>
          <button className="btn-secondary" onClick={close}>{L('Close', 'Đóng')}</button>
          {isOffice && <button className="btn-primary" disabled={!dirty || saving} onClick={save}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}{L('Save', 'Lưu')}</button>}
        </>
      )}>
      <div className="space-y-4">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'enroll_family', label: L('Enrollment form', 'Đơn đăng ký học') },
          { value: 'web_family', label: L('Tour and contact form', 'Đặt lịch và liên hệ') },
          { value: 'office', label: L('Office alerts', 'Thông báo văn phòng') },
          { value: 'outbox', label: L('Outbox', 'Hộp thư đi') },
        ]} />
        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {tab === 'outbox' ? <Outbox L={L} toast={toast} /> : !draft ? (!error && <Spinner />)
          : tab === 'office' ? <OfficeTab value={draft.office || DEFAULT_TEMPLATES.office} onChange={(fn) => set('office', fn)} L={L} readOnly={!isOffice} />
            : <FamilyTab k={tab} value={draft[tab] || DEFAULT_TEMPLATES[tab]} onChange={(fn) => set(tab, fn)} L={L} readOnly={!isOffice} />}
      </div>
    </Modal>
  )
}
const strip = (t) => (t ? Object.fromEntries(Object.entries(t).filter(([k]) => !['updated_by', 'updated_at'].includes(k))) : t)

function FamilyTab({ k, value, onChange, L, readOnly }) {
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

function OfficeTab({ value, onChange, L, readOnly }) {
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

/** The latest emails, and when the mailer last checked in. */
function Outbox({ L, toast }) {
  const [state, setState] = useState(null)
  const load = () => Promise.all([listMail({ limit: 60 }), mailerStatus().catch(() => null)])
    .then(([rows, status]) => setState({ rows, status: withAge(status), error: '' }))
    .catch((e) => setState({ rows: [], status: null, error: e.message }))
  useEffect(() => { load() }, [])
  if (!state) return <Spinner />
  const retry = async (r) => { try { await retryMail(r.id); toast(L('It goes within five minutes.', 'Email sẽ đi trong vòng năm phút.')); load() } catch (e) { toast.error(e.message) } }
  const see = async (r) => { try { await openMail(r.id) } catch (e) { toast.error(e.message) } }
  return (
    <div className="space-y-3 text-sm">
      {state.error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{state.error}</p>}
      <MailerLine status={state.status} L={L} />
      {!state.rows.length ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-400">{L('No emails yet. They show here as forms arrive and newsletters are scheduled.', 'Chưa có email nào. Email sẽ hiện ở đây khi có đơn gửi đến hoặc bản tin được hẹn giờ.')}</p> : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {state.rows.map((r) => {
            const st = MAIL_STATUS[r.status] || MAIL_STATUS.ready
            return (
              <li key={r.id} className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={st.tone}>{L(st.en, st.vi)}</Chip>
                    <span className="text-xs font-semibold text-slate-500">{L(MAIL_KINDS[r.kind]?.en, MAIL_KINDS[r.kind]?.vi)}</span>
                    <span className="text-xs text-slate-400">{new Date(r.sent_at || r.created_at).toLocaleString()}</span>
                  </div>
                  <div className="truncate font-semibold text-slate-800">{r.subject || '—'}</div>
                  <div className="truncate text-xs text-slate-500">{r.to_addr || r.bcc_addr}</div>
                  {r.error && r.status !== 'sent' && <div className="text-xs text-red-700">{r.error}</div>}
                </div>
                <div className="flex flex-none flex-wrap gap-1.5">
                  {r.subject && <button className="btn-ghost text-xs" onClick={() => see(r)}><Eye size={14} />{L('See', 'Xem')}</button>}
                  {r.message_id && <a className="btn-ghost text-xs" href={gmailLink(r.message_id)} target="_blank" rel="noreferrer"><Mail size={14} />Gmail</a>}
                  {['failed', 'skipped'].includes(r.status) && r.subject && <button className="btn-secondary text-xs" onClick={() => retry(r)}><RotateCcw size={14} />{L('Send again', 'Gửi lại')}</button>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
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
