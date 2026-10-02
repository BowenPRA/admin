import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, CalendarDays, CalendarRange, CalendarX, Clock, MessageSquare, Paperclip, Plus } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useAuth } from '../lib/AuthContext'
import { useData } from '../lib/DataContext'
import { useToast } from '../lib/toast'
import { todayIso } from '../lib/leads'
import {
  CLAUDE, DUE_GROUPS, assignable, blankTodo, byUrgency, canDeleteTodo, dueGroup, isOpen, statusOf, summarizeTodos, todosError, whoName,
} from '../lib/todos'
import { removeTodoFiles } from '../lib/todoFiles'
import { Card, Empty, PageHeader, SearchInput, Spinner } from '../components/ui'
import TodoModal from '../components/todos/TodoModal'
import { DueText, StatusPill, Who } from '../components/todos/TodoBits'

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

// One task in the list: the task in bold, then one quiet line with its number,
// who asked, and how many notes and files it has. Who has it, when it is due and
// its status sit in their own columns (under the task on a phone). The left edge
// is the colour of its status.
function TaskRow({ x, showWho, today, saving, onOpen, onStatus, onDelete, teachers, t, lang }) {
  const notes = (x.updates || []).length
  const files = (x.files || []).length
  return (
    <li className={`flex cursor-pointer items-start gap-3 border-b border-l-4 border-b-slate-100 py-3.5 pl-3 pr-4 transition-colors hover:bg-sky-50/50 sm:items-center ${statusOf(x.status).bar}`} onClick={onOpen}>
      <div className="min-w-0 flex-1">
        <button type="button" className="text-left text-base font-semibold leading-snug text-slate-900 hover:text-pra-blue focus:outline-none focus-visible:underline">
          {x.priority === 'high' && isOpen(x) && <span className="chip mr-2 bg-red-600 px-2 align-[2px] text-[11px] uppercase tracking-wide text-white">{t('tdHigh')}</span>}
          {x.title}
        </button>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-slate-600">
          <span className="font-semibold tabular-nums text-slate-400">#{x.number}</span>
          {showWho && <span className="sm:hidden"><Who email={x.assignee} teachers={teachers} lang={lang} t={t} size={22} /></span>}
          <span className="sm:hidden"><DueText todo={x} today={today} lang={lang} t={t} /></span>
          {x.giver && <span>{t('tdFrom', { name: x.giver })}</span>}
          {notes > 0 && <span className="inline-flex items-center gap-1 text-sky-700" title={t('tdNotes')}><MessageSquare size={13} />{notes}</span>}
          {files > 0 && <span className="inline-flex items-center gap-1 text-violet-700" title={t('tdFiles')}><Paperclip size={13} />{files}</span>}
        </div>
      </div>
      {showWho && <div className="hidden w-36 flex-none text-sm sm:block"><Who email={x.assignee} teachers={teachers} lang={lang} t={t} /></div>}
      <div className="hidden w-32 flex-none text-sm sm:block"><DueText todo={x} today={today} lang={lang} t={t} /></div>
      <div className="flex w-auto flex-none justify-end sm:w-28">
        <StatusPill value={x.status} lang={lang} t={t} disabled={saving} onChange={onStatus} onDelete={onDelete} />
      </div>
    </li>
  )
}

const GROUP_ICON = { late: AlertTriangle, today: Clock, week: CalendarDays, later: CalendarRange, none: CalendarX }

function GroupHeading({ group: g, lang }) {
  const Icon = GROUP_ICON[g.id]
  return (
    <h2 className={`flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wider ${g.head}`}>
      <Icon size={14} />{lang === 'vi' ? g.vi : g.en}
      <span className="rounded-full bg-white/80 px-1.5 text-[11px] font-bold tabular-nums">{g.rows.length}</span>
    </h2>
  )
}

// Tasks for the team and for Claude. Replaces the Team To-Do & Issues Tracker
// spreadsheet: office accounts see, add and change everything here (who may
// delete: canDeleteTodo), and the inbox triage adds and updates tasks through
// its own account.
export default function Todos() {
  const { t, lang } = useT()
  const toast = useToast()
  const { me } = useAuth()
  const { teachers } = useData()
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState(null)
  const [pickedView, setView] = useState(null)
  const [who, setWho] = useState('')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState('')

  useEffect(() => {
    let on = true
    db.todos.list().then((todos) => on && setState({ todos, error: '' })).catch((e) => on && setState({ todos: [], error: todosError(e) }))
    return () => { on = false }
  }, [])
  const todos = state?.todos
  const put = (row) => setState((st) => ({ ...st, todos: st.todos.some((x) => x.id === row.id) ? st.todos.map((x) => (x.id === row.id ? row : x)) : [...st.todos, row] }))
  const myEmail = me?.email || ''
  const today = todayIso()

  // A link such as /todo?task=23 opens that task.
  const wanted = params.get('task')
  const shown = openId === 'new' ? draft
    : (openId && todos?.find((x) => x.id === openId)) || (wanted && todos?.find((x) => String(x.number) === wanted)) || null
  const closeTask = () => { setOpenId(null); setDraft(null); if (wanted) setParams({}, { replace: true }) }

  const sum = useMemo(() => summarizeTodos(todos || [], myEmail, today), [todos, myEmail, today])
  const people = useMemo(() => assignable(teachers), [teachers])
  // The page opens on your own tasks when you have any, otherwise on everyone's.
  const view = pickedView || (sum.mine ? 'mine' : 'all')
  // Each tab has its own colour; its count shows in that colour when there is something in it.
  const VIEWS = [
    { id: 'mine', label: t('tdViewMine'), n: sum.mine, on: 'border-pra-blue text-pra-blue', badge: 'bg-pra-blue text-white', soft: 'bg-sky-100 text-sky-800' },
    { id: 'all', label: t('tdViewAll'), n: sum.open, on: 'border-slate-800 text-slate-900', badge: 'bg-slate-800 text-white', soft: 'bg-slate-100 text-slate-700' },
    { id: 'check', label: t('tdViewCheck'), n: sum.check, on: 'border-teal-600 text-teal-700', badge: 'bg-teal-600 text-white', soft: 'bg-teal-100 text-teal-800' },
    { id: 'claude', label: t('tdViewClaude'), n: sum.claude, on: 'border-violet-600 text-violet-700', badge: 'bg-violet-600 text-white', soft: 'bg-violet-100 text-violet-800' },
    { id: 'done', label: t('tdViewDone'), n: sum.done, on: 'border-green-600 text-green-700', badge: 'bg-green-600 text-white', soft: 'bg-green-100 text-green-800' },
  ]
  const inView = (x) => (view === 'done' ? !isOpen(x)
    : isOpen(x) && (view === 'all' || (view === 'mine' && x.assignee === myEmail) || (view === 'check' && x.status === 'check') || (view === 'claude' && x.assignee === CLAUDE)))
  const pickWho = view === 'all' || view === 'done' || view === 'check'
  const needle = norm(q)
  const rows = (todos || []).filter((x) => inView(x)
    && (!pickWho || !who || (who === 'none' ? !x.assignee : x.assignee === who))
    && (!needle || [x.title, x.details, x.giver, `#${x.number}`, whoName(x.assignee, teachers, lang), ...(x.updates || []).map((u) => u.text)].some((v) => norm(v).includes(needle))))
    .sort(byUrgency)
  const groups = view === 'done'
    ? [{ id: 'done', rows }]
    : DUE_GROUPS.map((g) => ({ ...g, rows: rows.filter((x) => dueGroup(x, today) === g.id) })).filter((g) => g.rows.length)
  const showWho = view !== 'mine' && view !== 'claude'
  const filtersOn = !!((pickWho && who) || q)
  const clearFilters = () => { setWho(''); setQ('') }

  const changeStatus = async (x, next) => {
    setSaving(x.id)
    try {
      put(await db.todos.patch(x.id, { status: next, updated_by: myEmail }))
      toast(`#${x.number}: ${lang === 'vi' ? statusOf(next).vi : statusOf(next).en}`)
    } catch (e) { toast.error(todosError(e)) } finally { setSaving('') }
  }

  /** Saves a new task (whole row) or the changed fields of one; resolves to the saved task, or null. */
  const save = async (row) => {
    try {
      const isNew = !todos.some((x) => x.id === row.id)
      const saved = isNew
        ? await db.todos.save({ ...row, created_by: myEmail, updated_by: myEmail })
        : await db.todos.patch(row.id, { ...row, updated_by: myEmail })
      put(saved); toast(t('tdSaved', { n: saved.number }))
      if (isNew) closeTask()
      return saved
    } catch (e) { toast.error(todosError(e)); return null }
  }
  const addNote = async (id, text) => {
    try { const saved = await db.todos.addUpdate(id, text, myEmail); put(saved); return saved } catch (e) { toast.error(todosError(e)); return null }
  }
  const remove = async (x) => {
    if (!confirm(t('tdConfirmDelete', { n: x.number }))) return
    try {
      await db.todos.remove(x.id)
      removeTodoFiles(x.files).catch((e) => console.warn('Task files not removed:', e.message))
      setState((st) => ({ ...st, todos: st.todos.filter((y) => y.id !== x.id) })); closeTask(); toast(t('deletedName', { name: `#${x.number}` }))
    } catch (e) { toast.error(todosError(e)) }
  }

  if (!todos) return <Spinner />
  const error = state.error
  const emptyText = { mine: t('tdNoneMine'), all: todos.length ? t('tdNoneOpen') : '', check: t('tdNoneCheck'), claude: t('tdNoneClaude'), done: t('tdNoneDone') }[view]

  return (
    <div className="space-y-5">
      <PageHeader title={t('todoNav')} subtitle={t('tdSubtitle')}>
        <button className="btn-primary" disabled={!!error} onClick={() => { setDraft(blankTodo(me)); setOpenId('new') }}><Plus size={16} /> {t('tdAdd')}</button>
      </PageHeader>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card className="overflow-hidden !p-0">
        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-slate-100 px-2 pt-2">
          {VIEWS.map((v) => {
            const on = view === v.id
            return (
              <button key={v.id} type="button" aria-pressed={on} onClick={() => setView(v.id)}
                className={`-mb-px flex flex-none items-center gap-2 border-b-[3px] px-3 py-2.5 text-[15px] font-semibold transition-colors ${on ? v.on : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                {v.label}
                <span className={`min-w-[1.5rem] rounded-full px-1.5 py-px text-center text-xs font-bold tabular-nums ${on ? v.badge : v.n ? v.soft : 'bg-slate-100 text-slate-400'}`}>{v.n}</span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <SearchInput value={q} onChange={setQ} placeholder={t('tdSearch')} className="w-full sm:w-64" />
          {pickWho && (
            <select className="input w-auto" value={who} onChange={(e) => setWho(e.target.value)} aria-label={t('tdColWho')}>
              <option value="">{t('tdAnyone')}</option>
              {people.map((p) => <option key={p.email} value={p.email}>{p.email === myEmail ? `${p.name} (${t('tdMe')})` : p.name}</option>)}
              <option value="none">{t('tdNobody')}</option>
            </select>
          )}
          {filtersOn && <button className="btn-ghost text-xs" onClick={clearFilters}>{t('clearFilters')}</button>}
          {sum.late > 0 && view !== 'done' && <span className="chip bg-red-100 text-red-700"><AlertTriangle size={12} className="mr-1" />{t('tdLateCount', { n: sum.late })}</span>}
          <span className="ml-auto text-xs text-slate-400">{t('tdCount', { n: rows.length })}</span>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            {filtersOn ? <Empty text={t('noMatches')} />
              : emptyText ? <Empty text={emptyText} />
                : <Empty text={t('tdNone')}><p className="mt-1">{t('tdNoneHint')}</p></Empty>}
          </div>
        ) : (
          <>
            <div className="hidden items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-2 sm:flex">
              <span className="th flex-1 py-0">{t('tdColTask')}</span>
              {showWho && <span className="th w-36 flex-none py-0">{t('tdColWho')}</span>}
              <span className="th w-32 flex-none py-0">{view === 'done' ? t('tdColDone') : t('tdColDue')}</span>
              <span className="th w-28 flex-none py-0 text-right">{t('tdColStatus')}</span>
            </div>
            {groups.map((g) => (
              <section key={g.id}>
                {g.en && <GroupHeading group={g} lang={lang} />}
                <ul>
                  {g.rows.map((x) => (
                    <TaskRow key={x.id} x={x} showWho={showWho} today={today} saving={saving === x.id} teachers={teachers} t={t} lang={lang}
                      onOpen={() => setOpenId(x.id)} onStatus={(v) => changeStatus(x, v)} onDelete={canDeleteTodo(x, me) ? () => remove(x) : null} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </Card>

      {shown && (
        <TodoModal key={shown.id || 'new'} value={shown} teachers={teachers} today={today}
          canDelete={canDeleteTodo(shown, me)} saving={saving === shown.id}
          onClose={closeTask} onSave={save} onStatus={(v) => changeStatus(shown, v)} onDelete={remove} onNote={addNote} t={t} lang={lang} />
      )}
    </div>
  )
}
