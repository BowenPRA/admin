import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Newspaper, PencilLine } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { listIssues, listParts } from '../../lib/newsletter/data'
import { EDITIONS, HIDDEN_PARTS } from '../../lib/newsletter/constants'
import { enDay, todayHoiAn } from '../../lib/newsletter/dates'
import { plain } from '../../lib/newsletter/text'
import { ownsCorner } from './status'
import { useL } from './bits'

/**
 * On a teacher's home page: their class corners in the newsletters going out
 * this week and next, and whether each is written. Shows nothing when there is
 * none (or before the newsletter is set up in the database).
 */
export default function CornerReminder() {
  const { me } = useAuth()
  const { L } = useL()
  const [rows, setRows] = useState([])
  useEffect(() => {
    let on = true
    // While class corners are hidden, teachers have nothing to write.
    if (HIDDEN_PARTS.includes('class')) return undefined
    ;(async () => {
      try {
        const today = todayHoiAn()
        const issues = (await listIssues()).filter((i) => i.issue_date >= today && i.status !== 'published').sort((a, b) => a.issue_date.localeCompare(b.issue_date)).slice(0, 6)
        if (!issues.length) return
        const parts = await listParts(issues.map((i) => i.id))
        const out = []
        for (const i of issues) for (const p of parts.filter((x) => x.newsletter_id === i.id && ownsCorner(x, me) && !x.data?.skip)) out.push({ issue: i, part: p, written: plain(p.data?.en?.body).length > 20 })
        if (on) setRows(out.sort((a, b) => a.issue.issue_date.localeCompare(b.issue.issue_date)))
      } catch { /* not set up yet */ }
    })()
    return () => { on = false }
  }, [me])
  if (!rows.length) return null
  const todo = rows.filter((r) => !r.written).length
  return (
    <section className={`card flex flex-wrap items-center gap-4 p-4 ${todo ? 'border-amber-200 bg-amber-50/40' : ''}`}>
      <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-pra-blue text-white"><Newspaper size={20} /></span>
      <div className="min-w-0 flex-1">
        <b className="block text-slate-800">{todo ? L(`Your class corner for the newsletter: ${todo} to write`, `Góc lớp của bạn trong bản tin: còn ${todo} phần cần viết`) : L('Your class corners for the newsletter are written', 'Góc lớp của bạn trong bản tin đã viết xong')}</b>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          {rows.map((r) => (
            <li key={r.part.id} className="inline-flex items-center gap-1.5">
              {r.written ? <Check size={14} className="text-green-600" /> : <PencilLine size={14} className="text-amber-600" />}
              {r.part.data?.class} · {EDITIONS[r.issue.edition]?.short} · {enDay(r.issue.issue_date)}
            </li>
          ))}
        </ul>
      </div>
      <Link to={rows.find((r) => !r.written) ? `/newsletter/${rows.find((r) => !r.written).issue.id}` : '/newsletter'} className="btn-primary">{todo ? L('Write it', 'Viết ngay') : L('Open', 'Mở')}<ArrowRight size={15} /></Link>
    </section>
  )
}
