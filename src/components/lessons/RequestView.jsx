import { useState } from 'react'
import { CheckCircle2, FileText, Link2, MessageCircleQuestion, MessagesSquare, Pencil, Send, Trash2, Undo2, Users, XCircle } from 'lucide-react'
import { fmtDay } from '../../lib/leads'
import {
  LESSON_STATUSES, OUTPUTS, className, hasOutputs, hasSource, profileFilled, requestTitle, statusHint, statusLabel, teacherName, useL,
} from '../../lib/lessons'
import { useToast } from '../../lib/toast'
import { Modal, TextArea, TextInput } from '../ui'
import LessonFiles from './LessonFiles'
import { DayChip, DetailsList, Heading, OutputButtons, ProfileSummary, SourceSummary, StatusPill, Thread, WantChips } from './LessonBits'
import LearnResults from '../learn/LearnResults'

/** The office fills in the links by hand (the builder's script normally does this). */
function OutputsEditor({ value, onSave, onCancel }) {
  const { L, lang } = useL()
  const [o, setO] = useState({ ...(value || {}) })
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    const clean = Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v || '').trim()]).filter(([, v]) => v))
    try { if (await onSave(clean)) onCancel() } finally { setBusy(false) }
  }
  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {OUTPUTS.map((x) => (
          <label key={x.id} className="block">
            <span className="label">{lang === 'vi' ? x.vi : x.en}</span>
            <TextInput value={o[x.id]} onChange={(v) => setO((cur) => ({ ...cur, [x.id]: v }))} placeholder="https://…" type="url" />
          </label>
        ))}
      </div>
      <label className="block">
        <span className="label">{L('Note for the teacher', 'Ghi chú cho giáo viên')}</span>
        <TextArea rows={2} value={o.note} onChange={(v) => setO((cur) => ({ ...cur, note: v }))} />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>{L('Cancel', 'Hủy')}</button>
        <button type="button" className="btn-primary" disabled={busy} onClick={save}>{busy ? L('Saving…', 'Đang lưu…') : L('Save links', 'Lưu đường dẫn')}</button>
      </div>
    </div>
  )
}

/**
 * One request, to read: status, the links once it is built, what was asked, the class,
 * and the messages. The teacher approves it, asks for changes, answers a question or
 * cancels it while it is sent; the office can set any status and fill in the links.
 * Under the links, how the class is getting on with the online parts on PRA Learn (LearnResults).
 */
export default function RequestView({ value: x, me, manager, teachers, sources, profile, canDelete, saving, onClose, onEdit, onStatus, onNote, onOutputs, onDelete, onProfile }) {
  const { L, lang } = useL()
  const toast = useToast()
  const [text, setText] = useState('')
  const [mode, setMode] = useState('') // '' | 'changes' | 'question'
  const [editLinks, setEditLinks] = useState(false)
  const [busy, setBusy] = useState(false)
  const mine = [x.teacher_email, x.created_by].map((e) => String(e || '').toLowerCase()).includes(String(me?.email || '').toLowerCase())
  const teacher = mine || !manager
  const files = x.files || []
  const updates = x.updates || []
  const asks = x.status === 'question' && teacher
  // The same rule as the form: something to build from and at least one thing to make.
  const sendable = hasSource(x) && (x.wants || []).length > 0

  const run = async (fn) => { setBusy(true); try { return await fn() } catch (e) { toast.error(e.message || String(e)) } finally { setBusy(false) } }
  const post = (kind) => run(async () => {
    const t = text.trim()
    if (!t) return
    if (kind === 'changes') {
      if (await onNote(t, 'comment')) { await onStatus('changes'); setText(''); setMode('') }
    } else if (kind === 'question') {
      if (await onNote(t, 'question')) { if (x.status !== 'question') await onStatus('question'); setText(''); setMode('') }
    } else if (await onNote(t, kind)) setText('')
  })

  const stamp = [
    `#${x.number}`,
    className(x.class_key, lang),
    L(`for ${teacherName(x.teacher_email, teachers)}`, `cho ${teacherName(x.teacher_email, teachers)}`),
    x.created_at && L(`asked ${fmtDay(x.created_at, lang)}`, `gửi ngày ${fmtDay(x.created_at, lang)}`),
  ].filter(Boolean).join(' · ')

  const composeLabel = mode === 'changes' ? L('What should change?', 'Cần sửa những gì?')
    : mode === 'question' ? L('Your question for the teacher', 'Câu hỏi cho giáo viên')
      : asks ? L('Your answer', 'Câu trả lời của thầy cô') : ''
  const composeKind = mode || (asks ? 'answer' : 'comment')

  return (
    <Modal open wide onClose={onClose} title={requestTitle(x, sources, lang)} subtitle={stamp}
      footer={<>
        {canDelete && <button type="button" className="btn-ghost mr-auto text-red-600 hover:bg-red-50" disabled={saving} onClick={() => onDelete(x)}><Trash2 size={15} /> {L('Delete', 'Xóa')}</button>}
        {(manager || ['draft', 'sent', 'cancelled'].includes(x.status)) && <button type="button" className="btn-secondary" onClick={onEdit}><Pencil size={15} /> {L('Edit', 'Sửa')}</button>}
        <button type="button" className="btn-primary" onClick={onClose}>{L('Close', 'Đóng')}</button>
      </>}>
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={x.status} office={!teacher} size="lg" />
            <DayChip x={x} />
            {x.claimed_by && manager && <span className="chip bg-amber-50 text-amber-800">{L(`Claimed by ${x.claimed_by}`, `${x.claimed_by} đang soạn`)}</span>}
          </div>
          <p className="text-[15px] text-slate-700">{statusHint(x.status, lang, !teacher)}</p>

          {/* What the teacher can do now. */}
          {teacher && (
            <div className="flex flex-wrap gap-2">
              {x.status === 'draft' && <button type="button" className="btn-primary" disabled={saving || !sendable} onClick={() => onStatus('sent')}><Send size={15} /> {L('Send', 'Gửi')}</button>}
              {x.status === 'cancelled' && <button type="button" className="btn-primary" disabled={saving || !sendable} onClick={() => onStatus('sent')}><Send size={15} /> {L('Send again', 'Gửi lại')}</button>}
              {['draft', 'cancelled'].includes(x.status) && !sendable && (
                <p className="basis-full text-sm font-semibold text-amber-700">{L('Before sending, press Edit and add a book, a file, a link or a topic, and tick what to make.', 'Trước khi gửi, thầy cô bấm Sửa để thêm sách, tệp, đường dẫn hoặc chủ đề, và chọn mục cần soạn.')}</p>
              )}
              {x.status === 'sent' && <button type="button" className="btn-secondary" disabled={saving} onClick={() => onStatus('cancelled')}><XCircle size={15} /> {L('Cancel request', 'Hủy yêu cầu')}</button>}
              {['ready', 'changes'].includes(x.status) && (
                <button type="button" disabled={saving} onClick={() => onStatus('done')}
                  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-[15px] font-bold text-white shadow-sm hover:bg-green-700 disabled:opacity-60">
                  <CheckCircle2 size={18} /> {x.status === 'ready' ? L('Approve', 'Duyệt') : L('Approve as it is', 'Duyệt như hiện tại')}
                </button>
              )}
              {x.status === 'ready' && (
                <button type="button" disabled={saving} onClick={() => setMode(mode === 'changes' ? '' : 'changes')}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-bold ring-1 ${mode === 'changes' ? 'bg-orange-500 text-white ring-orange-500' : 'bg-white text-orange-700 ring-orange-300 hover:bg-orange-50'}`}>
                  <Undo2 size={18} /> {L('Ask for changes', 'Yêu cầu sửa')}
                </button>
              )}
            </div>
          )}

          {/* The office: any status, the links by hand, a question for the teacher. */}
          {manager && (
            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={L('Status', 'Trạng thái')}>
                {LESSON_STATUSES.map((s) => {
                  const on = x.status === s.id
                  return (
                    <button key={s.id} type="button" aria-pressed={on} disabled={saving} onClick={() => !on && onStatus(s.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold transition-colors disabled:cursor-wait ${on ? `${s.solid} shadow-sm` : `bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900 ${s.hover}`}`}>
                      <span className={`h-2 w-2 rounded-full ${on ? 'bg-white' : s.dot}`} />{statusLabel(s.id, lang, true)}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={() => setEditLinks((v) => !v)}><Link2 size={14} /> {hasOutputs(x) ? L('Change the links', 'Sửa đường dẫn') : L('Fill in the links', 'Điền đường dẫn')}</button>
                <button type="button" className="btn-secondary text-xs" onClick={() => setMode(mode === 'question' ? '' : 'question')}><MessageCircleQuestion size={14} /> {L('Ask the teacher a question', 'Hỏi giáo viên')}</button>
              </div>
            </div>
          )}

          {(mode || asks) && (
            <div className={`rounded-xl p-3 ring-1 ${mode === 'changes' ? 'bg-orange-50 ring-orange-200' : 'bg-violet-50 ring-violet-200'}`}>
              <label className="label">{composeLabel}</label>
              <TextArea rows={3} value={text} onChange={setText} autoFocus={!!mode}
                placeholder={L('English or Vietnamese is fine.', 'Viết bằng tiếng Anh hoặc tiếng Việt đều được.')} />
              <div className="mt-2 flex justify-end gap-2">
                {mode && <button type="button" className="btn-ghost" onClick={() => { setMode(''); setText('') }}>{L('Cancel', 'Hủy')}</button>}
                <button type="button" className="btn-primary" disabled={busy || !text.trim()} onClick={() => post(composeKind)}>
                  <Send size={15} /> {mode === 'changes' ? L('Send changes', 'Gửi yêu cầu sửa') : mode === 'question' ? L('Ask', 'Gửi câu hỏi') : L('Send answer', 'Gửi câu trả lời')}
                </button>
              </div>
            </div>
          )}
        </section>

        {editLinks && <OutputsEditor value={x.outputs} onSave={onOutputs} onCancel={() => setEditLinks(false)} />}

        {hasOutputs(x) || x.outputs?.note ? (
          <section>
            <Heading>{L('The lesson', 'Bài giảng')}</Heading>
            <OutputButtons outputs={x.outputs} />
          </section>
        ) : null}

        <LearnResults request={x} />

        <section className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div>
              <Heading>{L('What was asked for', 'Nội dung yêu cầu')}</Heading>
              <WantChips wants={x.wants} />
            </div>
            <div>
              <Heading>{L('Based on', 'Dựa trên')}</Heading>
              <SourceSummary source={x.source} sources={sources} />
              {!x.source?.book_id && !x.source?.topic && !(x.source?.links || []).length && !files.length && <p className="text-sm text-slate-400">{L('Nothing yet.', 'Chưa có.')}</p>}
            </div>
            {files.length > 0 && (
              <div>
                <Heading n={files.length} icon={FileText}>{L('Files', 'Tệp')}</Heading>
                <LessonFiles items={files} readOnly />
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <Heading>{L('Details', 'Chi tiết')}</Heading>
              <DetailsList details={x.details} />
            </div>
            <div>
              <Heading icon={Users}>{L('About this class', 'Về lớp này')}</Heading>
              {profileFilled(profile) ? <ProfileSummary profile={profile} sources={sources} /> : <p className="text-sm text-slate-400">{L('Not filled in yet.', 'Chưa điền.')}</p>}
              {onProfile && <button type="button" className="mt-2 text-sm font-semibold text-pra-blue hover:underline" onClick={onProfile}>{profileFilled(profile) ? L('Open', 'Mở') : L('Fill it in', 'Điền thông tin')}</button>}
            </div>
          </div>
        </section>

        <section>
          <Heading n={updates.filter((u) => u.kind !== 'status').length} icon={MessagesSquare}>{L('Messages', 'Trao đổi')}</Heading>
          <Thread updates={updates} office={!teacher} />
          {!asks && !mode && (
            <div className="mt-3 flex items-end gap-2">
              <div className="flex-1"><TextArea rows={2} value={text} onChange={setText} placeholder={L('Write a message…', 'Viết tin nhắn…')} /></div>
              <button type="button" className="btn-secondary" disabled={busy || !text.trim()} onClick={() => post('comment')}><Send size={15} /> {L('Send', 'Gửi')}</button>
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}
