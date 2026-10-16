/* eslint-disable react-refresh/only-export-components */
import { ArrowRight, ChevronsDownUp, ChevronsUpDown, CloudCheck, CloudOff, Eye, LoaderCircle, RotateCw } from 'lucide-react'
import { PART_TYPES, PART_LABELS_VI } from '../../lib/newsletter/constants'
import { viState, notesFor, issueChecks, statusOf } from '../../lib/newsletter/payload'
import { plain } from '../../lib/newsletter/text'

/** A part's name in the outline: the class, the heading, or the kind of part. */
export function partLabel(p, L) {
  const d = p.data || {}
  if (p.type === 'class') return d.class || L('Class corner', 'Góc lớp')
  if (p.type === 'dates') return L('Dates', 'Ngày')
  if (p.type === 'reminders') return L('Remember', 'Ghi nhớ')
  const h = String(d.en?.heading || '').trim()
  if ((p.type === 'story' || p.type === 'photos') && h) return h.length > 34 ? `${h.slice(0, 32)}…` : h
  return L(PART_TYPES[p.type]?.label || p.type, PART_LABELS_VI[p.type])
}

/**
 * Where a part stands, for its dot in the outline and its line when folded:
 * 'ok' (written, translated), 'warn' (needs something), 'empty' (left out), 'off' (class left out this week).
 */
export function partState(p, L) {
  if (p.type === 'class' && p.data?.skip) return { tone: 'off', text: L('Left out this week', 'Tuần này không có') }
  if (p.type === 'dates') {
    const on = Object.values(p.data?.items || {}).filter((x) => x.on !== false).length
    const vs = viState(p)
    if (vs.kind === 'missing' || vs.kind === 'changed') return { tone: 'warn', text: L('Needs Vietnamese', 'Cần dịch') }
    return on ? { tone: 'ok', text: L(`${on} date${on > 1 ? 's' : ''}`, `${on} ngày`) } : { tone: 'empty', text: L('No dates ticked', 'Chưa chọn ngày') }
  }
  const vs = viState(p)
  if (vs.kind === 'empty') return { tone: 'empty', text: L('Empty: left out', 'Trống: không đưa vào') }
  if ((p.data?.photos || []).some((ph) => !ph.cleared)) return { tone: 'warn', text: L('Photo not checked', 'Ảnh chưa kiểm') }
  if (vs.kind === 'missing') return { tone: 'warn', text: L('Vietnamese missing', 'Thiếu tiếng Việt') }
  if (vs.kind === 'changed') return { tone: 'warn', text: L('English changed', 'Tiếng Anh đã sửa') }
  if (notesFor(p).length) return { tone: 'warn', text: L('Wording note', 'Lưu ý từ ngữ') }
  return { tone: 'ok', text: L('Done', 'Xong') }
}
const DOT = { ok: 'bg-green-500', warn: 'bg-amber-500', empty: 'bg-slate-300', off: 'bg-slate-200 ring-1 ring-slate-300' }

/** One line about a folded part: its first words. */
export function partSummary(p) {
  const d = p.data || {}
  if (p.type === 'dates') return Object.values(d.items || {}).filter((x) => x.on !== false).map((x) => x.en).filter(Boolean).join(' · ')
  if (p.type === 'reminders') return Object.values(d.items || {}).map((x) => x.en).filter(Boolean).join(' · ')
  if (p.type === 'press') return d.title || ''
  if (p.type === 'quote') return d.en?.text || ''
  return plain(d.en?.body || d.en?.heading || '').slice(0, 140)
}

/**
 * The outline under the issue's header, kept in view while scrolling: every part
 * with a dot for where it stands. A click goes to the part (and opens it).
 */
export function Outline({ parts, onJump, allOpen, onToggleAll, onPreview, L }) {
  const warn = parts.filter((p) => partState(p, L).tone === 'warn').length
  return (
    <nav aria-label={L('Parts of this issue', 'Các phần của số này')} className="sticky z-20 -mx-1 rounded-xl border border-slate-200 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur" style={{ top: 'calc(var(--header-h, 0px) + 6px)' }}>
      <div className="flex items-center gap-1.5">
        <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {parts.map((p) => {
            const st = partState(p, L)
            return (
              <button key={p.id} type="button" onClick={() => onJump(p.id)} title={st.text}
                className="inline-flex flex-none items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                <span className={`h-2 w-2 flex-none rounded-full ${DOT[st.tone]}`} />{partLabel(p, L)}
              </button>
            )
          })}
        </div>
        {warn > 0 && <span className="hidden flex-none rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 sm:inline">{L(`${warn} to look at`, `${warn} cần xem`)}</span>}
        <button type="button" onClick={onToggleAll} className="btn-ghost flex-none !px-2 !py-1" title={allOpen ? L('Fold every part', 'Thu gọn tất cả') : L('Open every part', 'Mở tất cả')}>
          {allOpen ? <ChevronsDownUp size={16} /> : <ChevronsUpDown size={16} />}
        </button>
        {onPreview && <button type="button" onClick={onPreview} className="btn-secondary flex-none !px-2.5 !py-1 text-xs xl:hidden"><Eye size={14} />{L('Preview', 'Xem trước')}</button>}
      </div>
    </nav>
  )
}

/** Saved / saving / not saved, with "Try again" when something did not save. */
export function SaveLine({ save, unsaved, onRetry, L }) {
  if (save === 'error' || save === 'offline') {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
        <CloudOff size={14} />{save === 'offline' ? L('Offline: changes kept here, saved when back online', 'Mất mạng: thay đổi được giữ lại, sẽ lưu khi có mạng') : L(`Not saved (${unsaved})`, `Chưa lưu (${unsaved})`)}
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-red-700 ring-1 ring-red-200 hover:bg-red-50"><RotateCw size={12} />{L('Try again', 'Thử lại')}</button>
      </span>
    )
  }
  if (save === 'saving' || unsaved) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400"><LoaderCircle size={13} className="animate-spin" />{L('Saving…', 'Đang lưu…')}</span>
  if (save === 'synced') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><CloudCheck size={14} className="text-green-600" />{L('All changes saved', 'Đã lưu hết')}</span>
  return null
}

/**
 * What to do next with this issue, in one line, from where it stands. Office only.
 * `corners` = { done, total, missing }.
 */
export function NextStep({ issue, parts, corners, L, onEnglishDone, onPublish, onlyVi, onOnlyVi }) {
  const st = statusOf(issue, parts)
  const c = issueChecks(issue, parts)
  let text, action = null, tone = 'sky'
  if (st === 'draft') {
    const left = []
    if (c.noOpening) left.push(L('the opening sentence', 'câu mở đầu'))
    if (corners.total && corners.done < corners.total) left.push(L(`class corners (${corners.done} of ${corners.total} written: ${corners.missing.join(', ')})`, `góc lớp (đã viết ${corners.done}/${corners.total}: còn ${corners.missing.join(', ')})`))
    if (c.noCover) left.push(L('a cover photo', 'ảnh bìa'))
    text = left.length ? L(`Next: ${left.join(', ')}. Then press "English is done".`, `Tiếp theo: ${left.join(', ')}. Sau đó bấm "Đã xong tiếng Anh".`) : L('The English looks ready. Press "English is done" to send it for Vietnamese.', 'Tiếng Anh có vẻ đã xong. Bấm "Đã xong tiếng Anh" để gửi đi dịch.')
    if (!left.length) action = <button type="button" className="btn-primary !py-1.5 text-xs" onClick={onEnglishDone}>{L('English is done', 'Đã xong tiếng Anh')}<ArrowRight size={14} /></button>
  } else if (st === 'vi') {
    tone = 'amber'
    text = onlyVi
      ? L(`Next: the Vietnamese for ${c.needVi.length} part${c.needVi.length > 1 ? 's' : ''}, shown below. Each box saves by itself.`, `Tiếp theo: dịch ${c.needVi.length} phần bên dưới. Mỗi ô tự lưu.`)
      : L(`Next: the Vietnamese for ${c.needVi.length} part${c.needVi.length > 1 ? 's' : ''}. "Show only parts that need Vietnamese" hides the rest.`, `Tiếp theo: dịch ${c.needVi.length} phần. "Chỉ hiện các phần cần dịch" sẽ ẩn các phần còn lại.`)
    if (!onlyVi) action = <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={onOnlyVi}>{L('Show only those', 'Chỉ hiện các phần đó')}</button>
  } else if (st === 'ready') {
    tone = c.unchecked.length ? 'amber' : 'green'
    text = c.unchecked.length ? L(`Nearly ready: ${c.unchecked.length} photo${c.unchecked.length > 1 ? 's' : ''} still to check against the no-photo list.`, `Gần xong: còn ${c.unchecked.length} ảnh cần đối chiếu danh sách không chụp ảnh.`) : L('Ready. Publish puts it on the website and saves the email in Gmail.', 'Đã sẵn sàng. Bấm Đăng để đưa lên trang web và lưu email trong Gmail.')
    if (!c.unchecked.length) action = <button type="button" className="btn-primary !py-1.5 text-xs" onClick={onPublish}>{L('Publish…', 'Đăng…')}<ArrowRight size={14} /></button>
  } else if (st === 'changed') {
    tone = 'amber'
    text = L('Changed since it was published. Publish the changes so the page, the PDFs and the email match.', 'Đã sửa sau khi đăng. Hãy đăng phần đã sửa để trang web, PDF và email khớp nhau.')
    action = <button type="button" className="btn-primary !py-1.5 text-xs" onClick={onPublish}>{L('Publish the changes…', 'Đăng phần đã sửa…')}</button>
  } else {
    tone = 'green'
    text = issue.email?.saved_at
      ? L('Published. The email is in admin@ Drafts: send it, or schedule it for Friday 16:30, then paste "Copy for chat groups" into the class chats.', 'Đã đăng. Email nằm trong Thư nháp admin@: gửi hoặc hẹn giờ 16:30 thứ Sáu, rồi dán "Sao chép cho nhóm chat" vào các nhóm lớp.')
      : L('Published. Save the email in Gmail from the Published window.', 'Đã đăng. Lưu email vào Gmail trong cửa sổ Đã đăng.')
    action = <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={onPublish}>{L('Open', 'Mở')}</button>
  }
  const cls = { sky: 'border-sky-200 bg-sky-50 text-sky-900', amber: 'border-amber-200 bg-amber-50 text-amber-900', green: 'border-green-200 bg-green-50 text-green-900' }[tone]
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-t px-4 py-2.5 text-sm ${cls}`}>
      <ArrowRight size={16} className="flex-none" />
      <span className="min-w-0 flex-1">{text}</span>
      {action}
    </div>
  )
}

/** Class corners written, of those planned: { done, total, missing: [class names] }. */
export function cornerCount(parts) {
  const cs = parts.filter((p) => p.type === 'class' && !p.data?.skip)
  const done = cs.filter((p) => plain(p.data?.en?.body).length > 20)
  return { done: done.length, total: cs.length, missing: cs.filter((p) => !done.includes(p)).map((p) => p.data?.class) }
}
