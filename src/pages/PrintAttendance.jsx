import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { useT, tFor } from '../lib/i18n'
import { classForYearGroup } from '../lib/schedule'
import { partialFrom } from '../lib/studentRecords'
import { attendancePeriods, defaultPeriod, yearGroupsOf, summarizeAttendance, nameOf, parseIso, LOW_RATE } from '../lib/attendanceSummary'
import { dayOf, weekday, shortDate, monthShort, monthLong, dateList, num, many } from '../lib/printFormat'
import { PrintShell, Masthead, KpiTiles, SectionTitle, ColumnChart, ListBlock, listBlock, layout, usePrintLang, H, mm, GREEN, AMBER, RED, BLUE } from '../components/print/Sheets'

// The attendance summary on paper: A4 landscape sheets for a month, a quarter or
// the academic year. With more than one year group, the first sheet is an overview
// (totals, each year group, absences day by day, students below 90%); each year
// group's register follows, with its notes. The sheets come from components/print/Sheets.

// Heights in mm of this page's own blocks.
const MM = { chartMin: 58, regHead: 14, regHeadCont: 8, gridHead: 9.5, gridRow: 6.2, noteTitle: 6.5, noteRow: 4.6 }
const rateTone = (rate) => (rate == null ? 'text-slate-300' : rate < LOW_RATE ? 'text-amber-600' : 'text-green-700')

export default function PrintAttendance() {
  const { t, lang: appLang } = useT()
  const { loading, students, calendar, schedule, travel: trips } = useData()
  const { canAttendance, isOffice, myYearGroups, displayName } = useAuth()
  const [params, setParams] = useSearchParams()
  const { lang, setLang, setParam } = usePrintLang(params, setParams)
  const T = useMemo(() => tFor(lang), [lang])

  const menuPeriods = useMemo(() => attendancePeriods(calendar, appLang), [calendar, appLang])
  const periods = useMemo(() => attendancePeriods(calendar, lang), [calendar, lang])
  const period = defaultPeriod(periods, params.get('period'))
  const allowed = useMemo(() => yearGroupsOf(students).filter(canAttendance), [students, canAttendance])
  const group = allowed.includes(params.get('group')) ? params.get('group') : ''
  const groups = useMemo(() => (group ? [group] : allowed), [group, allowed])
  const scoped = !isOffice && !!myYearGroups
  const groupLabel = group || (scoped ? allowed.join(', ') : T('allYearGroups'))

  const rangeKey = period ? `${period.from}|${period.to}` : ''
  const [loaded, setLoaded] = useState({ key: null, rows: [], error: '' })
  useEffect(() => {
    if (!rangeKey) return
    let alive = true
    const [from, to] = rangeKey.split('|')
    db.attendance.between(from, to)
      .then((rows) => alive && setLoaded({ key: rangeKey, rows, error: '' }))
      .catch((e) => alive && setLoaded({ key: rangeKey, rows: [], error: e.message || String(e) }))
    return () => { alive = false }
  }, [rangeKey])
  const rows = loaded.key === rangeKey ? loaded.rows : null

  const sum = useMemo(() => (rows && period ? summarizeAttendance({ rows, students, groups, period, calendar, trips }) : null), [rows, students, groups, period, calendar, trips])
  const homeroomOf = (g) => (schedule ? classForYearGroup(schedule, g)?.homeroom || '' : '')
  const multi = groups.length > 1

  const sheets = useMemo(() => {
    if (!sum?.students) return []
    const shown = sum.groups.filter((x) => x.students.length)
    const blocks = [{ type: 'masthead', h: H.masthead }, { type: 'kpis', h: H.kpis }]
    if (multi) {
      blocks.push({ type: 'overview', h: H.title + Math.max(H.tableHead + shown.length * H.tableRow, MM.chartMin) + H.gap })
      blocks.push(listBlock({ type: 'list', rows: sum.low, title: T('studentsBelow', { rate: LOW_RATE }), empty: T('noneBelow', { rate: LOW_RATE }), cols: lowCols(T, lang) }))
    }
    shown.forEach((g, i) => {
      blocks.push({
        type: 'register', g, newSheet: multi && i === 0, rows: g.students, min: 3, keep: true, row: MM.gridRow,
        head: (first) => (first ? MM.regHead : MM.regHeadCont) + MM.gridHead,
        tail: (last) => (last ? MM.gridRow : 0) + H.gap,
      })
      if (g.notes.length) blocks.push({ type: 'notes', g, rows: g.notes, min: 2, row: MM.noteRow, head: () => MM.noteTitle, tail: () => H.gap - 1 })
    })
    return layout(blocks)
  }, [sum, multi, T, lang])

  const ctx = { T, lang, sum, period, groupLabel, homeroomOf, multi, view: period?.kind === 'month' ? 'days' : 'months' }
  const only = !multi && sum?.groups[0]

  return (
    <PrintShell T={T} lang={lang} setLang={setLang} back="/attendance?tab=summary" by={displayName}
      loading={loading || !calendar || (!!period && !sum)} error={loaded.error} sheets={sheets}
      docTitle={period && `${T('attendanceSummary')} - ${period.title} - ${groupLabel}`}
      running={period && <><span className="font-bold text-pra-navy">{T('attendanceSummary')}</span>  ·  {period.title}  ·  {groupLabel}</>}
      footLeft={(blocks) => (blocks.some((b) => b.type === 'register') ? <Legend T={T} view={ctx.view} /> : null)}
      controls={period && (<>
        <select className="input w-auto" value={period.key} onChange={(e) => setParam('period', e.target.value)} aria-label={t('period')}>
          {menuPeriods.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        {allowed.length > 1 && (
          <select className="input w-auto" value={group} onChange={(e) => setParam('group', e.target.value)} aria-label={t('yearGroup')}>
            <option value="">{scoped ? allowed.join(', ') : t('allYearGroups')}</option>
            {allowed.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
      </>)}
      renderBlock={(b) => {
        if (b.type === 'masthead') {
          const sub = [period.range, groupLabel, many(T, 'nStudents', sum.students, lang), only && homeroomOf(only.g) ? `${T('homeroomTeacher')}: ${homeroomOf(only.g)}` : ''].filter(Boolean).join('  ·  ')
          return <Masthead overline={T('attendanceSummary')} title={period.title} sub={sub} />
        }
        if (b.type === 'kpis') {
          return <KpiTiles tiles={[
            { label: T('attendanceRate'), value: sum.rate == null ? '—' : `${sum.rate}%`, tone: rateTone(sum.rate), hint: T('rateHint', { n: num(sum.marked, lang) }), bar: sum.rate != null && { pct: sum.rate, color: sum.rate < LOW_RATE ? AMBER : GREEN } },
            { label: T('absences'), value: num(sum.absences, lang), mark: RED, hint: many(T, 'absentStudentsHint', sum.absentStudents, lang) },
            { label: T('lateArrivals'), value: num(sum.late, lang), mark: AMBER, hint: many(T, 'lateStudentsHint', sum.lateStudents, lang) },
            { label: T('fullAttendance'), value: num(sum.perfect, lang), mark: GREEN, hint: T('fullAttendanceHint') },
            { label: T('classDays'), value: sum.classDays.length, of: period.days, hint: T('classDaysHint'), warn: sum.unmarked ? many(T, 'marksMissing', sum.unmarked, lang) : '' },
          ]} />
        }
        if (b.type === 'overview') return <Overview h={b.h} {...ctx} />
        if (b.type === 'list') return <ListBlock b={b} T={T} />
        if (b.type === 'register') return <Register b={b} {...ctx} />
        if (b.type === 'notes') return <Notes b={b} {...ctx} />
        return null
      }} />
  )
}

const lowCols = (T, lang) => [
  { label: T('studentCol'), w: 'minmax(0,1fr)', cell: (x) => <><b className="text-slate-800">{nameOf(x.s)}</b>{x.s.nickname && <span className="text-slate-400">  {x.s.full_name}</span>}</> },
  { label: T('yearGroup'), w: '26mm', className: 'text-slate-600', cell: (x) => x.s.level },
  { label: T('rate'), w: '14mm', right: true, className: 'font-bold text-amber-600', cell: (x) => `${x.rate}%` },
  { label: T('absent'), w: '13mm', right: true, className: 'font-bold text-red-700', cell: (x) => x.absences },
  { label: T('late'), w: '11mm', right: true, cell: (x) => <span className={x.late ? 'text-amber-700' : 'text-slate-300'}>{x.late}</span> },
  { label: T('absentOn'), w: '92mm', className: 'pl-[5mm] text-slate-600', cell: (x) => dateList(x.absentOn, lang) },
]

function Legend({ T, view }) {
  if (view === 'months') {
    return (
      <span className="flex items-center gap-[4mm]">
        <span className="flex items-center gap-[1.2mm]"><span className="att-tint-low inline-block h-[3mm] w-[5mm] rounded-[0.6mm]" />{T('lowAttendance')}</span>
        <span className="flex items-center gap-[1.2mm]"><span className="att-a inline-flex !h-[3.2mm] !min-w-[4.4mm] !text-[5.5pt]">{T('absentLetter')}2</span>{T('absences')}</span>
        <span className="flex items-center gap-[1.2mm]"><span className="att-t inline-flex !h-[3.2mm] !min-w-[4.4mm] !text-[5.5pt]">{T('travelLetter')}2</span>{T('travelDays')}</span>
      </span>
    )
  }
  return (
    <span className="flex items-center gap-[3.5mm]">
      <span className="flex items-center gap-[1.2mm]"><span className="att-p" />{T('present')}</span>
      <span className="flex items-center gap-[1.2mm]"><span className="att-l">{T('lateLetter')}</span>{T('late')}</span>
      <span className="flex items-center gap-[1.2mm]"><span className="att-a">{T('absentLetter')}</span>{T('absent')}</span>
      <span className="flex items-center gap-[1.2mm]"><span className="att-t">{T('travelLetter')}</span>{T('absentTravelLong')}</span>
      <span className="flex items-center gap-[1.2mm]"><span className="att-u">–</span>{T('notMarked')}</span>
      <span className="flex items-center gap-[1.2mm]"><span className="att-none inline-block h-[3mm] w-[3mm] rounded-[0.5mm]" />{T('legendNoClass')}</span>
      <span className="flex items-center gap-[1.2mm]"><span className="att-out inline-block h-[3mm] w-[3mm] rounded-[0.5mm]" />{T('legendNotEnrolled')}</span>
    </span>
  )
}

function Overview({ h, T, lang, sum, period, homeroomOf }) {
  const shown = sum.groups.filter((x) => x.students.length)
  const anyMissing = shown.some((x) => x.unmarked)
  const cols = `minmax(0,1fr) 13mm 44mm 13mm 11mm${anyMissing ? ' 15mm' : ''}`
  // Absences (red, from the baseline) and late arrivals (amber, above) per class day, or per month for the year.
  const bins = period.kind === 'year'
    ? sum.months.map((k) => {
      const days = sum.classDays.filter((d) => d.startsWith(k))
      return { key: k, label: monthShort(k, lang), values: [days.reduce((n, d) => n + sum.daily[d].absent + sum.daily[d].travel, 0), days.reduce((n, d) => n + sum.daily[d].late, 0)] }
    })
    : sum.classDays.map((d) => ({
      key: d, values: [sum.daily[d].absent + sum.daily[d].travel, sum.daily[d].late],
      // A quarter has too many days to number them all: Mondays carry the date.
      label: period.kind === 'month' ? String(dayOf(d)) : parseIso(d).getDay() === 1 ? shortDate(d, lang) : '',
    }))
  return (
    <div className="grid grid-cols-[148mm_1fr] gap-[8mm]" style={{ height: mm(h - H.gap), marginBottom: mm(H.gap) }}>
      <div>
        <SectionTitle>{T('byYearGroup')}</SectionTitle>
        <div className="ps-thead grid items-end" style={{ gridTemplateColumns: cols, height: mm(H.tableHead) }}>
          <span>{T('yearGroup')}</span><span className="text-right">{T('studentsCol')}</span><span className="pl-[3mm]">{T('attendanceRate')}</span>
          <span className="text-right">{T('absent')}</span><span className="text-right">{T('late')}</span>{anyMissing && <span className="text-right">{T('notMarked')}</span>}
        </div>
        {shown.map((x) => (
          <div key={x.g} className="ps-row grid items-center" style={{ gridTemplateColumns: cols, height: mm(H.tableRow) }}>
            <span className="truncate"><b className="text-slate-800">{x.g}</b>{homeroomOf(x.g) && <span className="text-slate-400">  ·  {homeroomOf(x.g)}</span>}</span>
            <span className="text-right tabular-nums text-slate-600">{x.students.length}</span>
            <span className="flex items-center gap-[2mm] pl-[3mm]">
              <span className="h-[1.8mm] flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full" style={{ width: `${x.rate ?? 0}%`, background: x.rate != null && x.rate < LOW_RATE ? AMBER : BLUE }} /></span>
              <b className={`w-[9mm] text-right tabular-nums ${rateTone(x.rate)}`}>{x.rate == null ? '—' : `${x.rate}%`}</b>
            </span>
            <span className={`text-right tabular-nums ${x.absences ? 'font-bold text-red-700' : 'text-slate-300'}`}>{x.absences}</span>
            <span className={`text-right tabular-nums ${x.late ? 'text-amber-700' : 'text-slate-300'}`}>{x.late}</span>
            {anyMissing && <span className={`text-right tabular-nums ${x.unmarked ? 'font-semibold text-amber-700' : 'text-slate-300'}`}>{x.unmarked}</span>}
          </div>
        ))}
      </div>
      <div className="min-w-0">
        <SectionTitle>{period.kind === 'year' ? T('absencesByMonth') : T('absencesByDay')}</SectionTitle>
        <ColumnChart bins={bins} series={[{ label: T('absent'), color: RED }, { label: T('late'), color: AMBER }]} stacked
          labels={bins.length <= 23 ? 'all' : 'max'} width={117} height={h - H.title - H.gap} emptyText={T('noAbsencesPeriod')} />
      </div>
    </div>
  )
}

function Register({ b, T, lang, sum, homeroomOf, view, multi }) {
  const g = b.g
  const cols = view === 'days' ? sum.days : sum.months.map((k) => ({ month: k }))
  const template = `54mm repeat(${cols.length}, minmax(0,1fr)) repeat(4, 11mm) 13mm`
  const headH = b.first ? MM.regHead : MM.regHeadCont
  const notTaken = new Set(g.notTaken)
  const stats = [
    [T('attendanceRate'), g.rate == null ? '—' : `${g.rate}%`, rateTone(g.rate)],
    [T('absences'), g.absences, g.absences ? 'text-red-700' : 'text-slate-400'],
    [T('lateArrivals'), g.late, g.late ? 'text-amber-700' : 'text-slate-400'],
    [T('fullAttendance'), g.perfect, 'text-slate-800'],
  ]
  // A new week starts with a slightly stronger line, so the month reads in weeks.
  const weekStart = (c, i) => view === 'days' && i > 0 && parseIso(c.date).getDay() === 1
  const sub = [homeroomOf(g.g) && `${T('homeroomTeacher')}: ${homeroomOf(g.g)}`, many(T, 'nStudents', g.students.length, lang)].filter(Boolean).join('  ·  ')
  return (
    <div style={{ height: mm(b.h - H.gap), marginBottom: mm(H.gap) }}>
      {b.first ? (
        <div className="flex items-start justify-between gap-6" style={{ height: mm(headH) }}>
          <div className="flex min-w-0 items-stretch gap-[2.5mm]">
            <span className="w-[1.3mm] flex-none rounded-full bg-pra-blue" />
            <div className="min-w-0">
              <div className="text-[13pt] font-black leading-tight text-pra-navy">{g.g}</div>
              <div className="truncate text-[7.5pt] text-slate-500">{sub}{g.notTaken.length > 0 && <span className="font-semibold text-amber-700">  ·  {T('notTakenOn', { dates: dateList(g.notTaken, lang) })}</span>}</div>
            </div>
          </div>
          <div className="flex flex-none gap-[6mm]">
            {multi && stats.map(([label, value, tone]) => (
              <div key={label} className="text-right">
                <div className="text-[6pt] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</div>
                <div className={`text-[12pt] font-black leading-tight tabular-nums ${tone}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center text-[8.5pt] font-bold text-pra-navy" style={{ height: mm(headH) }}>{g.g} <span className="ml-[1.5mm] font-normal text-slate-400">({T('continued')})</span></div>
      )}

      <div className="att-grid" style={{ gridTemplateColumns: template, gridTemplateRows: `${MM.gridHead}mm repeat(${b.rows.length}, ${MM.gridRow}mm)${b.last ? ` ${MM.gridRow}mm` : ''}` }}>
        {/* Column heads */}
        <div className="att-gh justify-start pl-[1.5mm]" style={{ height: mm(MM.gridHead) }}>{T('studentCol')}</div>
        {cols.map((c, i) => view === 'days' ? (
          <div key={c.date} className={`att-gh flex-col ${c.state === 'none' ? 'att-none' : ''} ${weekStart(c, i) ? 'att-week' : ''}`} style={{ height: mm(MM.gridHead) }}>
            <span className="text-[5.5pt] font-semibold text-slate-400">{weekday(c.date, lang)}</span>
            <span className={`text-[7.5pt] font-bold ${c.state === 'class' ? 'text-slate-700' : 'text-slate-400'}`}>{dayOf(c.date)}</span>
          </div>
        ) : (
          <div key={c.month} className="att-gh" style={{ height: mm(MM.gridHead) }}>{monthLong(c.month, lang)}</div>
        ))}
        <div className="att-gh att-tot">{T('present')}</div>
        <div className="att-gh">{T('late')}</div>
        <div className="att-gh">{T('absent')}</div>
        <div className="att-gh">{T('absentTravel')}</div>
        <div className="att-gh">{T('rate')}</div>

        {/* One row per student */}
        {b.rows.map((x, r) => {
          const zebra = r % 2 ? 'att-zebra' : ''
          return [
            <div key={`${x.s.id}-n`} className={`att-c justify-start gap-[1.5mm] overflow-hidden pl-[1.5mm] ${zebra}`} style={{ height: mm(MM.gridRow) }}>
              <b className="flex-none text-[7.5pt] text-slate-800">{nameOf(x.s)}</b>
              {x.s.nickname && <span className="truncate text-[6.5pt] text-slate-400">{x.s.full_name}</span>}
              {partialFrom(x.s) && <span className="flex-none rounded-[0.6mm] bg-amber-50 px-[0.8mm] text-[5.5pt] font-bold text-amber-700">{T('fromTime', { time: partialFrom(x.s) })}</span>}
            </div>,
            ...cols.map((c, i) => view === 'days'
              ? <DayCell key={`${x.s.id}-${c.date}`} T={T} day={c} x={x} zebra={zebra} week={weekStart(c, i)} missed={notTaken.has(c.date)} />
              : <MonthCell key={`${x.s.id}-${c.month}`} T={T} m={x.months[c.month]} zebra={zebra} />),
            <div key={`${x.s.id}-p`} className={`att-c att-tot tabular-nums text-slate-700 ${zebra}`}>{x.present}</div>,
            <div key={`${x.s.id}-l`} className={`att-c tabular-nums ${x.late ? 'text-amber-700' : 'text-slate-300'} ${zebra}`}>{x.late}</div>,
            <div key={`${x.s.id}-a`} className={`att-c tabular-nums ${x.absent ? 'font-bold text-red-700' : 'text-slate-300'} ${zebra}`}>{x.absent}</div>,
            <div key={`${x.s.id}-t`} className={`att-c tabular-nums ${x.travel ? 'font-bold text-violet-700' : 'text-slate-300'} ${zebra}`}>{x.travel}</div>,
            <div key={`${x.s.id}-r`} className={`att-c font-extrabold tabular-nums ${rateTone(x.rate)} ${zebra}`}>{x.rate == null ? '—' : `${x.rate}%`}</div>,
          ]
        })}

        {/* Class line under the last row: absences each day, or the class's rate each month. */}
        {b.last && [
          <div key="f-n" className="att-c att-foot justify-start pl-[1.5mm] text-[6.5pt] font-bold uppercase tracking-[0.06em] text-slate-500" style={{ height: mm(MM.gridRow) }}>{view === 'days' ? T('absent') : T('attendanceRate')}</div>,
          ...cols.map((c, i) => {
            if (view === 'days') {
              const a = (g.daily[c.date]?.absent || 0) + (g.daily[c.date]?.travel || 0)
              return <div key={`f-${c.date}`} className={`att-c att-foot tabular-nums ${c.state === 'none' ? 'att-none' : ''} ${weekStart(c, i) ? 'att-week' : ''} ${a ? 'font-bold text-red-700' : ''}`}>{a || ''}</div>
            }
            const m = g.months[c.month]
            return <div key={`f-${c.month}`} className={`att-c att-foot font-bold tabular-nums ${rateTone(m.rate)}`}>{m.rate == null ? '' : `${m.rate}%`}</div>
          }),
          <div key="f-p" className="att-c att-foot att-tot font-bold tabular-nums text-slate-700">{g.present}</div>,
          <div key="f-l" className={`att-c att-foot font-bold tabular-nums ${g.late ? 'text-amber-700' : 'text-slate-300'}`}>{g.late}</div>,
          <div key="f-a" className={`att-c att-foot font-bold tabular-nums ${g.absent ? 'text-red-700' : 'text-slate-300'}`}>{g.absent}</div>,
          <div key="f-t" className={`att-c att-foot font-bold tabular-nums ${g.travel ? 'text-violet-700' : 'text-slate-300'}`}>{g.travel}</div>,
          <div key="f-r" className={`att-c att-foot font-black tabular-nums ${rateTone(g.rate)}`}>{g.rate == null ? '—' : `${g.rate}%`}</div>,
        ]}
      </div>
    </div>
  )
}

function DayCell({ T, day, x, zebra, week, missed }) {
  const cls = `att-c ${zebra} ${week ? 'att-week' : ''}`
  if (day.state === 'none') return <div className={`${cls} att-none`} />
  if (day.state === 'future') return <div className={cls} />
  const m = x.marks[day.date]
  // A mark made after an expected end date shows: that date is only expected.
  if (!x.expected(day.date) && !(m && x.until && day.date > x.until)) return <div className={`${cls} att-out`} />
  const noted = m && (m.note || '').trim()
  const glyph = !m ? <span className="att-u">–</span>
    : m.status === 'present' ? <span className="att-p" />
      : m.status === 'late' ? <span className="att-l">{T('lateLetter')}</span>
        : m.status === 'travel' ? <span className="att-t">{T('travelLetter')}</span>
          : <span className="att-a">{T('absentLetter')}</span>
  return (
    <div className={`${cls} relative ${!m && missed ? 'att-missed' : ''}`}>
      {glyph}
      {noted && <span className="att-noted" />}
    </div>
  )
}

function MonthCell({ T, m, zebra }) {
  if (!m?.marked) return <div className={`att-c text-slate-300 ${zebra}`}>{m?.travel ? <span className="att-t !h-[3.2mm] !min-w-[4.4mm] !text-[5.5pt]">{T('travelLetter')}{m.travel}</span> : '–'}</div>
  return (
    <div className={`att-c gap-[1.2mm] ${zebra} ${m.rate < LOW_RATE ? 'att-tint-low' : ''}`}>
      <span className={`text-[7.5pt] tabular-nums ${m.rate < LOW_RATE ? 'font-extrabold text-amber-700' : m.rate === 100 ? 'text-slate-400' : 'font-bold text-slate-700'}`}>{m.rate}%</span>
      {m.absent > 0 && <span className="att-a !h-[3.2mm] !min-w-[4.4mm] !text-[5.5pt]">{T('absentLetter')}{m.absent}</span>}
      {m.travel > 0 && <span className="att-t !h-[3.2mm] !min-w-[4.4mm] !text-[5.5pt]">{T('travelLetter')}{m.travel}</span>}
    </div>
  )
}

function Notes({ b, T, lang }) {
  return (
    <div style={{ height: mm(b.h - H.gap + 1), marginBottom: mm(H.gap - 1) }}>
      <div className="flex items-end text-[7.5pt] font-bold text-slate-700" style={{ height: mm(MM.noteTitle - 1.5), marginBottom: mm(1.5) }}>
        {T('notesTitle')}  ·  {b.g.g}{!b.first && <span className="ml-[1mm] font-normal text-slate-400">({T('continued')})</span>}
      </div>
      {b.rows.map((n, i) => (
        <div key={i} className="grid grid-cols-[19mm_44mm_15mm_1fr] items-center border-b border-slate-100 text-[7pt]" style={{ height: mm(MM.noteRow) }}>
          <span className="tabular-nums text-slate-500">{weekday(n.date, lang)} {shortDate(n.date, lang)}</span>
          <b className="truncate pr-[2mm] text-slate-800">{nameOf(n.s)}</b>
          <span className={`text-[6.5pt] font-bold ${n.status === 'absent' ? 'text-red-700' : n.status === 'late' ? 'text-amber-700' : n.status === 'travel' ? 'text-violet-700' : 'text-green-700'}`}>{T(n.status)}</span>
          <span className="truncate text-slate-600">{n.note}</span>
        </div>
      ))}
    </div>
  )
}
