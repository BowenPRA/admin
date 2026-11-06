import { BookOpen, CalendarDays, ExternalLink, Gamepad2, Link2, ListChecks, MonitorPlay, PencilRuler, Presentation, Printer } from 'lucide-react'
import { fmtDay } from '../../lib/leads'
import {
  DEVICES, KINDS, OUTPUTS, WANT_ICON, dayText, homeworkText, dayTone, statusLabel, statusOf, useL, wantOf,
} from '../../lib/lessons'
import { Avatar } from '../ui'

const OUTPUT_ICON = { slides: Presentation, plan: Printer, review: ListChecks, practice: MonitorPlay, worksheet: PencilRuler, game: Gamepad2 }

/** The status as a coloured pill. */
export function StatusPill({ status, office, size = 'sm' }) {
  const { lang } = useL()
  const s = statusOf(status)
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-bold ${size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'} ${s.tone}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />{statusLabel(status, lang, office)}
    </span>
  )
}

/** What was asked for, as small icons with names. */
export function WantChips({ wants, compact = false }) {
  const { lang } = useL()
  return (
    <span className={`${compact ? 'inline-flex' : 'flex'} flex-wrap items-center gap-1.5`}>
      {(wants || []).map((id) => {
        const w = wantOf(id)
        const Icon = WANT_ICON[id]
        if (!w) return null
        const label = lang === 'vi' ? w.vi : w.en
        return compact
          ? <span key={id} title={label} className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600"><Icon size={13} /></span>
          : <span key={id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700"><Icon size={13} />{label}</span>
      })}
    </span>
  )
}

/** The teaching date as a chip coloured by how soon it is. */
export function DayChip({ x }) {
  const { L, lang } = useL()
  if (!x?.needed_by) return null
  return <span className={`chip whitespace-nowrap ${dayTone(x)}`} title={L('Teaching date', 'Ngày dạy')}><CalendarDays size={12} className="mr-1" />{dayText(x.needed_by, lang)}</span>
}

/** The finished pieces as big buttons, once there are any. */
export function OutputButtons({ outputs }) {
  const { L, lang } = useL()
  const shown = OUTPUTS.filter((o) => outputs?.[o.id])
  if (!shown.length && !outputs?.note) return null
  return (
    <div className="space-y-2">
      {shown.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shown.map((o) => {
            const Icon = OUTPUT_ICON[o.id]
            return (
              <a key={o.id} href={outputs[o.id]} target="_blank" rel="noreferrer"
                className={`flex min-h-[56px] items-center gap-2.5 rounded-xl px-4 py-3 text-[15px] font-bold shadow-sm transition-colors ${o.tone}`}>
                <Icon size={20} className="flex-none" /><span className="flex-1 leading-tight">{lang === 'vi' ? o.vi : o.en}</span><ExternalLink size={14} className="flex-none opacity-70" />
              </a>
            )
          })}
        </div>
      )}
      {outputs?.note && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-100"><span className="font-semibold">{L('Note from the builder:', 'Ghi chú của người soạn:')}</span> {outputs.note}</p>}
    </div>
  )
}

// How the class is getting on with the online parts (PRA Learn) is components/learn/LearnResults.jsx.

/** The book, pages, topic and links the request is based on. */
export function SourceSummary({ source, sources }) {
  const { L, lang } = useL()
  const s = source || {}
  const book = sources.find((b) => b.id === s.book_id)
  const unit = book?.units?.find((u) => String(u.n) === String(s.unit))
  const sec = unit?.sections?.find((q) => String(q.id) === String(s.section))
  const links = (s.links || []).filter(Boolean)
  if (!s.book_id && !s.topic && !links.length) return null
  return (
    <div className="space-y-2.5">
      {s.book_id && (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-sky-100 text-sky-700"><BookOpen size={16} /></span>
          <div className="min-w-0 text-[15px] text-slate-900">
            <div className="font-semibold">{book?.title || s.book_id}{book?.kind && <span className="ml-1.5 text-xs font-normal text-slate-500">{(KINDS[book.kind] || KINDS.other)[lang === 'vi' ? 1 : 0]}</span>}</div>
            {(s.unit || s.section) && (
              <div className="text-sm text-slate-700">
                {s.unit && <span>{L('Unit', 'Chương')} {s.unit}{unit?.title ? `: ${unit.title}` : ''}</span>}
                {s.section && <span>{s.unit ? ' · ' : ''}{s.section}{sec?.title ? ` ${sec.title}` : ''}</span>}
              </div>
            )}
            {s.pages && <div className="text-sm text-slate-600">{L('Pages', 'Trang')} {s.pages}</div>}
          </div>
        </div>
      )}
      {s.topic && (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-amber-100 text-amber-700"><PencilRuler size={16} /></span>
          <p className="whitespace-pre-wrap pt-1 text-[15px] text-slate-900">{s.topic}</p>
        </div>
      )}
      {links.length > 0 && (
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-violet-100 text-violet-700"><Link2 size={16} /></span>
          <ul className="min-w-0 space-y-0.5 pt-1">
            {links.map((l, i) => <li key={i} className="truncate"><a href={l} target="_blank" rel="noreferrer" className="text-sm font-medium text-pra-blue hover:underline">{l}</a></li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

/** The optional details, only those filled in. */
export function DetailsList({ details }) {
  const { L, lang } = useL()
  const d = details || {}
  const rows = [
    d.teach_on && [L('Teaching date', 'Ngày dạy'), fmtDay(d.teach_on, lang)],
    d.length_min && [L('Lesson length', 'Thời lượng'), L(`${d.length_min} minutes`, `${d.length_min} phút`)],
    d.key_words && [L('Key words', 'Từ khóa'), d.key_words],
    d.hard && [L('What the class finds hard', 'Phần lớp thấy khó'), d.hard],
    d.ideas && [L('Ideas to include', 'Ý tưởng muốn có'), d.ideas],
    d.avoid && [L('What to avoid', 'Điều cần tránh'), d.avoid],
    (d.homework_amount || d.homework_due) && [L('Homework', 'Bài tập về nhà'), [d.homework_amount && homeworkText(d.homework_amount, lang), d.homework_due && L(`due ${fmtDay(d.homework_due, lang)}`, `hạn ${fmtDay(d.homework_due, lang)}`)].filter(Boolean).join(', ')],
    d.other && [L('Anything else', 'Ghi chú khác'), d.other],
  ].filter(Boolean)
  if (!rows.length) return <p className="text-sm text-slate-400">{L('No other details.', 'Không có chi tiết khác.')}</p>
  return (
    <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,9.5rem)_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[13px] font-semibold text-slate-500">{k}</dt>
          <dd className="whitespace-pre-wrap text-[15px] text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** About this class, in a few lines. */
export function ProfileSummary({ profile, sources }) {
  const { L } = useL()
  const p = profile?.profile || {}
  const devices = DEVICES.find((d) => d.id === p.devices_at_home)
  const books = (p.book_ids || []).map((id) => sources.find((s) => s.id === id)?.title || id)
  const rows = [
    p.english_level && [L('English level', 'Trình độ tiếng Anh'), p.english_level],
    typeof p.vietnamese_support === 'boolean' && [L('Vietnamese support', 'Hỗ trợ tiếng Việt'), p.vietnamese_support ? L('Yes, add Vietnamese where it helps', 'Có, thêm tiếng Việt khi cần') : L('No, English only', 'Không, chỉ tiếng Anh')],
    devices && [L('Devices at home', 'Thiết bị ở nhà'), L(`${devices.en} students`, `${devices.vi} học viên`)],
    p.example_name && [L('Name in examples', 'Tên dùng trong ví dụ'), p.example_name],
    books.length > 0 && [L('Books', 'Sách'), books.join(', ')],
    p.notes && [L('Notes', 'Ghi chú'), p.notes],
  ].filter(Boolean)
  if (!rows.length) return null
  return (
    <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,10rem)_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-semibold text-slate-500">{k}</dt>
          <dd className="whitespace-pre-wrap text-slate-800">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The comments, questions, answers and changes of status, oldest first. */
export function Thread({ updates, office }) {
  const { L, lang } = useL()
  if (!updates?.length) return <p className="text-sm text-slate-400">{L('No messages yet.', 'Chưa có trao đổi.')}</p>
  return (
    <ol className="space-y-3">
      {updates.map((u, i) => {
        const by = u.name || (u.by ? u.by.split('@')[0] : '')
        if (u.kind === 'status') {
          const s = statusOf(u.text)
          return (
            <li key={`${u.at}-${i}`} className="flex items-center gap-2 pl-1 text-[13px] text-slate-500">
              <span className={`h-2 w-2 flex-none rounded-full ${s.dot}`} />
              <span>{by ? <><span className="font-semibold text-slate-700">{by}</span> · </> : null}{statusLabel(u.text, lang, office)} · {fmtDay(u.at, lang)}</span>
            </li>
          )
        }
        const tone = u.kind === 'question' ? 'bg-violet-50 ring-violet-200' : u.kind === 'answer' ? 'bg-sky-50 ring-sky-100' : 'bg-slate-50 ring-slate-100'
        const tag = u.kind === 'question' ? L('Question', 'Câu hỏi') : u.kind === 'answer' ? L('Answer', 'Trả lời') : ''
        return (
          <li key={`${u.at}-${i}`} className="flex gap-3">
            <Avatar name={by || '?'} size={30} className="mt-0.5" />
            <div className={`min-w-0 flex-1 rounded-xl rounded-tl-sm px-3.5 py-2.5 ring-1 ${tone}`}>
              <div className="text-[13px] text-slate-500">
                <span className="font-semibold text-slate-800">{by || '?'}</span> · {fmtDay(u.at, lang)}
                {tag && <span className={`ml-2 rounded px-1.5 py-px text-[11px] font-bold uppercase tracking-wide ${u.kind === 'question' ? 'bg-violet-600 text-white' : 'bg-sky-600 text-white'}`}>{tag}</span>}
              </div>
              <div className="mt-0.5 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{u.text}</div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function Heading({ children, n, icon: Icon }) {
  return (
    <h4 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pra-navy">
      {Icon && <Icon size={14} />}{children}{n > 0 && <span className="rounded-full bg-sky-100 px-1.5 text-[11px] text-sky-800">{n}</span>}
    </h4>
  )
}
