import { OFFICE_ACCOUNTS } from '../data/staff'
import { fmtDay, personName, todayIso } from './leads'

// To-Do: one row per task, for the office. This took over from the "Team To-Do
// & Issues Tracker" spreadsheet on 1 October 2026. A task can be given to anyone
// on staff or to Claude; the inbox triage adds and updates tasks through its own
// account. See supabase/updates-2026-10-01-todos.sql.

/** What `assignee` holds when the task is Claude's. */
export const CLAUDE = 'claude'

// Each status has one colour, used for its pill, the edge of its row in the list
// and its button in the task window: `tone` light, `solid` when picked, `bar` the row edge, `hover` under the pointer.
export const TODO_STATUSES = [
  { id: 'open', en: 'To do', vi: 'Chưa làm', tone: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500', solid: 'bg-sky-600 text-white', bar: 'border-l-sky-400', hover: 'hover:bg-sky-50',
    hint: ['Not started yet.', 'Chưa bắt đầu.'] },
  { id: 'doing', en: 'Doing', vi: 'Đang làm', tone: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', solid: 'bg-amber-500 text-white', bar: 'border-l-amber-400', hover: 'hover:bg-amber-50',
    hint: ['Someone is working on it.', 'Đang có người làm.'] },
  { id: 'waiting', en: 'Waiting', vi: 'Đang chờ', tone: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500', solid: 'bg-violet-600 text-white', bar: 'border-l-violet-400', hover: 'hover:bg-violet-50',
    hint: ['Stuck until someone answers or something arrives. Say what in a note.', 'Chưa làm tiếp được vì đang chờ người khác trả lời hoặc chờ một việc khác. Ghi rõ đang chờ gì trong ghi chú.'] },
  { id: 'check', en: 'To check', vi: 'Cần kiểm tra', tone: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500', solid: 'bg-teal-600 text-white', bar: 'border-l-teal-500', hover: 'hover:bg-teal-50',
    hint: ['The work is done and the person who asked should look at it.', 'Đã làm xong, người giao việc cần xem lại.'] },
  { id: 'done', en: 'Done', vi: 'Xong', tone: 'bg-green-100 text-green-800', dot: 'bg-green-600', solid: 'bg-green-600 text-white', bar: 'border-l-green-500', hover: 'hover:bg-green-50',
    hint: ['Finished and checked.', 'Đã xong và đã kiểm tra.'] },
]

export const PRIORITIES = [
  { id: 'high', en: 'High', vi: 'Cao' },
  { id: 'normal', en: 'Normal', vi: 'Bình thường' },
  { id: 'low', en: 'Low', vi: 'Thấp' },
]

export const statusOf = (id) => TODO_STATUSES.find((s) => s.id === id) || TODO_STATUSES[0]
export const isOpen = (x) => x.status !== 'done'
/** Past its date and not finished. */
export const isLate = (x, today = todayIso()) => isOpen(x) && !!x.due_date && x.due_date < today
export const isDueSoon = (x, today = todayIso()) => isOpen(x) && !!x.due_date && x.due_date === today

const pad = (n) => String(n).padStart(2, '0')
const dayIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const plusDays = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return dayIso(d) }
const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000)

/** Open tasks are listed under these headings, the most pressing first, each with its own colour for the heading and the date. */
export const DUE_GROUPS = [
  { id: 'late', en: 'Late', vi: 'Quá hạn', head: 'bg-red-50 text-red-700', chip: 'bg-red-100 text-red-700' },
  { id: 'today', en: 'Due today', vi: 'Hạn hôm nay', head: 'bg-orange-50 text-orange-700', chip: 'bg-orange-100 text-orange-800' },
  { id: 'week', en: 'Next 7 days', vi: '7 ngày tới', head: 'bg-indigo-50 text-indigo-700', chip: 'bg-indigo-50 text-indigo-700' },
  { id: 'later', en: 'Later', vi: 'Sau đó', head: 'bg-slate-100/70 text-slate-600', chip: 'bg-slate-100 text-slate-600' },
  { id: 'none', en: 'No date', vi: 'Chưa có hạn', head: 'bg-slate-100/70 text-slate-500', chip: '' },
]
export function dueGroup(x, today = todayIso()) {
  if (!x.due_date) return 'none'
  if (x.due_date < today) return 'late'
  if (x.due_date === today) return 'today'
  return x.due_date <= plusDays(today, 7) ? 'week' : 'later'
}

const WEEKDAYS = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] }
/** The due date as people say it: "3 days late", "Today", "Tomorrow", "Thu 8 Oct", "30 Oct". */
export function dueText(x, today = todayIso(), lang = 'en') {
  if (!x.due_date) return ''
  const vi = lang === 'vi'
  const n = daysBetween(today, x.due_date)
  if (isOpen(x) && n < 0) return vi ? `Trễ ${-n} ngày` : `${-n} ${n === -1 ? 'day' : 'days'} late`
  if (isOpen(x) && n === 0) return vi ? 'Hôm nay' : 'Today'
  if (isOpen(x) && n === 1) return vi ? 'Ngày mai' : 'Tomorrow'
  const day = fmtDay(x.due_date, lang)
  if (!isOpen(x) || n > 7) return day
  const weekday = WEEKDAYS[vi ? 'vi' : 'en'][new Date(`${x.due_date}T00:00:00`).getDay()]
  return vi ? `${weekday}, ${day}` : `${weekday} ${day}`
}

/**
 * Seth and Bowen (head, super admin) can delete any task. Anyone else can delete
 * a task they added or asked for: "Asked by" is matched on its first word against
 * the first part of their email (Hien = hien.c@). The database checks the same
 * thing (supabase/updates-2026-10-01-todo-delete.sql).
 */
export function canDeleteTodo(x, me) {
  if (!x?.id || !me) return false
  if (['super_admin', 'head'].includes(me.access)) return true
  const email = String(me.email || '').toLowerCase()
  if (!email) return false
  if (String(x.created_by || '').toLowerCase() === email) return true
  const asker = String(x.giver || '').trim().split(/\s+/)[0].toLowerCase()
  return !!asker && asker === email.split('@')[0].split('.')[0]
}

/** Everyone a task can be given to: the office, then the teachers, then Claude. */
export function assignable(teachers = []) {
  const office = OFFICE_ACCOUNTS.map((a) => ({ email: a.email, name: a.name }))
  const seen = new Set(office.map((a) => a.email))
  const rest = teachers
    .filter((tr) => tr.email && tr.active !== false && !seen.has(tr.email.toLowerCase()))
    .map((tr) => ({ email: tr.email.toLowerCase(), name: tr.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return [...office, ...rest, { email: CLAUDE, name: 'Claude' }]
}

/** The name to show for whoever has a task, wrote a note or made a change. */
export function whoName(email, teachers = [], lang = 'en') {
  const e = String(email || '').toLowerCase()
  if (!e) return ''
  if (e === CLAUDE) return 'Claude'
  return OFFICE_ACCOUNTS.find((a) => a.email === e)?.name
    || teachers.find((tr) => (tr.email || '').toLowerCase() === e)?.name
    || personName(e, lang)
}

const RANK = { high: 0, normal: 1, low: 2 }
/** Open tasks: what is due first comes first, then by priority, then newest. Done tasks: last finished first. */
export function byUrgency(a, b) {
  if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1
  if (!isOpen(a)) return String(b.done_at || b.updated_at || '').localeCompare(String(a.done_at || a.updated_at || ''))
  if (!a.due_date !== !b.due_date) return a.due_date ? -1 : 1
  return String(a.due_date || '').localeCompare(String(b.due_date || ''))
    || (RANK[a.priority] ?? 1) - (RANK[b.priority] ?? 1)
    || (b.number || 0) - (a.number || 0)
}

export const blankTodo = (me) => ({
  title: '', details: '', status: 'open', priority: 'normal', assignee: '', giver: me?.name || '', due_date: '', files: [], updates: [], source: 'person',
})

/** The figures at the top of the page. */
export function summarizeTodos(todos, myEmail, today = todayIso()) {
  const open = todos.filter(isOpen)
  return {
    open: open.length,
    done: todos.length - open.length,
    mine: open.filter((x) => x.assignee === myEmail).length,
    late: open.filter((x) => isLate(x, today)).length,
    claude: open.filter((x) => x.assignee === CLAUDE).length,
    check: open.filter((x) => x.status === 'check').length,
  }
}

const setupHint = 'The To-Do tab is not set up in the database yet. Run supabase/updates-2026-10-01-todos.sql in Supabase, then reload.'
/** Turns "no such table / bucket / function" into something the office can act on. */
export const todosError = (e) => {
  const msg = e?.message || String(e)
  return /adm_todos|adm_todo_add_update|adm-todo|bucket not found|schema cache/i.test(msg) && /does not exist|not found|schema cache|could not find/i.test(msg) ? `${setupHint} (${msg})` : msg
}
