import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Users, CalendarCheck, CalendarDays, ClipboardList, ArrowRight } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { fmt, fmtDate } from '../lib/money'
import { LEVELS } from '../lib/fees'
import { splitSubjectKey } from '../data/staff'
import { isEnrolled } from '../lib/studentRecords'
import { teacherDay, todayIndex, isNow, subjectTone } from '../lib/schedule'
import { currentPeriod, reportWork, HOMEROOM_PART } from '../lib/report/utils'
import { Card, StatusChip, Empty, Spinner } from '../components/ui'

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const levelIndex = (l) => { const i = LEVELS.indexOf(l); return i < 0 ? 99 : i }

function Greeting({ name }) {
  const { lang } = useT()
  const h = new Date().getHours()
  const hello = lang === 'vi' ? 'Xin chào' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  return <h1 className="text-2xl font-black tracking-tight text-slate-800">{hello}{name ? `, ${name}` : ''}</h1>
}

/** Today's attendance progress for the given year groups. */
function useTodayAttendance(students) {
  const [marks, setMarks] = useState(null)
  useEffect(() => { db.attendance.list({ date: todayIso() }).then(setMarks).catch(() => setMarks([])) }, [])
  return (groups) => groups.map((g) => {
    const kids = students.filter((s) => isEnrolled(s) && s.level === g)
    const marked = (marks || []).filter((m) => kids.some((k) => k.id === m.student_id))
    return { g, total: kids.length, marked: marked.length, absent: marked.filter((m) => m.status === 'absent').length, loaded: !!marks }
  })
}

/** What this person teaches (and their duties) today, from the schedule. Hidden for people who are not on it. */
function TodayCard() {
  const { t } = useT()
  const { schedule } = useData()
  const { me } = useAuth()
  const day = todayIndex()
  const items = schedule && me?.name ? teacherDay(schedule, me.name, day) : []
  const onSchedule = schedule && me?.name && [0, 1, 2, 3, 4].some((d) => teacherDay(schedule, me.name, d).length)
  if (!onSchedule || day < 0) return null
  return (
    <Card title={t('todayLessons')} actions={<Link to="/schedule" className="btn-ghost text-xs">{t('fullSchedule')} <ArrowRight size={14} /></Link>}>
      {!items.length ? <p className="text-sm text-slate-500">{t('noLessonsToday')}</p> : (
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((x, i) => (
            <li key={i} className={`flex items-center gap-3 rounded-lg border px-3 py-1.5 text-sm ${x.kind === 'homeroom' ? 'border-slate-200 bg-slate-50 text-slate-600' : subjectTone(x.s)} ${isNow(x.time) ? 'ring-2 ring-green-500' : ''}`}>
              <span className="w-[5.5rem] flex-none text-xs font-semibold tabular-nums opacity-70">{x.time}</span>
              <span className="min-w-0"><span className="block truncate font-semibold">{x.s}</span>{x.classes.length > 0 && <span className="block truncate text-[11px] opacity-75">{x.classes.join(', ')}</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/**
 * This person's own report parts for the current period. `hidden` when nothing is
 * assigned to them on the Teachers page; `work` is null while loading.
 */
function useReportWork() {
  const { reportSettings: settings } = useData()
  const { me } = useAuth()
  const [work, setWork] = useState(null)
  const period = settings ? currentPeriod(settings) : null
  const subjects = me?.subjects || []
  const homerooms = (me?.homeroom_groups || []).filter((g) => g !== '*') // '*' is edit access, not an assignment
  const hidden = !period || (!subjects.length && !homerooms.length)
  const periodLabel = period?.label

  useEffect(() => {
    if (hidden) return
    let alive = true
    const groups = new Set([...homerooms, ...subjects.map((k) => splitSubjectKey(k)[1]).filter(Boolean)])
    db.reports.list({ school_year: settings.schoolYear, period_label: periodLabel })
      .then(async (rs) => {
        const mine = rs.filter((r) => groups.has(r.year_group))
        const ss = mine.length ? await db.sections.list({ report_id: mine.map((r) => r.id) }) : []
        return reportWork(settings, mine, ss, { subjects, homeroom_groups: homerooms })
      })
      .then((w) => alive && setWork(w))
      .catch(() => alive && setWork({ error: true, done: 0, total: 0, groups: [] }))
    return () => { alive = false }
  }, [settings, periodLabel, me, hidden]) // eslint-disable-line react-hooks/exhaustive-deps

  return { hidden, period, work }
}

const daysUntil = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number)
  const now = new Date()
  return Math.round((new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000)
}

/** How much report writing is left for this person: overall, then per class with each area they write. */
function ReportWorkCard({ period, work }) {
  const { t, lang } = useT()
  const days = daysUntil(period.end)
  const end = new Date(`${period.end}T00:00:00`).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short' })
  const subtitle = `${period.label} · ${days > 1 ? t('periodEndsIn', { date: end, days }) : days >= 0 ? t('periodEndsSoon', { date: end }) : t('periodEnded', { date: end })}`
  const left = work ? work.total - work.done : 0
  const pct = work?.total ? Math.round((work.done / work.total) * 100) : 0
  return (
    <Card title={t('yourReports')} subtitle={subtitle} actions={<Link to="/reports" className="btn-ghost text-xs">{t('openReports')} <ArrowRight size={14} /></Link>}>
      {!work ? <Spinner /> : work.error ? <p className="text-sm text-red-600">{t('errorLoad')}</p> : !work.total ? (
        <p className="text-sm text-slate-500">{t('reportsNotCreated', { period: period.label })}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            {left ? (
              <span className="text-slate-800"><span className="text-3xl font-black tabular-nums">{left}</span> <span className="text-sm font-semibold">{t(left === 1 ? 'reportPartLeft' : 'reportPartsLeft')}</span></span>
            ) : <span className="text-lg font-black text-green-700">{t('reportsAllDone')}</span>}
            <span className="text-xs text-slate-500">{t('reportPartsDone', { done: work.done, total: work.total, pct })}</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-pra-green transition-all" style={{ width: `${pct}%` }} /></div>
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
            {[...work.groups].sort((a, b) => levelIndex(a.yearGroup) - levelIndex(b.yearGroup)).map((g) => {
              const groupLeft = g.total - g.done ? t('nLeft', { n: g.total - g.done }) : '✓'
              return (
                <li key={g.yearGroup}>
                  {/* Phones: class name above its areas. Wider: one row per class. */}
                  <Link to={`/reports?group=${encodeURIComponent(g.yearGroup)}`} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                    <span className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-3">
                      <span className="block font-semibold text-slate-800 sm:w-28 sm:flex-none">
                        {g.yearGroup}<span className="ml-2 text-xs font-normal text-slate-500 sm:hidden">{groupLeft}</span>
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1 sm:mt-0 sm:flex-1">
                        {/* Unfinished areas first. */}
                        {[...g.areas].sort((a, b) => (a.done === a.total) - (b.done === b.total)).map((a) => {
                          const name = a.key === HOMEROOM_PART ? t('homeroomComment') : a.name
                          return a.done === a.total
                            ? <span key={a.key} className="chip bg-green-100 text-green-800">✓ {name}</span>
                            : <span key={a.key} className="chip bg-amber-100 text-amber-800">{name}<span className="ml-1.5 tabular-nums opacity-70">{a.done}/{a.total}</span></span>
                        })}
                      </span>
                    </span>
                    <span className="hidden w-16 flex-none text-right text-xs tabular-nums text-slate-500 sm:block">{groupLeft}</span>
                    <ArrowRight size={14} className="flex-none text-slate-300 group-hover:text-pra-blue" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Card>
  )
}

export default function Home() {
  const { isOffice } = useAuth()
  return isOffice ? <OfficeHome /> : <TeacherHome />
}

function QuickLink({ to, icon: Icon, tone, title, hint }) {
  return (
    <Link to={to} className="card group flex items-center gap-3 p-4 transition-colors hover:border-pra-blue">
      <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${tone}`}><Icon size={20} /></span>
      <span className="min-w-0 flex-1"><span className="block font-bold text-slate-800">{title}</span><span className="block truncate text-xs text-slate-500">{hint}</span></span>
      <ArrowRight size={16} className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-pra-blue" />
    </Link>
  )
}

function OfficeHome() {
  const { t, lang } = useT()
  const data = useData()
  const { me } = useAuth()
  const [invoices, setInvoices] = useState(null)
  const today = useTodayAttendance(data.students)
  const reports = useReportWork()

  useEffect(() => { db.invoices.list().then(setInvoices).catch(() => setInvoices([])) }, [])

  if (!invoices || data.loading) return <Spinner />

  const live = invoices.filter((i) => i.status !== 'void')
  const invoiced = live.reduce((s, i) => s + (Number(i.total) || 0), 0)
  const collected = live.reduce((s, i) => s + (Number(i.paid) || 0), 0)
  const outstanding = invoiced - collected
  const recent = [...live].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 8)
  const enrolled = data.students.filter(isEnrolled)
  const groups = [...new Set(enrolled.map((s) => s.level).filter(Boolean))].sort((a, b) => levelIndex(a) - levelIndex(b))
  const att = today(groups)
  const markedAll = att.reduce((n, x) => n + x.marked, 0)
  const absentAll = att.reduce((n, x) => n + x.absent, 0)

  const stat = (label, value, cls = '') => (
    <div className="card p-5"><div className="label">{label}</div><div className={`text-2xl font-black tabular-nums ${cls}`}>{fmt(value)} <span className="text-sm font-semibold text-slate-400">VND</span></div></div>
  )

  return (
    <div className="space-y-6">
      <div>
        <Greeting name={me?.name} />
        <p className="text-sm text-slate-500">{data.fees?.schoolYear} · {enrolled.length} {t('students').toLowerCase()} · {live.length} {t('invoiceCount')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink to="/invoices/new" icon={PlusCircle} tone="bg-green-100 text-green-700" title={t('newInvoice')} hint={t('quickStart')} />
        <QuickLink to="/attendance" icon={CalendarCheck} tone="bg-amber-100 text-amber-700" title={t('attendance')}
          hint={att[0]?.loaded ? `${t('today')}: ${markedAll}/${enrolled.length}${absentAll ? ` · ${absentAll} ${t('absent').toLowerCase()}` : ''}` : t('today')} />
        <QuickLink to="/students" icon={Users} tone="bg-sky-100 text-sky-700" title={t('students')} hint={`${enrolled.length} ${t('enrolled').toLowerCase()} · ${data.families.length} ${t('families').toLowerCase()}`} />
        <QuickLink to="/reports" icon={ClipboardList} tone="bg-indigo-100 text-indigo-700" title={t('reports')} hint={data.reportSettings?.schoolYear || ''} />
      </div>

      <TodayCard />

      {!reports.hidden && <ReportWorkCard period={reports.period} work={reports.work} />}

      <div className="grid gap-4 sm:grid-cols-3">
        {stat(t('invoicedTotal'), invoiced)}
        {stat(t('paidTotal'), collected, 'text-green-700')}
        {stat(t('outstanding'), outstanding, outstanding > 0 ? 'text-amber-700' : '')}
      </div>

      <Card title={t('recent')} actions={<Link to="/invoices" className="btn-ghost text-xs">{t('viewAll')} <ArrowRight size={14} /></Link>}>
        {recent.length === 0 ? <Empty text={t('noData')} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2">{t('number')}</th><th>{t('student')}</th><th className="hidden sm:table-cell">{t('period')}</th><th className="hidden md:table-cell">{t('issued')}</th><th className="text-right">{t('total')}</th><th className="text-right">{t('balance')}</th><th className="pl-3">{t('status')}</th></tr></thead>
              <tbody>
                {recent.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2"><Link className="font-semibold text-pra-blue" to={`/invoices/${i.id}`}>{i.number}</Link></td>
                    <td>{i.student_names}</td>
                    <td className="hidden sm:table-cell">{i.period_label}</td>
                    <td className="hidden md:table-cell">{fmtDate(i.issue_date, lang)}</td>
                    <td className="text-right tabular-nums">{fmt(i.total)}</td>
                    <td className="text-right tabular-nums">{fmt((i.total || 0) - (i.paid || 0))}</td>
                    <td className="pl-3"><StatusChip status={i.status} t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function TeacherHome() {
  const { t } = useT()
  const data = useData()
  const { me, displayName, isHead } = useAuth()
  const today = useTodayAttendance(data.students)
  const reports = useReportWork()
  if (data.loading) return <Spinner />

  const subjectName = (k) => (data.reportSettings?.subjects || []).find((s) => s.key === k)?.name || k
  const byGroup = {}
  ;(me?.subjects || []).forEach((k) => { const [s, g] = splitSubjectKey(k); if (g) (byGroup[g] ||= []).push(subjectName(s)) })
  ;(me?.homeroom_groups || []).filter((g) => g !== '*').forEach((g) => { byGroup[g] ||= [] })
  const groups = Object.keys(byGroup).sort((a, b) => levelIndex(a) - levelIndex(b))
  const att = today(groups)
  const markedAll = att.reduce((n, x) => n + x.marked, 0)
  const pupilsAll = att.reduce((n, x) => n + x.total, 0)
  const partsLeft = reports.work && !reports.work.error ? reports.work.total - reports.work.done : null

  return (
    <div className="space-y-6">
      <div>
        <Greeting name={displayName} />
        <p className="text-sm text-slate-500">{data.reportSettings?.schoolYear} · {isHead ? 'Head teacher' : groups.length ? `${groups.length} ${groups.length === 1 ? 'class' : 'classes'}` : ''}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink to="/attendance" icon={CalendarCheck} tone="bg-amber-100 text-amber-700" title={t('attendance')} hint={att[0]?.loaded ? `${t('today')}: ${markedAll}/${pupilsAll}` : t('today')} />
        <QuickLink to="/schedule" icon={CalendarDays} tone="bg-sky-100 text-sky-700" title={t('schedule')} hint={t('scheduleSubtitle')} />
        <QuickLink to="/reports" icon={ClipboardList} tone="bg-indigo-100 text-indigo-700" title={t('reports')}
          hint={partsLeft == null || !reports.work.total ? (isHead ? '' : t('yourLearningAreas')) : `${reports.period.label}: ${partsLeft ? t('nLeft', { n: partsLeft }) : t('reportsAllDone')}`} />
      </div>

      <TodayCard />

      {!groups.length ? <Empty text={isHead ? '' : t('noClassesToTake')} /> : (
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-800">{t('attendance')}</h2>
            <Link to="/attendance" className="btn-ghost text-xs">{t('takeAttendance')} <ArrowRight size={14} /></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g, i) => {
              const a = att[i]
              const home = (me?.homeroom_groups || []).includes(g)
              return (
                <div key={g} className="card p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-lg font-black text-slate-800">{g}</span>
                    <span className="text-xs text-slate-400">{a.total} {t('students').toLowerCase()}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {home && <span className="chip bg-amber-100 text-amber-800">Homeroom</span>}
                    {byGroup[g].map((s) => <span key={s} className="chip bg-sky-100 text-sky-800">{s}</span>)}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-green-500" style={{ width: a.total ? `${(a.marked / a.total) * 100}%` : 0 }} /></div>
                    <span>{t('today')}: {a.marked}/{a.total}{a.absent ? ` · ${a.absent} ${t('absent').toLowerCase()}` : ''}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {!reports.hidden && <ReportWorkCard period={reports.period} work={reports.work} />}
    </div>
  )
}
