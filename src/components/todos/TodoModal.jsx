import { useState } from 'react'
import { CalendarDays, Flag, Hand, Pencil, Send, Trash2, UserRound } from 'lucide-react'
import { genId } from '../../lib/db'
import { fmtDay } from '../../lib/leads'
import { CLAUDE, PRIORITIES, TODO_STATUSES, assignable, dueText, isOpen, statusOf, whoName } from '../../lib/todos'
import { prepareTodoFile, removeTodoFiles, uploadTodoFile } from '../../lib/todoFiles'
import { useToast } from '../../lib/toast'
import { Avatar, Field, TextInput, Select, TextArea, Modal } from '../ui'
import TodoFiles from './TodoFiles'
import { DueText, Who } from './TodoBits'

const FIELDS = ['title', 'details', 'priority', 'assignee', 'giver', 'due_date']
const hint = (x, lang) => x?.hint?.[lang === 'vi' ? 1 : 0]

function Heading({ children, n }) {
  return (
    <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pra-navy">
      {children}{n > 0 && <span className="rounded-full bg-sky-100 px-1.5 text-[11px] text-sky-800">{n}</span>}
    </h4>
  )
}

function Fact({ icon: Icon, tone, label, children }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg ${tone}`}><Icon size={16} /></span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-[15px] text-slate-900">{children}</div>
      </div>
    </div>
  )
}

/**
 * One task. An existing task opens to be read: status buttons, who has it, the
 * details, files and notes, with Edit for the rest. A new task opens as the form.
 * `onSave(row)` gets the whole row for a new task and only the changed fields
 * (plus id) for an existing one, so two people editing different things do not
 * undo each other; it resolves to the saved task, or null.
 */
export default function TodoModal({ value, ...props }) {
  const [editing, setEditing] = useState(!value.id)
  return editing
    ? <TodoForm value={value} {...props} onCancel={value.id ? () => setEditing(false) : props.onClose} onSaved={() => setEditing(false)} />
    : <TodoView value={value} {...props} onEdit={() => setEditing(true)} />
}

function TodoView({ value: x, teachers, today, canDelete, saving, onClose, onStatus, onDelete, onNote, onEdit, t, lang }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const updates = x.updates || []
  const files = x.files || []
  const prio = PRIORITIES.find((p) => p.id === x.priority)

  const addNote = async () => {
    setBusy(true)
    try { if (await onNote(x.id, note.trim())) setNote('') } catch (e) { toast.error(e.message || String(e)) } finally { setBusy(false) }
  }

  const stamp = [
    `#${x.number}`,
    x.created_at && x.created_by && t('ldAddedBy', { name: whoName(x.created_by, teachers, lang), date: fmtDay(x.created_at, lang) }),
    x.updated_at && x.updated_by && t('ldChangedBy', { name: whoName(x.updated_by, teachers, lang), date: fmtDay(x.updated_at, lang) }),
  ].filter(Boolean).join(' · ')

  return (
    <Modal open wide onClose={onClose} title={x.title} subtitle={stamp}
      footer={<>
        <button type="button" className="btn-secondary" onClick={onEdit}><Pencil size={15} /> {t('tdEdit')}</button>
        <button type="button" className="btn-primary" onClick={onClose}>{t('close')}</button>
      </>}>
      <div className="space-y-6">
        <section>
          {/* The statuses, each in its own colour; Delete sits at the end for Bowen, Seth and whoever asked for it. */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('tdColStatus')}>
            {TODO_STATUSES.map((s) => {
              const on = x.status === s.id
              return (
                <button key={s.id} type="button" aria-pressed={on} disabled={saving} onClick={() => !on && onStatus(s.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:cursor-wait ${on ? `${s.solid} shadow-sm` : `bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900 ${s.hover}`}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${on ? 'bg-white' : s.dot}`} />{lang === 'vi' ? s.vi : s.en}
                </button>
              )
            })}
            {canDelete && (
              <>
                <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
                <button type="button" disabled={saving} onClick={() => onDelete(x)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-600 hover:text-white disabled:cursor-wait">
                  <Trash2 size={14} />{t('tdDelete')}
                </button>
              </>
            )}
          </div>
          <p className="mt-2 text-[13px] text-slate-600">{x.assignee === CLAUDE ? t('tdClaudeHint') : hint(statusOf(x.status), lang)}</p>
        </section>

        <section className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={UserRound} tone="bg-sky-100 text-sky-700" label={t('tdColWho')}><Who email={x.assignee} teachers={teachers} lang={lang} t={t} size={24} /></Fact>
          <Fact icon={Hand} tone="bg-violet-100 text-violet-700" label={t('tdGiver')}>{x.giver || <span className="text-slate-400">-</span>}</Fact>
          <Fact icon={CalendarDays} tone="bg-indigo-100 text-indigo-700" label={t('tdColDue')}>
            {!x.due_date ? <span className="text-slate-400">{t('tdNoDate')}</span>
              : !isOpen(x) ? fmtDay(x.due_date, lang)
                : <><DueText todo={x} today={today} lang={lang} t={t} />{!dueText(x, today, lang).includes(fmtDay(x.due_date, lang)) && <span className="ml-1.5 text-sm text-slate-500">{fmtDay(x.due_date, lang)}</span>}</>}
          </Fact>
          <Fact icon={Flag} tone={x.priority === 'high' ? 'bg-red-100 text-red-600' : 'bg-slate-200/70 text-slate-600'} label={t('tdPriority')}>
            <span className={x.priority === 'high' ? 'font-bold text-red-600' : ''}>{prio ? (lang === 'vi' ? prio.vi : prio.en) : '-'}</span>
          </Fact>
        </section>

        <section>
          <Heading>{t('tdDetails')}</Heading>
          {x.details ? <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-800">{x.details}</p>
            : <p className="text-sm text-slate-400">{t('tdNoDetails')}</p>}
        </section>

        {files.length > 0 && (
          <section>
            <Heading n={files.length}>{t('tdFiles')}</Heading>
            <TodoFiles items={files} readOnly t={t} />
          </section>
        )}

        <section>
          <Heading n={updates.length}>{t('tdNotes')}</Heading>
          {updates.length > 0 && (
            <ol className="mb-3 space-y-3">
              {updates.map((u, i) => {
                const by = whoName(u.by, teachers, lang) || '?'
                return (
                  <li key={`${u.at}-${i}`} className="flex gap-3">
                    <Avatar name={by} size={30} className="mt-0.5" />
                    <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-100">
                      <div className="text-[13px] text-slate-500"><span className="font-semibold text-slate-800">{by}</span> · {fmtDay(u.at, lang)}</div>
                      <div className="mt-0.5 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">{u.text}</div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1"><TextArea rows={2} value={note} onChange={setNote} placeholder={t('tdNotePlaceholder')} /></div>
            <button type="button" className="btn-secondary" disabled={busy || !note.trim()} onClick={addNote}><Send size={15} /> {t('tdNoteAdd')}</button>
          </div>
        </section>
      </div>
    </Modal>
  )
}

function TodoForm({ value, teachers, onClose, onCancel, onSave, onSaved, t, lang }) {
  const toast = useToast()
  const [s, setS] = useState(value)
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setS((cur) => ({ ...cur, [k]: v }))
  const isNew = !s.id
  const people = assignable(teachers)
  const files = s.files || []

  const run = async (fn) => { setBusy(true); try { await fn() } catch (e) { toast.error(e.message || String(e)) } finally { setBusy(false) } }
  const invalid = !String(s.title || '').trim()
  const changed = Object.fromEntries(FIELDS.filter((k) => (s[k] ?? '') !== (value[k] ?? '')).map((k) => [k, k === 'title' ? s.title.trim() : s[k]]))
  const filesChanged = files.length !== (value.files || []).length || files.some((f, i) => f !== (value.files || [])[i])

  const addFiles = (picked) => run(async () => {
    const ready = []
    for (const f of picked) ready.push({ ...(await prepareTodoFile(f)), added_at: new Date().toISOString() })
    setS((cur) => ({ ...cur, files: [...(cur.files || []), ...ready.map((p) => ({ ...p, size: p.blob.size }))] }))
  })
  const removeFile = (i) => setS((cur) => ({ ...cur, files: cur.files.filter((_, n) => n !== i) }))

  const save = (e) => {
    e?.preventDefault()
    if (invalid) return
    if (!isNew && !Object.keys(changed).length && !filesChanged) return onCancel()
    return run(async () => {
      const id = s.id || genId()
      // Files picked in this form are stored now; the ones already saved are kept as they are.
      const stored = []
      for (const f of files) stored.push(f.blob ? await uploadTodoFile(id, f) : f)
      const gone = (value.files || []).filter((f) => f.path && !stored.some((x) => x.path === f.path))
      const saved = await onSave(isNew
        ? { ...s, id, title: s.title.trim(), files: stored }
        : { id, ...changed, ...(filesChanged ? { files: stored } : {}) })
      if (saved && gone.length) removeTodoFiles(gone).catch((err) => console.warn('Task files not removed:', err.message))
      if (saved && !isNew) onSaved()
    })
  }

  return (
    <Modal open wide onClose={onClose} title={isNew ? t('tdAdd') : t('tdEditTitle', { n: value.number })} subtitle={isNew ? null : value.title}
      footer={<>
        <button type="button" className="btn-secondary" onClick={onCancel}>{t('cancel')}</button>
        <button type="submit" form="todo-form" className="btn-primary" disabled={busy || invalid}>{busy ? t('saving') : isNew ? t('tdAdd') : t('save')}</button>
      </>}>
      <form id="todo-form" onSubmit={save} className="space-y-5">
        <div>
          <Field label={t('tdTitle')} hint={t('tdTitleHint')}><TextInput value={s.title} onChange={set('title')} autoFocus required maxLength={200} /></Field>
          <Field label={t('tdDetails')} hint={t('tdDetailsHint')} className="mt-3"><TextArea rows={5} value={s.details} onChange={set('details')} /></Field>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('tdColWho')}>
              <Select value={s.assignee} onChange={set('assignee')} options={[
                { value: '', label: t('tdNobody') },
                ...people.map((p) => ({ value: p.email, label: p.name })),
                ...(s.assignee && !people.some((p) => p.email === s.assignee) ? [{ value: s.assignee, label: whoName(s.assignee, teachers, lang) }] : []),
              ]} />
            </Field>
            <Field label={t('tdGiver')}><TextInput value={s.giver} onChange={set('giver')} /></Field>
            <Field label={t('tdColDue')}><TextInput type="date" value={s.due_date} onChange={set('due_date')} /></Field>
            <Field label={t('tdPriority')}>
              <Select value={s.priority} onChange={set('priority')} options={PRIORITIES.map((x) => ({ value: x.id, label: lang === 'vi' ? x.vi : x.en }))} />
            </Field>
          </div>
          {s.assignee === CLAUDE && <p className="mt-2 text-xs text-slate-500">{t('tdClaudeHint')}</p>}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <Heading>{t('tdFiles')}</Heading>
          <TodoFiles items={files} onAdd={addFiles} onRemove={removeFile} busy={busy} t={t} />
        </div>
      </form>
    </Modal>
  )
}
