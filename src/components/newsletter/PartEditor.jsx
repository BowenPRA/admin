import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, EyeOff, Plus, Trash2, Users, X } from 'lucide-react'
import { applyEdit } from '../../lib/newsletter/data'
import { PART_TYPES, PART_LABELS_VI as VI_LABELS, PART_HELP_VI, STORY_ICONS, CLASS_TONES, TONES, portraitUrl } from '../../lib/newsletter/constants'
import { safeUrl } from '../../lib/newsletter/text'
import { partState, partSummary } from './EditorBits'
import { enSnapshot, viState, notesFor, wordsOf } from '../../lib/newsletter/payload'
import { diffWords, fixQuy } from '../../lib/newsletter/text'
import { palmPressPosts } from '../../lib/newsletter/calendarFeed'
import { Avatar } from '../ui'
import { Meter, Note, RichText, TwoCols, ViChip } from './bits'
import { NlIcon } from './icons'
import PhotoStrip from './PhotoStrip'

const VI_TEXT_FIELDS = ['heading', 'when', 'body', 'ask', 'text', 'who', 'blurb', 'button_label']
const nid = () => Math.random().toString(36).slice(2, 8)

/**
 * One part of an issue in the editor: its header (icon, kind, Vietnamese state,
 * families only, move, remove), the English and the Vietnamese side by side, its
 * photos, and under it the wording notes and what changed in the English.
 */
export default function PartEditor({ part, issue, edit, me, L, office, canEdit, onMove, onRemove, onPatch, first, last, canSeeAlbums, open = true, onToggle, keyInUse }) {
  const T = PART_TYPES[part.type] || {}
  const d = part.data || {}
  const en = d.en || {}, vi = d.vi || {}
  const vs = viState(part)
  const notes = notesFor(part)
  const disabled = !canEdit
  const [iconOpen, setIconOpen] = useState(false)

  /** One text in one language. Writing Vietnamese counts as bringing the part's Vietnamese up to date. */
  const setText = (lang, field, value) => {
    const edits = [[[lang, field], value]]
    if (lang === 'vi') edits.push([['vi_from'], enSnapshot({ ...part, data: applyEdit(d, [lang, field], value) })])
    edit(part.id, edits)
  }
  const input = (lang, field, ph, { lead = false, limit } = {}) => (
    <div className="space-y-1">
      <input className={`input ${lead ? 'font-semibold' : ''} ${lang === 'vi' && en[field] && !vi[field] ? '!border-amber-300 !bg-amber-50/60' : ''}`} value={(lang === 'en' ? en : vi)[field] || ''}
        onChange={(e) => setText(lang, field, e.target.value)} placeholder={ph} disabled={disabled} lang={lang} />
      <Meter text={(lang === 'en' ? en : vi)[field]} limit={limit && (lang === 'vi' ? Math.round(limit * 1.2) : limit)} />
    </div>
  )
  const rich = (lang, field, ph, { limit, minHeight } = {}) => (
    <div className="space-y-1">
      <RichText value={(lang === 'en' ? en : vi)[field] || ''} onChange={(v) => setText(lang, field, v)} placeholder={ph} disabled={disabled} lang={lang}
        minHeight={minHeight} label={`${field} ${lang}`} invalid={lang === 'vi' && !!en[field] && !vi[field]} />
      <Meter text={(lang === 'en' ? en : vi)[field]} html limit={limit && (lang === 'vi' ? Math.round(limit * 1.2) : limit)} />
    </div>
  )
  const label = (text, hint) => <div className="flex items-baseline justify-between gap-2"><span className="label !mb-0">{text}</span>{hint && <span className="text-[11px] text-slate-400">{hint}</span>}</div>
  const lim = T.limits || {}

  const fixAll = () => {
    const edits = []
    for (const f of VI_TEXT_FIELDS) if (vi[f] && fixQuy(vi[f]) !== vi[f]) edits.push([['vi', f], fixQuy(vi[f])])
    for (const p of d.photos || []) if (p.id && p.vi && fixQuy(p.vi) !== p.vi) edits.push([['photos', `@${p.id}`, 'vi'], fixQuy(p.vi)])
    for (const w of wordsOf(part)) if (w.vi && fixQuy(w.vi) !== w.vi) edits.push([['words', w.id, 'vi'], fixQuy(w.vi)])
    if (edits.length) edit(part.id, edits)
  }

  let body = null
  if (part.type === 'opening') {
    body = <TwoCols L={L}
      en={<>{label(L('First sentence, in bold', 'Câu mở đầu, in đậm'), L('Also the preview line in the inbox', 'Cũng là dòng xem trước trong hộp thư'))}{input('en', 'heading', L('What this week was about, in one sentence', 'Một câu nói về tuần này'), { lead: true, limit: lim.heading })}
        {label(L('Then two or three sentences', 'Sau đó hai, ba câu'))}{rich('en', 'body', L('Keep it short: the details go in the parts below.', 'Viết ngắn gọn: chi tiết nằm ở các phần bên dưới.'), { limit: lim.body })}</>}
      vi={<>{label(L('First sentence', 'Câu mở đầu'))}{input('vi', 'heading', '', { lead: true, limit: lim.heading })}{label(L('The rest', 'Phần còn lại'))}{rich('vi', 'body', '', { limit: lim.body })}</>} />
  } else if (part.type === 'story') {
    body = <>
      <TwoCols L={L}
        en={<>{label(L('Heading', 'Tiêu đề'))}{input('en', 'heading', L('e.g. Quarter One Academic Showcase', 'VD: Academic Showcase Quý 1'), { lead: true, limit: lim.heading })}
          {label(L('Date and time line', 'Dòng ngày giờ'), L('optional', 'không bắt buộc'))}{input('en', 'when', L('e.g. Thursday 15 October · 3:30–4:15 PM', 'VD: Thứ Năm 15/10 · 15:30–16:15'), { limit: lim.when })}
          {label(L('Text', 'Nội dung'), L('The first sentence is what the email shows', 'Câu đầu tiên sẽ hiện trong email'))}{rich('en', 'body', L('Write here, or paste from a Google Doc: bold, bullets and links are kept.', 'Viết ở đây, hoặc dán từ Google Doc: giữ chữ đậm, gạch đầu dòng và liên kết.'), { limit: lim.body, minHeight: 120 })}
          {label(L('Button', 'Nút bấm'), L('optional, e.g. "Sign up" with a link', 'không bắt buộc, VD: "Đăng ký" kèm liên kết'))}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr]">
            <input className="input" value={en.button_label || ''} onChange={(e) => setText('en', 'button_label', e.target.value)} placeholder={L('Button words', 'Chữ trên nút')} disabled={disabled} />
            <input className={`input ${d.button_url && !safeUrl(d.button_url) ? '!border-amber-300 !bg-amber-50/60' : ''}`} value={d.button_url || ''} onChange={(e) => edit(part.id, [['button_url'], e.target.value])} placeholder="https://…" disabled={disabled} />
          </div>
          {d.button_url && !safeUrl(d.button_url) && <p className="text-xs font-semibold text-amber-700">{L('The link must start with https:// (copy it from the address bar of the browser). Until then the button is left out.', 'Liên kết phải bắt đầu bằng https:// (sao chép từ thanh địa chỉ trình duyệt). Khi chưa đúng, nút sẽ không hiện.')}</p>}
          {!!en.button_label && !d.button_url && <p className="text-xs text-amber-700">{L('Add the link, or the button is left out.', 'Hãy thêm liên kết, nếu không nút sẽ không hiện.')}</p>}</>}
        vi={<>{label(L('Heading', 'Tiêu đề'))}{input('vi', 'heading', '', { lead: true, limit: lim.heading })}{label(L('Date and time line', 'Dòng ngày giờ'))}{input('vi', 'when', '', { limit: lim.when })}
          {label(L('Text', 'Nội dung'))}{rich('vi', 'body', '', { limit: lim.body, minHeight: 120 })}
          {label(L('Button words', 'Chữ trên nút'))}{input('vi', 'button_label', '')}</>} />
      <div className="border-t border-slate-100 p-4">{label(L('Photos', 'Ảnh'), L(`up to ${T.photos}; one sits beside the text`, `tối đa ${T.photos}; một ảnh sẽ nằm cạnh chữ`))}
        <div className="mt-2"><PhotoStrip keyInUse={keyInUse} part={part} max={T.photos} edit={edit} issueId={issue.id} me={me} canClear={office} canSeeAlbums={canSeeAlbums} disabled={disabled} /></div></div>
    </>
  } else if (part.type === 'class') {
    body = d.skip ? <p className="p-4 text-sm text-slate-500">{L('No corner for this class this week. It is left out of the email, the page and the PDF.', 'Tuần này không có góc lớp này. Phần này sẽ không có trong email, trang web và PDF.')}</p> : <>
      <TwoCols L={L}
        en={<>{label(L('What the class did this week', 'Lớp đã làm gì trong tuần'), L('a few sentences; bold words make small headings', 'vài câu; chữ in đậm làm tiêu đề nhỏ'))}{rich('en', 'body', L('e.g. Science: we planted seeds and measured them every day…', 'VD: Khoa học: các con gieo hạt và đo mỗi ngày…'), { limit: lim.body, minHeight: 120 })}
          {label(L('Ask your child', 'Hỏi con nhé'), L('one question families can ask at home', 'một câu hỏi gia đình có thể hỏi con ở nhà'))}{input('en', 'ask', L('e.g. What did your seed need to grow?', 'VD: Hạt giống cần gì để lớn?'), { limit: lim.ask })}</>}
        vi={<>{label(L('What the class did', 'Lớp đã làm gì'))}{rich('vi', 'body', '', { limit: lim.body, minHeight: 120 })}{label(L('Ask your child', 'Hỏi con nhé'))}{input('vi', 'ask', '', { limit: lim.ask })}</>} />
      <div className="space-y-2 border-t border-slate-100 p-4">
        {label(L('Words of the week', 'Từ vựng trong tuần'), L('the English word and what it means in Vietnamese', 'từ tiếng Anh và nghĩa tiếng Việt'))}
        <WordList part={part} edit={edit} disabled={disabled} L={L} />
      </div>
      <div className="border-t border-slate-100 p-4">{label(L('Photos', 'Ảnh'), L(`up to ${T.photos}`, `tối đa ${T.photos}`))}
        <div className="mt-2"><PhotoStrip keyInUse={keyInUse} part={part} max={T.photos} edit={edit} issueId={issue.id} me={me} canClear={office} canSeeAlbums={canSeeAlbums} disabled={disabled} /></div></div>
    </>
  } else if (part.type === 'photos') {
    body = <>
      <TwoCols L={L} en={<>{label(L('Heading', 'Tiêu đề'))}{input('en', 'heading', L('e.g. Water Play', 'VD: Chơi nước'), { lead: true, limit: lim.heading })}</>}
        vi={<>{label(L('Heading', 'Tiêu đề'))}{input('vi', 'heading', '', { lead: true, limit: lim.heading })}</>} />
      <div className="border-t border-slate-100 p-4"><PhotoStrip keyInUse={keyInUse} part={part} max={T.photos} edit={edit} issueId={issue.id} me={me} canClear={office} canSeeAlbums={canSeeAlbums} disabled={disabled} /></div>
    </>
  } else if (part.type === 'quote') {
    body = <>
      <TwoCols L={L}
        en={<>{label(L('What they said', 'Câu nói'), L('their own words', 'nguyên văn'))}{input('en', 'text', L('"I learned that…"', '"Con học được rằng…"'), { limit: lim.text })}{label(L('Who', 'Ai'), L('first name and class', 'tên và lớp'))}{input('en', 'who', L('e.g. Amada, Year 7', 'VD: Amada, lớp 7'), { limit: lim.who })}</>}
        vi={<>{label(L('What they said', 'Câu nói'))}{input('vi', 'text', '', { limit: lim.text })}{label(L('Who', 'Ai'))}{input('vi', 'who', '')}</>} />
      <div className="border-t border-slate-100 p-4"><PhotoStrip keyInUse={keyInUse} part={part} max={1} edit={edit} issueId={issue.id} me={me} canClear={office} canSeeAlbums={canSeeAlbums} disabled={disabled} /></div>
    </>
  } else if (part.type === 'press') {
    body = <PressEditor part={part} edit={edit} disabled={disabled} L={L} setText={setText} />
  } else if (part.type === 'welcome') {
    body = <>
      <TwoCols L={L} en={<>{label(L('Heading', 'Tiêu đề'))}{input('en', 'heading', L('Welcome to our new families', 'Chào mừng các gia đình mới'))}{label(L('A line or two', 'Một hai câu'))}{rich('en', 'body', '', { limit: lim.body })}</>}
        vi={<>{label(L('Heading', 'Tiêu đề'))}{input('vi', 'heading', '')}{label(L('A line or two', 'Một hai câu'))}{rich('vi', 'body', '', { limit: lim.body })}</>} />
      <div className="space-y-2 border-t border-slate-100 p-4">{label(L('New students', 'Học viên mới'), L('first names and class only', 'chỉ tên gọi và lớp'))}
        <NameList part={part} edit={edit} disabled={disabled} L={L} /></div>
    </>
  } else if (part.type === 'closing') {
    body = <TwoCols L={L}
      en={<>{rich('en', 'body', L('A line to finish', 'Một câu kết'), { limit: lim.body, minHeight: 64 })}<p className="text-xs text-slate-400">{L('"Warm regards, Palm River Academy English Center" is added by itself.', '"Warm regards, Palm River Academy English Center" được thêm tự động.')}</p></>}
      vi={<>{rich('vi', 'body', '', { limit: lim.body, minHeight: 64 })}<p className="text-xs text-slate-400">{L('"Trân trọng, Trung tâm Anh ngữ Palm River Academy" is added by itself.', '"Trân trọng, Trung tâm Anh ngữ Palm River Academy" được thêm tự động.')}</p></>} />
  }

  const tone = part.type === 'class' ? TONES[CLASS_TONES[d.class_key] || 'blue'] : null
  const movable = !T.once
  return (
    <section id={`part-${part.id}`} className={`card overflow-hidden ${part.type === 'class' ? 'border-l-[6px]' : ''}`} style={tone ? { borderLeftColor: tone.main } : undefined}>
      <div className={`flex flex-wrap items-center gap-2 bg-white px-3 py-2.5 ${open ? 'border-b border-slate-100' : ''}`}>
        {onToggle && <button type="button" onClick={onToggle} className="-ml-1 grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-expanded={open} aria-label={open ? L('Fold this part', 'Thu gọn phần này') : L('Open this part', 'Mở phần này')}>{open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>}
        {['story', 'photos'].includes(part.type) && !disabled ? (
          <div className="relative">
            <button type="button" onClick={() => setIconOpen((v) => !v)} className="grid h-9 w-9 place-items-center rounded-lg border border-sky-100 bg-sky-50 text-pra-blue hover:border-pra-blue" title={L('Change the icon', 'Đổi biểu tượng')}><NlIcon name={d.icon || T.icon} /></button>
            {iconOpen && <IconGrid value={d.icon} onPick={(n) => { edit(part.id, [['icon'], n], { now: true }); setIconOpen(false) }} onClose={() => setIconOpen(false)} L={L} />}
          </div>
        ) : part.type === 'class' ? (
          <Avatar src={portraitUrl(d.teacher)} name={d.teacher || d.class} size={36} />
        ) : <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500"><NlIcon name={T.icon} /></span>}
        <div className={`min-w-0 ${onToggle ? 'cursor-pointer' : ''}`} onClick={onToggle}>
          <div className="font-bold text-slate-800">{part.type === 'class' ? <>{d.class} <span className="font-normal text-slate-500">· {L('class corner', 'góc lớp')}</span></> : L(T.label, VI_LABELS[part.type])}</div>
          {part.type === 'class' && <div className="text-xs text-slate-500">{d.teacher ? L(`Written by ${d.teacher}, or the office`, `Do ${d.teacher} hoặc văn phòng viết`) : L('No class teacher set', 'Chưa có giáo viên chủ nhiệm')}{part.updated_by ? ` · ${L('last change', 'sửa lần cuối')}: ${part.updated_by.split('@')[0]}` : ''}</div>}
        </div>
        <span className="flex flex-wrap gap-1"><ViChip state={vs} L={L} />{(part.public === false || T.familiesOnly) && <span className="chip bg-violet-100 text-violet-800"><EyeOff size={12} className="mr-1" />{L('Families only', 'Chỉ gửi gia đình')}</span>}</span>
        <span className="flex-1" />
        {office && part.type === 'class' && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600">
            <input type="checkbox" checked={!!d.skip} onChange={(e) => edit(part.id, [['skip'], e.target.checked], { now: true })} />{L('No corner this week', 'Tuần này không có')}
          </label>
        )}
        {office && ['story', 'photos', 'quote', 'press'].includes(part.type) && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600" title={L('In the email and the PDF, never on the public page', 'Có trong email và PDF, không đăng lên trang web')}>
            <input type="checkbox" checked={part.public === false} onChange={(e) => onPatch({ public: !e.target.checked })} />{L('Families only', 'Chỉ gửi gia đình')}
          </label>
        )}
        {office && movable && (
          <span className="flex">
            <button type="button" className="btn-ghost !px-2" disabled={first} onClick={() => onMove(-1)} aria-label={L('Move up', 'Lên')}><ArrowUp size={16} /></button>
            <button type="button" className="btn-ghost !px-2" disabled={last} onClick={() => onMove(1)} aria-label={L('Move down', 'Xuống')}><ArrowDown size={16} /></button>
            <button type="button" className="btn-ghost !px-2 hover:!text-red-600" onClick={onRemove} aria-label={L('Remove', 'Xoá')}><Trash2 size={16} /></button>
          </span>
        )}
      </div>
      {!open && (
        <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">
          <span className="min-w-0 flex-1 truncate">{partSummary(part) || <i>{L('Nothing written yet', 'Chưa viết gì')}</i>}</span>
          <span className="flex-none text-xs font-semibold text-slate-400">{partState(part, L).text}</span>
        </button>
      )}
      {open && T.help && <p className="px-4 pt-3 text-xs leading-relaxed text-slate-500">{L(T.help, PART_HELP_VI[part.type])}</p>}
      {open && body}
      {open && (vs.kind === 'changed' || notes.length > 0) && (
        <div className="space-y-2 border-t border-slate-100 bg-white p-3">
          {vs.kind === 'changed' && part.type !== 'dates' && part.type !== 'reminders' && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700">
              <div className="label">{L('What changed in the English since it was translated', 'Những gì đã sửa trong tiếng Anh sau khi dịch')}</div>
              <div className="[&_del]:mr-0.5 [&_del]:bg-red-100 [&_del]:text-red-800 [&_ins]:bg-green-100 [&_ins]:text-green-900 [&_ins]:no-underline" dangerouslySetInnerHTML={{ __html: diffWords(d.vi_from || '', enSnapshot(part)) }} />
              {canEdit && <div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" className="btn-secondary !py-1 text-xs" onClick={() => edit(part.id, [['vi_from'], enSnapshot(part)], { now: true })}>{L('The Vietnamese still fits', 'Bản tiếng Việt vẫn đúng')}</button><span className="text-xs text-slate-500">{L('Or change the Vietnamese, and this goes away.', 'Hoặc sửa bản tiếng Việt, thông báo này sẽ mất.')}</span></div>}
            </div>
          )}
          {notes.map((n) => (
            <Note key={n.msg} action={n.fix === 'quy' && canEdit ? <button type="button" className="btn-secondary !py-1 text-xs" onClick={fixAll}>{L('Change to "quý"', 'Đổi thành "quý"')}</button> : null}>
              <b>{n.lang === 'vi' ? L('Vietnamese', 'Tiếng Việt') : 'English'}:</b> {n.msg}{n.n > 1 ? ` (${n.n})` : ''}
            </Note>
          ))}
        </div>
      )}
    </section>
  )
}


function IconGrid({ value, onPick, onClose, L }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal-in absolute left-0 top-11 z-30 w-[300px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
      <div className="mb-1.5 flex items-center justify-between px-1 text-xs text-slate-500">{L('Drawn icons look the same on the page, in the email and in the PDF.', 'Biểu tượng giống nhau trên trang web, email và PDF.')}<button type="button" onClick={onClose} className="text-slate-400"><X size={14} /></button></div>
      <div className="grid grid-cols-8 gap-1">
        {STORY_ICONS.map((n) => (
          <button key={n} type="button" title={n.replace(/-/g, ' ')} onClick={() => onPick(n)}
            className={`grid h-8 w-8 place-items-center rounded-lg ${value === n ? 'bg-pra-blue text-white' : 'text-slate-600 hover:bg-sky-50 hover:text-pra-blue'}`}><NlIcon name={n} size={17} /></button>
        ))}
      </div>
    </div>
  )
}

function WordList({ part, edit, disabled, L }) {
  const words = wordsOf(part)
  const max = PART_TYPES.class.words
  const setWord = (w, lang, value) => {
    const edits = [[['words', w.id, lang], value]]
    if (lang === 'vi') {
      const next = applyEdit(part.data, ['words', w.id, lang], value)
      edits.push([['vi_from'], enSnapshot({ ...part, data: next })])
    }
    edit(part.id, edits)
  }
  return (
    <div className="space-y-1.5">
      {words.map((w) => (
        <div key={w.id} className="flex items-center gap-2">
          <input className="input !py-1.5 font-semibold" value={w.en || ''} onChange={(e) => setWord(w, 'en', e.target.value)} placeholder={L('English word', 'Từ tiếng Anh')} disabled={disabled} lang="en" />
          <input className={`input !py-1.5 ${w.en && !w.vi ? '!border-amber-300 !bg-amber-50/60' : ''}`} value={w.vi || ''} onChange={(e) => setWord(w, 'vi', e.target.value)} placeholder={L('Vietnamese meaning', 'Nghĩa tiếng Việt')} disabled={disabled} lang="vi" />
          {!disabled && <button type="button" className="btn-ghost !px-2" onClick={() => edit(part.id, [['words', w.id], null, true], { now: true })} aria-label={L('Remove word', 'Xoá từ')}><X size={15} /></button>}
        </div>
      ))}
      {!disabled && words.length < max && (
        <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => edit(part.id, [['words', nid()], { en: '', vi: '', pos: (words[words.length - 1]?.pos ?? -1) + 1 }], { now: true })}>
          <Plus size={14} />{L('Add a word', 'Thêm từ')}
        </button>
      )}
    </div>
  )
}

function NameList({ part, edit, disabled, L }) {
  const names = part.data?.names || []
  const set = (list) => edit(part.id, [['names'], list])
  return (
    <div className="space-y-1.5">
      {names.map((n, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className="input !py-1.5" value={n.name || ''} onChange={(e) => set(names.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder={L('First name', 'Tên gọi')} disabled={disabled} />
          <input className="input !py-1.5" value={n.class || ''} onChange={(e) => set(names.map((x, j) => (j === i ? { ...x, class: e.target.value } : x)))} placeholder={L('Class', 'Lớp')} disabled={disabled} />
          {!disabled && <button type="button" className="btn-ghost !px-2" onClick={() => edit(part.id, [['names'], names.filter((_, j) => j !== i)], { now: true })} aria-label={L('Remove', 'Xoá')}><X size={15} /></button>}
        </div>
      ))}
      {!disabled && <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => edit(part.id, [['names'], [...names, { name: '', class: '' }]], { now: true })}><Users size={14} />{L('Add a name', 'Thêm tên')}</button>}
    </div>
  )
}

function PressEditor({ part, edit, disabled, L, setText }) {
  const d = part.data || {}
  const [posts, setPosts] = useState([])
  useEffect(() => { palmPressPosts().then(setPosts) }, [])
  const pickPost = (url) => {
    const p = posts.find((x) => x.url === url)
    if (!p) return
    edit(part.id, [[['url'], p.url], [['title'], p.title], [['author'], p.author || ''], [['en', 'blurb'], p.blurb_en || ''], [['vi', 'blurb'], p.blurb_vi || ''], [['vi_from'], p.blurb_en || '']], { now: true })
  }
  return (
    <TwoCols L={L}
      en={<>
        <label className="block space-y-1"><span className="label !mb-0">{L('Post on The Palm Press', 'Bài trên The Palm Press')}</span>
          <select className="input" value={d.url || ''} onChange={(e) => pickPost(e.target.value)} disabled={disabled}>
            <option value="">{L('Choose a post…', 'Chọn bài…')}</option>
            {posts.map((p) => <option key={p.url} value={p.url}>{p.title}{p.author ? ` · ${p.author}` : ''}</option>)}
          </select></label>
        <label className="block space-y-1"><span className="label !mb-0">{L('One line about it', 'Một câu giới thiệu')}</span>
          <input className="input" value={d.en?.blurb || ''} onChange={(e) => setText('en', 'blurb', e.target.value)} disabled={disabled} /></label>
      </>}
      vi={<label className="block space-y-1"><span className="label !mb-0">{L('One line about it', 'Một câu giới thiệu')}</span>
        <input className="input" value={d.vi?.blurb || ''} onChange={(e) => setText('vi', 'blurb', e.target.value)} disabled={disabled} lang="vi" /></label>} />
  )
}
