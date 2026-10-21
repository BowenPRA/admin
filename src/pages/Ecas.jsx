import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, CalendarDays, CalendarRange, Check, CheckCheck, Clock, GraduationCap, Info, MapPin, MessageSquare,
  Pencil, Plane, Plus, Printer, Shapes, StickyNote, Trash2, UserPlus, UserRound, Users,
} from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { photoSrc } from '../lib/report/photo'
import { TRAVEL } from '../lib/travel'
import { LEVELS } from '../lib/fees'
import { hasLogin } from '../data/staff'
import {
  WEEKDAYS, weekdayName, weekdayShort, weekdayEvery, dayStyle, blankTerm, blankActivity, sortTerms, currentTerm, useOffDays, sessionDates,
  defaultSession, nextSession, termCalendar, termProgress, weekNumber, sessionState, yearGroupsText, levelsBetween, startText, timeText, activityName,
  teacherName, sameEmail, activitiesOf, membersOf, memberFlags, otherActivities, candidates, todayLocal, awayFromPra,
} from '../lib/eca'
import { Avatar, Card, Empty, Field, Modal, PageHeader, SearchInput, Segmented, Spinner, TextArea, TextInput } from '../components/ui'

// ECAs, the after-class activities. The page opens on the term: a card with its dates and
// where it stands, the week from Monday to Friday with each day's activities in that day's
// colour, and the term calendar with every session and whether its register was taken. Open
// an activity for its register, its list of students and a summary.
// The office and the head set up terms and activities; they and the teacher who runs an
// activity change its list and take its register. The ECA register is kept apart from the
// daily one, but a student absent from PRA that day (or traveling) shows as absent here too
// until the teacher marks them.

const STATUSES = [
  { key: 'present', on: 'bg-green-600 text-white border-green-600', soft: 'bg-green-100 text-green-800', stripe: 'shadow-[inset_4px_0_0_#16a34a]', cell: 'bg-green-100 text-green-800' },
  { key: 'late', on: 'bg-amber-500 text-white border-amber-500', soft: 'bg-amber-100 text-amber-800', stripe: 'shadow-[inset_4px_0_0_#f59e0b]', cell: 'bg-amber-100 text-amber-800' },
  { key: 'absent', on: 'bg-red-600 text-white border-red-600', soft: 'bg-red-100 text-red-700', stripe: 'shadow-[inset_4px_0_0_#dc2626]', cell: 'bg-red-100 text-red-700' },
]
const STATUS = Object.fromEntries(STATUSES.map((s) => [s.key, s]))
// Absent from PRA that day, not marked on the ECA register: lit in a lighter red, counted absent.
const AWAY = { on: 'bg-red-50 text-red-700 border-red-300', stripe: 'shadow-[inset_4px_0_0_#fca5a5]', cell: 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-200' }
const STATE_DOT = { taken: 'bg-green-500', partial: 'bg-amber-400', missing: 'bg-red-400', today: 'bg-pra-blue', future: 'bg-slate-300' }
const nameOf = (s) => s.nickname || s.full_name || ''
const dayLabel = (iso, lang, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', opts)
}
const shortDate = (iso, lang) => dayLabel(iso, lang, { day: 'numeric', month: 'short' })
const rangeText = (term, lang) => (term ? `${dayLabel(term.from_date, lang)} – ${dayLabel(term.to_date, lang)}` : '')

/** The day register for some dates, as { 'studentId|date': status }; null while it loads. */
function useDayRegister(dates) {
  const key = dates.join(',')
  const [state, setState] = useState({ key: null, map: null })
  useEffect(() => {
    let alive = true
    const wanted = key ? key.split(',') : []
    ;(wanted.length ? db.attendance.list({ date: wanted }) : Promise.resolve([]))
      .catch(() => [])
      .then((rows) => alive && setState({ key, map: Object.fromEntries(rows.map((r) => [`${r.student_id}|${r.date}`, r.status])) }))
    return () => { alive = false }
  }, [key])
  return state.key === key ? state.map : null
}

/** ECA marks for some activities; null while they load. `reload` reads them again. */
function useEcaMarks(ids) {
  const key = ids.join(',')
  const [state, setState] = useState({ key: null, rows: null })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    const wanted = key ? key.split(',') : []
    ;(wanted.length ? db.eca.attendance.list({ activity_id: wanted }) : Promise.resolve([]))
      .catch(() => [])
      .then((rows) => alive && setState({ key, rows }))
    return () => { alive = false }
  }, [key, tick])
  // Marks made on another phone show when this one is looked at again.
  useEffect(() => {
    const onShow = () => { if (document.visibilityState === 'visible') setTick((n) => n + 1) }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [])
  const rows = state.key === key ? state.rows : null
  const setRows = (fn) => setState((cur) => (cur.key === key ? { ...cur, rows: fn(cur.rows || []) } : cur))
  return [rows, setRows]
}

export default function Ecas() {
  const { t } = useT()
  const { loading, eca } = useData()
  const [params] = useSearchParams()
  const id = params.get('activity')
  const activity = id ? eca.activities.find((a) => a.id === id) : null
  if (loading) return <Spinner />
  if (id && !activity) return <div className="space-y-4"><BackLink /><Empty text={t('noData')} /></div>
  return activity ? <ActivityView key={activity.id} activity={activity} startDate={params.get('date')} /> : <Overview />
}

function BackLink({ term }) {
  const { t } = useT()
  return <Link to={term ? `/eca?term=${term}` : '/eca'} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> {t('ecaAllEcas')}</Link>
}

/** A card with a coloured icon badge in its title, as on the Home page. */
function Section({ icon: Icon, tone, title, subtitle, action, children, className = '' }) {
  return (
    <Card className={className} subtitle={subtitle} actions={action}
      title={<span className="flex items-center gap-2.5"><span className={`flex h-8 w-8 flex-none items-center justify-center rounded-xl ${tone}`}><Icon size={17} /></span>{title}</span>}>
      {children}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// The term

function Overview() {
  const { t, lang } = useT()
  const { eca, students, fees, travel: trips } = useData()
  const { isOffice, isHead } = useAuth()
  const manage = isOffice || isHead
  const [params, setParams] = useSearchParams()
  const terms = sortTerms(eca.terms)
  const term = terms.find((x) => x.id === params.get('term')) || currentTerm(eca.terms)
  const offDays = useOffDays()
  const [termModal, setTermModal] = useState(null) // a term row being edited, or a blank one
  const [activityModal, setActivityModal] = useState(null)
  const today = todayLocal()
  const list = term ? activitiesOf(eca, term.id) : []
  const [marks] = useEcaMarks(list.map((a) => a.id))
  const sessions = Object.fromEntries(list.map((a) => [a.id, offDays ? sessionDates(a, term, offDays) : []]))
  const held = [...new Set(Object.values(sessions).flat().filter((d) => d <= today))].sort()
  const daily = useDayRegister(held)

  // What the office should look at: Nursery, the wrong year group, half day, two activities, left.
  // One line per student, with every activity they are on.
  const checks = []
  if (manage) {
    list.forEach((a) => membersOf(eca, a.id, students).forEach(({ m, s }) => {
      const flags = memberFlags(s, a, { eca, day: today }).filter((f) => f !== 'ecaFlagHalfDay' || m.status !== 'waiting')
      let x = checks.find((c) => c.s.id === s.id)
      if (!x) checks.push(x = { s, acts: [], flags: [] })
      x.acts.push(a)
      flags.forEach((f) => { if (!x.flags.includes(f)) x.flags.push(f) })
    }))
  }
  const toCheck = checks.filter((x) => x.flags.length)

  // How each session's register stands: marks made, plus students away from PRA that day.
  const stateOf = (a, date) => {
    const joined = membersOf(eca, a.id, students).filter((x) => x.m.status === 'joined')
    const marked = new Set((marks || []).filter((r) => r.activity_id === a.id && r.date === date).map((r) => r.student_id))
    const covered = joined.filter(({ s }) => marked.has(s.id) || (date <= today && awayFromPra(daily, trips, s.id, date))).length
    return { state: sessionState(date, covered, joined.length, today), covered, size: joined.length }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title={t('ecaTitle')} subtitle={t('ecaPageSub')}>
        {terms.length > 1 && (
          <select className="input w-auto" value={term?.id || ''} onChange={(e) => setParams({ term: e.target.value }, { replace: true })} aria-label={t('ecaTerm')}>
            {terms.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.school_year}</option>)}
          </select>
        )}
        {term && list.length > 0 && <Link className="btn-secondary" to={`/print/eca?term=${term.id}`}><Printer size={16} /> {t('ecaPrintAll')}</Link>}
        {manage && term && <button className="btn-secondary" onClick={() => setActivityModal(blankActivity(term.id))}><Plus size={16} /> {t('ecaAddActivity')}</button>}
        {manage && <button className="btn-primary" onClick={() => setTermModal(blankTerm(fees?.schoolYear || term?.school_year, term))}><Plus size={16} /> {t('ecaNewTerm')}</button>}
      </PageHeader>

      {!eca.ready && manage && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">{t('ecaSetup')}</p>}

      {!term ? <Empty text={`${t('ecaNoTerms')} ${manage ? t('ecaNoTermsOffice') : ''}`} /> : (<>
        <TermCard term={term} list={list} manage={manage} onEdit={() => setTermModal(term)} />
        <WeekBoard term={term} list={list} sessions={sessions} ready={!!offDays} />
        {list.length > 0 && <TermCalendar term={term} list={list} offDays={offDays} stateOf={marks && daily ? stateOf : null} />}

        {toCheck.length > 0 && (
          <Section icon={AlertTriangle} tone="bg-amber-100 text-amber-700" title={t('ecaChecksTitle')} subtitle={t('ecaChecksSub')}>
            <ul className="divide-y divide-slate-100 text-sm">
              {toCheck.map(({ s, acts, flags }) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-2">
                  <Avatar src={photoSrc(s.photo)} name={s.full_name} size={28} />
                  <span className="font-semibold text-slate-800">{nameOf(s)}</span><span className="text-xs text-slate-400">{s.level}</span>
                  {flags.map((f) => (
                    <span key={f} className={`chip !text-[11px] ${f === 'ecaFlagNursery' || f === 'ecaFlagLeft' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{f === 'ecaFlagTwo' ? t('ecaFlagOnN', { n: acts.length }) : t(f)}</span>
                  ))}
                  <span className="flex flex-wrap gap-1 sm:ml-auto">
                    {acts.map((a) => (
                      <Link key={a.id} to={`/eca?activity=${a.id}`} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-semibold ${dayStyle(a.weekday).soft} ${dayStyle(a.weekday).hover}`}>
                        {weekdayShort(a.weekday, lang)} · {activityName(a, lang)}
                      </Link>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </>)}

      {termModal && <TermModal term={termModal} terms={terms} onClose={() => setTermModal(null)} onSaved={(id) => setParams({ term: id }, { replace: true })} />}
      {activityModal && <ActivityModal activity={activityModal} onClose={() => setActivityModal(null)} />}
    </div>
  )
}

const DayDot = ({ weekday, className = '' }) => <span className={`inline-block h-2.5 w-2.5 flex-none rounded-full ${dayStyle(weekday).dot} ${className}`} />

/** The term at a glance: its dates and times, where it stands, and how many take part. */
function TermCard({ term, list, manage, onEdit }) {
  const { t, lang } = useT()
  const { eca } = useData()
  const p = termProgress(term)
  const people = new Set((eca.members || []).filter((m) => m.status === 'joined' && list.some((a) => a.id === m.activity_id)).map((m) => m.student_id)).size
  const chip = !p ? null
    : p.state === 'before' ? <span className="chip bg-sky-100 text-sky-800">{p.days === 1 ? t('ecaStartsTomorrow') : t('ecaStartsIn', { n: p.days })}</span>
    : p.state === 'during' ? <span className="chip bg-green-100 text-green-800">{t('ecaWeekOf', { n: p.week, total: p.weeks })}</span>
    : <span className="chip bg-slate-100 text-slate-600">{t('ecaTermOver')}</span>
  const pct = !p ? 0 : p.state === 'after' ? 100 : p.state === 'during' ? Math.round((p.week / p.weeks) * 100) : 0
  const stat = (label, value) => (
    <div className="min-w-[4.5rem]">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-2xl font-black tabular-nums leading-tight text-slate-800">{value}</dd>
    </div>
  )
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex min-w-0 items-start gap-3 lg:flex-1">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Shapes size={22} /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black tracking-tight text-slate-800">{term.name}</h2>
              {term.school_year && <span className="text-sm text-slate-400">{term.school_year}</span>}
              {chip}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5"><CalendarRange size={15} className="text-slate-400" />{rangeText(term, lang)}</span>
              <span className="inline-flex items-center gap-1.5"><Clock size={15} className="text-slate-400" />{timeText(term, lang)}</span>
              {term.note && <span className="inline-flex items-center gap-1.5"><Info size={15} className="text-slate-400" />{term.note}</span>}
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 sm:flex sm:gap-8">
          {stat(t('ecaStatActivities'), list.length)}
          {stat(t('ecaStatStudents'), people)}
          {stat(t('ecaStatWeeks'), p?.weeks ?? '—')}
        </dl>
        {manage && <button className="btn-secondary self-start lg:self-center" onClick={onEdit}><Pencil size={15} /> {t('ecaEditTerm')}</button>}
      </div>
      <div className="h-1.5 bg-slate-100"><div className="h-full bg-pra-green transition-all" style={{ width: `${pct}%` }} /></div>
    </section>
  )
}

/** Monday to Friday side by side, each day's activities in that day's colour. */
function WeekBoard({ term, list, sessions, ready }) {
  const { t, lang } = useT()
  const { eca, students, teachers } = useData()
  const { me } = useAuth()
  const today = todayLocal()
  const running = today >= term.from_date && today <= term.to_date
  const todayDow = ((new Date().getDay() + 6) % 7) + 1
  const byDay = WEEKDAYS.map((w) => ({ ...w, acts: list.filter((a) => Number(a.weekday) === w.n) }))
  const empty = byDay.filter((d) => !d.acts.length)
  // Days with activities take more room than days without.
  const cols = byDay.map((d) => (d.acts.length ? 'minmax(0,1fr)' : 'minmax(0,0.6fr)')).join(' ')

  return (
    <Section icon={CalendarDays} tone="bg-sky-100 text-sky-700" title={t('ecaWeek')} subtitle={t('ecaWeekSub')}>
      <div className="grid gap-3 lg:[grid-template-columns:var(--cols)]" style={{ '--cols': cols }}>
        {byDay.map((d) => {
          const st = dayStyle(d.n)
          const isToday = running && todayDow === d.n
          const next = d.acts.length && ready ? nextSession(sessions[d.acts[0].id] || [], today) : null
          return (
            <div key={d.n} className={`min-w-0 ${d.acts.length ? '' : 'hidden lg:block'}`}>
              <div className={`mb-2 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${isToday ? 'bg-green-100 text-green-800' : 'bg-slate-50 text-slate-600'}`}>
                <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-bold"><DayDot weekday={d.n} />{lang === 'vi' ? d.vi : d.en}</span>
                {isToday ? <span className="text-[11px] font-bold uppercase">{t('today')}</span> : next ? <span className="whitespace-nowrap text-[11px] text-slate-500">{shortDate(next, lang)}</span> : null}
              </div>
              <div className="space-y-2">
                {d.acts.map((a) => {
                  const people = membersOf(eca, a.id, students)
                  const joined = people.filter((x) => x.m.status === 'joined').length
                  const waiting = people.length - joined
                  return (
                    <Link key={a.id} to={`/eca?activity=${a.id}`} className={`group block rounded-xl border p-3 transition hover:shadow-sm ${st.soft} ${st.hover}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold leading-tight">{activityName(a, lang)}</span>
                        {sameEmail(a.teacher_email, me?.email) && <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${st.solid}`}>{t('ecaYours')}</span>}
                      </div>
                      {lang !== 'vi' && a.name_vi && <div className="text-xs opacity-60">{a.name_vi}</div>}
                      <div className="mt-2 space-y-0.5 text-xs opacity-80">
                        <div className="flex items-center gap-1.5"><UserRound size={13} className="flex-none" /><span className="truncate">{teacherName(a.teacher_email, teachers) || '—'}</span></div>
                        <div className="flex items-center gap-1.5"><GraduationCap size={13} className="flex-none" /><span className="truncate">{yearGroupsText(a.year_groups, lang)}</span></div>
                        <div className="flex items-center gap-1.5"><Users size={13} className="flex-none" /><span>{t('ecaCount', { n: joined })}{waiting > 0 ? ` · ${t('ecaWaitingN', { n: waiting })}` : ''}</span></div>
                      </div>
                    </Link>
                  )
                })}
                {!d.acts.length && <div className="flex min-h-[6.5rem] items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">{t('ecaNoEca')}</div>}
              </div>
            </div>
          )
        })}
      </div>
      {/* Phones: the days with no activity, in one line. */}
      {empty.length > 0 && empty.length < 5 && <p className="mt-3 text-xs text-slate-400 lg:hidden">{t('ecaNoEcaOn', { days: empty.map((d) => (lang === 'vi' ? d.vi : d.en)).join(', ') })}</p>}
    </Section>
  )
}

/** The term week by week: each week's activities, and whether each register was taken. */
function TermCalendar({ term, list, offDays, stateOf }) {
  const { t, lang } = useT()
  const today = todayLocal()
  if (!offDays) return null
  const { days, weeks } = termCalendar(term, list, offDays)
  return (
    <Section icon={CalendarRange} tone="bg-indigo-100 text-indigo-700" title={t('ecaCalendar')} subtitle={t('ecaCalendarSub')}>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="border-separate border-spacing-0 text-sm">
          <thead><tr>
            <th className="pb-1.5 pl-2 pr-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:pr-5">{t('ecaWeekCol')}</th>
            {days.map((w) => <th key={w} className="pb-1.5 pr-3 text-left sm:pr-6"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600"><DayDot weekday={w} />{weekdayName(w, lang)}</span></th>)}
          </tr></thead>
          <tbody>
            {weeks.map((wk) => {
              const current = today >= wk.monday && today <= wk.sunday
              const cell = `border-t border-slate-100 py-1 align-top sm:align-middle ${current ? 'bg-green-50' : ''}`
              return (
                <tr key={wk.n}>
                  <td className={`${cell} whitespace-nowrap pl-2 pr-2 sm:pr-5 ${current ? 'rounded-l-lg' : ''}`}>
                    <span className={`text-xs font-semibold ${current ? 'text-green-800' : 'text-slate-600'}`}>
                      <span className="sm:hidden">{t('ecaWeekShort', { n: wk.n })}</span><span className="hidden sm:inline">{t('ecaWeekN', { n: wk.n })}</span>
                    </span>
                    {current && <span className="ml-1.5 hidden rounded-full bg-green-600 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white sm:inline">{t('ecaThisWeek')}</span>}
                  </td>
                  {wk.cells.map((c, i) => (
                    <td key={c.weekday} className={`${cell} pr-3 sm:pr-6 ${current && i === wk.cells.length - 1 ? 'rounded-r-lg' : ''}`}>
                      {!c.inTerm ? <span className="text-xs text-slate-300">—</span> : (
                        // Phones: the date over the activities; wider screens: one line.
                        <div className="flex flex-wrap items-center gap-1 sm:flex-nowrap sm:gap-1.5 sm:whitespace-nowrap">
                          <span className={`w-full text-[11px] tabular-nums sm:w-11 sm:flex-none ${c.date === today ? 'font-bold text-green-700' : 'text-slate-400'}`}>{shortDate(c.date, lang)}</span>
                          {c.closed ? <span className="text-[11px] italic text-slate-400">{t('ecaClosed')}</span>
                            : c.activities.map((a) => <SessionPill key={a.id} a={a} date={c.date} info={stateOf?.(a, c.date)} />)}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1"><Check size={12} className="text-green-600" /> {t('ecaLegendTaken')}</span>
        <span className="inline-flex items-center gap-1"><span className="font-bold text-amber-600">3/6</span> {t('ecaLegendPartial')}</span>
        <span className="inline-flex items-center gap-1"><AlertTriangle size={12} className="text-red-500" /> {t('ecaLegendMissing')}</span>
      </div>
    </Section>
  )
}

function SessionPill({ a, date, info }) {
  const { lang, t } = useT()
  const st = dayStyle(a.weekday)
  const s = info?.state
  return (
    <Link to={`/eca?activity=${a.id}&date=${date}`} title={s ? t(`ecaState_${s}`) : undefined}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold transition hover:shadow-sm ${st.soft} ${st.hover} ${s === 'today' ? 'ring-2 ring-green-500' : ''}`}>
      {activityName(a, lang)}
      {s === 'taken' && <Check size={12} className="flex-none text-green-600" />}
      {s === 'partial' && <span className="flex-none font-bold text-amber-600">{info.covered}/{info.size}</span>}
      {s === 'missing' && info.size > 0 && <AlertTriangle size={12} className="flex-none text-red-500" />}
    </Link>
  )
}

/** The flags on a student, as small chips. */
function Flags({ flags, s, a }) {
  const { t, lang } = useT()
  const { eca } = useData()
  return flags.map((f) => (
    <span key={f} className={`chip !text-[11px] ${f === 'ecaFlagNursery' || f === 'ecaFlagLeft' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
      {f === 'ecaFlagTwo' ? t('ecaFlagTwo', { names: otherActivities(s, a, eca).map((x) => activityName(x, lang)).join(', ') }) : t(f)}
    </span>
  ))
}

// ---------------------------------------------------------------------------
// Setting up terms and activities (office and head)

function TermModal({ term, terms, onClose, onSaved }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { eca, refreshEca } = useData()
  const isNew = !term.id
  const [f, setF] = useState(term)
  const [copyFrom, setCopyFrom] = useState(() => (isNew ? terms[0]?.id || '' : ''))
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const count = isNew ? 0 : activitiesOf(eca, term.id).length
  const ok = f.name.trim() && f.from_date && f.to_date && f.to_date >= f.from_date && f.start_time && f.end_time

  const save = async () => {
    setBusy(true)
    try {
      const row = await db.eca.terms.save({ ...f, name: f.name.trim(), note: (f.note || '').trim() || null })
      // A new term can start with the last one's activities (not their students).
      if (isNew && copyFrom) {
        for (const a of activitiesOf(eca, copyFrom)) {
          const copy = { ...a, term_id: row.id }
          delete copy.id; delete copy.created_at; delete copy.updated_at
          await db.eca.activities.save(copy)
        }
      }
      await refreshEca()
      toast(t('ecaSaved'))
      onSaved?.(row.id)
      onClose()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!confirm(t('ecaDeleteTermConfirm', { name: term.name, n: count }))) return
    setBusy(true)
    try { await db.eca.terms.remove(term.id); await refreshEca(); onClose() } catch (e) { toast.error(e.message); setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? t('ecaNewTerm') : t('ecaEditTerm')}
      footer={<>
        {!isNew && <button className="btn-ghost mr-auto text-red-600" disabled={busy} onClick={remove}><Trash2 size={15} /> {t('ecaDeleteTerm')}</button>}
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" disabled={!ok || busy} onClick={save}>{t('save')}</button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('ecaTermName')} hint={t('ecaTermNameHint')}><TextInput value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label={t('ecaSchoolYear')}><TextInput value={f.school_year || ''} onChange={set('school_year')} /></Field>
        <Field label={t('ecaFrom')}><input type="date" className="input" value={f.from_date || ''} onChange={(e) => set('from_date')(e.target.value)} /></Field>
        <Field label={t('ecaTo')}><input type="date" className="input" value={f.to_date || ''} onChange={(e) => set('to_date')(e.target.value)} /></Field>
        <Field label={t('ecaStart')}><input type="time" className="input" value={f.start_time || ''} onChange={(e) => set('start_time')(e.target.value)} /></Field>
        <Field label={t('ecaEnd')}><input type="time" className="input" value={f.end_time || ''} onChange={(e) => set('end_time')(e.target.value)} /></Field>
        <Field className="sm:col-span-2" label={t('ecaNote')} hint={t('ecaNoteHint')}><TextInput value={f.note || ''} onChange={set('note')} /></Field>
        {isNew && terms.length > 0 && (
          <Field className="sm:col-span-2" label={t('ecaCopyFrom')} hint={t('ecaCopyHint')}>
            <select className="input" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              <option value="">{t('ecaCopyNone')}</option>
              {terms.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.school_year} ({activitiesOf(eca, x.id).map((a) => activityName(a, lang)).join(', ') || '—'})</option>)}
            </select>
          </Field>
        )}
      </div>
    </Modal>
  )
}

function ActivityModal({ activity, onClose }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { eca, teachers, refreshEca } = useData()
  const isNew = !activity.id
  const [f, setF] = useState(activity)
  const groups = f.year_groups || []
  const [fromLevel, setFromLevel] = useState(() => LEVELS.find((l) => groups.includes(l)) || '')
  const [toLevel, setToLevel] = useState(() => { const last = [...LEVELS].reverse().find((l) => groups.includes(l)); return last && last !== LEVELS.at(-1) ? last : '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const staff = teachers.filter((x) => hasLogin(x) && x.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name)))
  const yearGroups = fromLevel ? levelsBetween(fromLevel, toLevel) : []
  const people = isNew ? 0 : (eca.members || []).filter((m) => m.activity_id === activity.id).length
  const ok = f.name.trim() && f.weekday

  const save = async () => {
    setBusy(true)
    try {
      await db.eca.activities.save({ ...f, name: f.name.trim(), name_vi: (f.name_vi || '').trim() || null, teacher_email: f.teacher_email || null, year_groups: yearGroups, weekday: Number(f.weekday) })
      await refreshEca()
      toast(t('ecaSaved'))
      onClose()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!confirm(t('ecaDeleteActivityConfirm', { name: activityName(activity, lang), n: people }))) return
    setBusy(true)
    try { await db.eca.activities.remove(activity.id); await refreshEca(); onClose() } catch (e) { toast.error(e.message); setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? t('ecaAddActivity') : t('ecaEditActivity')}
      footer={<>
        {!isNew && <button className="btn-ghost mr-auto text-red-600" disabled={busy} onClick={remove}><Trash2 size={15} /> {t('ecaDeleteActivity')}</button>}
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" disabled={!ok || busy} onClick={save}>{t('save')}</button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('ecaActivityName')}><TextInput value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label={t('ecaActivityNameVi')}><TextInput value={f.name_vi || ''} onChange={set('name_vi')} /></Field>
        <Field label={t('ecaDay')} className="sm:col-span-2">
          <div className="flex flex-wrap gap-1.5" role="group">
            {WEEKDAYS.map((w) => {
              const on = Number(f.weekday) === w.n
              return (
                <button key={w.n} type="button" aria-pressed={on} onClick={() => set('weekday')(w.n)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold transition ${on ? dayStyle(w.n).solid + ' border-transparent' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}>
                  {!on && <DayDot weekday={w.n} />}{lang === 'vi' ? w.vi : w.en}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label={t('ecaTeacher')}>
          <select className="input" value={f.teacher_email || ''} onChange={(e) => set('teacher_email')(e.target.value)}>
            <option value="">{t('ecaNoTeacher')}</option>
            {staff.map((x) => <option key={x.id} value={x.email}>{x.title ? `${x.title} ` : ''}{x.name}</option>)}
          </select>
        </Field>
        <Field label={t('ecaRoom')}><TextInput value={f.room || ''} onChange={set('room')} /></Field>
        <Field label={t('ecaYearsFrom')}>
          <select className="input" value={fromLevel} onChange={(e) => setFromLevel(e.target.value)}>
            <option value="">{t('ecaAnyYear')}</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
        <Field label={t('ecaYearsTo')}>
          <select className="input" value={toLevel} disabled={!fromLevel} onChange={(e) => setToLevel(e.target.value)}>
            <option value="">{t('ecaAndUp')}</option>
            {LEVELS.filter((l) => !fromLevel || LEVELS.indexOf(l) >= LEVELS.indexOf(fromLevel)).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
        <p className="-mt-1 text-xs text-slate-500 sm:col-span-2">{t('ecaOpenTo', { groups: yearGroupsText(yearGroups, lang) })}</p>
        <Field className="sm:col-span-2" label={t('ecaDescription')}><TextArea rows={3} value={f.description || ''} onChange={set('description')} /></Field>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// One activity: register, students, summary

function ActivityView({ activity, startDate }) {
  const { t, lang } = useT()
  const { eca, students, teachers, travel: trips } = useData()
  const { isOffice, isHead, me } = useAuth()
  const manage = isOffice || isHead
  const canRun = manage || sameEmail(activity.teacher_email, me?.email)
  const term = eca.terms.find((x) => x.id === activity.term_id)
  const offDays = useOffDays()
  const sessions = offDays ? sessionDates(activity, term, offDays) : null
  const today = todayLocal()
  const held = (sessions || []).filter((d) => d <= today)
  const [rows, setRows] = useEcaMarks([activity.id])
  const daily = useDayRegister(held)
  const list = membersOf(eca, activity.id, students)
  const joined = list.filter((x) => x.m.status === 'joined')
  const waiting = list.length - joined.length
  const [tab, setTab] = useState(() => (list.length ? 'register' : 'students'))
  const [edit, setEdit] = useState(false)
  const st = dayStyle(activity.weekday)
  const teacher = teacherName(activity.teacher_email, teachers)

  // A student's state at a session: their ECA mark, else absent if away from PRA that day.
  const markOf = (sid, date) => rows?.find((r) => r.student_id === sid && r.date === date)
  // The day register is only read for sessions held; a trip shows ahead of time, as on the daily register.
  const awayOn = (sid, date) => awayFromPra(date <= today ? daily : null, trips, sid, date)
  const ready = !!(sessions && rows && daily)
  const came = ready ? joined.reduce((n, { s }) => n + held.filter((d) => ['present', 'late'].includes(markOf(s.id, d)?.status)).length, 0) : 0
  const possible = joined.length * held.length

  const tabs = [{ value: 'register', label: t('ecaRegister') }, { value: 'students', label: `${t('ecaStudents')} · ${joined.length}` }, { value: 'summary', label: t('ecaSummary') }]
  const stat = (icon, label, value, hint) => (
    <div className="card flex items-center gap-3 p-3 sm:p-4">
      <span className={`hidden h-10 w-10 flex-none items-center justify-center rounded-xl sm:flex ${st.soft} border`}>{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-xl font-black tabular-nums leading-tight text-slate-800">{value}</div>
        {hint && <div className="truncate text-xs text-slate-500">{hint}</div>}
      </div>
    </div>
  )

  return (
    <div className="space-y-4 sm:space-y-5">
      <BackLink term={activity.term_id} />
      <div className="flex flex-wrap items-start gap-3 sm:gap-4">
        <div className={`flex h-14 w-14 flex-none flex-col items-center justify-center rounded-2xl shadow-sm sm:h-16 sm:w-16 ${st.solid}`}>
          <span className="text-[11px] font-bold uppercase tracking-wider opacity-90">{weekdayShort(activity.weekday, lang)}</span>
          <span className="text-sm font-black leading-tight sm:text-base">{startText(term, lang)}</span>
        </div>
        <div className="min-w-[12rem] flex-1">
          <h1 className="text-2xl font-black tracking-tight text-slate-800">{activityName(activity, lang)}</h1>
          {(lang === 'vi' ? activity.name : activity.name_vi) && <div className="text-sm text-slate-400">{lang === 'vi' ? activity.name : activity.name_vi}</div>}
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            <span className={`inline-flex items-center gap-1.5 font-semibold ${st.text}`}><Clock size={15} />{weekdayEvery(activity.weekday, lang)} · {timeText(term, lang)}</span>
            <span className="inline-flex items-center gap-1.5"><UserRound size={15} className="text-slate-400" />{teacher || '—'}</span>
            <span className="inline-flex items-center gap-1.5"><GraduationCap size={15} className="text-slate-400" />{yearGroupsText(activity.year_groups, lang)}</span>
            {activity.room && <span className="inline-flex items-center gap-1.5"><MapPin size={15} className="text-slate-400" />{activity.room}</span>}
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link className="btn-secondary" to={`/print/eca?activity=${activity.id}`}><Printer size={16} /> {t('ecaPrint')}</Link>
          {manage && <button className="btn-secondary" onClick={() => setEdit(true)}><Pencil size={15} /> {t('ecaEditActivity')}</button>}
        </div>
      </div>
      {activity.description && <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{activity.description}</p>}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {stat(<Users size={19} />, t('ecaStatOnList'), joined.length, waiting ? t('ecaWaitingN', { n: waiting }) : term?.note || '')}
        {stat(<CalendarRange size={19} />, t('ecaStatWeeksHeld'), sessions ? `${held.length}/${sessions.length}` : '…', sessions ? (nextSession(sessions, today) === today ? t('ecaNextToday') : nextSession(sessions, today) ? t('ecaNext', { date: dayLabel(nextSession(sessions, today), lang) }) : t('ecaFinished')) : '')}
        {stat(<Check size={19} />, t('ecaStatCame'), ready && possible ? `${Math.round((came / possible) * 100)}%` : '—', ready && possible ? t('ecaCameOf', { n: came, total: possible }) : t('ecaNoneYet'))}
      </div>

      <Segmented className="flex w-full sm:inline-flex sm:w-auto [&>button]:flex-1 [&>button]:whitespace-nowrap [&>button]:py-2 sm:[&>button]:py-1" value={tab} onChange={setTab} options={tabs} />
      {!ready ? <Spinner /> : tab === 'register'
        ? <Register activity={activity} term={term} joined={joined.map((x) => x.s)} sessions={sessions} rows={rows} setRows={setRows} awayOn={awayOn} canRun={canRun} teacher={teacher} startDate={startDate} />
        : tab === 'students' ? <StudentList activity={activity} list={list} canRun={canRun} />
        : <Summary term={term} joined={joined.map((x) => x.s)} sessions={sessions} rows={rows} awayOn={awayOn} />}
      {edit && <ActivityModal activity={activity} onClose={() => setEdit(false)} />}
    </div>
  )
}

function Register({ activity, term, joined: kids, sessions, rows, setRows, awayOn, canRun, teacher, startDate }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { displayName } = useAuth()
  const today = todayLocal()
  const [day, setDay] = useState(() => (sessions.includes(startDate) ? startDate : defaultSession(sessions, today)))
  const [noteOpen, setNoteOpen] = useState({})
  const [noteDraft, setNoteDraft] = useState({})

  if (!sessions.length) return <Empty text={t('ecaNoSessions')} />
  const marks = Object.fromEntries(rows.filter((r) => r.date === day).map((r) => [r.student_id, r]))
  const away = (s) => awayOn(s.id, day)
  // What a student counts as at this session: their mark, else absent when away from PRA.
  const stateOf = (s) => marks[s.id]?.status || (away(s) ? 'away' : null)
  const put = (list) => setRows((all) => {
    const n = all.filter((r) => !list.some((x) => x.student_id === r.student_id && x.date === r.date))
    return [...n, ...list]
  })

  const save = async (changes) => {
    const before = changes.map((r) => marks[r.student_id]).filter(Boolean)
    const full = changes.map((r) => ({ activity_id: activity.id, date: day, taken_by: displayName, ...r }))
    put(full.map((r) => ({ ...(marks[r.student_id] || {}), ...r })))
    try {
      put(await db.eca.attendance.mark(full))
      return true
    } catch (e) {
      setRows((all) => [...all.filter((r) => !(r.date === day && changes.some((x) => x.student_id === r.student_id))), ...before])
      toast.error(e.message)
      return false
    }
  }
  // Tapping the lit mark again takes it off.
  const clear = async (s) => {
    const row = marks[s.id]
    setRows((all) => all.filter((r) => !(r.date === day && r.student_id === s.id)))
    try { if (row?.id) await db.eca.attendance.clear(row.id) } catch (e) { put([row]); toast.error(e.message) }
  }
  const setStatus = (s, status) => {
    if (marks[s.id]?.status === status) return clear(s)
    // Already counted absent (away from PRA): there is nothing to mark.
    if (status === 'absent' && !marks[s.id] && away(s)) return
    const note = !marks[s.id] ? (noteDraft[s.id] || '').trim() : ''
    return save([{ student_id: s.id, status, ...(note ? { note } : {}) }])
  }
  const saveNote = (s) => {
    if (!marks[s.id]) return
    const note = (noteDraft[s.id] ?? marks[s.id].note ?? '').trim()
    if (note === (marks[s.id].note || '')) return
    save([{ student_id: s.id, status: marks[s.id].status, note: note || null }])
  }
  // Students away from PRA are already counted absent, so they are left as they are.
  const markRest = async () => {
    const rest = kids.filter((s) => !stateOf(s))
    if (rest.length && await save(rest.map((s) => ({ student_id: s.id, status: 'present' })))) toast(t('ecaSaved'))
  }

  const counts = { present: 0, late: 0, absent: 0 }
  kids.forEach((s) => { const st = stateOf(s); if (st) counts[st === 'away' ? 'absent' : st]++ })
  const unmarked = kids.filter((s) => !stateOf(s)).length
  const sessionInfo = (d) => {
    const n = kids.filter((s) => rows.some((r) => r.date === d && r.student_id === s.id) || awayOn(s.id, d)).length
    return sessionState(d, n, kids.length, today)
  }

  return (
    <div className="space-y-3 pb-24 sm:space-y-4 sm:pb-0">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:gap-1.5 sm:px-0">
        {sessions.map((d) => {
          const on = d === day
          const state = sessionInfo(d)
          return (
            <button key={d} type="button" aria-pressed={on} onClick={() => setDay(d)} title={t(`ecaState_${state}`)}
              className={`flex h-10 flex-none items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition-colors sm:h-auto sm:py-1 ${on ? 'border-pra-blue bg-pra-blue text-white' : d === today ? 'border-pra-blue bg-white text-pra-blue' : d > today ? 'border-slate-200 bg-white text-slate-400' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}>
              <span className={`h-2 w-2 flex-none rounded-full ${on ? 'bg-white/80' : STATE_DOT[state]}`} />
              <span className="opacity-70">{t('ecaWeekShort', { n: weekNumber(term, d) })}</span>
              {dayLabel(d, lang, { day: 'numeric', month: 'short' })}
            </button>
          )
        })}
      </div>
      <p className="text-sm font-semibold text-slate-600">{dayLabel(day, lang, { weekday: 'long', day: 'numeric', month: 'long' })} · {t('ecaWeekOf', { n: weekNumber(term, day), total: termProgress(term)?.weeks ?? sessions.length })}{day > today && <span className="font-normal text-slate-400"> · {t('ecaFuture')}</span>}</p>
      {!canRun && <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">{t('ecaNotYours', { teacher: teacher || '—' })}</p>}

      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-3 py-3 sm:gap-2 sm:px-4">
          {STATUSES.map((st) => <span key={st.key} className={`chip ${st.soft} ${counts[st.key] ? '' : 'opacity-60'}`}>{t(st.key)} · {counts[st.key]}</span>)}
          {unmarked > 0 && <span className="chip bg-slate-100 text-slate-600">{t('notMarked')} · {unmarked}</span>}
          {canRun && <button className="btn-green ml-auto hidden !py-1.5 text-xs sm:inline-flex" disabled={!unmarked} onClick={markRest}><CheckCheck size={15} /> {t('markAllPresent')}</button>}
        </div>
        {!kids.length ? <div className="p-4"><Empty text={t('ecaEmptyList')} /></div> : (
          <ul className="divide-y divide-slate-100">
            {kids.map((s) => {
              const m = marks[s.id]
              const state = stateOf(s)
              const why = away(s)
              const showNote = noteOpen[s.id] || !!m?.note
              return (
                <li key={s.id} className={`px-3 py-3 sm:px-4 sm:py-2.5 ${state === 'away' ? AWAY.stripe : state ? STATUS[state].stripe : 'bg-amber-50/40'}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                    <Avatar src={photoSrc(s.photo)} name={s.full_name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-800">{nameOf(s)} <span className="text-xs font-normal text-slate-400">{s.level}</span></div>
                      {s.nickname && <div className="truncate text-xs text-slate-500">{s.full_name}</div>}
                      {why && (
                        <div className={`flex items-center gap-1 text-xs font-semibold ${why === TRAVEL ? 'text-violet-700' : 'text-red-700'}`}>
                          {why === TRAVEL && <Plane size={12} />}
                          {why === TRAVEL ? t('ecaAwayTravel') : t('ecaAwayDay')}{m && m.status !== 'absent' ? ` · ${t('ecaCameAnyway')}` : ''}
                        </div>
                      )}
                    </div>
                    <button type="button" aria-pressed={showNote} className={`relative grid h-11 w-11 flex-none place-items-center rounded-lg sm:order-last sm:h-9 sm:w-9 ${showNote ? 'text-pra-blue' : 'text-slate-400 hover:text-slate-600'}`} title={t('addNote')} aria-label={t('addNote')}
                      onClick={() => setNoteOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}>
                      <MessageSquare size={18} />
                      {m?.note && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-pra-blue sm:right-1 sm:top-1" />}
                    </button>
                    <div className="grid basis-full grid-cols-3 gap-1.5 sm:flex sm:basis-auto sm:gap-1" role="group" aria-label={s.full_name}>
                      {STATUSES.map((st) => {
                        const awayHere = state === 'away' && st.key === 'absent'
                        const on = awayHere || m?.status === st.key
                        return (
                          <button key={st.key} type="button" aria-pressed={on} disabled={!canRun} onClick={() => setStatus(s, st.key)}
                            title={awayHere ? t('ecaAwayHint') : undefined}
                            className={`h-11 touch-manipulation select-none rounded-lg border px-0.5 text-xs font-bold transition active:scale-95 disabled:cursor-default disabled:active:scale-100 min-[350px]:text-[13px] sm:h-9 sm:min-w-[4.5rem] sm:px-2 sm:text-sm ${awayHere ? AWAY.on : on ? st.on : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'}`}>
                            {t(st.key)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {showNote && (
                    <div className="mt-2.5 sm:ml-[52px] sm:mt-2">
                      <input className="input text-base sm:text-xs" placeholder={m ? t('addNote') : t('ecaNoteNeedsMark')} disabled={!canRun || !m} value={noteDraft[s.id] ?? m?.note ?? ''} enterKeyHint="done"
                        onChange={(e) => setNoteDraft((d) => ({ ...d, [s.id]: e.target.value }))} onBlur={() => saveNote(s)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <p className="text-xs text-slate-400">{t('ecaAwayExplain')}</p>
      {kids.some((s) => marks[s.id]?.taken_by) && (
        <p className="text-xs text-slate-400">{t('takenBy', { name: [...new Set(kids.map((s) => marks[s.id]?.taken_by).filter(Boolean))].join(', ') })}</p>
      )}

      {/* Phones: the bulk action stays under the thumb. */}
      {canRun && kids.length > 0 && (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
          {unmarked > 0
            ? <button type="button" className="btn-green h-12 w-full justify-center text-sm" onClick={markRest}><CheckCheck size={18} /> {t('markAllPresent')}</button>
            : <div className="flex h-12 items-center justify-center gap-2 rounded-lg bg-green-50 text-sm font-bold text-green-800"><Check size={18} /> {t('allMarked', { total: kids.length })}</div>}
        </div>
      )}
    </div>
  )
}

/** A note on a student's place on the list: shown as text, edited in place. */
function NoteField({ value, canEdit, onSave }) {
  const { t } = useT()
  const [draft, setDraft] = useState(null)
  if (draft !== null) {
    const done = (keep) => { if (keep && draft.trim() !== (value || '')) onSave(draft.trim()); setDraft(null) }
    return <input autoFocus className="input mt-1.5 !py-1 text-xs" placeholder={t('ecaNoteFor')} value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={() => done(true)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') done(false) }} />
  }
  if (value) return <button type="button" disabled={!canEdit} onClick={() => setDraft(value)} className="mt-0.5 inline-flex max-w-full items-start gap-1 text-left text-xs text-slate-600 enabled:hover:text-pra-blue"><StickyNote size={12} className="mt-0.5 flex-none text-slate-400" /><span>{value}</span></button>
  return canEdit ? <button type="button" onClick={() => setDraft('')} className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-pra-blue"><Plus size={12} /> {t('ecaAddNote')}</button> : null
}

function StudentList({ activity, list, canRun }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { eca, refreshEca } = useData()
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const today = todayLocal()
  const joined = list.filter((x) => x.m.status === 'joined')
  const waiting = list.filter((x) => x.m.status === 'waiting')

  const run = async (fn) => { setBusy(true); try { await fn(); await refreshEca() } catch (e) { toast.error(e.message) } finally { setBusy(false) } }
  const setStatus = (m, status) => run(() => db.eca.members.patch(m.id, { status }))
  const remove = (m, s) => confirm(t('ecaRemoveConfirm', { name: nameOf(s), activity: activityName(activity, lang) })) && run(() => db.eca.members.remove(m.id))

  const row = ({ m, s }) => {
    const flags = memberFlags(s, activity, { eca, day: today }).filter((f) => f !== 'ecaFlagHalfDay' || m.status !== 'waiting')
    return (
      <li key={m.id} className="flex items-start gap-3 px-3 py-2.5 sm:px-4">
        <Avatar src={photoSrc(s.photo)} name={s.full_name} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-slate-800">{nameOf(s)}</span>
            <span className="text-xs text-slate-400">{s.level}</span>
            <Flags flags={flags} s={s} a={activity} />
          </div>
          {s.nickname && <div className="truncate text-xs text-slate-500">{s.full_name}</div>}
          {s.allergies && <div className="text-xs font-semibold text-red-700">{s.allergies}</div>}
          <NoteField value={m.note} canEdit={canRun && !busy} onSave={(note) => run(() => db.eca.members.patch(m.id, { note: note || null }))} />
        </div>
        {canRun && (
          <div className="flex flex-none items-center gap-1">
            <button className="btn-ghost !px-2 text-xs" disabled={busy} onClick={() => setStatus(m, m.status === 'waiting' ? 'joined' : 'waiting')}>{m.status === 'waiting' ? t('ecaToJoined') : t('ecaToWaiting')}</button>
            <button className="btn-ghost !px-2 text-slate-400 hover:text-red-600" disabled={busy} title={t('ecaRemove')} aria-label={t('ecaRemove')} onClick={() => remove(m, s)}><Trash2 size={15} /></button>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="space-y-3">
      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5 sm:px-4">
          <h3 className="text-sm font-bold text-slate-700">{t('ecaOnList')} · {joined.length}</h3>
          {canRun && <button className="btn-primary ml-auto !py-1.5 text-xs" onClick={() => setAdding(true)}><UserPlus size={15} /> {t('ecaAddStudents')}</button>}
        </div>
        {!joined.length ? <div className="p-4"><Empty text={t('ecaEmptyList')} /></div> : <ul className="divide-y divide-slate-100">{joined.map(row)}</ul>}
      </Card>
      {waiting.length > 0 && (
        <Card className="!p-0 overflow-hidden border-amber-200">
          <div className="border-b border-amber-100 bg-amber-50/70 px-3 py-2.5 sm:px-4"><h3 className="text-sm font-bold text-amber-800">{t('ecaWaiting')} · {waiting.length}</h3></div>
          <ul className="divide-y divide-slate-100">{waiting.map(row)}</ul>
        </Card>
      )}
      {adding && <AddStudents activity={activity} onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddStudents({ activity, onClose }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { eca, students, refreshEca } = useData()
  const [q, setQ] = useState('')
  const [others, setOthers] = useState(false)
  const [picked, setPicked] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const { fit, other } = useMemo(() => candidates(students, activity, eca), [students, activity, eca])
  const fold = (x) => String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  const match = (s) => !q.trim() || fold(`${s.nickname || ''} ${s.full_name || ''} ${s.student_code || ''}`).includes(fold(q.trim()))
  const toggle = (id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const today = todayLocal()

  const add = async () => {
    setBusy(true)
    try {
      const chosen = students.filter((s) => picked.has(s.id))
      // Half-day students go on the waiting list, as the sign-up form says.
      await db.eca.members.add(chosen.map((s) => ({ activity_id: activity.id, student_id: s.id, status: memberFlags(s, activity, { eca }).includes('ecaFlagHalfDay') ? 'waiting' : 'joined' })))
      await refreshEca()
      toast(t('ecaAdded', { n: chosen.length }))
      onClose()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const row = (s) => {
    const flags = memberFlags(s, activity, { eca, day: today })
    const on = picked.has(s.id)
    return (
      <li key={s.id}>
        <label className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 ${on ? 'bg-sky-50' : 'hover:bg-slate-50'}`}>
          <input type="checkbox" className="h-4 w-4 flex-none accent-pra-blue" checked={on} onChange={() => toggle(s.id)} />
          <Avatar src={photoSrc(s.photo)} name={s.full_name} size={30} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5"><span className="font-semibold text-slate-800">{nameOf(s)}</span><span className="text-xs text-slate-400">{s.level}</span><Flags flags={flags} s={s} a={activity} /></span>
            {s.nickname && <span className="block truncate text-xs text-slate-500">{s.full_name}</span>}
          </span>
        </label>
      </li>
    )
  }
  const fitShown = fit.filter(match)
  const otherShown = other.filter(match)

  return (
    <Modal open onClose={onClose} title={t('ecaAddStudents')} subtitle={`${activityName(activity, lang)} · ${weekdayEvery(activity.weekday, lang)} · ${yearGroupsText(activity.year_groups, lang)}`}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" disabled={!picked.size || busy} onClick={add}><UserPlus size={15} /> {t('ecaAddN', { n: picked.size })}</button>
      </>}>
      <div className="space-y-3">
        <SearchInput value={q} onChange={setQ} placeholder={t('ecaSearch')} autoFocus />
        {!fit.length && !other.length ? <Empty text={t('ecaNoneToAdd')} /> : (<>
          {fitShown.length > 0 ? <ul>{fitShown.map(row)}</ul> : <p className="text-sm text-slate-400">{t('ecaNoneToAdd')}</p>}
          {other.length > 0 && (
            <div className="border-t border-slate-100 pt-2">
              <button type="button" className="text-sm font-semibold text-slate-500 hover:text-slate-800" onClick={() => setOthers((o) => !o)}>{others ? t('ecaHideOthers') : t('ecaShowOthers', { n: other.length })}</button>
              {(others || q.trim()) && otherShown.length > 0 && (<>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-700">{t('ecaOthersTitle')}</p>
                <ul>{otherShown.map(row)}</ul>
              </>)}
            </div>
          )}
        </>)}
      </div>
    </Modal>
  )
}

function Summary({ term, joined: onList, sessions, rows, awayOn }) {
  const { t, lang } = useT()
  const { students } = useData()
  const today = todayLocal()
  const held = sessions.filter((d) => d <= today)
  const markOf = (sid, d) => rows.find((r) => r.student_id === sid && r.date === d)
  // Everyone on the list, and anyone marked who has since come off it.
  const gone = [...new Set(rows.map((r) => r.student_id))].filter((id) => !onList.some((s) => s.id === id)).map((id) => students.find((s) => s.id === id)).filter(Boolean)
  const glyph = { present: '✓', late: lang === 'vi' ? 'T' : 'L', absent: lang === 'vi' ? 'V' : 'A' }
  const line = (s, off) => {
    const came = held.filter((d) => ['present', 'late'].includes(markOf(s.id, d)?.status)).length
    const pct = held.length ? came / held.length : 0
    return (
      <tr key={s.id} className="border-t border-slate-100">
        <td className="td pl-4"><div className="flex items-center gap-2"><Avatar src={photoSrc(s.photo)} name={s.full_name} size={26} /><span className={`font-semibold ${off ? 'text-slate-400' : 'text-slate-800'}`}>{nameOf(s)}</span><span className="text-xs text-slate-400">{off ? t('ecaOffList') : s.level}</span></div></td>
        {sessions.map((d) => {
          const m = markOf(s.id, d)
          const away = !m && awayOn(s.id, d)
          const st = m?.status
          return (
            <td key={d} className="td text-center">
              <span title={m?.note || (away ? t(away === TRAVEL ? 'ecaAwayTravel' : 'ecaAwayDay') : undefined)}
                className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold ${st ? STATUS[st].cell : away ? AWAY.cell : d <= today ? 'bg-slate-50 text-slate-300' : ''}`}>
                {st ? glyph[st] : away ? glyph.absent : d <= today ? '·' : ''}
              </span>
            </td>
          )
        })}
        <td className="td pr-4">
          <div className="flex items-center justify-end gap-2">
            <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-slate-100 sm:block"><div className="h-full rounded-full bg-pra-green" style={{ width: `${pct * 100}%` }} /></div>
            <span className="font-bold tabular-nums text-slate-700">{came}/{held.length}</span>
          </div>
        </td>
      </tr>
    )
  }
  return (
    <div className="space-y-2">
      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/60"><tr>
            <th className="th pl-4">{t('student')}</th>
            {sessions.map((d) => <th key={d} className={`th whitespace-nowrap text-center ${d > today ? 'text-slate-300' : ''}`}><div className="text-[10px] opacity-70">{t('ecaWeekShort', { n: weekNumber(term, d) })}</div>{dayLabel(d, lang, { day: 'numeric', month: 'short' })}</th>)}
            <th className="th pr-4 text-right">{t('ecaCame')}</th>
          </tr></thead>
          <tbody>{onList.map((s) => line(s, false))}{gone.map((s) => line(s, true))}</tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-400">{t('ecaSummaryHint')}</p>
    </div>
  )
}
