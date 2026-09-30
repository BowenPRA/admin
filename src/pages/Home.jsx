import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Users, CalendarCheck, CalendarDays, ClipboardList, ArrowRight, Check, Sun, Sprout, FileSignature } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { fmt, fmtDate } from '../lib/money'
import { LEVELS } from '../lib/fees'
import { splitSubjectKey } from '../data/staff'
import { isEnrolled, activeFamilies } from '../lib/studentRecords'
import { summarize } from '../lib/leads'
import { teacherDay, todayIndex, isNow, subjectTone } from '../lib/schedule'
import { currentPeriod, reportWork, studentSections, HOMEROOM_PART, WRITING } from '../lib/report/utils'
import { Card, StatusChip, Empty, Spinner } from '../components/ui'
import { WritingTags, WRITING_PARTS } from '../components/report/WritingTags'

// The home page. A teacher sees, in this order: today's lessons, then
// attendance and report writing side by side (each its own card, nothing
// mixed), then a plain list of the classes they teach. The office sees the
// invoice figures plus the same attendance and report cards.

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const levelIndex = (l) => { const i = LEVELS.indexOf(l); return i < 0 ? 99 : i }
const byLevel = (a, b) => levelIndex(a) - levelIndex(b)
const CommentIcon = WRITING_PARTS[0].Icon
const DescriptionIcon = WRITING_PARTS[1].Icon

// ---------------------------------------------------------------------------
// Data

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

/**
 * This person's own report parts for the current period. `hidden` when nothing is
 * assigned to them on the Teachers page; `work` is null while loading.
 */
function useReportWork() {
  const { reportSettings: settings, students } = useData()
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
        const [saved, notes] = await Promise.all([
          mine.length ? db.sections.list({ report_id: mine.map((r) => r.id) }) : [],
          // The period's course descriptions, one task each for the areas that need one.
          mine.length ? db.courseNotes.list({ school_year: settings.schoolYear, period_label: periodLabel }) : [],
        ])
        // A partial-day student's academic sections are not part of their report.
        const ss = mine.flatMap((r) => studentSections(settings, saved.filter((x) => x.report_id === r.id), students.find((st) => st.id === r.student_id)))
        return reportWork(settings, mine, ss, { subjects, homeroom_groups: homerooms, notes })
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

// ---------------------------------------------------------------------------
// Building blocks

/** Greeting band: brand gradient, the date, and a line of today's numbers. */
function Hero({ name, subtitle, facts = [] }) {
  const { t, lang } = useT()
  const h = new Date().getHours()
  const hello = lang === 'vi' ? 'Xin chào' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const date = new Date().toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pra-navy via-pra-blue to-pra-green px-6 py-6 text-white shadow-sm">
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-white/10" />
      <div className="relative">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">{t('appName')} · {date}</div>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{hello}{name ? `, ${name}` : ''}</h1>
        {subtitle && <p className="mt-1 text-sm text-white/80">{subtitle}</p>}
        {facts.filter(Boolean).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {facts.filter(Boolean).map((f, i) => {
              const cls = 'inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm ring-1 ring-white/20'
              return f.to
                ? <Link key={i} to={f.to} className={`${cls} hover:bg-white/25`}>{f.icon && <f.icon size={13} />} {f.text}</Link>
                : <span key={i} className={cls}>{f.icon && <f.icon size={13} />} {f.text}</span>
            })}
          </div>
        )}
      </div>
    </section>
  )
}

/** A card with a coloured icon badge in its title. */
function Section({ icon: Icon, tone, title, subtitle, action, children, className = '' }) {
  return (
    <Card className={className} subtitle={subtitle} actions={action}
      title={<span className="flex items-center gap-2.5"><span className={`flex h-8 w-8 flex-none items-center justify-center rounded-xl ${tone}`}><Icon size={17} /></span>{title}</span>}>
      {children}
    </Card>
  )
}

/** A thin progress bar. */
function Bar({ value, total, tone = 'bg-pra-green', className = '' }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return <div className={`h-2 overflow-hidden rounded-full bg-slate-100 ${className}`}><div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} /></div>
}

/** What this person teaches (and their duties) today, from the schedule. Hidden for people who are not on it. */
function TodayCard({ items, onSchedule }) {
  const { t } = useT()
  if (!onSchedule) return null
  return (
    <Section icon={Sun} tone="bg-sky-100 text-sky-700" title={t('today')} action={<Link to="/schedule" className="btn-ghost text-xs">{t('fullSchedule')} <ArrowRight size={14} /></Link>}>
      {!items.length ? <p className="text-sm text-slate-500">{t('noLessonsToday')}</p> : (
        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((x, i) => (
            <li key={i} className={`flex items-center gap-3 rounded-lg border px-3 py-1.5 text-sm ${x.kind === 'homeroom' ? 'border-slate-200 bg-slate-50 text-slate-600' : subjectTone(x.s)} ${isNow(x.time) ? 'ring-2 ring-pra-green' : ''}`}>
              <span className="w-[5.5rem] flex-none text-xs font-semibold tabular-nums opacity-70">{x.time}</span>
              <span className="min-w-0"><span className="block truncate font-semibold">{x.s}</span>{x.classes.length > 0 && <span className="block truncate text-[11px] opacity-75">{x.classes.join(', ')}</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

/** Today's register, one row per class: how many are marked, who is absent, and whether it is done. */
function AttendanceCard({ rows: all, homerooms = [] }) {
  const { t } = useT()
  // Only classes with someone to register; a year group with no enrolled students is left out.
  const rows = all.filter((r) => r.total > 0)
  const loaded = all[0]?.loaded
  const marked = rows.reduce((n, r) => n + r.marked, 0)
  const total = rows.reduce((n, r) => n + r.total, 0)
  const status = (r) => {
    if (!r.total) return { label: t('noStudentsYet'), tone: 'bg-slate-100 text-slate-500' }
    if (r.marked >= r.total) return { label: t('registerDone'), tone: 'bg-green-100 text-green-800', done: true }
    if (r.marked > 0) return { label: t('registerInProgress'), tone: 'bg-amber-100 text-amber-800' }
    return { label: t('registerNotTaken'), tone: 'bg-slate-100 text-slate-600' }
  }
  return (
    <Section icon={CalendarCheck} tone="bg-amber-100 text-amber-700" title={t('attendanceToday')}
      subtitle={loaded ? t('markedOf', { done: marked, total }) : undefined}
      action={<Link to="/attendance" className="btn-ghost text-xs">{t('takeAttendance')} <ArrowRight size={14} /></Link>}>
      {!loaded ? <Spinner /> : !rows.length ? <p className="text-sm text-slate-500">{t('noStudentsYet')}</p> : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const s = status(r)
            return (
              <li key={r.g}>
                <Link to="/attendance" className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50">
                  <span className="w-28 flex-none">
                    <span className="block font-semibold text-slate-800">{r.g}</span>
                    {homerooms.includes(r.g) && <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">{t('homeroomTeacher')}</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <Bar value={r.marked} total={r.total} tone={s.done ? 'bg-pra-green' : 'bg-amber-400'} />
                    <span className="mt-1 block text-xs tabular-nums text-slate-500">
                      {r.marked}/{r.total} {t('students').toLowerCase()}{r.absent ? ` · ${t('nAbsent', { n: r.absent })}` : ''}
                    </span>
                  </span>
                  <span className={`chip flex-none ${s.tone}`}>{s.done && <Check size={12} className="mr-1" />}{s.label}</span>
                  <ArrowRight size={14} className="flex-none text-slate-300 group-hover:text-pra-blue" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}

const finished = (a) => a.done === a.total && (!a.description || a.description.done)

/** One class's areas in the report table: what is done for each student and whether the course description is written. */
function AreaRow({ area: a, t }) {
  const homeroom = a.key === HOMEROOM_PART
  const writing = homeroom ? WRITING.specialist : WRITING[a.tier] || WRITING.vocational
  const studentsDone = a.done === a.total
  const unit = writing.comment ? t('commentsWord') : t('writingLevels')
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1.5 pr-3 text-sm text-slate-800">
        <span className="inline-flex items-center gap-1.5">{homeroom ? t('homeroomComment') : a.name}{!homeroom && <WritingTags writing={writing} compact size={11} />}</span>
      </td>
      <td className="py-1.5 pr-3 text-right text-sm tabular-nums">
        {a.total === 0 ? <span className="text-slate-300">—</span> : studentsDone
          ? <span className="font-semibold text-green-700"><Check size={13} className="mr-0.5 inline" />{a.done}/{a.total}</span>
          : <span className="font-semibold text-amber-700">{a.done}/{a.total} <span className="font-normal text-slate-400">{unit}</span></span>}
      </td>
      <td className="py-1.5 text-right text-sm">
        {!a.description ? <span className="text-slate-300">—</span> : a.description.done
          ? <span className="font-semibold text-green-700"><Check size={13} className="inline" /></span>
          : <span className="chip bg-amber-100 text-amber-800">{t('writingToWrite')}</span>}
      </td>
    </tr>
  )
}

/** How much report writing is left for this person: overall, then a small table per class. */
function ReportWorkCard({ period, work }) {
  const { t, lang } = useT()
  const days = daysUntil(period.end)
  const end = new Date(`${period.end}T00:00:00`).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'short' })
  const subtitle = `${period.label} · ${days > 1 ? t('periodEndsIn', { date: end, days }) : days >= 0 ? t('periodEndsSoon', { date: end }) : t('periodEnded', { date: end })}`
  const left = work ? work.total - work.done : 0
  const pct = work?.total ? Math.round((work.done / work.total) * 100) : 0
  return (
    <Section icon={ClipboardList} tone="bg-indigo-100 text-indigo-700" title={t('yourReports')} subtitle={subtitle}
      action={<Link to="/reports" className="btn-ghost text-xs">{t('openReports')} <ArrowRight size={14} /></Link>}>
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
          <Bar value={work.done} total={work.total} className="mt-2 h-2.5" />
          <table className="mt-4 w-full">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="pb-1 pr-3 text-left font-semibold">{t('learningArea')}</th>
                <th className="pb-1 pr-3 text-right font-semibold"><span className="inline-flex items-center gap-1"><CommentIcon size={12} className="text-violet-600" />{t('eachStudent')}</span></th>
                <th className="pb-1 text-right font-semibold"><span className="inline-flex items-center gap-1"><DescriptionIcon size={12} className="text-emerald-600" />{t('writingDescription')}</span></th>
              </tr>
            </thead>
            {[...work.groups].sort((a, b) => byLevel(a.yearGroup, b.yearGroup)).map((g) => {
              const groupLeft = g.total - g.done
              return (
                <tbody key={g.yearGroup}>
                  <tr className="bg-slate-50/80">
                    <td colSpan={3} className="rounded-lg px-2 py-1.5">
                      <Link to={`/reports?group=${encodeURIComponent(g.yearGroup)}`} className="group flex items-center gap-2 text-sm">
                        <span className="font-bold text-slate-800">{g.yearGroup}</span>
                        <span className={`text-xs ${groupLeft ? 'text-amber-700' : 'text-green-700'}`}>{groupLeft ? t('nLeft', { n: groupLeft }) : t('reportsAllDone')}</span>
                        <ArrowRight size={13} className="ml-auto text-slate-300 group-hover:text-pra-blue" />
                      </Link>
                    </td>
                  </tr>
                  {/* Unfinished areas first. */}
                  {[...g.areas].sort((a, b) => finished(a) - finished(b)).map((a) => <AreaRow key={a.key} area={a} t={t} />)}
                </tbody>
              )
            })}
          </table>
        </>
      )}
    </Section>
  )
}

/** The classes on this person's Teachers row: each year group with its learning areas and what they need. */
function ClassesCard({ byGroup, homerooms, settings }) {
  const { t } = useT()
  const subjectName = (k) => (settings?.subjects || []).find((s) => s.key === k)?.name || k
  const groups = Object.keys(byGroup).sort(byLevel)
  return (
    <Section icon={Users} tone="bg-emerald-100 text-emerald-700" title={t('yourClasses')} subtitle={t('yourClassesHint')}>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <li key={g} className="rounded-xl border border-slate-200 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-800">{g}</span>
              {homerooms.includes(g) && <span className="chip bg-amber-100 text-amber-800">{t('homeroomTeacher')}</span>}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {byGroup[g].map((s) => <span key={s} className="chip gap-1 bg-slate-100 text-slate-700">{subjectName(s)} <WritingTags settings={settings} subjectKey={s} compact size={11} /></span>)}
              {!byGroup[g].length && <span className="text-xs text-slate-400">{t('homeroomComment')}</span>}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}

// ---------------------------------------------------------------------------
// Pages

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

/** Today's lessons for `me` from the schedule, and whether they appear on it at all this week. */
function useTodayLessons() {
  const { schedule } = useData()
  const { me } = useAuth()
  const day = todayIndex()
  const items = schedule && me?.name && day >= 0 ? teacherDay(schedule, me.name, day) : []
  const onSchedule = !!(schedule && me?.name && day >= 0 && [0, 1, 2, 3, 4].some((d) => teacherDay(schedule, me.name, d).length))
  return { items, onSchedule }
}

function OfficeHome() {
  const { t, lang } = useT()
  const data = useData()
  const { me } = useAuth()
  const [invoices, setInvoices] = useState(null)
  const [leads, setLeads] = useState(null)
  const [webWaiting, setWebWaiting] = useState(0)
  const [formsToCheck, setFormsToCheck] = useState(0)
  const today = useTodayAttendance(data.students)
  const reports = useReportWork()
  const lessons = useTodayLessons()

  useEffect(() => { db.invoices.list().then(setInvoices).catch(() => setInvoices([])) }, [])
  // Until supabase/updates-2026-09-30-leads.sql has run there is no leads table; the line is then left out.
  useEffect(() => { db.leads.list().then((ls) => setLeads(summarize(ls))).catch(() => setLeads(null)) }, [])
  // The same goes for messages from the website (updates-2026-09-30-website-forms.sql).
  useEffect(() => { db.webMessages.list().then((ms) => setWebWaiting(ms.filter((m) => !m.done_at).length)).catch(() => setWebWaiting(0)) }, [])
  // And for enrollment forms from the website (updates-2026-09-30-enrollments.sql).
  useEffect(() => { db.enrollments.list().then((fs) => setFormsToCheck(fs.filter((f) => !f.checked_at).length)).catch(() => setFormsToCheck(0)) }, [])

  if (!invoices || data.loading) return <Spinner />

  const live = invoices.filter((i) => i.status !== 'void')
  const invoiced = live.reduce((s, i) => s + (Number(i.total) || 0), 0)
  const collected = live.reduce((s, i) => s + (Number(i.paid) || 0), 0)
  const outstanding = invoiced - collected
  const recent = [...live].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 8)
  const enrolled = data.students.filter(isEnrolled)
  const groups = [...new Set(enrolled.map((s) => s.level).filter(Boolean))].sort(byLevel)
  const att = today(groups)
  const toRegister = att.filter((x) => x.total && x.marked < x.total).length

  const stat = (label, value, cls = '') => (
    <div className="card p-5"><div className="label">{label}</div><div className={`text-2xl font-black tabular-nums ${cls}`}>{fmt(value)} <span className="text-sm font-semibold text-slate-400">VND</span></div></div>
  )

  return (
    <div className="space-y-6">
      <Hero name={me?.name} subtitle={`${data.fees?.schoolYear} · ${enrolled.length} ${t('students').toLowerCase()} · ${live.length} ${t('invoiceCount')}`}
        facts={[
          att[0]?.loaded && { icon: CalendarCheck, text: toRegister ? t(toRegister === 1 ? 'classToRegister' : 'classesToRegister', { n: toRegister }) : t('allRegistered') },
          !reports.hidden && reports.work && !reports.work.error && reports.work.total > 0 && { icon: ClipboardList, text: `${reports.period.label}: ${reports.work.total - reports.work.done ? t('nLeft', { n: reports.work.total - reports.work.done }) : t('reportsAllDone')}` },
          leads && (leads.new || leads.due || webWaiting) && { icon: Sprout, to: '/leads', text: `${t('leadsNav')}: ${[leads.new && t('ldNewShort', { n: leads.new }), leads.due && t('ldDueShort', { n: leads.due }), webWaiting && t('ldWebShort', { n: webWaiting })].filter(Boolean).join(' · ')}` },
          formsToCheck > 0 && { icon: FileSignature, to: '/enrollments', text: t('enHomeShort', { n: formsToCheck }) },
        ]} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink to="/invoices/new" icon={PlusCircle} tone="bg-green-100 text-green-700" title={t('newInvoice')} hint={t('quickStart')} />
        <QuickLink to="/attendance" icon={CalendarCheck} tone="bg-amber-100 text-amber-700" title={t('attendance')} hint={t('takeAttendance')} />
        <QuickLink to="/students" icon={Users} tone="bg-sky-100 text-sky-700" title={t('students')} hint={`${enrolled.length} ${t('enrolled').toLowerCase()} · ${t('activeFamiliesCount', { n: activeFamilies(data.families, data.students).length })}`} />
        <QuickLink to="/reports" icon={ClipboardList} tone="bg-indigo-100 text-indigo-700" title={t('reports')} hint={data.reportSettings?.schoolYear || ''} />
      </div>

      <TodayCard items={lessons.items} onSchedule={lessons.onSchedule} />

      <div className={`grid gap-6 ${reports.hidden ? '' : 'xl:grid-cols-2'}`}>
        {groups.length > 0 && <AttendanceCard rows={att} />}
        {!reports.hidden && <ReportWorkCard period={reports.period} work={reports.work} />}
      </div>

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
  const lessons = useTodayLessons()
  if (data.loading) return <Spinner />

  // year group -> subject keys, plus the homeroom groups with no subjects
  const byGroup = {}
  ;(me?.subjects || []).forEach((k) => { const [s, g] = splitSubjectKey(k); if (g) (byGroup[g] ||= []).push(s) })
  const homerooms = (me?.homeroom_groups || []).filter((g) => g !== '*')
  homerooms.forEach((g) => { byGroup[g] ||= [] })
  const groups = Object.keys(byGroup).sort(byLevel)
  const att = today(groups)
  const toRegister = att.filter((x) => x.total && x.marked < x.total).length
  const work = reports.work && !reports.work.error ? reports.work : null
  const partsLeft = work ? work.total - work.done : null

  return (
    <div className="space-y-6">
      <Hero name={displayName}
        subtitle={`${data.reportSettings?.schoolYear || ''}${isHead ? ' · Head teacher' : groups.length ? ` · ${groups.length} ${groups.length === 1 ? 'class' : 'classes'}` : ''}`}
        facts={[
          lessons.onSchedule && { icon: CalendarDays, text: lessons.items.length === 1 ? t('lessonToday') : lessons.items.length ? t('lessonsToday', { n: lessons.items.length }) : t('noLessonsToday') },
          groups.length > 0 && att[0]?.loaded && { icon: CalendarCheck, text: toRegister ? t(toRegister === 1 ? 'classToRegister' : 'classesToRegister', { n: toRegister }) : t('allRegistered') },
          !reports.hidden && work && { icon: ClipboardList, text: work.total ? `${reports.period.label}: ${partsLeft ? t('nLeft', { n: partsLeft }) : t('reportsAllDone')}` : t('noReportsYet') },
        ]} />

      <TodayCard items={lessons.items} onSchedule={lessons.onSchedule} />

      {!groups.length ? <Empty text={isHead ? '' : t('noClassesToTake')} /> : (
        <>
          <div className={`grid gap-6 ${reports.hidden ? '' : 'xl:grid-cols-2'}`}>
            <AttendanceCard rows={att} homerooms={homerooms} />
            {!reports.hidden && <ReportWorkCard period={reports.period} work={reports.work} />}
          </div>
          <ClassesCard byGroup={byGroup} homerooms={homerooms} settings={data.reportSettings} />
        </>
      )}
    </div>
  )
}
