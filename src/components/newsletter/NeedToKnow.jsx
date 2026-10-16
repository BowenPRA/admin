import { useEffect, useState } from 'react'
import { CalendarDays, CalendarPlus, ChevronDown, ChevronRight, Pin, Plus, Repeat, X } from 'lucide-react'
import { academicCalendar, upcoming } from '../../lib/newsletter/calendarFeed'
import { addDays, dateRange, timeSpan } from '../../lib/newsletter/dates'
import { itemsOf, viState } from '../../lib/newsletter/payload'
import { PART_TYPES } from '../../lib/newsletter/constants'
import { Meter, ViChip } from './bits'

const nid = () => Math.random().toString(36).slice(2, 8)
const TAG_LABEL = { off: ['no classes', 'nghỉ học', 'bg-rose-100 text-rose-800'], fees: ['fees', 'học phí', 'bg-amber-100 text-amber-800'], event: ['event', 'sự kiện', 'bg-green-100 text-green-800'] }

/**
 * "Need to know": the dates (ticked from the academic calendar, or added for
 * this issue) and the reminders. Always first in the email, the page and the
 * PDF, whatever order the other parts are in.
 */
export default function NeedToKnow({ dates, reminders, issue, edit, disabled, L, lang, open = true, onToggle }) {
  return (
    <section className="card overflow-hidden" id={dates ? `part-${dates.id}` : undefined}>
      <div className={`flex flex-wrap items-center gap-2 bg-gradient-to-r from-sky-50 to-white px-4 py-3 ${open ? 'border-b border-slate-100' : ''}`}>
        {onToggle && <button type="button" onClick={onToggle} className="-ml-2 grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700" aria-expanded={open} aria-label={open ? L('Fold', 'Thu gọn') : L('Open', 'Mở')}>{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>}
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-pra-blue text-white"><Pin size={18} /></span>
        <div><div className="font-bold text-slate-800">{L('Need to know', 'Cần biết')}</div><div className="text-xs text-slate-500">{L('First in the email, the page and the PDF. Families who read nothing else read this.', 'Luôn ở đầu email, trang web và PDF. Gia đình không đọc gì khác cũng sẽ đọc phần này.')}</div></div>
      </div>
      {open && <div className="grid grid-cols-1 2xl:grid-cols-[1.25fr_1fr]">
        {dates && <Dates part={dates} issue={issue} edit={edit} disabled={disabled} L={L} lang={lang} />}
        {reminders && <Reminders part={reminders} edit={edit} disabled={disabled} L={L} />}
      </div>}
    </section>
  )
}

function Dates({ part, issue, edit, disabled, L, lang }) {
  // A date with no day (half-made, or left by a save that landed after it was removed) goes last instead of breaking the page.
  const items = itemsOf(part).sort((a, b) => String(a.iso || '9999').localeCompare(String(b.iso || '9999')) || (a.pos ?? 0) - (b.pos ?? 0))
  const [cal, setCal] = useState([])
  useEffect(() => { academicCalendar().then(setCal) }, [])
  const have = new Set(items.map((i) => i.cal).filter(Boolean))
  const more = upcoming(cal, issue.issue_date, 120).filter((e) => !have.has(e.id))
  const set = (it, fields) => edit(part.id, Object.entries(fields).map(([k, v]) => [['items', it.id, k], v]))
  const setVi = (it, v) => edit(part.id, [[['items', it.id, 'vi'], v], [['items', it.id, 'vi_from'], String(it.en || '').trim()]])
  const add = (fields) => edit(part.id, [['items', nid()], { on: true, pos: items.length, t1: '', t2: '', en: '', vi: '', tag: '', ...fields }], { now: true })
  const vs = viState(part)
  return (
    <div className="min-w-0 space-y-2 p-4">
      <div className="flex items-center gap-2"><CalendarDays size={15} className="text-pra-blue" /><span className="label !mb-0">{L('Dates to remember', 'Ngày cần nhớ')}</span><ViChip state={vs} L={L} /></div>
      <p className="text-xs text-slate-500">{L('Tick the dates to show. The app writes each date in both languages, so only the words of an added date need translating.', 'Đánh dấu những ngày muốn hiện. Ngày tháng được viết sẵn bằng hai thứ tiếng, chỉ cần dịch phần nội dung của ngày tự thêm.')}</p>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {items.map((it) => it.cal ? (
          <li key={it.id} className={`flex items-start gap-3 px-3 py-2 ${it.on === false ? 'opacity-50' : ''}`}>
            <input type="checkbox" className="mt-1 h-4 w-4" checked={it.on !== false} disabled={disabled} onChange={(e) => set(it, { on: e.target.checked })} aria-label={it.en} />
            <div className="w-36 flex-none text-sm font-semibold tabular-nums text-slate-700">{dateRange(it.iso, it.end, lang === 'vi' ? 'vi' : 'en')}</div>
            <div className="min-w-0 flex-1 text-sm">
              <div className="text-slate-800">{it.en}{it.tag && TAG_LABEL[it.tag] && <span className={`chip ml-1.5 !py-0 ${TAG_LABEL[it.tag][2]}`}>{L(TAG_LABEL[it.tag][0], TAG_LABEL[it.tag][1])}</span>}</div>
              <div className="text-xs text-slate-500">{it.vi} · {L('from the academic calendar', 'từ lịch năm học')}</div>
            </div>
          </li>
        ) : (
          <li key={it.id} className={`space-y-2 px-3 py-2.5 ${it.on === false ? 'opacity-50' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={it.on !== false} disabled={disabled} onChange={(e) => set(it, { on: e.target.checked })} aria-label={L('Show this date', 'Hiện ngày này')} />
              <input type="date" className="input !w-auto !py-1" value={it.iso || ''} disabled={disabled} onChange={(e) => set(it, { iso: e.target.value })} aria-label={L('Date', 'Ngày')} />
              <span className="text-xs text-slate-400">{L('to', 'đến')}</span>
              <input type="date" className="input !w-auto !py-1" value={it.end || ''} disabled={disabled} min={it.iso} onChange={(e) => set(it, { end: e.target.value || null })} aria-label={L('Last day (optional)', 'Ngày cuối (không bắt buộc)')} />
              <input type="time" className="input !w-auto !py-1" value={it.t1 || ''} disabled={disabled} onChange={(e) => set(it, { t1: e.target.value })} aria-label={L('From', 'Từ')} />
              <input type="time" className="input !w-auto !py-1" value={it.t2 || ''} disabled={disabled} onChange={(e) => set(it, { t2: e.target.value })} aria-label={L('Until', 'Đến')} />
              <select className="input !w-auto !py-1 text-xs" value={it.tag || ''} disabled={disabled} onChange={(e) => set(it, { tag: e.target.value })} aria-label={L('Kind', 'Loại')}>
                <option value="">{L('No tag', 'Không nhãn')}</option><option value="event">{L('Event', 'Sự kiện')}</option><option value="off">{L('No classes', 'Nghỉ học')}</option><option value="fees">{L('Fees', 'Học phí')}</option>
              </select>
              {!disabled && <button type="button" className="btn-ghost !px-2" onClick={() => edit(part.id, [['items', it.id], null, true], { now: true })} aria-label={L('Remove', 'Xoá')}><X size={15} /></button>}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input className="input !py-1.5" value={it.en || ''} disabled={disabled} placeholder={L('What is happening', 'Sự kiện gì')} onChange={(e) => set(it, { en: e.target.value })} />
              <input className={`input !py-1.5 ${it.en && !it.vi ? '!border-amber-300 !bg-amber-50/60' : ''}`} value={it.vi || ''} disabled={disabled} placeholder={L('In Vietnamese', 'Bằng tiếng Việt')} onChange={(e) => setVi(it, e.target.value)} lang="vi" />
            </div>
            {it.iso && <div className="text-xs text-slate-400">{L('Shows as', 'Hiện là')} <b className="text-slate-600">{dateRange(it.iso, it.end, 'en')}{it.t1 ? `, ${timeSpan(it.t1, it.t2, 'en')}` : ''}</b> / <b className="text-slate-600">{dateRange(it.iso, it.end, 'vi')}{it.t1 ? `, ${timeSpan(it.t1, it.t2, 'vi')}` : ''}</b></div>}
          </li>
        ))}
        {!items.length && <li className="px-3 py-3 text-sm text-slate-400">{L('No dates yet.', 'Chưa có ngày nào.')}</li>}
      </ul>
      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => add({ iso: addDays(issue.issue_date, 7) })}><CalendarPlus size={14} />{L('Add a date', 'Thêm ngày')}</button>
          {more.length > 0 && (
            <select className="input !w-auto !py-1.5 text-xs" value="" onChange={(e) => { const ev = more.find((x) => x.id === e.target.value); if (ev) add({ cal: ev.id, iso: ev.iso, end: ev.end || null, en: ev.en, vi: ev.vi, tag: ev.tag, vi_from: ev.en }) }}>
              <option value="">{L('+ From the academic calendar…', '+ Từ lịch năm học…')}</option>
              {more.map((e) => <option key={e.id} value={e.id}>{dateRange(e.iso, e.end, 'en')} · {e.en}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  )
}

function Reminders({ part, edit, disabled, L }) {
  const items = itemsOf(part)
  const lim = PART_TYPES.reminders.limits.item
  const set = (it, k, v) => edit(part.id, k === 'vi' ? [[['items', it.id, 'vi'], v], [['items', it.id, 'vi_from'], String(it.en || '').trim()]] : [['items', it.id, k], v])
  const vs = viState(part)
  return (
    <div id={`part-${part.id}`} className="min-w-0 space-y-2 border-t border-slate-100 p-4 2xl:border-l 2xl:border-t-0">
      <div className="flex items-center gap-2"><Pin size={15} className="text-pra-green" /><span className="label !mb-0">{L('Remember', 'Ghi nhớ')}</span><ViChip state={vs} L={L} /></div>
      <p className="text-xs text-slate-500">{L('Things to bring, pay or send back. One short line each.', 'Những thứ cần mang, cần đóng hoặc gửi lại. Mỗi việc một dòng ngắn.')}</p>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="space-y-1 rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex items-start gap-2">
              <input className="input !py-1.5" value={it.en || ''} disabled={disabled} placeholder={L('e.g. Friday: Water Play. Pack a change of clothes.', 'VD: Thứ Sáu: Chơi nước. Mang theo quần áo thay.')} onChange={(e) => set(it, 'en', e.target.value)} />
              {!disabled && <button type="button" className="btn-ghost !px-2" onClick={() => edit(part.id, [['items', it.id], null, true], { now: true })} aria-label={L('Remove', 'Xoá')}><X size={15} /></button>}
            </div>
            <input className={`input !py-1.5 ${it.en && !it.vi ? '!border-amber-300 !bg-amber-50/60' : ''}`} value={it.vi || ''} disabled={disabled} placeholder={L('In Vietnamese', 'Bằng tiếng Việt')} onChange={(e) => set(it, 'vi', e.target.value)} lang="vi" />
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600" title={L('Carried over into next week\'s issue', 'Tự chuyển sang số tuần sau')}>
                <input type="checkbox" checked={!!it.repeat} disabled={disabled} onChange={(e) => set(it, 'repeat', e.target.checked)} /><Repeat size={12} />{L('Every week', 'Hằng tuần')}
              </label>
              <Meter text={it.en} limit={lim} />
            </div>
          </li>
        ))}
      </ul>
      {!disabled && <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => edit(part.id, [['items', nid()], { en: '', vi: '', repeat: false, pos: items.length }], { now: true })}><Plus size={14} />{L('Add a reminder', 'Thêm ghi nhớ')}</button>}
    </div>
  )
}
