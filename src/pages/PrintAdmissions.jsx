import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useAuth } from '../lib/AuthContext'
import { useT, tFor } from '../lib/i18n'
import { STAGES, SOURCES, LEAD_PROGRAMS, labelOf, personName } from '../lib/leads'
import { ageOf } from '../lib/studentRecords'
import { admissionsSummary, admissionMonths } from '../lib/admissionsSummary'
import { monthYear, monthShort, shortDate, fullDate, many, num, isoOf } from '../lib/printFormat'
import { PrintShell, Masthead, KpiTiles, SectionTitle, ColumnChart, HBars, ListBlock, listBlock, layout, usePrintLang, H, mm, BLUE, GREEN } from '../components/print/Sheets'

// The admissions summary on paper (office accounts): for a month or the last
// twelve months, the families who asked about joining, where they are now, how
// they found PRA, tours and calls, enrollment forms, and the follow-ups that are
// due. A4 landscape. The figures come from lib/admissionsSummary.js.

const OVERVIEW = 52 // mm
const FORMS = '#6f9f2f' // PRA green, for enrollment forms beside enquiries in blue
const STAGE_COLOR = { new: '#f59e0b', contacted: '#0ea5e9', tour_booked: '#8b5cf6', tour_done: '#6366f1', trial: '#14b8a6', enrolled: '#16a34a', lost: '#94a3b8' }

export default function PrintAdmissions() {
  const { t, lang: appLang } = useT()
  const { displayName } = useAuth()
  const [params, setParams] = useSearchParams()
  const { lang, setLang, setParam } = usePrintLang(params, setParams)
  const T = useMemo(() => tFor(lang), [lang])

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    // Before the enrollments SQL has run there are no forms; the rest still prints.
    Promise.all([db.leads.list(), db.enrollments.list().catch(() => [])])
      .then(([leads, enrollments]) => alive && setData({ leads, enrollments }))
      .catch((e) => { if (alive) { setError(e.message || String(e)); setData({ leads: [], enrollments: [] }) } })
    return () => { alive = false }
  }, [])

  const months = useMemo(() => (data ? admissionMonths(data) : []), [data])
  const thisMonth = isoOf(new Date()).slice(0, 7)
  const asked = params.get('period')
  const period = asked === '12m' || months.includes(asked) ? asked : thisMonth
  const sum = useMemo(() => (data ? admissionsSummary({ ...data, period }) : null), [data, period])
  const title = period === '12m' ? T('last12Months') : monthYear(period, lang)

  const sheets = useMemo(() => {
    if (!sum) return []
    const blocks = [
      { type: 'masthead', h: H.masthead },
      { type: 'kpis', h: H.kpis },
      { type: 'overview', h: OVERVIEW + H.gap },
      listBlock({ type: 'list', rows: sum.enquiries, title: T('newEnquiries'), empty: T('noEnquiries'), cols: enquiryCols(T, lang) }),
      listBlock({ type: 'list', rows: sum.tours, title: T('toursAndCalls'), empty: T('noTours'), cols: tourCols(T, lang) }),
      listBlock({ type: 'list', rows: sum.forms, title: T('enrollmentForms'), empty: T('noForms'), cols: formCols(T, lang) }),
    ]
    if (sum.due) blocks.push(listBlock({ type: 'list', rows: sum.due, title: T('followUpsDue', { date: fullDate(isoOf(new Date()), lang) }), empty: T('noFollowUps'), cols: dueCols(T, lang) }))
    return layout(blocks)
  }, [sum, T, lang])

  return (
    <PrintShell T={T} lang={lang} setLang={setLang} back="/leads" by={displayName}
      loading={!data || !sum} error={error} sheets={sheets}
      docTitle={`${T('admissionsSummary')} - ${title}`}
      running={<><span className="font-bold text-pra-navy">{T('admissionsSummary')}</span>  ·  {title}</>}
      controls={(
        <select className="input w-auto" value={period} onChange={(e) => setParam('period', e.target.value)} aria-label={t('period')}>
          {[...months].reverse().map((k) => <option key={k} value={k}>{monthYear(k, appLang)}</option>)}
          <option value="12m">{appLang === 'vi' ? '12 tháng gần nhất' : 'Last 12 months'}</option>
        </select>
      )}
      renderBlock={(b) => {
        if (b.type === 'masthead') {
          const range = sum.rolling ? `${fullDate(sum.range.from, lang)} – ${fullDate(sum.range.to, lang)}` : ''
          return <Masthead overline={T('admissionsSummary')} title={title} sub={[range, T('admissionsSub')].filter(Boolean).join('  ·  ')} />
        }
        if (b.type === 'kpis') {
          return <KpiTiles tiles={[
            { label: T('newEnquiries'), value: num(sum.enquiries.length, lang), mark: BLUE, hint: many(T, 'nChildren', sum.children, lang) },
            { label: T('toursAndCalls'), value: num(sum.tours.length, lang), hint: T('toursHint') },
            { label: T('enrollmentForms'), value: num(sum.forms.length, lang), mark: FORMS, hint: T('formsHint', { n: sum.formsAdded }) },
            { label: T('nowEnrolled'), value: num(sum.nowEnrolled, lang), of: sum.enquiries.length, tone: sum.nowEnrolled ? 'text-green-700' : 'text-slate-800',
              bar: sum.enquiries.length > 0 && { pct: (sum.nowEnrolled / sum.enquiries.length) * 100, color: GREEN }, hint: T('nowEnrolledHint') },
            { label: T('inProgress'), value: num(sum.active, lang), hint: T('inProgressHint'), warn: sum.due?.length ? many(T, 'followUpsDueN', sum.due.length, lang) : '' },
          ]} />
        }
        if (b.type === 'overview') return <Overview T={T} lang={lang} sum={sum} period={period} />
        if (b.type === 'list') return <ListBlock b={b} T={T} />
        return null
      }} />
  )
}

function Overview({ T, lang, sum, period }) {
  const bins = sum.monthly.map((m) => ({ key: m.key, label: monthShort(m.key, lang), values: [m.enquiries, m.forms] }))
  const stageRows = STAGES.map((s) => ({ label: lang === 'vi' ? s.vi : s.en, value: sum.stages[s.id] || 0, color: STAGE_COLOR[s.id] }))
  const sourceRows = SOURCES.map((s) => ({ label: lang === 'vi' ? s.vi : s.en, value: sum.sources[s.id] || 0, color: BLUE }))
  const top = Math.max(1, ...stageRows.map((r) => r.value), ...sourceRows.map((r) => r.value))
  return (
    <div className="grid grid-cols-[113mm_1fr_1fr] gap-[8mm]" style={{ height: mm(OVERVIEW), marginBottom: mm(H.gap) }}>
      <div className="min-w-0">
        <SectionTitle>{T('enquiriesByMonth')}</SectionTitle>
        <ColumnChart bins={bins} series={[{ label: T('enquiriesShort'), color: BLUE }, { label: T('formsShort'), color: FORMS }]}
          width={113} height={OVERVIEW - H.title} labels="all" strong={period === '12m' ? undefined : period} format={(v) => String(v)} emptyText={T('noEnquiries')} />
      </div>
      <div className="min-w-0">
        <SectionTitle>{T('whereNow')}</SectionTitle>
        <HBars labelW={30} valueW={7} rowH={6.2} max={top} rows={stageRows} />
      </div>
      <div className="min-w-0">
        <SectionTitle>{T('howTheyCame')}</SectionTitle>
        <HBars labelW={30} valueW={7} rowH={6.2} max={top} rows={sourceRows} />
      </div>
    </div>
  )
}

const stageChip = (id, lang) => {
  const s = STAGES.find((x) => x.id === id)
  if (!s) return ''
  return <span className="inline-flex items-center gap-[1mm]"><span className="inline-block h-[1.8mm] w-[1.8mm] rounded-full" style={{ background: STAGE_COLOR[id] }} />{lang === 'vi' ? s.vi : s.en}</span>
}

const enquiryCols = (T, lang) => [
  { label: T('colDate'), w: '15mm', className: 'tabular-nums text-slate-600', cell: (l) => shortDate(l.day, lang) },
  { label: T('colFamily'), w: 'minmax(0,1fr)', cell: (l) => <b className="text-slate-800">{l.family}</b> },
  { label: T('colChildren'), w: 'minmax(0,1.1fr)', className: 'text-slate-600', cell: (l) => l.children || (l.kids ? many(T, 'nChildren', Number(l.kids), lang) : '') },
  { label: T('colProgram'), w: '28mm', className: 'text-slate-600', cell: (l) => labelOf(LEAD_PROGRAMS, l.program, lang) },
  { label: T('colSource'), w: '26mm', className: 'text-slate-600', cell: (l) => labelOf(SOURCES, l.source, lang) },
  { label: T('colStageNow'), w: '32mm', cell: (l) => stageChip(l.stage, lang) },
  { label: T('colOwner'), w: '25mm', className: 'text-slate-600', cell: (l) => personName(l.owner, lang) },
]

const tourCols = (T, lang) => [
  { label: T('colDate'), w: '15mm', className: 'tabular-nums text-slate-600', cell: (l) => shortDate(l.day, lang) },
  { label: T('colFamily'), w: 'minmax(0,1fr)', cell: (l) => <b className="text-slate-800">{l.family}</b> },
  { label: T('colChildren'), w: 'minmax(0,1.1fr)', className: 'text-slate-600', cell: (l) => l.children || '' },
  { label: T('colProgram'), w: '28mm', className: 'text-slate-600', cell: (l) => labelOf(LEAD_PROGRAMS, l.program, lang) },
  { label: T('colStageNow'), w: '32mm', cell: (l) => stageChip(l.stage, lang) },
  { label: T('colNextStep'), w: 'minmax(0,1fr)', className: 'text-slate-600', cell: (l) => l.next_step || '' },
]

const formCols = (T, lang) => [
  { label: T('colReceived'), w: '17mm', className: 'tabular-nums text-slate-600', cell: (e) => shortDate(e.day, lang) },
  { label: T('studentCol'), w: 'minmax(0,1fr)', cell: (e) => <b className="text-slate-800">{e.student_name}</b> },
  { label: T('colBorn'), w: '30mm', className: 'tabular-nums text-slate-600', cell: (e) => (e.dob ? `${fullDate(String(e.dob).slice(0, 10), lang)}${ageOf(String(e.dob).slice(0, 10)) != null ? ` (${ageOf(String(e.dob).slice(0, 10))})` : ''}` : '') },
  { label: T('colApplyingFor'), w: '34mm', className: 'text-slate-600', cell: (e) => e.applying_for || '' },
  { label: T('colParents'), w: 'minmax(0,1fr)', className: 'text-slate-600', cell: (e) => [e.parent_name, e.parent_phone].filter(Boolean).join('  ·  ') },
  { label: T('colStatus'), w: '62mm', cell: (e) => <span className={e.made_student ? 'font-semibold text-green-700' : 'text-slate-600'}>{e.made_student ? T('formAdded') : e.student_id ? T('formLinked') : T('formNotLinked')}{e.checked_at ? '' : <span className="font-semibold text-amber-700">  ·  {T('formUnchecked')}</span>}</span> },
]

const dueCols = (T, lang) => [
  { label: T('colFollowUp'), w: '18mm', className: 'tabular-nums font-semibold text-amber-700', cell: (l) => shortDate(String(l.follow_up).slice(0, 10), lang) },
  { label: T('colFamily'), w: 'minmax(0,1fr)', cell: (l) => <b className="text-slate-800">{l.family}</b> },
  { label: T('colStageNow'), w: '32mm', cell: (l) => stageChip(l.stage, lang) },
  { label: T('colOwner'), w: '25mm', className: 'text-slate-600', cell: (l) => personName(l.owner, lang) },
  { label: T('colNextStep'), w: 'minmax(0,1.6fr)', className: 'text-slate-600', cell: (l) => l.next_step || '' },
]
