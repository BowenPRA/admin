import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Calendar, Check, ChevronLeft, ChevronRight, CheckCheck, MessageSquare, Plane, Printer, TrendingDown } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { photoSrc } from '../lib/report/photo'
import { isEnrolled, partialFrom, afterEnd, endDateOf } from '../lib/studentRecords'
import { dayText } from '../lib/studentDates'
import { iso, todayIso, parseIso as parse, levelIndex, asMarked, attendancePeriods, defaultPeriod, summarizeAttendance, LOW_RATE } from '../lib/attendanceSummary'
import { TRAVEL, tripOn, statusOn, tripLine, blankTrip } from '../lib/travel'
import { Card, Empty, Spinner, Avatar, Segmented, PageHeader } from '../components/ui'
import { TripForm } from '../components/attendance/Trips'

// Daily attendance: one mark per student per school day. Separate from
// progress reports, which deliberately leave attendance out.

// `stripe` marks a row's status down its left edge; `bar` is its slice of the progress bar.
const STATUSES = [
  { key: 'present', on: 'bg-green-600 text-white border-green-600', soft: 'bg-green-100 text-green-800', stripe: 'shadow-[inset_4px_0_0_#16a34a]', bar: 'bg-green-600' },
  { key: 'late', on: 'bg-amber-500 text-white border-amber-500', soft: 'bg-amber-100 text-amber-800', stripe: 'shadow-[inset_4px_0_0_#f59e0b]', bar: 'bg-amber-500' },
  { key: 'absent', on: 'bg-red-600 text-white border-red-600', soft: 'bg-red-100 text-red-700', stripe: 'shadow-[inset_4px_0_0_#dc2626]', bar: 'bg-red-600' },
]
// A(T), Absent (Traveling): a day inside a trip (lib/travel.js). Nobody taps it: it comes from the trip.
const AWAY = { key: TRAVEL, on: 'bg-violet-600 text-white border-violet-600', soft: 'bg-violet-100 text-violet-800', stripe: 'shadow-[inset_4px_0_0_#7c3aed]', bar: 'bg-violet-500' }
const STATUS = Object.fromEntries([...STATUSES, AWAY].map((st) => [st.key, st]))
const GROUP_KEY = 'pra-attendance-group'
const isPhone = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches
const isWeekend = (s) => [0, 6].includes(parse(s).getDay())
const shiftSchoolDay = (s, dir) => { const d = parse(s); do { d.setDate(d.getDate() + dir) } while ([0, 6].includes(d.getDay())); return iso(d) }

export default function Attendance() {
  const { t } = useT()
  const { loading, students } = useData()
  const { canAttendance, myYearGroups, me, isOffice } = useAuth()
  // The printed summary's Back button returns to the Summary tab.
  const [params] = useSearchParams()
  const [tab, setTab] = useState(() => (params.get('tab') === 'summary' ? 'summary' : 'take'))
  const scoped = !isOffice && !!myYearGroups

  const enrolled = useMemo(() => students.filter(isEnrolled), [students])
  const groups = useMemo(() => [...new Set(enrolled.map((s) => s.level).filter(Boolean))].sort((a, b) => levelIndex(a) - levelIndex(b)), [enrolled])
  const myGroups = useMemo(() => {
    const allowed = groups.filter(canAttendance)
    // Homeroom year groups first for teachers.
    const home = me?.homeroom_groups || []
    return [...allowed].sort((a, b) => (home.includes(b) ? 1 : 0) - (home.includes(a) ? 1 : 0) || levelIndex(a) - levelIndex(b))
  }, [groups, canAttendance, me])

  if (loading) return <Spinner />

  const tabs = [{ value: 'take', label: t('takeAttendance') }, { value: 'summary', label: t('summary') }]
  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title={t('attendance')} subtitle={scoped ? (myGroups.join(', ') || '—') : `${enrolled.length} ${t('students').toLowerCase()} · ${groups.length} ${t('yearGroup').toLowerCase()}`}>
        <Segmented className="hidden sm:inline-flex" value={tab} onChange={setTab} options={tabs} />
      </PageHeader>
      {/* Phones: full-width tabs, easy to hit with a thumb. */}
      <Segmented className="flex w-full sm:hidden [&>button]:flex-1 [&>button]:py-2" value={tab} onChange={setTab} options={tabs} />
      {!myGroups.length && tab === 'take'
        ? <Empty text={groups.length ? t('noClassesToTake') : t('noData')} />
        : tab === 'take' ? <TakeAttendance students={enrolled} groups={myGroups} /> : <Summary students={students} groups={scoped ? myGroups : groups} />}
    </div>
  )
}

function TakeAttendance({ students, groups }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { displayName } = useAuth()
  const { travel: trips } = useData()
  const [date, setDate] = useState(() => { const d = todayIso(); return isWeekend(d) ? shiftSchoolDay(d, -1) : d })
  // Remember the last year group on this device, so a teacher reopening the app lands on their class.
  const [group, setGroupState] = useState(() => { try { return localStorage.getItem(GROUP_KEY) || groups[0] } catch { return groups[0] } })
  const setGroup = (g) => { setGroupState(g); try { localStorage.setItem(GROUP_KEY, g) } catch { /* ignore */ } }
  // Marks for the loaded date: student_id -> row. `null` while another date loads.
  const [loaded, setLoaded] = useState({ date: null, map: {} })
  const marks = loaded.date === date ? loaded.map : null
  const [noteOpen, setNoteOpen] = useState({})
  const [noteDraft, setNoteDraft] = useState({})
  const [tripOpen, setTripOpen] = useState({}) // student_id -> the trip boxes are showing
  const activeGroup = groups.includes(group) ? group : groups[0]
  // After a student's expected end date they are not expected: listed last, not counted
  // as unmarked, not marked by "Mark everyone else present". They can still be marked.
  const finished = (s) => afterEnd(s, date)
  // The trip a student is on that day, and what the day counts as: a mark, or A(T) from the trip.
  const tripFor = (s) => tripOn(trips, s.id, date)
  const stateOf = (s) => (finished(s) && !marks?.[s.id] ? null : statusOn(marks?.[s.id], tripFor(s)))
  // Who the day's numbers are out of: everyone expected, and anyone marked.
  const isCounted = (s) => !finished(s) || !!marks?.[s.id]
  const showTrip = (s, on = true) => { setTripOpen((o) => ({ ...o, [s.id]: on })); if (on) setNoteOpen((o) => ({ ...o, [s.id]: true })) }
  const inFlight = useRef({}) // student_id -> the save still on its way

  // Reads a day's marks. On a day already on screen, marks still on their way from this
  // device stay as they are shown; everything else follows the database.
  const readDay = async (day, alive = () => true) => {
    const rows = await db.attendance.list({ date: day })
    const server = Object.fromEntries(rows.map((r) => [r.student_id, asMarked(r)]))
    const sending = (map) => Object.fromEntries(Object.entries(map).filter(([sid]) => inFlight.current[sid]))
    if (alive()) setLoaded((cur) => ({ date: day, map: cur.date === day ? { ...server, ...sending(cur.map) } : server }))
    return server
  }

  useEffect(() => {
    let alive = true
    readDay(date, () => alive).catch((e) => { toast.error(e.message); if (alive) setLoaded((cur) => (cur.date === date ? cur : { date, map: {} })) })
    // Marks made on another phone (the gate, the office) show when this one is looked at again.
    const onShow = () => { if (document.visibilityState === 'visible') readDay(date, () => alive).catch(() => {}) }
    document.addEventListener('visibilitychange', onShow)
    return () => { alive = false; document.removeEventListener('visibilitychange', onShow) }
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  // Students past their expected end date come last.
  const kids = useMemo(() => students.filter((s) => s.level === activeGroup)
    .sort((a, b) => afterEnd(a, date) - afterEnd(b, date) || (a.nickname || a.full_name).localeCompare(b.nickname || b.full_name)), [students, activeGroup, date])

  // Changes apply to the day they were made on: a slow reply never lands in another day's list.
  const applyTo = (day, fn) => setLoaded((cur) => (cur.date === day ? { date: day, map: fn(cur.map) } : cur))
  const save = async (rows) => {
    const day = date
    const before = Object.fromEntries(rows.map((r) => [r.student_id, marks[r.student_id]]))
    // The note is only sent when it is the note being changed: a status tap leaves a note written on another device alone.
    const full = rows.map((r) => ({ date: day, year_group: activeGroup, taken_by: displayName, ...r }))
    applyTo(day, (m) => { const n = { ...m }; full.forEach((r) => { n[r.student_id] = { ...(m[r.student_id] || {}), ...r } }); return n })
    const sent = db.attendance.mark(full)
    rows.forEach((r) => { inFlight.current[r.student_id] = sent })
    try {
      const saved = await sent
      applyTo(day, (m) => { const n = { ...m }; saved.forEach((r) => { n[r.student_id] = asMarked(r) }); return n })
      return true
    } catch (e) {
      // Put back only the rows that failed, so marks made in the meantime stay.
      applyTo(day, (m) => { const n = { ...m }; rows.forEach((r) => { if (before[r.student_id]) n[r.student_id] = before[r.student_id]; else delete n[r.student_id] }); return n })
      toast.error(e.message)
      return false
    } finally {
      rows.forEach((r) => { if (inFlight.current[r.student_id] === sent) delete inFlight.current[r.student_id] })
    }
  }
  // Tapping the chosen status again takes the mark off (e.g. the wrong student was tapped).
  const clearMark = async (s) => {
    const day = date
    const row = marks[s.id]
    if (!row) return
    if (row.note && !confirm(t('clearMarkConfirm', { name: s.nickname || s.full_name }))) return
    const drop = () => applyTo(day, (m) => { const n = { ...m }; delete n[s.id]; return n })
    drop()
    setNoteDraft((d) => { const n = { ...d }; delete n[s.id]; return n })
    setNoteOpen((o) => ({ ...o, [s.id]: false }))
    try {
      // A mark still on its way (a quick second tap) is waited for: it brings the row to
      // remove, and its reply has by then put the mark back on screen, so that is taken off again.
      let id = row.id
      const sent = inFlight.current[s.id]
      if (sent) {
        id = (await sent.catch(() => [])).find((r) => r.student_id === s.id)?.id || id
        drop()
      }
      if (id) await db.attendance.clear(id)
    } catch (e) {
      applyTo(day, (m) => (m[s.id] ? m : { ...m, [s.id]: row }))
      toast.error(e.message)
    }
  }
  // A note typed before any status is chosen waits, and is saved with the status when one is tapped.
  const waitingNote = (s) => (marks[s.id] ? '' : (noteDraft[s.id] || '').trim())
  const setStatus = (s, status) => {
    // Already A(T) from a trip: tapping it shows the trip, there is no mark to make.
    if (status === 'absent' && !marks[s.id] && stateOf(s) === TRAVEL) return showTrip(s)
    if (marks[s.id]?.status === status) return clearMark(s)
    const note = waitingNote(s)
    return save([{ student_id: s.id, status, ...(note ? { note } : {}) }])
  }
  const saveNote = (s) => {
    // No status yet: a note on its own must not mark the student present.
    if (!marks[s.id]) return
    const note = (noteDraft[s.id] ?? marks[s.id].note ?? '').trim()
    if (note === (marks[s.id].note || '')) return
    save([{ student_id: s.id, status: marks[s.id].status, note: note || null }])
  }
  // A partial-day student (see partialFrom) is not marked present in bulk before
  // they arrive today; the teacher marks them when they come in.
  const minutes = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + (m || 0) }
  const notArrived = (s) => {
    if (!partialFrom(s) || date !== todayIso()) return false
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes() < minutes(partialFrom(s))
  }
  const markRestPresent = async () => {
    // Someone else may have marked students since this page was opened (the gate, another
    // phone). The day is read again first, so their marks stay and only the students still
    // unmarked are set present.
    let known = marks
    try { known = { ...marks, ...(await readDay(date)) } } catch { /* no connection for a moment: go by what is on screen */ }
    // A student who is traveling is A(T) already, and is left as that. A student past their
    // expected end date is not expected, so is left unmarked.
    const open = kids.filter((s) => !known[s.id] && !tripFor(s) && !finished(s))
    const waiting = open.filter(notArrived)
    const rest = open.filter((s) => !notArrived(s))
    const later = waiting.length ? t('arrivesLater', { names: waiting.map((s) => s.nickname || s.full_name).join(', '), time: partialFrom(waiting[0]) }) : ''
    if (!rest.length) { if (later) toast.info(later); return }
    const ok = await save(rest.map((s) => ({ student_id: s.id, status: 'present' })))
    // Notes typed before a status was chosen go with the mark.
    if (ok) for (const s of rest) { const note = waitingNote(s); if (note) await save([{ student_id: s.id, status: 'present', note }]) }
    if (ok && later) toast.info(later)
    // On phones the bottom bar already turns to "All marked"; a toast would cover it.
    else if (ok && !isPhone()) toast(t('attendanceSaved'))
  }

  const counted = kids.filter(isCounted)
  const counts = [...STATUSES, AWAY].reduce((m, st) => ({ ...m, [st.key]: counted.filter((s) => stateOf(s) === st.key).length }), {})
  const unmarked = counted.filter((s) => !stateOf(s)).length
  const done = counted.length - unmarked
  const groupDone = (g) => { const ks = students.filter((s) => s.level === g && isCounted(s)); return { done: marks ? ks.filter((s) => stateOf(s)).length : 0, total: ks.length } }
  const dateLabel = parse(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const shortDateLabel = parse(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  // After finishing a class, offer the next one that still has students to mark.
  const nextGroup = marks && !unmarked && groups.length > 1
    ? [...groups.slice(groups.indexOf(activeGroup) + 1), ...groups.slice(0, groups.indexOf(activeGroup))].find((g) => { const p = groupDone(g); return p.total && p.done < p.total })
    : null

  // Keep the chosen year group visible in the sideways-scrolling chip row.
  const chipsRef = useRef(null)
  useEffect(() => {
    chipsRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [activeGroup])

  const tap = (fn) => { navigator.vibrate?.(8); fn() }

  return (
    <div className="space-y-3 pb-28 sm:space-y-4 sm:pb-0">
      <div className="flex items-center gap-2">
        <div className="flex h-11 min-w-0 flex-1 items-center overflow-hidden rounded-xl border border-slate-300 bg-white sm:h-auto sm:flex-none sm:rounded-lg">
          <button type="button" className="grid h-full w-11 flex-none place-items-center text-slate-500 hover:bg-slate-50 active:bg-slate-100 sm:w-9" onClick={() => setDate(shiftSchoolDay(date, -1))} aria-label={t('previousDay')}><ChevronLeft size={18} /></button>
          {/* Phones: a readable date; tapping it opens the phone's own date picker. */}
          <label className="relative flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 border-x border-slate-200 px-2 font-semibold text-slate-700 sm:hidden">
            <Calendar size={15} className="flex-none text-slate-400" /><span className="truncate">{shortDateLabel}</span>
            <input type="date" className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0" value={date} aria-label={dateLabel}
              onClick={(e) => { try { e.currentTarget.showPicker() } catch { /* not supported */ } }} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          <input type="date" className="hidden border-x border-slate-200 px-2 py-1.5 text-sm focus:outline-none sm:block" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button type="button" className="grid h-full w-11 flex-none place-items-center text-slate-500 hover:bg-slate-50 active:bg-slate-100 sm:w-9" onClick={() => setDate(shiftSchoolDay(date, 1))} aria-label={t('nextDay')}><ChevronRight size={18} /></button>
        </div>
        {date !== todayIso() && <button type="button" className="btn-secondary h-11 flex-none sm:h-auto sm:!py-1.5 sm:text-xs" onClick={() => setDate(todayIso())}>{t('today')}</button>}
        <span className="hidden text-sm font-semibold text-slate-600 sm:inline">{dateLabel}</span>
      </div>

      {/* Phones: one sideways-scrolling row of year groups instead of several wrapped rows. */}
      <div ref={chipsRef} className="no-scrollbar -mx-4 flex scroll-mt-20 gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:gap-1.5 sm:px-0">
        {groups.map((g) => {
          const p = groupDone(g)
          const complete = marks && p.total > 0 && p.done === p.total
          const on = g === activeGroup
          return (
            <button key={g} type="button" aria-pressed={on} onClick={() => setGroup(g)}
              className={`flex h-10 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors sm:h-auto sm:px-3 sm:py-1 ${on ? 'border-pra-blue bg-pra-blue text-white' : complete ? 'border-green-300 bg-green-50 text-green-800' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}>
              {g}
              {marks && (complete
                ? <Check size={14} className={on ? 'text-white' : 'text-green-600'} aria-label={t('allMarked', { total: p.total })} />
                : <span className={`text-xs font-normal tabular-nums ${on ? 'text-white/80' : 'text-slate-400'}`}>{p.done}/{p.total}</span>)}
            </button>
          )
        })}
      </div>

      {isWeekend(date) && <p className="text-sm text-amber-700">{t('noSchoolDay')}</p>}

      <Card className="!p-0 overflow-hidden">
        <div className="space-y-2.5 border-b border-slate-100 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {STATUSES.map((st) => <span key={st.key} className={`chip ${st.soft} ${counts[st.key] ? '' : 'opacity-60'}`}>{t(st.key)} · {counts[st.key]}</span>)}
            {counts[TRAVEL] > 0 && <span className={`chip ${AWAY.soft}`} title={t('absentTravelLong')}>{t('absentTravel')} · {counts[TRAVEL]}</span>}
            {unmarked > 0 && <span className="chip bg-slate-100 text-slate-600">{t('notMarked')} · {unmarked}</span>}
            <button className="btn-green ml-auto hidden !py-1.5 text-xs sm:inline-flex" disabled={!marks || !unmarked} onClick={markRestPresent}><CheckCheck size={15} /> {t('markAllPresent')}</button>
          </div>
          {counted.length > 0 && <ProgressBar counts={counts} total={counted.length} />}
        </div>
        {!marks ? <Spinner /> : !kids.length ? <div className="p-4"><Empty text={t('noData')} /></div> : (
          <ul className="divide-y divide-slate-100">
            {kids.map((s) => {
              const m = marks[s.id]
              const trip = tripFor(s)
              const state = stateOf(s)
              const away = state === TRAVEL
              const ended = finished(s) && !m
              const showNote = noteOpen[s.id] || !!m?.note
              return (
                <li key={s.id} className={`px-3 py-3 sm:px-4 sm:py-2.5 ${state ? STATUS[state]?.stripe || '' : ended ? 'bg-slate-50' : 'bg-amber-50/40'}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                    <Avatar src={photoSrc(s.photo)} name={s.full_name} size={40} className={ended ? 'opacity-60' : ''} />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className={`truncate font-semibold ${ended ? 'text-slate-500' : 'text-slate-800'}`}>{s.nickname || s.full_name}</span>
                        {partialFrom(s) && <span className="flex-none rounded bg-amber-50 px-1.5 text-[11px] font-semibold text-amber-700" title={t('partialDay')}>{t('fromTime', { time: partialFrom(s) })}</span>}
                      </div>
                      <div className="truncate text-xs text-slate-500">{s.nickname ? s.full_name : ''} {s.student_code && <span className="font-mono">{s.student_code}</span>}</div>
                      {finished(s) && <div className="text-xs font-semibold text-slate-500">{t('endedRegister', { date: dayText(endDateOf(s), lang) })}</div>}
                      {trip && <div className={`flex items-center gap-1 truncate text-xs font-semibold ${away ? 'text-violet-700' : 'text-slate-400'}`}><Plane size={12} className="flex-none" /><span className="truncate">{t('traveling')}: {tripLine(trip, lang)}</span></div>}
                    </div>
                    <button type="button" aria-pressed={showNote} className={`relative grid h-11 w-11 flex-none place-items-center rounded-lg sm:order-last sm:h-9 sm:w-9 ${showNote ? 'text-pra-blue' : 'text-slate-400 hover:text-slate-600'} active:bg-slate-100`} title={t('addNote')} aria-label={t('addNote')}
                      onClick={() => setNoteOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}>
                      <MessageSquare size={18} />
                      {m?.note && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-pra-blue sm:right-1 sm:top-1" />}
                    </button>
                    {/* Phones: four big buttons on their own line under the name. */}
                    <div className="grid basis-full grid-cols-3 gap-1.5 sm:flex sm:basis-auto sm:gap-1" role="group" aria-label={s.full_name}>
                      {STATUSES.map((st) => {
                        // On a day inside a trip the Absent button reads A(T), and is lit without a mark.
                        const awayHere = away && st.key === 'absent'
                        const on = awayHere || m?.status === st.key
                        return (
                          <button key={st.key} type="button" aria-pressed={on} title={awayHere ? t('absentTravelLong') : on ? t('tapToClear') : t(st.key)} onClick={() => tap(() => setStatus(s, st.key))}
                            className={`h-11 touch-manipulation select-none rounded-lg border px-0.5 text-xs font-bold transition active:scale-95 min-[350px]:text-[13px] sm:h-9 sm:min-w-[4.5rem] sm:px-2 sm:text-sm ${awayHere ? AWAY.on : on ? st.on : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'}`}>
                            {awayHere ? t('absentTravel') : t(st.key)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {showNote && (
                    <div className="mt-2.5 space-y-2 sm:ml-[52px] sm:mt-2">
                      <input className="input text-base sm:text-xs" placeholder={t('addNote')} value={noteDraft[s.id] ?? m?.note ?? ''} autoFocus={!m?.note && !tripOpen[s.id]} enterKeyHint="done"
                        onChange={(e) => setNoteDraft((d) => ({ ...d, [s.id]: e.target.value }))} onBlur={() => saveNote(s)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                      {/* Traveling is added here: from this day, until when, and where. */}
                      {tripOpen[s.id]
                        ? <TripForm key={trip?.id || 'new'} trip={trip || blankTrip(s.id, date)} onDone={() => showTrip(s, false)} />
                        : <button type="button" className="inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-lg px-1 text-xs font-semibold text-violet-700 hover:underline" onClick={() => showTrip(s)}><Plane size={14} /> {trip ? t('changeTrip') : t('markTraveling')}</button>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      {marks && done > 0 && <p className="text-xs text-slate-400">{t('unmarkHint')}</p>}
      {marks && kids.some((s) => marks[s.id]?.taken_by) && (
        <p className="text-xs text-slate-400">{t('takenBy', { name: [...new Set(kids.map((s) => marks[s.id]?.taken_by).filter(Boolean))].join(', ') })}</p>
      )}

      {/* Phones: progress and the bulk action stay under the thumb while scrolling the class. */}
      {marks && kids.length > 0 && (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-none">
              <div className={`text-lg font-black leading-none tabular-nums ${unmarked ? 'text-slate-800' : 'text-green-700'}`}>{done}<span className="text-sm font-semibold text-slate-400">/{counted.length}</span></div>
              <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{activeGroup}</div>
            </div>
            {unmarked > 0 ? (
              <button type="button" className="btn-green h-12 flex-1 justify-center text-sm" onClick={() => tap(markRestPresent)}><CheckCheck size={18} /> {t('markAllPresent')}</button>
            ) : nextGroup ? (
              <button type="button" className="btn-primary h-12 flex-1 justify-center text-sm" onClick={() => { setGroup(nextGroup); chipsRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }}>
                <Check size={18} /> {t('nextGroup', { group: nextGroup })} <ChevronRight size={16} />
              </button>
            ) : (
              <div className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-green-50 text-sm font-bold text-green-800"><Check size={18} /> {t('allMarked', { total: counted.length })}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProgressBar({ counts, total }) {
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      {[...STATUSES, AWAY].map((st) => counts[st.key] > 0 && <div key={st.key} className={`${st.bar} transition-all duration-300`} style={{ width: `${(counts[st.key] / total) * 100}%` }} />)}
    </div>
  )
}

function Summary({ students, groups }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { calendar, travel: trips } = useData()
  const periods = useMemo(() => attendancePeriods(calendar, lang), [calendar, lang])
  const [periodKey, setPeriodKey] = useState(() => todayIso().slice(0, 7))
  const period = defaultPeriod(periods, periodKey)
  const [group, setGroup] = useState('')
  const rangeKey = period ? `${period.from}|${period.to}` : ''
  const [loaded, setLoaded] = useState({ key: null, rows: [] })
  const rows = loaded.key === rangeKey ? loaded.rows : null

  useEffect(() => {
    if (!rangeKey) return
    let alive = true
    const [from, to] = rangeKey.split('|')
    db.attendance.between(from, to)
      .then((r) => alive && setLoaded({ key: rangeKey, rows: r }))
      .catch((e) => { toast.error(e.message); if (alive) setLoaded({ key: rangeKey, rows: [] }) })
    return () => { alive = false }
  }, [rangeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Students who have left still show in the periods they were marked in (see summarizeAttendance).
  const sum = useMemo(() => (rows && period ? summarizeAttendance({ rows, students, groups: group ? [group] : groups, period, calendar, trips }) : null), [rows, students, groups, group, period, calendar, trips])
  const table = sum ? sum.groups.flatMap((x) => x.students) : null
  const byGroup = sum ? sum.groups.map((x) => ({ g: x.g, n: x.students.length, rate: x.rate, days: x.daysMarked, absences: x.absences, travel: x.travel })) : []

  if (!period) return <Empty text={t('noData')} />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {/* text-base on phones stops iOS zooming in when a select is tapped. */}
        <select className="input h-11 text-base sm:h-auto sm:w-auto sm:text-sm" value={period.key} onChange={(e) => setPeriodKey(e.target.value)} aria-label={t('period')}>
          {periods.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select className="input h-11 text-base sm:h-auto sm:w-auto sm:text-sm" value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t('yearGroup')}>
          <option value="">{t('allYearGroups')}</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <Link className="btn-secondary col-span-2 h-11 justify-center sm:order-last sm:ml-auto sm:h-auto" to={`/print/attendance?period=${period.key}${group ? `&group=${encodeURIComponent(group)}` : ''}`}><Printer size={16} /> {t('printSummary')}</Link>
        {period.days ? <span className="col-span-2 text-xs text-slate-500">{lang === 'vi' ? `${period.days} ngày học theo lịch` : `${period.days} days in the PRA calendar`}</span> : null}
      </div>

      {!table ? <Spinner /> : (<>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {byGroup.map((x) => (
            <button key={x.g} type="button" onClick={() => setGroup(group === x.g ? '' : x.g)} className={`card p-3 text-left transition-colors hover:border-pra-blue active:bg-slate-50 sm:p-4 ${group === x.g ? 'border-pra-blue ring-1 ring-pra-blue' : ''}`}>
              <div className="flex flex-col gap-x-2 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between"><span className="truncate font-bold text-slate-700">{x.g}</span><span className="text-xs text-slate-400">{x.n} · {x.days} {lang === 'vi' ? 'ngày' : x.days === 1 ? 'day' : 'days'}</span></div>
              <div className={`mt-1 text-xl font-black tabular-nums sm:text-2xl ${x.rate == null ? 'text-slate-300' : x.rate < LOW_RATE ? 'text-amber-600' : 'text-green-700'}`}>{x.rate == null ? '—' : `${x.rate}%`}</div>
              <div className="text-xs text-slate-500">{x.absences} {t('absent').toLowerCase()}{x.travel > 0 && <span className="text-violet-700" title={t('absentTravelLong')}> ({x.travel} {t('absentTravel')})</span>}</div>
            </button>
          ))}
        </div>

        {/* Phones: one card per student instead of an eight-column table. */}
        <Card className="!p-0 overflow-hidden sm:hidden">
          {!table.length ? <div className="p-4"><Empty text={t('noData')} /></div> : (
            <ul className="divide-y divide-slate-100">
              {table.map((x) => (
                <li key={x.s.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar src={photoSrc(x.s.photo)} name={x.s.full_name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5"><span className="truncate font-semibold text-slate-800">{x.s.nickname || x.s.full_name}</span>{!group && <span className="flex-none text-[11px] text-slate-400">{x.s.level}</span>}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {x.marked ? [...STATUSES, AWAY].filter((st) => x[st.key]).map((st) => <span key={st.key} className={`chip !px-2 !text-[11px] ${st.soft}`}>{st.key === TRAVEL ? t('absentTravel') : t(st.key)} {x[st.key]}</span>) : <span className="text-xs text-slate-400">{t('notMarked')}</span>}
                    </div>
                  </div>
                  <div className="flex-none text-right">
                    {x.rate == null ? <span className="text-lg text-slate-300">—</span> : (
                      <span className={`inline-flex items-center gap-1 text-lg font-black tabular-nums ${x.rate < LOW_RATE ? 'text-amber-600' : 'text-green-700'}`} title={x.rate < LOW_RATE ? t('lowAttendance') : undefined}>
                        {x.rate < LOW_RATE && <TrendingDown size={15} />}{x.rate}%
                      </span>
                    )}
                    <div className="text-[11px] tabular-nums text-slate-400">{x.marked} {lang === 'vi' ? 'ngày' : x.marked === 1 ? 'day' : 'days'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="!p-0 hidden overflow-x-auto sm:block">
          {!table.length ? <div className="p-4"><Empty text={t('noData')} /></div> : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60"><tr>
                <th className="th pl-4">{t('student')}</th><th className="th">{t('yearGroup')}</th>
                {STATUSES.map((st) => <th key={st.key} className="th text-right">{t(st.key)}</th>)}
                <th className="th text-right" title={t('absentTravelLong')}>{t('absentTravel')}</th>
                <th className="th text-right">{t('daysMarked')}</th><th className="th pr-4 text-right">{t('attendanceRate')}</th>
              </tr></thead>
              <tbody>
                {table.map((x) => (
                  <tr key={x.s.id} className="border-t border-slate-100">
                    <td className="td pl-4"><div className="flex items-center gap-2"><Avatar src={photoSrc(x.s.photo)} name={x.s.full_name} size={26} /><span className="font-semibold text-slate-800">{x.s.nickname || x.s.full_name}</span><span className="hidden font-mono text-[11px] text-slate-400 sm:inline">{x.s.student_code}</span></div></td>
                    <td className="td whitespace-nowrap text-slate-500">{x.s.level}</td>
                    {STATUSES.map((st) => <td key={st.key} className={`td text-right tabular-nums ${x[st.key] ? (st.key === 'absent' ? 'font-semibold text-red-700' : 'text-slate-700') : 'text-slate-300'}`}>{x[st.key]}</td>)}
                    <td className={`td text-right tabular-nums ${x.travel ? 'font-semibold text-violet-700' : 'text-slate-300'}`}>{x.travel}</td>
                    <td className="td text-right tabular-nums text-slate-500">{x.marked}</td>
                    <td className="td pr-4 text-right">
                      {x.rate == null ? <span className="text-slate-300">—</span> : (
                        <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${x.rate < LOW_RATE ? 'text-amber-600' : 'text-green-700'}`} title={x.rate < LOW_RATE ? t('lowAttendance') : undefined}>
                          {x.rate < LOW_RATE && <TrendingDown size={14} />}{x.rate}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </>)}
    </div>
  )
}
