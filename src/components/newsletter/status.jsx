/* eslint-disable react-refresh/only-export-components */
import { Check, Globe, Languages, Mail, PencilLine } from 'lucide-react'
import { issueChecks, statusOf } from '../../lib/newsletter/payload'

/** Whether this signed-in teacher writes this class corner (the same rule as adm_newsletter_can_edit in the database). */
export function ownsCorner(part, me) {
  if (part.type !== 'class' || !me) return false
  const d = part.data || {}
  if (d.teacher_email && String(d.teacher_email).toLowerCase() === String(me.email || '').toLowerCase()) return true
  const hr = me.homeroom_groups || []
  return (d.year_groups || []).some((g) => hr.includes(g))
}

/** Where an issue stands, as chips (also used at the top of the editor). */
export function StatusChips({ issue, parts, L }) {
  const st = statusOf(issue, parts)
  const c = issueChecks(issue, parts)
  const out = []
  if (st === 'draft') out.push(<span key="d" className="chip bg-slate-100 text-slate-700"><PencilLine size={12} className="mr-1" />{L('Being written', 'Đang viết')}</span>)
  if (st === 'vi') out.push(<span key="v" className="chip bg-amber-100 text-amber-800"><Languages size={12} className="mr-1" />{L(`Needs Vietnamese · ${c.needVi.length}`, `Cần dịch · ${c.needVi.length}`)}</span>)
  if (st === 'ready') out.push(<span key="r" className="chip bg-sky-100 text-sky-800"><Check size={12} className="mr-1" />{L('Ready to publish', 'Sẵn sàng đăng')}</span>)
  if (st === 'published') out.push(<span key="p" className="chip bg-green-100 text-green-800"><Globe size={12} className="mr-1" />{L('Published', 'Đã đăng')}</span>)
  if (st === 'changed') out.push(<span key="c" className="chip bg-amber-100 text-amber-800"><Globe size={12} className="mr-1" />{L('Changed since publishing', 'Đã sửa sau khi đăng')}</span>)
  if (issue.status === 'published' && issue.email?.saved_at) out.push(<span key="e" className="chip bg-white text-green-800 ring-1 ring-green-500"><Mail size={12} className="mr-1" />{L('Email draft saved', 'Đã lưu thư nháp')}</span>)
  if (st !== 'published' && c.notes.length) out.push(<span key="n" className="chip bg-amber-50 text-amber-800 ring-1 ring-amber-200">{L(`${c.notes.length} wording note${c.notes.length > 1 ? 's' : ''}`, `${c.notes.length} lưu ý từ ngữ`)}</span>)
  return <span className="inline-flex flex-wrap gap-1">{out}</span>
}
