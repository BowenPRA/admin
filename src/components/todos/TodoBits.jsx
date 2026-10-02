import { ChevronDown } from 'lucide-react'
import { fmtDay } from '../../lib/leads'
import { CLAUDE, DUE_GROUPS, TODO_STATUSES, dueGroup, dueText, isOpen, statusOf, whoName } from '../../lib/todos'
import { Avatar } from '../ui'

const DELETE = '__delete'

/**
 * The status as a coloured pill that is also a drop-down, so it can be changed
 * where it is shown. With `onDelete` (Bowen, Seth and whoever asked for the task)
 * the list ends with "Delete task".
 */
export function StatusPill({ value, onChange, onDelete, lang, disabled, t }) {
  const s = statusOf(value)
  const pick = (v) => (v === DELETE ? onDelete() : onChange(v))
  return (
    <span className="relative inline-flex">
      <select value={value} disabled={disabled} onChange={(e) => pick(e.target.value)} onClick={(e) => e.stopPropagation()}
        aria-label="Status"
        className={`cursor-pointer appearance-none rounded-full border-0 py-1 pl-2.5 pr-7 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-pra-sky/40 disabled:cursor-wait ${s.tone}`}>
        {TODO_STATUSES.map((x) => <option key={x.id} value={x.id} className="bg-white font-semibold text-slate-800">{lang === 'vi' ? x.vi : x.en}</option>)}
        {onDelete && <option disabled className="bg-white">──────</option>}
        {onDelete && <option value={DELETE} className="bg-white font-semibold text-red-600">{t('tdDelete')}</option>}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 opacity-70" />
    </span>
  )
}

/** When it is due, as a chip coloured by how soon; done tasks show the day they were finished. */
export function DueText({ todo, today, lang, t }) {
  if (!isOpen(todo)) return todo.done_at ? <span className="chip bg-green-50 text-green-700">{t('tdDoneOn', { date: fmtDay(todo.done_at, lang) })}</span> : null
  if (!todo.due_date) return null
  const g = DUE_GROUPS.find((x) => x.id === dueGroup(todo, today))
  return <span className={`chip whitespace-nowrap ${g.chip}`}>{dueText(todo, today, lang)}</span>
}

/** Whoever has the task, with their initials. */
export function Who({ email, teachers, lang, t, size = 26 }) {
  if (!email) return <span className="italic text-slate-400">{t('tdNobody')}</span>
  const name = whoName(email, teachers, lang)
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={name} size={size} />
      <span className={`truncate font-medium ${email === CLAUDE ? 'text-violet-700' : 'text-slate-800'}`}>{name}</span>
    </span>
  )
}
