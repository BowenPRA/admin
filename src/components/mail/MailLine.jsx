import { useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Clock, Mail, MinusCircle } from 'lucide-react'
import { listMail, gmailLink, MAIL_KINDS } from '../../lib/mail'
import { fmtMoment } from '../../lib/leads'

const icon = { sent: CircleCheck, failed: CircleAlert, skipped: MinusCircle }
const tone = { sent: 'text-green-700', failed: 'text-red-700', skipped: 'text-slate-500' }

/**
 * The emails sent about one form or message: the family's thank-you and the
 * office alert, each with how it went. `mails` are the outbox rows for it; give
 * `refId` instead to read them here.
 */
export default function MailLine({ mails: given = null, refId = null, L }) {
  const [loaded, setLoaded] = useState(null)
  useEffect(() => {
    if (given || !refId) return
    let on = true
    listMail({ refs: [refId] }).then((rows) => on && setLoaded(rows)).catch(() => on && setLoaded([]))
    return () => { on = false }
  }, [refId, given])
  const mails = (given || loaded || []).filter((m) => m.kind !== 'newsletter' && m.kind !== 'notice')
  if (!mails.length) return null
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {mails.map((m) => {
        const Icon = icon[m.status] || Clock
        const kind = MAIL_KINDS[m.kind] || {}
        const when = m.sent_at ? fmtMoment(m.sent_at, L('en', 'vi')) : ''
        const what = m.status === 'sent' ? L(`sent ${when}`, `đã gửi ${when}`)
          : m.status === 'failed' ? L('not sent', 'chưa gửi được')
            : m.status === 'skipped' ? L('not sent', 'không gửi')
              : L('waiting to go', 'đang chờ gửi')
        const label = <><Icon size={13} className="flex-none" /><span><b className="font-semibold">{L(kind.en, kind.vi)}</b>{m.kind.endsWith('_family') && m.to_addr ? ` (${m.to_addr})` : ''}: {what}{m.error && m.status !== 'sent' ? ` · ${m.error}` : ''}</span></>
        return m.message_id
          ? <a key={m.id} href={gmailLink(m.message_id)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={`inline-flex items-start gap-1 hover:underline ${tone[m.status] || 'text-sky-700'}`} title={L('Open in admin@ Sent', 'Mở trong Thư đã gửi của admin@')}>{label}<Mail size={12} className="mt-0.5 flex-none opacity-60" /></a>
          : <span key={m.id} className={`inline-flex items-start gap-1 ${tone[m.status] || 'text-sky-700'}`}>{label}</span>
      })}
    </div>
  )
}
