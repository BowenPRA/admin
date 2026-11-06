import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, FileUp, Gift, Languages, PencilLine, Send, StepForward } from 'lucide-react'
import { genId } from '../../lib/db'
import {
  HOMEWORK, WANTS, WANT_ICON, booksFor, className, hasSource, pagesLabel, pagesText, requestTitle, teacherName, teachersOf, useL,
} from '../../lib/lessons'
import { prepareLessonFile, removeLessonFiles, uploadLessonFile } from '../../lib/lessonFiles'
import { useToast } from '../../lib/toast'
import { Field, Modal, TextArea, TextInput } from '../ui'
import LessonFiles from './LessonFiles'

const FIELDS = ['class_key', 'teacher_email', 'wants', 'source', 'details', 'previous_id']
const LENGTHS = [30, 40, 45, 60, 90]

// Empty strings and empty lists are left out, so the row holds only what was filled in.
const tidy = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => (Array.isArray(v) ? v.length : v !== '' && v != null)))
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

function StepTab({ n, on, done, label, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-current={on ? 'step' : undefined}
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors ${on ? 'bg-pra-blue text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
      <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-black ${on ? 'bg-white text-pra-blue' : done ? 'bg-green-600 text-white' : 'bg-white text-slate-500'}`}>{done && !on ? <Check size={13} /> : n}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

// What comes back for what is ticked, in plain words.
const GETS = [
  { ids: ['slides'], en: 'Slides to teach from, with a one-page plan', vi: 'Slide để dạy trên lớp, kèm giáo án một trang' },
  { ids: ['review', 'practice'], en: 'A guided review and step-by-step practice in PRA Learn (learn.pra.edu.vn)', vi: 'Phần ôn tập có hướng dẫn và luyện tập từng bước trên PRA Learn (learn.pra.edu.vn)' },
  { ids: ['worksheet'], en: 'A printed worksheet, with the answers for you', vi: 'Phiếu bài tập in, kèm đáp án cho thầy cô' },
  { ids: ['game'], en: 'A short review game for the whole class', vi: 'Trò chơi ôn tập ngắn cho cả lớp' },
]

function SourceCard({ icon: Icon, tone, title, filled, children }) {
  return (
    <section className={`rounded-xl border p-4 ${filled ? 'border-green-300 bg-green-50/40' : 'border-slate-200'}`}>
      <h4 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-800">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}><Icon size={16} /></span>{title}
        {filled && <Check size={16} className="text-green-600" />}
      </h4>
      {children}
    </section>
  )
}

/**
 * A new request, or a change to one, in three short steps: what to make, what it is based
 * on, and optional details. Only the class and one source are required. `onSave(row,
 * isNew)` gets the whole row for a new request and the changed fields (plus id) for an
 * existing one; it resolves to the saved request, or null.
 */
export default function RequestForm({ value, classes, teachers, sources, profiles, me, manager, onClose, onSave }) {
  const { L, lang } = useL()
  const toast = useToast()
  const [s, setS] = useState(() => ({ ...value, source: { ...value.source, links: value.source?.links || [] }, details: { ...value.details } }))
  const [linksText, setLinksText] = useState((value.source?.links || []).join('\n'))
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const isNew = !value.id
  const files = s.files || []
  const src = s.source || {}
  const det = s.details || {}
  const setSrc = (k, v) => setS((cur) => ({ ...cur, source: { ...cur.source, [k]: v } }))
  const setDet = (k, v) => setS((cur) => ({ ...cur, details: { ...cur.details, [k]: v } }))
  const links = linksText.split(/\s*\n\s*/).map((l) => l.trim()).filter(Boolean)
  const withLinks = { ...s, source: { ...src, links } }
  const sourced = hasSource(withLinks)
  const canSend = !!s.class_key && sourced && (s.wants || []).length > 0

  const books = useMemo(() => booksFor(s.class_key, sources), [s.class_key, sources])
  const profileBooks = profiles.find((p) => p.class_key === s.class_key)?.profile?.book_ids || []
  const book = sources.find((b) => b.id === src.book_id)
  const unit = book?.units?.find((u) => String(u.n) === String(src.unit))
  const forWhom = useMemo(() => {
    const list = teachersOf(s.class_key, teachers).map((t) => t.email.toLowerCase())
    if (s.teacher_email && !list.includes(s.teacher_email)) list.unshift(s.teacher_email)
    return list
  }, [s.class_key, s.teacher_email, teachers])

  const pickClass = (k) => setS((cur) => {
    const keepBook = booksFor(k, sources).some((b) => b.id === cur.source?.book_id)
    const mine = (me?.subjects || []).includes(k)
    const teacher = manager && !mine ? teachersOf(k, teachers)[0]?.email?.toLowerCase() || cur.teacher_email : cur.teacher_email
    return { ...cur, class_key: k, teacher_email: teacher, source: keepBook ? cur.source : { ...cur.source, book_id: '', unit: '', section: '', pages: '' } }
  })
  const toggleWant = (id) => setS((cur) => {
    const has = (cur.wants || []).includes(id)
    return { ...cur, wants: has ? cur.wants.filter((w) => w !== id) : WANTS.map((w) => w.id).filter((w) => w === id || cur.wants.includes(w)) }
  })
  const pickBook = (id) => setS((cur) => ({ ...cur, source: { ...cur.source, book_id: id, unit: '', section: '', pages: '' } }))
  const pickUnit = (n) => {
    const u = book?.units?.find((x) => String(x.n) === n)
    setS((cur) => ({ ...cur, source: { ...cur.source, unit: n, section: '', pages: u ? pagesText(u.pages) : '' } }))
  }
  const pickSection = (id) => {
    const q = unit?.sections?.find((x) => String(x.id) === id)
    setS((cur) => ({ ...cur, source: { ...cur.source, section: id, pages: q ? pagesText(q.pages) : unit ? pagesText(unit.pages) : cur.source.pages } }))
  }

  const run = async (fn) => { setBusy(true); try { await fn() } catch (e) { toast.error(e.message || String(e)) } finally { setBusy(false) } }
  const addFiles = (picked) => run(async () => {
    const ready = []
    for (const f of picked) {
      try { ready.push({ ...(await prepareLessonFile(f)), at: new Date().toISOString() }) } catch (e) { toast.error(e.message) }
    }
    setS((cur) => ({ ...cur, files: [...(cur.files || []), ...ready.map((p) => ({ ...p, size: p.blob.size }))] }))
  })
  const removeFile = (i) => setS((cur) => ({ ...cur, files: cur.files.filter((_, n) => n !== i) }))

  // A new request, a draft or a cancelled one: saved as a draft or sent. Anything else: Save changes.
  const draftish = isNew || ['draft', 'cancelled'].includes(value.status)
  const save = (send) => {
    setTried(true)
    if (!s.class_key) { setStep(1); return }
    if (send && !sourced) { setStep(2); return }
    if (send && !(s.wants || []).length) { setStep(1); return }
    // A draft may be saved without a source; a request that has been sent keeps one.
    if (!send && !sourced && !draftish) { setStep(2); return }
    return run(async () => {
      const id = s.id || genId()
      const stored = []
      const uploaded = []
      // Names already in the folder, including files taken off in this change (removed only after the save).
      const taken = (value.files || []).map((f) => f.path).filter(Boolean)
      try {
        for (const f of files) {
          if (!f.blob) { stored.push(f); continue }
          const entry = await uploadLessonFile(id, f, me?.email, [...taken, ...stored.map((x) => x.path)])
          uploaded.push(entry)
          stored.push(entry)
        }
      } catch (err) {
        removeLessonFiles(uploaded).catch(() => {})
        throw err
      }
      const gone = (value.files || []).filter((f) => f.path && !stored.some((x) => x.path === f.path))
      const row = {
        ...s, id,
        source: tidy({ ...src, links }),
        details: tidy(det),
        files: stored,
        status: send ? 'sent' : draftish ? 'draft' : s.status,
      }
      const changed = Object.fromEntries(FIELDS.filter((k) => !same(row[k], value[k])).map((k) => [k, row[k]]))
      if (!same(row.files, value.files || [])) changed.files = row.files
      if (row.status !== value.status) changed.status = row.status
      const saved = await onSave(isNew ? row : { id, ...changed }, isNew)
      // Not saved: the files just stored would belong to nothing, so they go again.
      if (!saved) { removeLessonFiles(uploaded).catch(() => {}); return }
      if (gone.length) removeLessonFiles(gone).catch((err) => console.warn('Request files not removed:', err.message))
    })
  }

  const steps = [L('What to make', 'Cần soạn gì'), L('Based on', 'Dựa trên'), L('Details', 'Chi tiết')]
  const title = isNew ? (value.previous_id ? L('Next lesson', 'Bài tiếp theo') : L('New lesson request', 'Yêu cầu bài giảng mới')) : L(`Change request #${value.number}`, `Sửa yêu cầu #${value.number}`)

  return (
    <Modal open wide onClose={onClose} title={title}
      subtitle={<span className="inline-flex items-center gap-1.5"><Languages size={13} />{L('Write in English or Vietnamese, whichever is easier.', 'Thầy cô có thể viết bằng tiếng Anh hoặc tiếng Việt.')}</span>}
      footer={<>
        {step > 1 && <button type="button" className="btn-ghost mr-auto" onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> {L('Back', 'Quay lại')}</button>}
        {draftish && <button type="button" className="btn-secondary" disabled={busy || !s.class_key} onClick={() => save(false)}>{L('Save as draft', 'Lưu nháp')}</button>}
        {step < 3 && <button type="button" className={draftish ? 'btn-secondary' : 'btn-secondary'} onClick={() => setStep(step + 1)}>{L('Next', 'Tiếp')} <ArrowRight size={15} /></button>}
        {draftish
          ? <button type="button" className="btn-primary" disabled={busy} onClick={() => save(true)}><Send size={15} /> {busy ? L('Saving…', 'Đang lưu…') : L('Send', 'Gửi')}</button>
          : <button type="button" className="btn-primary" disabled={busy} onClick={() => save(false)}>{busy ? L('Saving…', 'Đang lưu…') : L('Save changes', 'Lưu thay đổi')}</button>}
      </>}>
      <div className="mb-5 flex gap-2">
        {steps.map((label, i) => <StepTab key={label} n={i + 1} on={step === i + 1} done={i === 0 ? !!s.class_key && s.wants?.length > 0 : i === 1 ? sourced : false} label={label} onClick={() => setStep(i + 1)} />)}
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={L('Class', 'Lớp')}>
              <select className="input" value={s.class_key} onChange={(e) => pickClass(e.target.value)} autoFocus={isNew}>
                {!s.class_key && <option value="">{L('Pick a class…', 'Chọn lớp…')}</option>}
                {classes.map((k) => <option key={k} value={k}>{className(k, lang)}</option>)}
              </select>
            </Field>
            {manager && (
              <Field label={L('For', 'Cho giáo viên')} hint={L('The teacher who will teach it.', 'Giáo viên sẽ dạy bài này.')}>
                <select className="input" value={s.teacher_email} onChange={(e) => setS((cur) => ({ ...cur, teacher_email: e.target.value }))}>
                  {forWhom.map((e) => <option key={e} value={e}>{teacherName(e, teachers)}{e === me?.email ? ` (${L('me', 'tôi')})` : ''}</option>)}
                </select>
              </Field>
            )}
          </div>
          {tried && !s.class_key && <p className="text-sm font-semibold text-red-600">{L('Pick the class first.', 'Hãy chọn lớp trước.')}</p>}
          {isNew && value.previous_id && (
            <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm text-sky-900">
              <StepForward size={16} className="mt-0.5 flex-none text-pra-blue" />
              <span>
                {src.unit
                  ? <>{L('Follows your last request. It asks for', 'Tiếp nối yêu cầu gần nhất. Yêu cầu này là')} <b>{[requestTitle({ source: { ...src, topic: '' } }, sources, lang), pagesLabel(src.pages, lang)].filter(Boolean).join(' · ')}</b>{book ? ` (${book.title})` : ''}. </>
                  : book ? <>{L(`Follows your last request, from ${book.title}. There is no section after it in the catalogue, so pick what comes next.`, `Tiếp nối yêu cầu gần nhất, từ ${book.title}. Danh mục không có bài tiếp theo, thầy cô vui lòng chọn phần cần soạn.`)} </>
                  : <>{L('Follows your last request for this class. Say what it is based on in step 2.', 'Tiếp nối yêu cầu gần nhất của lớp này. Thầy cô ghi nguồn ở bước 2.')} </>}
                {L('Change anything you need.', 'Thầy cô có thể sửa bất kỳ phần nào.')}
              </span>
            </div>
          )}
          <div>
            <div className="label">{L('What should we make?', 'Thầy cô cần những gì?')}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {WANTS.map((w) => {
                const on = (s.wants || []).includes(w.id)
                const Icon = WANT_ICON[w.id]
                return (
                  <button key={w.id} type="button" aria-pressed={on} onClick={() => toggleWant(w.id)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${on ? 'border-pra-blue bg-sky-50 ring-1 ring-pra-blue' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded border ${on ? 'border-pra-blue bg-pra-blue text-white' : 'border-slate-300 bg-white'}`}>{on && <Check size={13} />}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[15px] font-semibold text-slate-900"><Icon size={16} className="text-pra-blue" />{lang === 'vi' ? w.vi : w.en}</span>
                      <span className="mt-0.5 block text-[13px] text-slate-500">{w.hint[lang === 'vi' ? 1 : 0]}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            {tried && !(s.wants || []).length && <p className="mt-2 text-sm font-semibold text-red-600">{L('Tick at least one.', 'Hãy chọn ít nhất một mục.')}</p>}
          </div>
          {GETS.some((g) => g.ids.some((id) => (s.wants || []).includes(id))) && (
            <div className="rounded-xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200">
              <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-slate-500"><Gift size={14} />{L("What you'll get", 'Thầy cô sẽ nhận được')}</div>
              <ul className="space-y-1 text-sm text-slate-700">
                {GETS.filter((g) => g.ids.some((id) => (s.wants || []).includes(id))).map((g) => (
                  <li key={g.en} className="flex items-start gap-2"><Check size={14} className="mt-0.5 flex-none text-green-600" />{lang === 'vi' ? g.vi : g.en}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{L('Fill in one or more of these. One is enough.', 'Điền một hoặc nhiều phần bên dưới. Chỉ cần một phần là đủ.')}</p>
          {tried && !sourced && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{L('Pick a book, add a file or a link, or write the topic.', 'Hãy chọn sách, thêm tệp hoặc đường dẫn, hoặc ghi chủ đề.')}</p>}

          <SourceCard icon={BookOpen} tone="bg-sky-100 text-sky-700" title={L('A book', 'Sách')} filled={!!src.book_id}>
            {books.length === 0 ? <p className="text-sm text-slate-500">{s.class_key ? L('No books for this class in the catalogue yet. Use a file, a link or a topic instead.', 'Chưa có sách cho lớp này trong danh mục. Thầy cô có thể dùng tệp, đường dẫn hoặc chủ đề.') : L('Pick the class first.', 'Hãy chọn lớp trước.')}</p> : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={L('Book', 'Sách')} className="sm:col-span-2">
                  <select className="input" value={src.book_id || ''} onChange={(e) => pickBook(e.target.value)}>
                    <option value="">{L('No book', 'Không dùng sách')}</option>
                    {[false, true].map((near) => {
                      const list = books.filter((b) => b.near === near)
                      if (!list.length) return null
                      return (
                        <optgroup key={String(near)} label={near ? L('Nearby years', 'Các lớp gần') : L('This class', 'Lớp này')}>
                          {list.map((b) => <option key={b.id} value={b.id}>{profileBooks.includes(b.id) ? '★ ' : ''}{b.title}</option>)}
                        </optgroup>
                      )
                    })}
                  </select>
                </Field>
                {book && (book.units || []).length > 0 && (
                  <>
                    <Field label={L('Unit', 'Chương')}>
                      <select className="input" value={src.unit || ''} onChange={(e) => pickUnit(e.target.value)}>
                        <option value="">{L('Pick a unit…', 'Chọn chương…')}</option>
                        {book.units.map((u) => <option key={u.n} value={String(u.n)}>{[`${u.n}. ${u.title}`, pagesLabel(u.pages, lang)].filter(Boolean).join(' · ')}</option>)}
                      </select>
                    </Field>
                    {(unit?.sections || []).length > 0 && <Field label={L('Section', 'Bài')}>
                      <select className="input" value={src.section || ''} onChange={(e) => pickSection(e.target.value)}>
                        <option value="">{[L('The whole unit', 'Cả chương'), pagesLabel(unit?.pages, lang)].filter(Boolean).join(' · ')}</option>
                        {(unit?.sections || []).map((q) => <option key={q.id} value={String(q.id)}>{[`${q.id} ${q.title}`, pagesLabel(q.pages, lang)].filter(Boolean).join(' · ')}</option>)}
                      </select>
                    </Field>}
                  </>
                )}
                {book && (
                  <Field label={L('Pages', 'Trang')} hint={L('Book page numbers, e.g. 44-47. Filled in from the section; change it if you need.', 'Số trang trong sách, ví dụ 44-47. Tự điền theo bài, có thể sửa.')}>
                    <TextInput value={src.pages} onChange={(v) => setSrc('pages', v)} placeholder="44-47" />
                  </Field>
                )}
              </div>
            )}
          </SourceCard>

          <SourceCard icon={FileUp} tone="bg-violet-100 text-violet-700" title={L('Your files and Drive links', 'Tệp và đường dẫn Drive của thầy cô')} filled={files.length > 0 || links.length > 0}>
            <LessonFiles items={files} onAdd={addFiles} onRemove={removeFile} busy={busy} />
            <Field label={L('Drive links', 'Đường dẫn Drive')} hint={L('One link a line. Share them with admin@pra.edu.vn, or put them in a shared drive.', 'Mỗi dòng một đường dẫn. Chia sẻ với admin@pra.edu.vn, hoặc để trong ổ đĩa dùng chung.')} className="mt-3">
              <TextArea rows={2} value={linksText} onChange={setLinksText} placeholder="https://drive.google.com/…" />
            </Field>
          </SourceCard>

          <SourceCard icon={PencilLine} tone="bg-amber-100 text-amber-700" title={L('A topic', 'Chủ đề')} filled={!!String(src.topic || '').trim()}>
            <TextInput value={src.topic} onChange={(v) => setSrc('topic', v)} maxLength={300}
              placeholder={L('In a sentence, e.g. "Adding and subtracting with negative numbers on a number line"', 'Một câu ngắn, ví dụ "Cộng trừ số âm trên trục số"')} />
          </SourceCard>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{L('All optional. The more you say, the closer it will be to what you want.', 'Không bắt buộc. Thầy cô ghi càng rõ, bài soạn càng sát ý.')}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={L('Teaching date', 'Ngày dạy')}><TextInput type="date" value={det.teach_on} onChange={(v) => setDet('teach_on', v)} /></Field>
            <Field label={L('Lesson length', 'Thời lượng')}>
              <select className="input" value={det.length_min || ''} onChange={(e) => setDet('length_min', e.target.value ? Number(e.target.value) : '')}>
                <option value="">-</option>
                {LENGTHS.map((m) => <option key={m} value={m}>{L(`${m} minutes`, `${m} phút`)}</option>)}
              </select>
            </Field>
            <Field label={L('Key words', 'Từ khóa')}><TextInput value={det.key_words} onChange={(v) => setDet('key_words', v)} placeholder={L('negative, temperature, below zero', 'negative, temperature, below zero')} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={L('What the class finds hard', 'Phần lớp thấy khó')}><TextArea rows={2} value={det.hard} onChange={(v) => setDet('hard', v)} /></Field>
            <Field label={L('Ideas to include', 'Ý tưởng muốn có')}><TextArea rows={2} value={det.ideas} onChange={(v) => setDet('ideas', v)} /></Field>
            <Field label={L('What to avoid', 'Điều cần tránh')}><TextArea rows={2} value={det.avoid} onChange={(v) => setDet('avoid', v)} /></Field>
            <Field label={L('Anything else', 'Ghi chú khác')}><TextArea rows={2} value={det.other} onChange={(v) => setDet('other', v)} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={L('Homework', 'Bài tập về nhà')}>
              <select className="input" value={det.homework_amount || ''} onChange={(e) => setDet('homework_amount', e.target.value)}>
                {HOMEWORK.map((h) => <option key={h.id} value={h.id}>{lang === 'vi' ? h.vi : h.en}</option>)}
              </select>
            </Field>
            {det.homework_amount && <Field label={L('Homework due', 'Hạn nộp bài')}><TextInput type="date" value={det.homework_due} onChange={(v) => setDet('homework_due', v)} /></Field>}
          </div>
        </div>
      )}

      {!canSend && step === 3 && tried && <p className="mt-3 text-sm font-semibold text-red-600">{L('Before sending: pick the class, tick what to make, and give one source in step 2.', 'Trước khi gửi: chọn lớp, chọn mục cần soạn và điền một nguồn ở bước 2.')}</p>}
    </Modal>
  )
}

