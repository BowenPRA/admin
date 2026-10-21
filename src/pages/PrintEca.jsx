import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { useT, tFor } from '../lib/i18n'
import { many } from '../lib/printFormat'
import { useOffDays, sessionDates, activitiesOf, membersOf, weekdayName, timeText, yearGroupsText, activityName, teacherName, todayLocal } from '../lib/eca'
import { PrintShell, Masthead, layout, usePrintLang, H, mm, bodyWidth } from '../components/print/Sheets'

// ECA registers on paper: one A4 portrait sheet per activity, its students down the side
// and one box per session across, with the marks already taken filled in, so the teacher
// can take the register on paper and the office can see who should be collected at the end.
// ?activity=<id> prints one activity, ?term=<id> every activity in the term.

const ORIENT = 'portrait'
const ROW = 7.2
const HEAD = 15 // the activity's own heading, when several are printed
const nameOf = (s) => s.nickname || s.full_name || ''
const dayShort = (iso, lang) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'numeric' }) }

export default function PrintEca() {
  const { t } = useT()
  const { loading, eca, students, teachers } = useData()
  const { displayName } = useAuth()
  const [params, setParams] = useSearchParams()
  const { lang, setLang } = usePrintLang(params, setParams)
  const T = useMemo(() => tFor(lang), [lang])
  const offDays = useOffDays()
  const one = eca.activities.find((a) => a.id === params.get('activity'))
  const term = eca.terms.find((x) => x.id === (one ? one.term_id : params.get('term')))
  const activities = useMemo(() => (one ? [one] : term ? activitiesOf(eca, term.id) : []), [one, term, eca])

  // The marks taken so far, for every activity printed.
  const [marks, setMarks] = useState(null)
  const ids = activities.map((a) => a.id).join(',')
  useEffect(() => {
    let alive = true
    Promise.all(activities.map((a) => db.eca.attendance.list({ activity_id: a.id }).catch(() => [])))
      .then((lists) => alive && setMarks(lists.flat()))
    return () => { alive = false }
  }, [ids]) // eslint-disable-line react-hooks/exhaustive-deps

  const sheets = useMemo(() => {
    if (!marks || !offDays || !term) return []
    const blocks = [{ type: 'masthead', h: H.masthead }]
    activities.forEach((a, i) => {
      const list = membersOf(eca, a.id, students)
      const rows = list.filter((x) => x.m.status === 'joined').map((x) => x.s)
      const waiting = list.filter((x) => x.m.status === 'waiting').map((x) => x.s)
      const sessions = sessionDates(a, term, offDays)
      const named = activities.length > 1
      // An empty list still prints, with a few lines to write names on.
      const lines = rows.length ? rows : [null, null, null]
      blocks.push({ type: 'reg', a, rows: lines, sessions, waiting, named, keep: true, min: 2, row: ROW, newSheet: i > 0 ? 'always' : false,
        head: (first) => (first && named ? HEAD : 0) + H.listHead, tail: (last) => (last && waiting.length ? 6 : 0) + H.gap })
    })
    return layout(blocks, ORIENT)
  }, [marks, offDays, term, activities, eca, students])

  const title = one ? activityName(one, lang) : T('ecaPrintAllTitle')
  const sub = one
    ? [weekdayName(one.weekday, lang), timeText(term, lang), teacherName(one.teacher_email, teachers), yearGroupsText(one.year_groups, lang), one.room].filter(Boolean).join('  ·  ')
    : [term?.name, term && `${dayShort(term.from_date, lang)}–${dayShort(term.to_date, lang)}`, timeText(term, lang)].filter(Boolean).join('  ·  ')
  const back = one ? `/eca?activity=${one.id}` : term ? `/eca?term=${term.id}` : '/eca'

  return (
    <PrintShell T={T} lang={lang} setLang={setLang} orientation={ORIENT} back={back} by={displayName}
      loading={loading || !marks || !offDays} sheets={sheets} empty={t('ecaNoActivities')}
      docTitle={`${T('ecaPrintTitle')} - ${title}`}
      running={<><span className="font-bold text-pra-navy">{T('ecaPrintTitle')}</span>  ·  {title}</>}
      footLeft={() => <span>{[term?.note, T('ecaPrintKey')].filter(Boolean).join('  ·  ')}</span>}
      renderBlock={(b) => {
        if (b.type === 'masthead') return <Masthead overline={`${T('ecaPrintTitle')}  ·  ${term?.name || ''}`} title={title} sub={sub} />
        if (b.type === 'reg') return <RegisterBlock b={b} T={T} lang={lang} term={term} teachers={teachers} marks={marks} />
        return null
      }} />
  )
}

function RegisterBlock({ b, T, lang, term, teachers, marks }) {
  const { a, sessions } = b
  const today = todayLocal()
  // Name, year group and allergies on the left; one box per session; the total on the right.
  const fixed = 7 + 44 + 20 + 12
  const room = bodyWidth(ORIENT) - fixed - 2 * (sessions.length + 4)
  const health = sessions.length <= 8 ? 30 : 0
  const box = Math.max(7, Math.min(13, (room - health) / Math.max(1, sessions.length)))
  const cols = `7mm 44mm 20mm ${health ? `${health}mm ` : ''}${sessions.map(() => `${box}mm`).join(' ')} 12mm`
  const glyph = { present: '✓', late: lang === 'vi' ? 'T' : 'L', absent: lang === 'vi' ? 'V' : 'A' }
  const tone = { present: 'text-green-700', late: 'text-amber-600', absent: 'font-bold text-red-700' }
  const markOf = (sid, d) => marks.find((r) => r.activity_id === a.id && r.student_id === sid && r.date === d)?.status
  const held = sessions.filter((d) => d <= today)
  const first = b.first !== false
  return (
    <div style={{ height: mm(b.h - H.gap), marginBottom: mm(H.gap) }}>
      {first && b.named && (
        <div className="flex items-stretch gap-[2.5mm]" style={{ height: mm(HEAD - 3), marginBottom: mm(3) }}>
          <span className="w-[1.3mm] flex-none rounded-full bg-pra-blue" />
          <div className="min-w-0">
            <div className="text-[14pt] font-black leading-tight text-pra-navy">{activityName(a, lang)}</div>
            <div className="truncate text-[7.5pt] text-slate-500">{[weekdayName(a.weekday, lang), timeText(term, lang), teacherName(a.teacher_email, teachers), yearGroupsText(a.year_groups, lang), a.room, many(T, 'nStudents', b.rows.filter(Boolean).length, lang)].filter(Boolean).join('  ·  ')}</div>
          </div>
        </div>
      )}
      <div className="ps-thead grid items-end" style={{ gridTemplateColumns: cols, height: mm(H.listHead) }}>
        <span />
        <span>{T('studentCol')}</span>
        <span>{T('yearGroup')}</span>
        {health > 0 && <span>{T('colHealth')}</span>}
        {sessions.map((d) => <span key={d} className="text-center normal-case tracking-normal">{dayShort(d, lang)}</span>)}
        <span className="text-right">{T('ecaCame')}</span>
      </div>
      {b.rows.map((s, k) => (
        <div key={s?.id || `blank-${k}`} className="ps-row grid items-center" style={{ gridTemplateColumns: cols, height: mm(ROW) }}>
          <span className="text-[7pt] tabular-nums text-slate-400">{s ? k + 1 : ''}</span>
          <span className="min-w-0 leading-tight">
            {s && <><span className="block truncate font-bold text-slate-900">{nameOf(s)}</span>{s.nickname && <span className="block truncate text-[6.5pt] text-slate-500">{s.full_name}</span>}</>}
          </span>
          <span className="truncate text-[7.5pt] text-slate-600">{s?.level || ''}</span>
          {health > 0 && <span className="truncate text-[7pt] font-semibold text-red-700">{s?.allergies || ''}</span>}
          {sessions.map((d) => {
            const st = s && markOf(s.id, d)
            return <span key={d} className="flex justify-center"><span className={`flex h-[5mm] w-[5mm] items-center justify-center rounded-[0.8mm] border border-slate-300 text-[8pt] ${st ? tone[st] : ''}`}>{st ? glyph[st] : ''}</span></span>
          })}
          <span className="text-right text-[8pt] font-bold tabular-nums text-slate-700">{s && held.length ? `${held.filter((d) => ['present', 'late'].includes(markOf(s.id, d))).length}/${held.length}` : ''}</span>
        </div>
      ))}
      {b.last && b.waiting.length > 0 && (
        <div className="truncate pt-[1.5mm] text-[7.5pt] text-amber-800" style={{ height: mm(6) }}>
          <b>{T('ecaWaiting')}:</b> {b.waiting.map((s) => `${nameOf(s)} (${s.level})`).join(', ')}
        </div>
      )}
    </div>
  )
}
