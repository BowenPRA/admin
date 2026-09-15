import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Users, CalendarCheck, ClipboardList, ArrowRight } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { fmt, fmtDate } from '../lib/money'
import { LEVELS } from '../lib/fees'
import { splitSubjectKey } from '../data/staff'
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
    const kids = students.filter((s) => s.active !== false && s.level === g)
    const marked = (marks || []).filter((m) => kids.some((k) => k.id === m.student_id))
    return { g, total: kids.length, marked: marked.length, absent: marked.filter((m) => m.status === 'absent').length, loaded: !!marks }
  })
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

  useEffect(() => { db.invoices.list().then(setInvoices).catch(() => setInvoices([])) }, [])

  if (!invoices || data.loading) return <Spinner />

  const live = invoices.filter((i) => i.status !== 'void')
  const invoiced = live.reduce((s, i) => s + (Number(i.total) || 0), 0)
  const collected = live.reduce((s, i) => s + (Number(i.paid) || 0), 0)
  const outstanding = invoiced - collected
  const recent = [...live].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 8)
  const enrolled = data.students.filter((s) => s.active !== false)
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
  if (data.loading) return <Spinner />

  const subjectName = (k) => (data.reportSettings?.subjects || []).find((s) => s.key === k)?.name || k
  const byGroup = {}
  ;(me?.subjects || []).forEach((k) => { const [s, g] = splitSubjectKey(k); if (g) (byGroup[g] ||= []).push(subjectName(s)) })
  ;(me?.homeroom_groups || []).filter((g) => g !== '*').forEach((g) => { byGroup[g] ||= [] })
  const groups = Object.keys(byGroup).sort((a, b) => levelIndex(a) - levelIndex(b))
  const att = today(groups)

  return (
    <div className="space-y-6">
      <div>
        <Greeting name={displayName} />
        <p className="text-sm text-slate-500">{data.reportSettings?.schoolYear} · {isHead ? 'Head teacher' : groups.length ? `${groups.length} ${groups.length === 1 ? 'class' : 'classes'}` : ''}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <QuickLink to="/attendance" icon={CalendarCheck} tone="bg-amber-100 text-amber-700" title={t('takeAttendance')} hint={t('today')} />
        <QuickLink to="/reports" icon={ClipboardList} tone="bg-indigo-100 text-indigo-700" title={t('reports')} hint={isHead ? '' : 'Your learning areas'} />
      </div>

      {!groups.length ? <Empty text={isHead ? '' : t('noClassesToTake')} /> : (
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
      )}
    </div>
  )
}
