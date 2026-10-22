/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import { CalendarClock, CircleCheck, CircleX, Eye, LoaderCircle, Mail, MailCheck, RotateCcw, ShieldCheck, TriangleAlert, Undo2 } from 'lucide-react'
import { EDITIONS } from '../../lib/newsletter/constants'
import { fingerprint } from '../../lib/newsletter/payload'
import { approveNewsletter, unscheduleNewsletter, retryMail, openMail, gmailLink, isApprover, MAIL_STATUS } from '../../lib/mail'
import TestDialog from './TestDialog'

const LIVE = ['waiting', 'ready', 'sending']
export const isLiveJob = (job) => !!job && LIVE.includes(job.status)

const pad = (n) => String(n).padStart(2, '0')
/** 'yyyy-mm-ddThh:mm' in this computer's time, for the date and time boxes. */
export const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

/** The issue's Friday at 16:30, or the next half hour when that has passed. */
export function defaultSendTime(issue) {
  const [y, m, d] = String(issue.issue_date || '').split('-').map(Number)
  const friday = y ? new Date(y, m - 1, d, 16, 30) : null
  if (friday && friday.getTime() > Date.now() + 5 * 60000) return toLocalInput(friday)
  const next = new Date(Math.ceil((Date.now() + 5 * 60000) / 1800000) * 1800000)
  return toLocalInput(next)
}

/** 'Fri 30 Oct, 16:30' / 'T6, 30/10, 16:30' */
export function fmtWhen(iso, L) {
  if (!iso) return ''
  const d = new Date(iso)
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const en = `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`
  const vi = `${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}, ${time}`
  return L(en, vi)
}
const who = (email) => { const n = String(email || '').split('@')[0].split('.')[0]; return n ? n[0].toUpperCase() + n.slice(1) : '' }

/** The schedule as a chip, beside the issue's other chips. */
export function JobChip({ job, L }) {
  if (!job) return null
  if (job.status === 'waiting') return <span className="chip bg-amber-100 text-amber-800"><ShieldCheck size={12} className="mr-1" />{L('Waiting for approval', 'Chờ duyệt')}</span>
  if (job.status === 'ready' || job.status === 'sending') return <span className="chip bg-sky-100 text-sky-800"><CalendarClock size={12} className="mr-1" />{L(`Goes ${fmtWhen(job.send_at, L)}`, `Gửi ${fmtWhen(job.send_at, L)}`)}</span>
  if (job.status === 'sent') return <span className="chip bg-green-100 text-green-800"><Mail size={12} className="mr-1" />{L(`Emailed ${fmtWhen(job.sent_at, L)}`, `Đã gửi ${fmtWhen(job.sent_at, L)}`)}</span>
  if (job.status === 'failed') return <span className="chip bg-red-100 text-red-700"><CircleX size={12} className="mr-1" />{L('Email not sent', 'Email chưa gửi được')}</span>
  return null
}

/** The choice of day and time, and what happens then. */
export function ScheduleForm({ issue, when, setWhen, me, L }) {
  const ed = EDITIONS[issue.edition]
  const approver = isApprover(me)
  const [now] = useState(() => Date.now())
  const [friday] = useState(() => defaultSendTime(issue))
  const past = when && new Date(when).getTime() < now
  return (
    <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-4 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">{L('When it goes to families', 'Thời gian gửi cho gia đình')}</span>
          <input type="datetime-local" className="input w-auto" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        {when !== friday && <button type="button" className="btn-ghost text-xs" onClick={() => setWhen(friday)}>{L('Back to the usual time', 'Về giờ thường lệ')}</button>}
        <button type="button" className="btn-ghost text-xs" onClick={() => setWhen(toLocalInput(new Date()))}>{approver ? L('Send now', 'Gửi ngay') : L('As soon as it is approved', 'Ngay khi được duyệt')}</button>
      </div>
      {past && <p className="text-amber-800">{L('That time has passed: it goes within five minutes of being approved.', 'Thời gian này đã qua: email sẽ đi trong vòng năm phút sau khi được duyệt.')}</p>}
      <ul className="space-y-1.5 text-slate-700">
        <li className="flex gap-2"><Mail size={15} className="mt-0.5 flex-none text-slate-500" /><span>{L('From admin@, Bcc', 'Từ admin@, Bcc')} {ed.groups.join(', ')}. {L('Both PDFs attached.', 'Kèm hai file PDF.')}</span></li>
        <li className="flex gap-2"><CalendarClock size={15} className="mt-0.5 flex-none text-slate-500" /><span>{L('The page goes on pra.edu.vn ten minutes before the email.', 'Trang lên pra.edu.vn mười phút trước khi email được gửi.')}</span></li>
        <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 flex-none text-slate-500" /><span>{approver
          ? L('You approve newsletters, so scheduling it approves it.', 'Bạn là người duyệt bản tin, nên hẹn giờ cũng là duyệt luôn.')
          : L('Seth or Bowen approves it before it goes. They get an email asking them to.', 'Thầy Seth hoặc thầy Bowen sẽ duyệt trước khi gửi. Hai thầy sẽ nhận email nhắc duyệt.')}</span></li>
      </ul>
    </div>
  )
}

/**
 * Where the issue's schedule stands, with what can be done about it: approve (Seth
 * and Bowen), see the email, cancel, send again. `onJob(row)` gets the changed row;
 * `onAgain()` starts a new schedule with the issue as it is now.
 */
export function ScheduleCard({ job, issue, parts, me, L, toast, onJob, onAgain }) {
  const [busy, setBusy] = useState('')
  const [testing, setTesting] = useState(false)
  if (!job || job.status === 'cancelled') return null
  const st = MAIL_STATUS[job.status] || MAIL_STATUS.ready
  const changed = isLiveJob(job) && job.print && job.print !== fingerprint(issue, parts)
  const act = (name, fn, ok) => async () => {
    setBusy(name)
    try { const row = await fn(); onJob({ ...job, ...row }); if (ok) toast(ok) } catch (e) { toast.error(e.message) } finally { setBusy('') }
  }
  const see = async () => { try { await openMail(job.id) } catch (e) { toast.error(e.message) } }
  const tone = { amber: 'border-amber-200 bg-amber-50/70', sky: 'border-sky-200 bg-sky-50/70', green: 'border-green-200 bg-green-50/60', red: 'border-red-200 bg-red-50/70', slate: 'border-slate-200 bg-slate-50' }[st.tone]
  const Icon = job.status === 'sent' ? CircleCheck : job.status === 'failed' ? CircleX : job.status === 'waiting' ? ShieldCheck : CalendarClock
  return (
    <div className={`space-y-2.5 rounded-xl border p-4 text-sm ${tone}`}>
      <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
        <Icon size={17} />
        {job.status === 'waiting' && L(`Scheduled for ${fmtWhen(job.send_at, L)}: waiting for Seth or Bowen to approve it`, `Hẹn gửi ${fmtWhen(job.send_at, L)}: chờ thầy Seth hoặc thầy Bowen duyệt`)}
        {job.status === 'ready' && L(`Goes to families ${fmtWhen(job.send_at, L)}`, `Gửi cho gia đình lúc ${fmtWhen(job.send_at, L)}`)}
        {job.status === 'sending' && L('Being sent now', 'Đang gửi')}
        {job.status === 'sent' && L(`Emailed to families ${fmtWhen(job.sent_at, L)}`, `Đã gửi cho gia đình lúc ${fmtWhen(job.sent_at, L)}`)}
        {job.status === 'failed' && L('The email was not sent', 'Email chưa gửi được')}
      </div>
      <p className="text-slate-600">
        {[job.requested_by && L(`Scheduled by ${who(job.requested_by)}`, `${who(job.requested_by)} hẹn giờ`),
          job.approved_by && L(`approved by ${who(job.approved_by)}`, `${who(job.approved_by)} đã duyệt`),
          isLiveJob(job) && job.published_at && L('the page is on the website', 'trang đã lên web'),
          job.status === 'ready' && !job.published_at && L('the page goes up ten minutes before', 'trang lên web mười phút trước'),
        ].filter(Boolean).join(' · ')}
      </p>
      {job.status === 'failed' && job.error && <p className="text-red-700">{job.error}</p>}
      {isLiveJob(job) && job.error && job.tries > 0 && <p className="text-amber-800">{L('The last try did not go through; it is tried again in ten minutes:', 'Lần gửi trước chưa được; sẽ thử lại sau mười phút:')} {job.error}</p>}
      {changed && (
        <p className="flex gap-2 text-amber-800"><TriangleAlert size={16} className="mt-0.5 flex-none" />
          {L('The issue has changed since it was scheduled. It goes out as it was scheduled. To send the changes, schedule it again' + (isApprover(me) ? '.' : ' (it then needs approving again).'), 'Số này đã sửa sau khi hẹn giờ. Email sẽ gửi bản đã hẹn. Muốn gửi bản đã sửa, hãy hẹn giờ lại' + (isApprover(me) ? '.' : ' (sẽ cần duyệt lại).'))}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {job.status === 'waiting' && isApprover(me) && (
          <button className="btn-primary" disabled={!!busy} onClick={act('approve', () => approveNewsletter(job.id, me), L('Approved. It goes at its time.', 'Đã duyệt. Email sẽ đi đúng giờ.'))}>
            {busy === 'approve' ? <LoaderCircle size={16} className="animate-spin" /> : <ShieldCheck size={16} />}{L('Approve', 'Duyệt')}
          </button>
        )}
        <button className="btn-secondary" onClick={see}><Eye size={16} />{L('See the email', 'Xem email')}</button>
        {['waiting', 'ready', 'failed'].includes(job.status) && (
          <button className="btn-secondary" disabled={!!busy} onClick={() => setTesting(true)}><MailCheck size={16} />{L('Send a test…', 'Gửi thử…')}</button>
        )}
        {job.status === 'sent' && job.message_id && <a className="btn-ghost" href={gmailLink(job.message_id)} target="_blank" rel="noreferrer"><Mail size={16} />{L('Open in admin@ Sent', 'Mở trong Thư đã gửi')}</a>}
        {job.status === 'failed' && (
          <button className="btn-secondary" disabled={!!busy} onClick={act('retry', () => retryMail(job.id), L('It goes within five minutes.', 'Email sẽ đi trong vòng năm phút.'))}><RotateCcw size={16} />{L('Send it again', 'Gửi lại')}</button>
        )}
        {(changed || job.status === 'failed') && <button className="btn-secondary" disabled={!!busy} onClick={onAgain}><CalendarClock size={16} />{L('Schedule again', 'Hẹn giờ lại')}</button>}
        {['waiting', 'ready', 'failed'].includes(job.status) && (
          <button className="btn-ghost text-red-700" disabled={!!busy} onClick={() => { if (confirm(L('Cancel this schedule? Nothing is sent. The issue stays as it is.', 'Hủy lịch gửi này? Sẽ không gửi gì. Số báo vẫn giữ nguyên.'))) act('cancel', () => unscheduleNewsletter(job.id, me), L('The schedule is cancelled.', 'Đã hủy lịch gửi.'))() }}>
            <Undo2 size={16} />{L('Cancel the schedule', 'Hủy lịch gửi')}
          </button>
        )}
      </div>
      {testing && <TestDialog issue={issue} job={job} toast={toast} L={L} onClose={() => setTesting(false)} />}
    </div>
  )
}
