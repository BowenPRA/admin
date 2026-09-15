import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCheck, MessageSquare, TrendingDown } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { LEVELS } from '../lib/fees'
import { photoSrc } from '../lib/report/photo'
import { Card, Empty, Spinner, Avatar, Segmented, PageHeader } from '../components/ui'

// Daily attendance: one mark per student per school day. Separate from
// progress reports, which deliberately leave attendance out.

const STATUSES = [
  { key: 'present', short: 'P', on: 'bg-green-600 text-white border-green-600', soft: 'bg-green-100 text-green-800' },
  { key: 'late', short: 'L', on: 'bg-amber-500 text-white border-amber-500', soft: 'bg-amber-100 text-amber-800' },
  { key: 'absent', short: 'A', on: 'bg-red-600 text-white border-red-600', soft: 'bg-red-100 text-red-700' },
  { key: 'excused', short: 'E', on: 'bg-sky-600 text-white border-sky-600', soft: 'bg-sky-100 text-sky-800' },
]
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayIso = () => iso(new Date())
const parse = (s) => new Date(`${s}T00:00:00`)
const levelIndex = (l) => { const i = LEVELS.indexOf(l); return i < 0 ? 99 : i }
const isWeekend = (s) => [0, 6].includes(parse(s).getDay())
const shiftSchoolDay = (s, dir) => { const d = parse(s); do { d.setDate(d.getDate() + dir) } while ([0, 6].includes(d.getDay())); return iso(d) }

export default function Attendance() {
  const { t } = useT()
  const { loading, students } = useData()
  const { canAttendance, myYearGroups, me, isOffice } = useAuth()
  const [tab, setTab] = useState('take')
  const scoped = !isOffice && !!myYearGroups

  const enrolled = useMemo(() => students.filter((s) => s.active !== false), [students])
  const groups = useMemo(() => [...new Set(enrolled.map((s) => s.level).filter(Boolean))].sort((a, b) => levelIndex(a) - levelIndex(b)), [enrolled])
  const myGroups = useMemo(() => {
    const allowed = groups.filter(canAttendance)
    // Homeroom year groups first for teachers.
    const home = me?.homeroom_groups || []
    return [...allowed].sort((a, b) => (home.includes(b) ? 1 : 0) - (home.includes(a) ? 1 : 0) || levelIndex(a) - levelIndex(b))
  }, [groups, canAttendance, me])

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">
      <PageHeader title={t('attendance')} subtitle={scoped ? (myGroups.join(', ') || '—') : `${enrolled.length} ${t('students').toLowerCase()} · ${groups.length} ${t('yearGroup').toLowerCase()}`}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'take', label: t('takeAttendance') }, { value: 'summary', label: t('summary') }]} />
      </PageHeader>
      {!myGroups.length && tab === 'take'
        ? <Empty text={groups.length ? t('noClassesToTake') : t('noData')} />
        : tab === 'take' ? <TakeAttendance students={enrolled} groups={myGroups} /> : <Summary students={enrolled} groups={scoped ? myGroups : groups} />}
    </div>
  )
}

function TakeAttendance({ students, groups }) {
  const { t } = useT()
  const toast = useToast()
  const { displayName } = useAuth()
  const [date, setDate] = useState(() => { const d = todayIso(); return isWeekend(d) ? shiftSchoolDay(d, -1) : d })
  const [group, setGroup] = useState(groups[0])
  // Marks for the loaded date: student_id -> row. `null` while another date loads.
  const [loaded, setLoaded] = useState({ date: null, map: {} })
  const marks = loaded.date === date ? loaded.map : null
  const setMarks = (fn) => setLoaded((cur) => ({ date, map: typeof fn === 'function' ? fn(cur.map) : fn }))
  const [noteOpen, setNoteOpen] = useState({})
  const [noteDraft, setNoteDraft] = useState({})
  const activeGroup = groups.includes(group) ? group : groups[0]

  useEffect(() => {
    let alive = true
    db.attendance.list({ date })
      .then((rows) => alive && setLoaded({ date, map: Object.fromEntries(rows.map((r) => [r.student_id, r])) }))
      .catch((e) => { toast.error(e.message); if (alive) setLoaded({ date, map: {} }) })
    return () => { alive = false }
  }, [date]) // eslint-disable-line react-hooks/exhaustive-deps

  const kids = useMemo(() => students.filter((s) => s.level === activeGroup).sort((a, b) => (a.nickname || a.full_name).localeCompare(b.nickname || b.full_name)), [students, activeGroup])

  const save = async (rows) => {
    const prev = marks
    const next = { ...marks }
    rows.forEach((r) => { next[r.student_id] = { ...(marks[r.student_id] || {}), ...r } })
    setMarks(next)
    try {
      const saved = await db.attendance.mark(rows.map((r) => ({ date, year_group: activeGroup, taken_by: displayName, note: marks[r.student_id]?.note || null, ...r })))
      setMarks((cur) => { const m = { ...cur }; saved.forEach((r) => { m[r.student_id] = r }); return m })
    } catch (e) { setMarks(prev); toast.error(e.message) }
  }
  const setStatus = (s, status) => save([{ student_id: s.id, status }])
  const saveNote = (s) => {
    const note = (noteDraft[s.id] ?? marks[s.id]?.note ?? '').trim()
    if (note === (marks[s.id]?.note || '')) return
    save([{ student_id: s.id, status: marks[s.id]?.status || 'present', note: note || null }])
  }
  const markRestPresent = async () => {
    const rest = kids.filter((s) => !marks[s.id])
    if (!rest.length) return
    await save(rest.map((s) => ({ student_id: s.id, status: 'present' })))
    toast(t('attendanceSaved'))
  }

  const counts = STATUSES.reduce((m, st) => ({ ...m, [st.key]: kids.filter((s) => marks?.[s.id]?.status === st.key).length }), {})
  const unmarked = kids.filter((s) => !marks?.[s.id]).length
  const groupProgress = (g) => { const ks = students.filter((s) => s.level === g); return marks ? `${ks.filter((s) => marks[s.id]).length}/${ks.length}` : '' }
  const dateLabel = parse(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 bg-white">
          <button className="px-2 py-2 text-slate-500 hover:bg-slate-50" onClick={() => setDate(shiftSchoolDay(date, -1))} aria-label="Previous school day"><ChevronLeft size={16} /></button>
          <input type="date" className="border-x border-slate-200 px-2 py-1.5 text-sm focus:outline-none" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="px-2 py-2 text-slate-500 hover:bg-slate-50" onClick={() => setDate(shiftSchoolDay(date, 1))} aria-label="Next school day"><ChevronRight size={16} /></button>
        </div>
        {date !== todayIso() && <button className="btn-ghost text-xs" onClick={() => setDate(todayIso())}>{t('today')}</button>}
        <span className="text-sm font-semibold text-slate-600">{dateLabel}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {groups.map((g) => (
          <button key={g} type="button" onClick={() => setGroup(g)}
            className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${g === activeGroup ? 'border-pra-blue bg-pra-blue text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}>
            {g} <span className={`ml-1 text-xs font-normal ${g === activeGroup ? 'text-white/80' : 'text-slate-400'}`}>{groupProgress(g)}</span>
          </button>
        ))}
      </div>

      {isWeekend(date) && <p className="text-sm text-amber-700">{t('noSchoolDay')}</p>}

      <Card className="!p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          {STATUSES.map((st) => <span key={st.key} className={`chip ${st.soft}`}>{t(st.key)} · {counts[st.key]}</span>)}
          {unmarked > 0 && <span className="chip bg-slate-100 text-slate-600">{t('notMarked')} · {unmarked}</span>}
          <button className="btn-green ml-auto !py-1.5 text-xs" disabled={!marks || !unmarked} onClick={markRestPresent}><CheckCheck size={15} /> {t('markAllPresent')}</button>
        </div>
        {!marks ? <Spinner /> : !kids.length ? <div className="p-4"><Empty text={t('noData')} /></div> : (
          <ul className="divide-y divide-slate-100">
            {kids.map((s) => {
              const m = marks[s.id]
              const showNote = noteOpen[s.id] || !!m?.note
              return (
                <li key={s.id} className={`px-4 py-2.5 ${m ? '' : 'bg-amber-50/30'}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar src={photoSrc(s.photo)} name={s.full_name} size={36} />
                    <div className="min-w-[140px] flex-1">
                      <div className="font-semibold text-slate-800">{s.nickname || s.full_name}</div>
                      <div className="text-xs text-slate-500">{s.nickname ? s.full_name : ''} {s.student_code && <span className="font-mono">{s.student_code}</span>}</div>
                    </div>
                    <div className="flex items-center gap-1" role="radiogroup" aria-label={s.full_name}>
                      {STATUSES.map((st) => (
                        <button key={st.key} type="button" role="radio" aria-checked={m?.status === st.key} title={t(st.key)} onClick={() => setStatus(s, st.key)}
                          className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-bold transition-colors sm:min-w-[4.5rem] ${m?.status === st.key ? st.on : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'}`}>
                          <span className="sm:hidden">{st.short}</span><span className="hidden sm:inline">{t(st.key)}</span>
                        </button>
                      ))}
                      <button type="button" className={`ml-1 rounded-lg p-2 ${showNote ? 'text-pra-blue' : 'text-slate-400 hover:text-slate-600'}`} title={t('addNote')} onClick={() => setNoteOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}><MessageSquare size={16} /></button>
                    </div>
                  </div>
                  {showNote && (
                    <input className="input mt-2 text-xs sm:ml-12 sm:w-[calc(100%-3rem)]" placeholder={t('addNote')} value={noteDraft[s.id] ?? m?.note ?? ''}
                      onChange={(e) => setNoteDraft((d) => ({ ...d, [s.id]: e.target.value }))} onBlur={() => saveNote(s)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      {marks && kids.some((s) => marks[s.id]?.taken_by) && (
        <p className="text-xs text-slate-400">{t('takenBy', { name: [...new Set(kids.map((s) => marks[s.id]?.taken_by).filter(Boolean))].join(', ') })}</p>
      )}
    </div>
  )
}

function Summary({ students, groups }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { calendar } = useData()
  const periods = useMemo(() => {
    const cal = calendar || { months: [], quarters: [] }
    const monthRows = (cal.months || []).map((m) => {
      const [y, mo] = m.key.split('-').map(Number)
      return { key: m.key, label: lang === 'vi' ? m.vi : `${m.en} ${y}`, from: `${m.key}-01`, to: iso(new Date(y, mo, 0)), days: m.days }
    })
    const quarterRows = (cal.quarters || []).map((q) => ({ key: q.id, label: lang === 'vi' ? q.vi : q.en, from: q.start, to: q.end, days: q.days }))
    const year = cal.firstDay ? [{ key: 'year', label: cal.schoolYear || 'Year', from: cal.firstDay, to: cal.lastDay, days: (cal.months || []).reduce((s, m) => s + Number(m.days || 0), 0) }] : []
    return [...monthRows, ...quarterRows, ...year]
  }, [calendar, lang])
  const [periodKey, setPeriodKey] = useState(() => todayIso().slice(0, 7))
  const period = periods.find((p) => p.key === periodKey) || periods[0]
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

  const table = useMemo(() => {
    if (!rows) return null
    const inGroups = students.filter((s) => groups.includes(s.level) && (!group || s.level === group))
    return inGroups.map((s) => {
      const mine = rows.filter((r) => r.student_id === s.id)
      const c = { present: 0, late: 0, absent: 0, excused: 0 }
      mine.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1 })
      const marked = mine.length
      const rate = marked ? Math.round(((c.present + c.late) / marked) * 100) : null
      return { s, ...c, marked, rate }
    }).sort((a, b) => levelIndex(a.s.level) - levelIndex(b.s.level) || (a.s.nickname || a.s.full_name).localeCompare(b.s.nickname || b.s.full_name))
  }, [rows, students, groups, group])

  const byGroup = useMemo(() => {
    if (!table) return []
    return groups.filter((g) => !group || g === group).map((g) => {
      const list = table.filter((x) => x.s.level === g)
      const marked = list.reduce((n, x) => n + x.marked, 0)
      const attended = list.reduce((n, x) => n + x.present + x.late, 0)
      const days = new Set(rows.filter((r) => list.some((x) => x.s.id === r.student_id)).map((r) => r.date)).size
      return { g, n: list.length, rate: marked ? Math.round((attended / marked) * 100) : null, days, absent: list.reduce((n, x) => n + x.absent, 0) }
    })
  }, [table, groups, group, rows])

  if (!period) return <Empty text={t('noData')} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto" value={period.key} onChange={(e) => setPeriodKey(e.target.value)} aria-label={t('period')}>
          {periods.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select className="input w-auto" value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t('yearGroup')}>
          <option value="">{t('allYearGroups')}</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        {period.days ? <span className="text-xs text-slate-500">{lang === 'vi' ? `${period.days} ngày học theo lịch` : `${period.days} days in the PRA calendar`}</span> : null}
      </div>

      {!table ? <Spinner /> : (<>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {byGroup.map((x) => (
            <button key={x.g} type="button" onClick={() => setGroup(group === x.g ? '' : x.g)} className={`card p-4 text-left transition-colors hover:border-pra-blue ${group === x.g ? 'border-pra-blue' : ''}`}>
              <div className="flex items-baseline justify-between"><span className="font-bold text-slate-700">{x.g}</span><span className="text-xs text-slate-400">{x.n} · {x.days} {lang === 'vi' ? 'ngày' : 'days'}</span></div>
              <div className={`mt-1 text-2xl font-black tabular-nums ${x.rate == null ? 'text-slate-300' : x.rate < 90 ? 'text-amber-600' : 'text-green-700'}`}>{x.rate == null ? '—' : `${x.rate}%`}</div>
              <div className="text-xs text-slate-500">{x.absent} {t('absent').toLowerCase()}</div>
            </button>
          ))}
        </div>

        <Card className="!p-0 overflow-x-auto">
          {!table.length ? <div className="p-4"><Empty text={t('noData')} /></div> : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60"><tr>
                <th className="th pl-4">{t('student')}</th><th className="th">{t('yearGroup')}</th>
                {STATUSES.map((st) => <th key={st.key} className="th text-right">{t(st.key)}</th>)}
                <th className="th text-right">{t('daysMarked')}</th><th className="th pr-4 text-right">{t('attendanceRate')}</th>
              </tr></thead>
              <tbody>
                {table.map((x) => (
                  <tr key={x.s.id} className="border-t border-slate-100">
                    <td className="td pl-4"><div className="flex items-center gap-2"><Avatar src={photoSrc(x.s.photo)} name={x.s.full_name} size={26} /><span className="font-semibold text-slate-800">{x.s.nickname || x.s.full_name}</span><span className="hidden font-mono text-[11px] text-slate-400 sm:inline">{x.s.student_code}</span></div></td>
                    <td className="td whitespace-nowrap text-slate-500">{x.s.level}</td>
                    {STATUSES.map((st) => <td key={st.key} className={`td text-right tabular-nums ${x[st.key] ? (st.key === 'absent' ? 'font-semibold text-red-700' : 'text-slate-700') : 'text-slate-300'}`}>{x[st.key]}</td>)}
                    <td className="td text-right tabular-nums text-slate-500">{x.marked}</td>
                    <td className="td pr-4 text-right">
                      {x.rate == null ? <span className="text-slate-300">—</span> : (
                        <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${x.rate < 90 ? 'text-amber-600' : 'text-green-700'}`} title={x.rate < 90 ? t('lowAttendance') : undefined}>
                          {x.rate < 90 && <TrendingDown size={14} />}{x.rate}%
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
