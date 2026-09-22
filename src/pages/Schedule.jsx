import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Printer, RotateCcw, Save, Trash2, ArrowUp, ArrowDown, MapPin, UserRound, X } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { DAYS, DAYS_VI, DEFAULT_SCHEDULE } from '../data/schedule'
import { cellOf, classForYearGroup, isNow, KIND_TONE, minutesNow, sameTeacher, startOf, subjectTone, teachersIn, teacherWeek, todayIndex } from '../lib/schedule'
import { Card, Empty, Field, Modal, PageHeader, Segmented, Select, Spinner, TextInput } from '../components/ui'

// The weekly timetable: by class, by teacher, and the duty roster. Office
// accounts can edit it; everyone else reads it.

const CLASS_KEY = 'pra-schedule-class'
const clone = (x) => JSON.parse(JSON.stringify(x))
const KINDS = [
  { value: '', label: 'Lessons (one per day)' }, { value: 'routine', label: 'Same all week: routine' }, { value: 'homeroom', label: 'Same all week: homeroom' },
  { value: 'break', label: 'Same all week: break' }, { value: 'lunch', label: 'Same all week: lunch' },
]
const names = (list) => (list || []).join(', ')
const splitNames = (text) => String(text || '').split(/[,;&+]/).map((x) => x.trim()).filter(Boolean)
const sameCell = (a, b) => (a.s || '') === (b.s || '') && names(a.t) === names(b.t) && (a.kind || '') === (b.kind || '')

/** Re-renders once a minute so the "now" marker keeps up. */
function useMinute() {
  const [, setTick] = useState(0)
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 60000); return () => clearInterval(id) }, [])
  return { day: todayIndex(), now: minutesNow() }
}

export default function Schedule() {
  const { t, lang } = useT()
  const { loading, schedule: saved, refresh } = useData()
  const { isOffice, me } = useAuth()
  const toast = useToast()
  const clock = useMinute()
  const [view, setView] = useState('class')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [classKey, setClassKey] = useState(() => { try { return localStorage.getItem(CLASS_KEY) || '' } catch { return '' } })
  const [teacher, setTeacher] = useState('')
  const [day, setDay] = useState(() => Math.max(0, todayIndex()))
  const [rowEdit, setRowEdit] = useState(null) // { index } or { index: -1 } for a new row
  const [classEdit, setClassEdit] = useState(false)

  const schedule = draft || saved
  const editing = !!draft
  const dayNames = lang === 'vi' ? DAYS_VI : DAYS
  const staff = useMemo(() => (schedule ? teachersIn(schedule) : []), [schedule])

  if (loading || !schedule) return <Spinner />

  const classes = schedule.classes || []
  // A teacher lands on their homeroom class, then on the class they last looked at.
  const mine = (me?.homeroom_groups || []).map((g) => classForYearGroup(schedule, g)).find(Boolean)
  const cls = classes.find((c) => c.key === classKey) || mine || classes[0]
  const pickClass = (k) => { setClassKey(k); try { localStorage.setItem(CLASS_KEY, k) } catch { /* ignore */ } }
  const meInList = staff.find((n) => sameTeacher(n, me?.name))
  const who = staff.includes(teacher) ? teacher : meInList || staff[0] || ''

  const patchClass = (fn) => setDraft((d) => ({ ...d, classes: d.classes.map((c) => (c.key === cls.key ? fn(clone(c)) : c)) }))
  const save = async () => {
    setBusy(true)
    try { await db.setSchedule({ ...draft, version: DEFAULT_SCHEDULE.version }); await refresh(); setDraft(null); toast(t('scheduleSaved')) }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  const reset = () => { if (confirm(t('scheduleResetConfirm'))) setDraft(clone(DEFAULT_SCHEDULE)) }
  const cancel = () => { if (JSON.stringify(draft) === JSON.stringify(saved) || confirm(t('discardChanges'))) setDraft(null) }
  const addClass = () => {
    const name = prompt(t('newClassName'))
    if (!name?.trim()) return
    const key = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now() % 10000}`
    setDraft((d) => ({ ...d, classes: [...d.classes, { key, name: name.trim(), yearGroups: [], room: '', homeroom: '', rows: [] }] }))
    pickClass(key)
  }
  const removeClass = () => {
    if (!confirm(t('removeClassConfirm', { name: cls.name }))) return
    setDraft((d) => ({ ...d, classes: d.classes.filter((c) => c.key !== cls.key) }))
    setClassEdit(false)
  }

  const tabs = [{ value: 'class', label: t('byClass') }, { value: 'teacher', label: t('byTeacher') }, { value: 'duty', label: t('duty') }]

  return (
    <div className={`space-y-4 ${editing ? 'pb-24 sm:pb-0' : ''}`}>
      <PageHeader title={t('schedule')} subtitle={`${schedule.schoolYear || ''} · ${t('scheduleSubtitle')}`}>
        <div className="no-print flex flex-wrap items-center gap-2">
          {!editing && <button className="btn-secondary" onClick={() => window.print()}><Printer size={16} /> {t('print')}</button>}
          {isOffice && !editing && <button className="btn-secondary" onClick={() => { setDraft(clone(saved)); setView((v) => (v === 'teacher' ? 'class' : v)) }}><Pencil size={16} /> {t('edit')}</button>}
          {editing && (<>
            <button className="btn-ghost" onClick={reset} title={t('scheduleResetHint')}><RotateCcw size={16} /> <span className="hidden sm:inline">{t('builtInSchedule')}</span></button>
            <button className="btn-secondary" onClick={cancel}>{t('cancel')}</button>
            <button className="btn-primary" onClick={save} disabled={busy}><Save size={16} /> {busy ? t('saving') : t('save')}</button>
          </>)}
        </div>
      </PageHeader>

      <Segmented className="no-print flex w-full sm:inline-flex sm:w-auto [&>button]:flex-1 [&>button]:py-1.5" value={view} onChange={setView} options={editing ? tabs.filter((x) => x.value !== 'teacher') : tabs} />
      {editing && <p className="no-print rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">{t('scheduleEditHint')}</p>}

      {view === 'class' && (<>
        <div className="no-print no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:gap-1.5 sm:px-0">
          {classes.map((c) => (
            <button key={c.key} type="button" aria-pressed={c.key === cls?.key} onClick={() => pickClass(c.key)}
              className={`h-10 flex-none whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors sm:h-auto sm:px-3 sm:py-1 ${c.key === cls?.key ? 'border-pra-blue bg-pra-blue text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}>
              {c.name}
            </button>
          ))}
          {editing && <button type="button" className="h-10 flex-none whitespace-nowrap rounded-full border border-dashed border-slate-400 px-3 text-sm font-semibold text-slate-500 hover:bg-white sm:h-auto sm:py-1" onClick={addClass}><Plus size={14} className="mr-1 inline" />{t('addClass')}</button>}
        </div>

        {!cls ? <Empty text={t('noData')} /> : (
          <Card className="!p-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-3">
              <h2 className="text-lg font-black text-slate-800">{cls.name}</h2>
              {cls.homeroom && <span className="inline-flex items-center gap-1 text-sm text-slate-600"><UserRound size={14} className="text-slate-400" /> {t('homeroomTeacher')}: <b className="font-semibold">{cls.homeroom}</b></span>}
              {cls.room && <span className="inline-flex items-center gap-1 text-sm text-slate-600"><MapPin size={14} className="text-slate-400" /> {cls.room}</span>}
              {(cls.yearGroups || []).length > 1 && <span className="text-xs text-slate-400">{cls.yearGroups.join(', ')}</span>}
              {editing && <button className="btn-ghost no-print ml-auto !py-1 text-xs" onClick={() => setClassEdit(true)}><Pencil size={14} /> {t('classDetails')}</button>}
            </div>
            {cls.note && <p className="border-b border-slate-100 bg-slate-50/60 px-4 py-1.5 text-xs text-slate-500">{cls.note}</p>}
            <DayTabs day={day} setDay={setDay} dayNames={dayNames} today={clock.day} />
            <WeekGrid rows={cls.rows || []} dayNames={dayNames} clock={clock} day={day} editing={editing} onEditRow={(index) => setRowEdit({ index })}
              render={(cell) => <LessonCell cell={cell} />} cellsOf={(row) => DAYS.map((_, d) => cellOf(row, d))} />
            {editing && <div className="no-print border-t border-slate-100 p-3"><button className="btn-secondary text-xs" onClick={() => setRowEdit({ index: -1 })}><Plus size={14} /> {t('addTimeSlot')}</button></div>}
          </Card>
        )}
      </>)}

      {view === 'teacher' && (<>
        <div className="no-print flex flex-wrap items-center gap-2">
          <select className="input h-11 w-auto text-base sm:h-auto sm:text-sm" value={who} onChange={(e) => setTeacher(e.target.value)} aria-label={t('teacher')}>
            {staff.map((n) => <option key={n} value={n}>{n}{sameTeacher(n, me?.name) ? ` (${t('you')})` : ''}</option>)}
          </select>
        </div>
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-lg font-black text-slate-800">{who}</h2></div>
          <DayTabs day={day} setDay={setDay} dayNames={dayNames} today={clock.day} />
          <TeacherGrid schedule={schedule} name={who} dayNames={dayNames} clock={clock} day={day} empty={t('nothingScheduled')} />
        </Card>
      </>)}

      {view === 'duty' && <DutyTable schedule={schedule} dayNames={dayNames} clock={clock} me={me} editing={editing} t={t}
        onChange={(duties) => setDraft((d) => ({ ...d, duties }))} />}

      {rowEdit && cls && (
        <RowModal t={t} dayNames={dayNames} staff={staff} row={rowEdit.index >= 0 ? cls.rows[rowEdit.index] : null} onClose={() => setRowEdit(null)}
          onSave={(row) => { patchClass((c) => { if (rowEdit.index >= 0) c.rows[rowEdit.index] = row; else c.rows.push(row); c.rows.sort((a, b) => startOf(a.time) - startOf(b.time)); return c }); setRowEdit(null) }}
          onRemove={rowEdit.index >= 0 ? () => { patchClass((c) => { c.rows.splice(rowEdit.index, 1); return c }); setRowEdit(null) } : null} />
      )}
      {classEdit && cls && <ClassModal t={t} cls={cls} staff={staff} onClose={() => setClassEdit(false)} onRemove={classes.length > 1 ? removeClass : null}
        onSave={(p) => { patchClass((c) => ({ ...c, ...p })); setClassEdit(false) }} />}
    </div>
  )
}

/** Phones show one day at a time. */
function DayTabs({ day, setDay, dayNames, today }) {
  return (
    <div className="no-print flex border-b border-slate-100 sm:hidden" role="group">
      {dayNames.map((n, d) => (
        <button key={n} type="button" aria-pressed={d === day} onClick={() => setDay(d)}
          className={`relative flex-1 py-2.5 text-sm font-bold ${d === day ? 'text-pra-blue' : 'text-slate-500'}`}>
          {n.replace(/^Thứ /, 'T').slice(0, 3)}
          {d === today && <span className="absolute left-1/2 top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-green-500" />}
          {d === day && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-pra-blue" />}
        </button>
      ))}
    </div>
  )
}

function LessonCell({ cell }) {
  if (!(cell.s || '').trim()) return <span className="text-slate-300">—</span>
  return (<>
    <span className="block font-semibold leading-snug">{cell.s}</span>
    {(cell.t || []).length > 0 && <span className="block text-[11px] leading-snug opacity-75">{names(cell.t)}</span>}
  </>)
}

/**
 * Time down the side, Monday to Friday across. Neighbouring days with the same
 * lesson join into one wide cell. Phones get the chosen day as a list instead.
 */
function WeekGrid({ rows, cellsOf, render, dayNames, clock, day, editing, onEditRow }) {
  const { t } = useT()
  if (!rows.length) return <div className="p-4"><Empty text={t('nothingScheduled')} /></div>
  const tone = (cell) => (cell.kind ? KIND_TONE[cell.kind] || KIND_TONE.routine : (cell.s || '').trim() ? subjectTone(cell.s) : 'bg-white')
  return (<>
    <ul className="divide-y divide-slate-100 sm:hidden print:hidden">
      {rows.map((row, i) => {
        const cell = cellsOf(row)[day]
        const live = clock.day === day && isNow(row.time, clock.now)
        return (
          <li key={i} className={`flex items-stretch gap-3 px-3 py-2 ${live ? 'bg-green-50/60' : ''}`}>
            <div className="w-[5.25rem] flex-none pt-1.5 text-xs font-semibold tabular-nums text-slate-500">{row.time}{live && <span className="mt-0.5 block text-[10px] font-bold uppercase text-green-700">{t('now')}</span>}</div>
            <div className={`min-w-0 flex-1 rounded-lg border px-3 py-1.5 text-sm ${cell.kind ? 'border-transparent' : ''} ${tone(cell)}`}>{render(cell)}</div>
            {editing && <button className="btn-ghost flex-none px-2" onClick={() => onEditRow(i)} aria-label={t('edit')}><Pencil size={15} /></button>}
          </li>
        )
      })}
    </ul>
    <div className="hidden overflow-x-auto sm:block print:block">
      <table className="w-full table-fixed border-separate border-spacing-1 p-2 text-[13px]">
        <thead><tr>
          <th className="w-[6.5rem] px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('time')}</th>
          {dayNames.map((n, d) => <th key={n} className={`rounded-lg px-2 py-1.5 text-center text-xs font-bold ${d === clock.day ? 'bg-green-100 text-green-800' : 'text-slate-600'}`}>{n}</th>)}
          {editing && <th className="no-print w-9" />}
        </tr></thead>
        <tbody>
          {rows.map((row, i) => {
            const cells = cellsOf(row)
            const spans = []
            const live = isNow(row.time, clock.now)
            // Today's cell stands on its own while its lesson is on, so only that day is ringed.
            const alone = (d) => live && d === clock.day
            cells.forEach((cell, d) => { const last = spans.at(-1); if (last && sameCell(last.cell, cell) && !alone(d) && !alone(d - 1)) last.n++; else spans.push({ cell, d, n: 1 }) })
            return (
              <tr key={i}>
                <td className={`whitespace-nowrap px-2 py-1.5 align-middle text-xs font-semibold tabular-nums ${live && clock.day >= 0 ? 'text-green-700' : 'text-slate-500'}`}>{row.time}</td>
                {spans.map((sp) => {
                  const here = live && clock.day >= sp.d && clock.day < sp.d + sp.n
                  return (
                    <td key={sp.d} colSpan={sp.n} className={`rounded-lg border px-2 py-1.5 text-center align-middle ${sp.cell.kind ? 'border-transparent text-xs font-semibold' : ''} ${tone(sp.cell)} ${here ? 'ring-2 ring-green-500' : ''}`}>
                      {render(sp.cell)}
                    </td>
                  )
                })}
                {editing && <td className="no-print text-center"><button className="btn-ghost px-1.5 py-1" onClick={() => onEditRow(i)} aria-label={`${t('edit')} ${row.time}`}><Pencil size={14} /></button></td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  </>)
}

function TeacherGrid({ schedule, name, dayNames, clock, day, empty }) {
  const rows = useMemo(() => teacherWeek(schedule, name), [schedule, name])
  if (!rows.length) return <div className="p-4"><Empty text={empty} /></div>
  // One cell per day: a lesson (with its classes), a duty, or free.
  const cellsOf = (row) => row.days.map((list) => (list.length
    ? { s: list.map((x) => x.s).join(' + '), t: [...new Set(list.flatMap((x) => x.classes))], kind: list.every((x) => x.kind === 'homeroom') ? 'homeroom' : undefined }
    : { s: '', t: [] }))
  return <WeekGrid rows={rows} cellsOf={cellsOf} dayNames={dayNames} clock={clock} day={day} render={(cell) => <LessonCell cell={cell} />} />
}

function DutyTable({ schedule, dayNames, clock, me, editing, onChange, t }) {
  const duties = schedule.duties || []
  const set = (i, p) => onChange(duties.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const move = (i, d) => { const a = [...duties]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a) }
  if (!duties.length && !editing) return <Empty text={t('nothingScheduled')} />
  return (
    <Card className="!p-0 overflow-hidden" >
      <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-lg font-black text-slate-800">{t('dutyRoster')}</h2><p className="text-xs text-slate-500">{t('dutyHint')}</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50/60"><tr>
            <th className="th pl-4">{t('time')}</th><th className="th">{t('area')}</th>
            {dayNames.map((n, d) => <th key={n} className={`th ${d === clock.day ? 'text-green-700' : ''}`}>{n}</th>)}
            {editing && <th className="th no-print" />}
          </tr></thead>
          <tbody>
            {duties.map((duty, i) => (
              <tr key={i} className={`border-t border-slate-100 ${clock.day >= 0 && isNow(duty.time, clock.now) ? 'bg-green-50/60' : ''}`}>
                {editing ? (<>
                  <td className="td pl-4"><input className="input !py-1 text-xs" value={duty.time} onChange={(e) => set(i, { time: e.target.value })} aria-label={t('time')} /></td>
                  <td className="td"><input className="input !py-1 text-xs" value={duty.area} onChange={(e) => set(i, { area: e.target.value })} aria-label={t('area')} /><input className="input mt-1 !py-1 text-xs" value={duty.classes || ''} placeholder={t('classes')} onChange={(e) => set(i, { classes: e.target.value })} aria-label={t('classes')} /></td>
                  {DAYS.map((_, d) => <td key={d} className="td"><input className="input !py-1 text-xs" value={names(duty.who?.[d])} onChange={(e) => set(i, { who: DAYS.map((__, k) => (k === d ? splitNames(e.target.value) : duty.who?.[k] || [])) })} aria-label={dayNames[d]} /></td>)}
                  <td className="td no-print whitespace-nowrap pr-2">
                    <button className="btn-ghost px-1.5" onClick={() => move(i, -1)} aria-label="Up"><ArrowUp size={14} /></button>
                    <button className="btn-ghost px-1.5" onClick={() => move(i, 1)} aria-label="Down"><ArrowDown size={14} /></button>
                    <button className="btn-ghost px-1.5 text-red-500" onClick={() => onChange(duties.filter((_x, j) => j !== i))} aria-label={t('delete')}><Trash2 size={14} /></button>
                  </td>
                </>) : (<>
                  <td className="td whitespace-nowrap pl-4 text-xs font-semibold tabular-nums text-slate-500">{duty.time}</td>
                  <td className="td"><span className="font-semibold text-slate-800">{duty.area}</span>{duty.classes && <span className="block text-xs text-slate-400">{duty.classes}</span>}</td>
                  {DAYS.map((_, d) => {
                    const list = duty.who?.[d] || []
                    const isMe = list.some((n) => sameTeacher(n, me?.name))
                    return <td key={d} className="td"><span className={isMe ? 'rounded-md bg-amber-100 px-1.5 py-0.5 font-bold text-amber-900' : 'text-slate-700'}>{names(list) || <span className="text-slate-300">—</span>}</span></td>
                  })}
                </>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <div className="no-print border-t border-slate-100 p-3"><button className="btn-secondary text-xs" onClick={() => onChange([...duties, { time: '', area: '', classes: '', who: DAYS.map(() => []) }])}><Plus size={14} /> {t('addTimeSlot')}</button></div>}
    </Card>
  )
}

/** One time slot of a class: the same thing all week, or a lesson per day. */
function RowModal({ row, onSave, onRemove, onClose, dayNames, staff, t }) {
  const [time, setTime] = useState(row?.time || '')
  const [kind, setKind] = useState(row ? (row.days ? '' : row.kind || 'routine') : '')
  const [label, setLabel] = useState(row?.all || '')
  const [allTeachers, setAllTeachers] = useState(names(row?.t))
  const [days, setDays] = useState(() => DAYS.map((_, d) => { const cell = row ? cellOf(row, d) : { s: '', t: [] }; return { s: row?.days ? cell.s || '' : '', t: row?.days ? names(cell.t) : '', kind: row?.days ? cell.kind || '' : '' } }))
  const setDayCell = (d, p) => setDays((cur) => cur.map((x, k) => (k === d ? { ...x, ...p } : x)))
  const copyMonday = () => setDays((cur) => cur.map(() => ({ ...cur[0] })))
  const submit = (e) => {
    e.preventDefault()
    const clean = time.trim().replace(/\s*[-—]\s*/, '–')
    onSave(kind
      ? { time: clean, all: label.trim(), kind, t: splitNames(allTeachers) }
      : { time: clean, days: days.map((x) => ({ s: x.s.trim(), t: splitNames(x.t), ...(x.kind && { kind: x.kind }) })) })
  }
  return (
    <Modal open onClose={onClose} title={row ? `${t('edit')}: ${row.time}` : t('addTimeSlot')} wide
      footer={(<>
        {onRemove && <button type="button" className="btn-ghost mr-auto text-red-600 hover:bg-red-50" onClick={() => { if (confirm(t('removeRowConfirm'))) onRemove() }}><Trash2 size={16} /> {t('delete')}</button>}
        <button type="button" className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button type="submit" form="row-form" className="btn-primary">{t('done')}</button>
      </>)}>
      <form id="row-form" onSubmit={submit} className="space-y-4">
        <datalist id="schedule-staff">{staff.map((n) => <option key={n} value={n} />)}</datalist>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('time')} hint="8:45–9:35"><TextInput value={time} onChange={setTime} required pattern=".*\d{1,2}[:.]\d{2}\s*[–—\-]\s*\d{1,2}[:.]\d{2}.*" placeholder="8:45–9:35" /></Field>
          <Field label={t('rowType')}><Select value={kind} onChange={setKind} options={KINDS} /></Field>
        </div>
        {kind ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('whatHappens')}><TextInput value={label} onChange={setLabel} required placeholder="Snack / Break" /></Field>
            <Field label={t('teachers')} hint={t('teachersHint')}><TextInput value={allTeachers} onChange={setAllTeachers} list="schedule-staff" /></Field>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between"><span className="label !mb-0">{t('lessons')}</span><button type="button" className="btn-ghost !py-1 text-xs" onClick={copyMonday}>{t('copyMonday')}</button></div>
            {days.map((x, d) => (
              <div key={d} className="grid items-center gap-2 sm:grid-cols-[6.5rem_1fr_1fr]">
                <span className="text-sm font-semibold text-slate-600">{dayNames[d]}</span>
                <input className="input" value={x.s} onChange={(e) => setDayCell(d, { s: e.target.value })} placeholder={t('lessonSubject')} aria-label={`${dayNames[d]}: ${t('lessonSubject')}`} />
                <input className="input" value={x.t} onChange={(e) => setDayCell(d, { t: e.target.value })} placeholder={t('teachers')} list="schedule-staff" aria-label={`${dayNames[d]}: ${t('teachers')}`} />
              </div>
            ))}
            <p className="text-xs text-slate-400">{t('teachersHint')}</p>
          </div>
        )}
      </form>
    </Modal>
  )
}

function ClassModal({ cls, onSave, onRemove, onClose, staff, t }) {
  const [v, setV] = useState({ name: cls.name || '', homeroom: cls.homeroom || '', room: cls.room || '', note: cls.note || '', yearGroups: names(cls.yearGroups) })
  const set = (k) => (x) => setV((cur) => ({ ...cur, [k]: x }))
  return (
    <Modal open onClose={onClose} title={t('classDetails')}
      footer={(<>
        {onRemove && <button type="button" className="btn-ghost mr-auto text-red-600 hover:bg-red-50" onClick={onRemove}><X size={16} /> {t('removeClass')}</button>}
        <button type="button" className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button type="submit" form="class-form" className="btn-primary">{t('done')}</button>
      </>)}>
      <form id="class-form" className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave({ ...v, name: v.name.trim(), yearGroups: splitNames(v.yearGroups) }) }}>
        <datalist id="schedule-staff-2">{staff.map((n) => <option key={n} value={n} />)}</datalist>
        <Field label={t('className')}><TextInput value={v.name} onChange={set('name')} required /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('homeroomTeacher')}><TextInput value={v.homeroom} onChange={set('homeroom')} list="schedule-staff-2" /></Field>
          <Field label={t('room')}><TextInput value={v.room} onChange={set('room')} /></Field>
        </div>
        <Field label={t('yearGroups')} hint={t('yearGroupsHint')}><TextInput value={v.yearGroups} onChange={set('yearGroups')} placeholder="Year 2, Year 3" /></Field>
        <Field label={t('classNote')}><TextInput value={v.note} onChange={set('note')} /></Field>
      </form>
    </Modal>
  )
}
