import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { useT, tFor } from '../lib/i18n'
import { feesSummary, feeMonths, AGE_BANDS } from '../lib/feesSummary'
import { monthYear, monthShort, shortDate, fullDate, many, vnd, vndShort, isoOf } from '../lib/printFormat'
import { PrintShell, Masthead, KpiTiles, SectionTitle, ColumnChart, HBars, ListBlock, listBlock, layout, usePrintLang, H, mm, GREEN, AMBER, RED, BLUE, BLUE_SOFT, SLATE } from '../components/print/Sheets'

// The fees summary on paper (office accounts): for a month or the academic year,
// what came in, what was invoiced, and what is still owed and how late. A4
// landscape. The figures come from lib/feesSummary.js.

const OVERVIEW = 62 // the chart and the two bar lists beside it, in mm
const AGE_COLORS = { notDue: SLATE, d1_30: '#fbbf24', d31_60: AMBER, d61: RED }
const AGE_LABEL = { notDue: 'ageNotDue', d1_30: 'age1_30', d31_60: 'age31_60', d61: 'age61' }

export default function PrintFees() {
  const { t, lang: appLang } = useT()
  const { loading, families, fees, calendar } = useData()
  const { displayName } = useAuth()
  const [params, setParams] = useSearchParams()
  const { lang, setLang, setParam } = usePrintLang(params, setParams)
  const T = useMemo(() => tFor(lang), [lang])
  const schoolYear = fees?.schoolYear || calendar?.schoolYear || ''

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    Promise.all([db.invoices.list(), db.payments.list()])
      .then(([invoices, payments]) => alive && setData({ invoices, payments }))
      .catch((e) => { if (alive) { setError(e.message || String(e)); setData({ invoices: [], payments: [] }) } })
    return () => { alive = false }
  }, [])

  const months = useMemo(() => (data ? feeMonths({ ...data, calendar, schoolYear }) : []), [data, calendar, schoolYear])
  const thisMonth = isoOf(new Date()).slice(0, 7)
  const asked = params.get('period')
  const period = asked === 'year' || months.includes(asked) ? asked : months.includes(thisMonth) ? thisMonth : (months.at(-1) || 'year')
  const sum = useMemo(() => (data ? feesSummary({ ...data, families, period, schoolYear, months }) : null), [data, families, period, schoolYear, months])

  const title = period === 'year' ? T('academicYearTitle', { y: schoolYear }) : monthYear(period, lang)
  const sheets = useMemo(() => {
    if (!sum) return []
    return layout([
      { type: 'masthead', h: H.masthead },
      { type: 'kpis', h: H.kpis },
      { type: 'overview', h: H.title + OVERVIEW + H.gap },
      listBlock({
        type: 'list', rows: sum.received, title: T('paymentsReceived'), empty: T('noPayments'), cols: paymentCols(T, lang),
        foot: [T('totalRow'), '', '', '', '', many(T, 'nPayments', sum.received.length, lang), vnd(sum.receivedTotal)],
      }),
      listBlock({
        type: 'list', rows: sum.owed, title: T('stillOwedOn', { date: fullDate(sum.asOf, lang) }), empty: T('nothingOwed'), cols: owedCols(T, lang),
        foot: [T('totalRow'), many(T, 'nFamilies', sum.owedFamilies, lang), '', '', '', vnd(sum.owed.reduce((s, x) => s + (Number(x.total) || 0), 0)), vnd(sum.owed.reduce((s, x) => s + x.paidAsOf, 0)), vnd(sum.owedTotal), ''],
      }),
      listBlock({
        type: 'list', rows: sum.issued, title: T('invoicesIssued'), empty: T('noInvoicesIssued'), cols: issuedCols(T, lang),
        foot: [T('totalRow'), '', '', '', '', vnd(sum.issuedTotal), many(T, 'nInvoices', sum.issued.length, lang)],
      }),
    ])
  }, [sum, T, lang])

  const sub = [
    period === 'year' ? '' : T('academicYearTitle', { y: schoolYear }),
    T('owedAsOf', { date: fullDate(sum?.asOf || '', lang) }),
    T('vndNote'),
  ].filter(Boolean).join('  ·  ')

  return (
    <PrintShell T={T} lang={lang} setLang={setLang} back="/invoices" by={displayName}
      loading={loading || !data || !sum} error={error} sheets={sheets}
      docTitle={`${T('feesSummary')} - ${title}`}
      running={<><span className="font-bold text-pra-navy">{T('feesSummary')}</span>  ·  {title}</>}
      controls={(
        <select className="input w-auto" value={period} onChange={(e) => setParam('period', e.target.value)} aria-label={t('period')}>
          {months.map((k) => <option key={k} value={k}>{monthYear(k, appLang)}</option>)}
          <option value="year">{appLang === 'vi' ? `Năm học ${schoolYear}` : `Academic year ${schoolYear}`}</option>
        </select>
      )}
      renderBlock={(b) => {
        if (b.type === 'masthead') return <Masthead overline={T('feesSummary')} title={title} sub={sub} />
        if (b.type === 'kpis') {
          return <KpiTiles tiles={[
            { label: T('feesReceived'), value: vnd(sum.receivedTotal), small: true, mark: BLUE, hint: many(T, 'nPayments', sum.received.length, lang) },
            { label: T('feesInvoiced'), value: vnd(sum.issuedTotal), small: true, mark: BLUE_SOFT, hint: many(T, 'nInvoices', sum.issued.length, lang) },
            { label: T('feesOwed'), value: vnd(sum.owedTotal), small: true, hint: `${many(T, 'nInvoices', sum.owed.length, lang)}  ·  ${many(T, 'nFamilies', sum.owedFamilies, lang)}` },
            { label: T('feesOverdue'), value: vnd(sum.overdueTotal), small: true, tone: sum.overdueTotal ? 'text-red-700' : 'text-slate-400', hint: `${many(T, 'nInvoices', sum.overdue.length, lang)} ${T('pastDue')}` },
            { label: T('feesCollected'), value: sum.collectedPct == null ? '—' : `${sum.collectedPct}%`, tone: 'text-slate-800',
              bar: sum.collectedPct != null && { pct: sum.collectedPct, color: GREEN },
              hint: T('collectedHint', { paid: vndShort(sum.yearPaid, lang), total: vndShort(sum.yearInvoiced, lang), y: schoolYear }) },
          ]} />
        }
        if (b.type === 'overview') return <Overview T={T} lang={lang} sum={sum} period={period} />
        if (b.type === 'list') return <ListBlock b={b} T={T} />
        return null
      }} />
  )
}

function Overview({ T, lang, sum, period }) {
  const bins = sum.monthly.map((m) => ({ key: m.key, label: monthShort(m.key, lang), values: [m.invoiced, m.received] }))
  const methods = Object.entries(sum.byMethod).sort((a, b) => b[1] - a[1])
  return (
    <div className="grid grid-cols-[150mm_1fr] gap-[9mm]" style={{ height: mm(H.title + OVERVIEW), marginBottom: mm(H.gap) }}>
      <div className="min-w-0">
        <SectionTitle>{T('invoicedReceivedByMonth')}</SectionTitle>
        <ColumnChart bins={bins} series={[{ label: T('feesInvoiced'), color: BLUE_SOFT }, { label: T('feesReceived'), color: BLUE }]}
          width={150} height={OVERVIEW} labels="all" strong={period === 'year' ? undefined : period} format={(v) => vndShort(v, lang)} emptyText={T('noPayments')} />
      </div>
      <div className="min-w-0">
        <SectionTitle>{T('owedByAge')}</SectionTitle>
        <HBars labelW={46} valueW={26} rows={AGE_BANDS.map((k) => ({
          label: T(AGE_LABEL[k]), sub: sum.bands[k].count ? many(T, 'nInvoices', sum.bands[k].count, lang) : '',
          value: sum.bands[k].amount, shown: vnd(sum.bands[k].amount), color: AGE_COLORS[k],
        }))} />
        <div style={{ height: mm(4) }} />
        <SectionTitle>{T('receivedByMethod')}</SectionTitle>
        {methods.length ? (
          <HBars labelW={46} valueW={26} max={Math.max(1, ...methods.map((m) => m[1]))} rows={methods.slice(0, 2).map(([m, v]) => ({ label: T(m), value: v, shown: vnd(v), color: BLUE }))} />
        ) : <div className="text-[8pt] text-slate-400">{T('noPayments')}</div>}
      </div>
    </div>
  )
}

const statusTone = { paid: 'text-green-700', partial: 'text-amber-700', sent: 'text-slate-600' }

const paymentCols = (T, lang) => [
  { label: T('colDate'), w: '17mm', className: 'tabular-nums text-slate-600', cell: (p) => shortDate(p.day, lang) },
  { label: T('colReceipt'), w: '27mm', className: 'tabular-nums text-slate-600', cell: (p) => p.receipt_number || '—' },
  { label: T('colInvoice'), w: '27mm', className: 'tabular-nums text-slate-600', cell: (p) => p.inv?.number || '' },
  { label: T('colFamily'), w: 'minmax(0,1fr)', cell: (p) => <b className="text-slate-800">{p.family || '—'}</b> },
  { label: T('colStudents'), w: 'minmax(0,1.2fr)', className: 'text-slate-600', cell: (p) => p.student_names || p.inv?.student_names || '' },
  { label: T('colMethod'), w: '28mm', className: 'text-slate-600', cell: (p) => T(p.method || 'transfer') },
  { label: T('colAmount'), w: '30mm', right: true, className: 'font-bold text-slate-800', cell: (p) => vnd(p.amount) },
]

const owedCols = (T, lang) => [
  { label: T('colInvoice'), w: '26mm', className: 'tabular-nums text-slate-600', cell: (x) => x.number },
  { label: T('colFamily'), w: 'minmax(0,1fr)', cell: (x) => <b className="text-slate-800">{x.family || '—'}</b> },
  { label: T('colStudents'), w: 'minmax(0,1.1fr)', className: 'text-slate-600', cell: (x) => x.student_names },
  { label: T('colPeriod'), w: '26mm', className: 'text-slate-600', cell: (x) => x.period_label },
  { label: T('colDue'), w: '17mm', className: 'tabular-nums text-slate-600', cell: (x) => (x.due ? shortDate(x.due, lang) : '—') },
  { label: T('colTotal'), w: '25mm', right: true, className: 'text-slate-600', cell: (x) => vnd(x.total) },
  { label: T('colPaid'), w: '25mm', right: true, className: 'text-slate-600', cell: (x) => (x.paidAsOf ? vnd(x.paidAsOf) : '—') },
  { label: T('colBalance'), w: '25mm', right: true, className: 'font-bold text-slate-800', cell: (x) => vnd(x.balance) },
  { label: T('colLate'), w: '20mm', right: true, cell: (x) => (x.late ? <b className={x.late > 30 ? 'text-red-700' : 'text-amber-700'}>{many(T, 'nDays', x.late, lang)}</b> : <span className="text-slate-400">{T('notDueYet')}</span>) },
]

const issuedCols = (T, lang) => [
  { label: T('colInvoice'), w: '26mm', className: 'tabular-nums text-slate-600', cell: (i) => i.number },
  { label: T('colIssued'), w: '17mm', className: 'tabular-nums text-slate-600', cell: (i) => shortDate(i.day, lang) },
  { label: T('colFamily'), w: 'minmax(0,1fr)', cell: (i) => <b className="text-slate-800">{i.family || '—'}</b> },
  { label: T('colStudents'), w: 'minmax(0,1.2fr)', className: 'text-slate-600', cell: (i) => i.student_names },
  { label: T('colPeriod'), w: '30mm', className: 'text-slate-600', cell: (i) => i.period_label },
  { label: T('colTotal'), w: '28mm', right: true, className: 'font-bold text-slate-800', cell: (i) => vnd(i.total) },
  { label: T('colStatus'), w: '30mm', right: true, cell: (i) => <span className={`font-semibold ${statusTone[i.status] || 'text-slate-600'}`}>{T(i.status)}</span> },
]
