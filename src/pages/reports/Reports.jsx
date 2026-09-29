import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Printer, Trash2, RefreshCw, ExternalLink, Settings, ArrowRight, Languages, Check } from 'lucide-react'
import { useData } from '../../lib/DataContext'
import { useAuth } from '../../lib/AuthContext'
import { db } from '../../lib/db'
import { LEVELS } from '../../lib/fees'
import { loadPreviousSections } from '../../lib/report/loaders'
import { buildReport, buildSections, buildSection, completion, sectionDone, homeroomDone, descriptionTasks, writingFor, missingAreas, studentSections, cohortAverages, templateForYearGroup, fmtDate, subjectByKey, currentPeriod, scheduledHomeroom, hasReviewScores } from '../../lib/report/utils'
import { photoSrc } from '../../lib/report/photo'
import { isEnrolled } from '../../lib/studentRecords'
import { Card, Field, Select, Checkbox, Modal, Empty, Spinner, ReportStatusChip } from '../../components/ui'
import { WritingTags, WritingLegend } from '../../components/report/WritingTags'
import TranslationModal from '../../components/report/TranslationModal'

// Nursery, Kindergarten, Year 1 … Upper Secondary, then anything unknown.
const groupIndex = (g) => { const i = LEVELS.indexOf(g); return i < 0 ? 99 : i }
const byYearGroup = (a, b) => groupIndex(a) - groupIndex(b) || String(a).localeCompare(String(b))
const TEMPLATE_KEY = 'pra-report-template'

function studentAge(dob) {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
  return age
}

/** A figure for the summary row: label, big number, optional bar and hint. */
function Tile({ label, value, hint, tone = 'text-slate-800', bar }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-0.5 text-2xl font-black tabular-nums ${tone}`}>{value}</div>
      {bar != null && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-pra-green" style={{ width: `${bar}%` }} /></div>}
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

export default function Reports() {
  const { reportSettings, loading } = useData()
  if (loading || !reportSettings) return <Spinner />
  return <ReportsList settings={reportSettings} />
}

async function fetchPeriod(settings, period) {
  const rs = await db.reports.list({ school_year: settings.schoolYear, period_label: period })
  const [ss, ns] = await Promise.all([
    rs.length ? db.sections.list({ report_id: rs.map((r) => r.id) }) : [],
    db.courseNotes.list({ school_year: settings.schoolYear, period_label: period }),
  ])
  return { rs, ss, ns }
}

function ReportsList({ settings }) {
  const { students, teachers } = useData()
  const { me, isHead, canSubject, canHomeroom, myYearGroups } = useAuth()
  const [period, setPeriod] = useState(() => currentPeriod(settings)?.label || '')
  const [params] = useSearchParams()
  const [group, setGroup] = useState(() => params.get('group') || '') // the home page links straight to a class
  const [mineOnly, setMineOnly] = useState(true)
  const scoped = !isHead && mineOnly && !!myYearGroups
  const [reports, setReports] = useState(null)
  const [sections, setSections] = useState([])
  const [notes, setNotes] = useState([]) // the period's course descriptions (adm_course_notes)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [translating, setTranslating] = useState(false)
  // Translation files write every teacher's parts, so only head teachers and super admins get them.
  const canTranslate = ['super_admin', 'head'].includes(me?.access)

  const load = useCallback(() => setReloadKey((k) => k + 1), [])
  const studentOf = (r) => students.find((s) => s.id === r.student_id)
  // What each report is made of: a partial-day student's academic sections are left out.
  // `sections` keeps every saved row (deleting a report removes them all).
  const shown = useMemo(() => {
    const byId = new Map(students.map((s) => [s.id, s]))
    const reportOf = new Map((reports || []).map((r) => [r.id, r]))
    return sections.filter((x) => studentSections(settings, [x], byId.get(reportOf.get(x.report_id)?.student_id)).length > 0)
  }, [sections, reports, students, settings])
  useEffect(() => {
    let alive = true
    fetchPeriod(settings, period).then(({ rs, ss, ns }) => { if (alive) { setReports(rs); setSections(ss); setNotes(ns) } }).catch((e) => alert(e.message))
    return () => { alive = false }
  }, [settings, period, reloadKey])

  const byGroup = useMemo(() => {
    const m = new Map()
    for (const r of reports || []) {
      if (group && r.year_group !== group) continue
      if (scoped && !myYearGroups.includes(r.year_group)) continue
      if (!m.has(r.year_group)) m.set(r.year_group, [])
      m.get(r.year_group).push(r)
    }
    for (const list of m.values()) list.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''))
    return [...m.entries()].sort((a, b) => byYearGroup(a[0], b[0]))
  }, [reports, group, scoped, myYearGroups])

  // The learning areas this teacher writes, grouped by what each needs:
  // [{ writing, names: ['English (Year 7)', …] }] for both, comments only, descriptions only.
  const myWriting = useMemo(() => {
    const kinds = [{ comment: true, description: true }, { comment: true, description: false }, { comment: false, description: true }]
    return kinds.map((writing) => ({
      writing,
      names: (me?.subjects || []).filter((k) => { const w = writingFor(settings, k.split(':')[0]); return w.comment === writing.comment && w.description === writing.description })
        .map((k) => { const [s, g] = k.split(':'); return `${subjectByKey(settings, s).name}${g ? ` (${g})` : ''}` }),
    })).filter((x) => x.names.length)
  }, [me, settings])

  // "Still to write" lists this person's own classes only: what is on their
  // Teachers row. A head can edit everything, but the year group cards already
  // show everyone's progress, so the head's list stays personal too.
  const ownSubject = (key, yg) => (isHead ? (me?.subjects || []).includes(`${key}:${yg}`) : canSubject(key, yg))
  const ownHomeroom = (r) => (isHead ? (me?.homeroom_groups || []).includes(r.year_group) : canHomeroom(r))
  // Per-student parts (a level and, where the area has one, a comment of at least the minimum length)…
  const todo = useMemo(() => {
    const out = []
    for (const r of reports || []) {
      if (r.status === 'published') continue
      const mine = shown.filter((s) => s.report_id === r.id && ownSubject(s.subject_key, r.year_group) && !sectionDone(settings, s, r))
      const overview = ownHomeroom(r) && !homeroomDone(settings, r)
      if (mine.length || overview) out.push({ report: r, parts: [...mine.map((s) => subjectByKey(settings, s.subject_key).name), overview ? 'homeroom comment' : null].filter(Boolean) })
    }
    return out
  }, [reports, shown, settings, me]) // eslint-disable-line react-hooks/exhaustive-deps
  // …and the course descriptions still to write, one per year group and area on this teacher's row.
  const todoDescriptions = useMemo(() => (
    descriptionTasks(settings, (reports || []).filter((r) => !scoped || myYearGroups.includes(r.year_group)), shown, { subjects: me?.subjects || [], notes }).filter((d) => !d.done)
  ), [reports, shown, notes, settings, me, scoped, myYearGroups])

  const remove = async (r) => {
    if (!confirm(`Delete the ${r.period_label} report for ${r.student_name}? This cannot be undone.`)) return
    try {
      await db.reports.remove(r.id)
      for (const s of sections.filter((x) => x.report_id === r.id)) await db.sections.remove(s.id).catch(() => {})
    } catch (e) { alert(e.message) }
    load()
  }
  const updateRefs = async (yg, list) => {
    setBusy(yg)
    try {
      // Work from what is saved now, not from when this page opened, and change only the class reference:
      // teachers may have been writing comments in the meantime.
      const ids = list.map((r) => r.id)
      const cohort = (await fetchPeriod(settings, period)).ss.filter((s) => ids.includes(s.report_id))
      const avgs = cohortAverages(cohort)
      const changed = cohort.filter((s) => avgs[s.subject_key] != null && Number(s.class_avg) !== avgs[s.subject_key])
      if (!changed.length) { alert('Nothing to update: no review scores entered yet, or the references already match.'); return }
      for (const s of changed) await db.sections.patch(s.id, { class_avg: avgs[s.subject_key] })
      load(); alert(`Class references for ${yg}: ${Object.entries(avgs).map(([k, v]) => `${subjectByKey(settings, k).name} ${v}%`).join(', ')}`)
    } catch (e) { alert(e.message) } finally { setBusy('') }
  }
  // Reports created before an area was added to their year group (e.g. Movement for Year 7).
  const missingFor = (list) => list.flatMap((r) => missingAreas(settings, r, shown.filter((s) => s.report_id === r.id), studentOf(r)).map((key) => ({ r, key })))
  const addMissing = async (yg, gaps) => {
    setBusy(yg)
    try { await db.sections.saveMany(gaps.map(({ r, key }) => buildSection(r.id, key, settings, { yearGroup: r.year_group, teachers }))); load() }
    catch (e) { alert(e.message) } finally { setBusy('') }
  }

  const periods = settings.periods || []
  const periodInfo = periods.find((p) => p.label === period)
  const homeroomGroups = me?.homeroom_groups || []
  // Figures for the reports on screen (the chosen period, year group and class filter).
  const visible = byGroup.flatMap(([, list]) => list)
  const count = (status) => visible.filter((r) => r.status === status).length
  const pctOf = (r) => completion(r, shown.filter((s) => s.report_id === r.id), settings).pct
  const avgPct = visible.length ? Math.round(visible.reduce((n, r) => n + pctOf(r), 0) / visible.length) : 0
  const stillToWrite = todo.length + todoDescriptions.length
  const shortDate = (d) => fmtDate(d, { day: 'numeric', month: 'short' })
  const pill = (done) => `chip gap-1 ${done ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`

  return (
    <div className="space-y-5">
      {/* Header: title, what this teacher writes, and the head's tools. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-pra-blue">{settings.schoolYear}</div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800">Progress reports</h1>
          {!isHead && (
            <div className="mt-1 text-sm text-slate-500">
              {myWriting.length || homeroomGroups.length ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold text-slate-600">You write</span>
                  {myWriting.map((x, i) => <span key={i} className="inline-flex flex-wrap items-center gap-1.5"><WritingTags writing={x.writing} /><span className="text-slate-700">{x.names.join(', ')}</span></span>)}
                  {homeroomGroups.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="chip bg-amber-50 text-amber-800 ring-1 ring-amber-200">Homeroom</span><span className="text-slate-700">{homeroomGroups.map((g) => (g === '*' ? 'every year group' : g)).join(', ')}</span></span>}
                </div>
              ) : 'You are not linked to any classes yet, so reports are read-only. Ask the head teacher to add you on the Teachers page.'}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isHead && <Link to="/reports/settings" className="btn-secondary"><Settings size={16} /> Settings</Link>}
          {canTranslate && <button className="btn-secondary" onClick={() => setTranslating(true)} title="Download the reports for translation in the Claude desktop app, then upload the Vietnamese"><Languages size={16} /> Translate</button>}
          {isHead && <button className="btn-green" onClick={() => setCreating(true)}><Plus size={16} /> Create reports</button>}
        </div>
      </div>

      {/* Which quarter, which year group, whose classes. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="seg" role="group" aria-label="Period">
          {periods.map((p) => <button key={p.label} type="button" aria-pressed={p.label === period} title={`${shortDate(p.start)} – ${shortDate(p.end)}`} onClick={() => { setPeriod(p.label); setGroup(''); setReports(null) }}>{p.label}</button>)}
        </div>
        <select className="input w-auto" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Year group">
          <option value="">All year groups</option>
          {[...new Set([...(reports || []).map((r) => r.year_group), group].filter(Boolean))].sort(byYearGroup).map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        {!isHead && myYearGroups && (
          <div className="seg" role="group">
            <button type="button" aria-pressed={mineOnly} onClick={() => setMineOnly(true)}>My classes</button>
            <button type="button" aria-pressed={!mineOnly} onClick={() => setMineOnly(false)}>All reports</button>
          </div>
        )}
        {periodInfo?.start && <span className="ml-auto text-xs text-slate-500">{period}: {shortDate(periodInfo.start)} – {shortDate(periodInfo.end)}</span>}
      </div>

      {!reports ? <Spinner /> : !byGroup.length ? (
        <Empty text={`No ${period} reports yet. `}>{isHead && <button className="font-semibold text-pra-blue" onClick={() => setCreating(true)}>Create them →</button>}</Empty>
      ) : (<>
        {/* The period at a glance. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Reports" value={visible.length} hint={`${byGroup.length} year group${byGroup.length === 1 ? '' : 's'}`} />
          <Tile label="Average completion" value={`${avgPct}%`} bar={avgPct} />
          {isHead
            ? <Tile label="Ready to review" value={count('ready')} hint={`${count('draft')} still in draft`} tone={count('ready') ? 'text-sky-700' : 'text-slate-800'} />
            : <Tile label="Still to write" value={stillToWrite} hint={stillToWrite ? `${todoDescriptions.length} course description${todoDescriptions.length === 1 ? '' : 's'} · ${todo.length} student${todo.length === 1 ? '' : 's'}` : 'All your parts are written'} tone={stillToWrite ? 'text-amber-700' : 'text-green-700'} />}
          <Tile label="Published" value={count('published')} hint={visible.length ? `${Math.round((count('published') / visible.length) * 100)}% of reports` : ''} tone={count('published') ? 'text-green-700' : 'text-slate-800'} />
        </div>

        {/* This person's unfinished parts: course descriptions on the left, students on the right. */}
        {stillToWrite > 0 && (
          <Card className="border-amber-200 bg-amber-50/30" title="Still to write" subtitle={`${isHead ? 'Your own classes. ' : ''}Parts that are empty or shorter than their minimum. A comment below its minimum does not count as written.`}>
            <div className={`grid gap-5 ${todoDescriptions.length && todo.length ? 'lg:grid-cols-2' : ''}`}>
              {todoDescriptions.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><WritingTags writing={{ description: true }} /> <span>· once per year group</span></div>
                  <ul className="divide-y divide-amber-100 rounded-xl border border-amber-100 bg-white">
                    {todoDescriptions.map((d) => (
                      <li key={`${d.yearGroup}:${d.key}`}>
                        <Link to={`/reports/${d.report.id}`} className="group flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                          <span className="font-semibold text-slate-800">{d.name}</span>
                          <span className="chip bg-slate-100 text-slate-600">{d.yearGroup}</span>
                          <span className="text-xs text-slate-500">{d.note?.description?.trim() ? 'too short' : 'not written yet'}</span>
                          <ArrowRight size={14} className="ml-auto text-slate-300 group-hover:text-pra-blue" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {todo.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><WritingTags writing={{ comment: true }} /> <span>· {todo.length} student{todo.length === 1 ? '' : 's'}</span></div>
                  <ul className="divide-y divide-amber-100 rounded-xl border border-amber-100 bg-white">
                    {todo.slice(0, 20).map(({ report, parts }) => (
                      <li key={report.id}>
                        <Link to={`/reports/${report.id}`} className="group flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                          <span className="font-semibold text-slate-800">{report.student_name}</span>
                          <span className="chip bg-slate-100 text-slate-600">{report.year_group}</span>
                          <span className="min-w-0 truncate text-xs text-slate-500">{parts.join(', ')}</span>
                          <ArrowRight size={14} className="ml-auto flex-none text-slate-300 group-hover:text-pra-blue" />
                        </Link>
                      </li>
                    ))}
                    {todo.length > 20 && <li className="px-3 py-2 text-xs text-slate-500">and {todo.length - 20} more below</li>}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* One card per year group. */}
        {byGroup.map(([yg, list]) => {
          const gaps = isHead ? missingFor(list.filter((r) => r.status !== 'published')) : []
          const n = (status) => list.filter((r) => r.status === status).length
          const groupPct = Math.round(list.reduce((a, r) => a + pctOf(r), 0) / list.length)
          const bi = list.filter((r) => r.lang === 'bi').length
          const printUrl = (lang) => `/print/reports?year=${encodeURIComponent(settings.schoolYear)}&period=${encodeURIComponent(period)}&group=${encodeURIComponent(yg)}${lang ? `&lang=${lang}` : ''}`
          const summary = [n('published') && `${n('published')} published`, n('ready') && `${n('ready')} ready to review`, n('draft') && `${n('draft')} in draft`].filter(Boolean).join(' · ')
          return (
            <Card key={yg} className="!p-0 overflow-hidden [&>div:first-child]:mb-0 [&>div:first-child]:px-5 [&>div:first-child]:pt-4 [&>div:first-child]:pb-3"
              title={<span className="flex items-baseline gap-2">{yg}<span className="text-sm font-normal text-slate-500">{list.length} report{list.length === 1 ? '' : 's'}</span></span>}
              subtitle={<span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1"><span className="inline-flex items-center gap-2"><span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-pra-green" style={{ width: `${groupPct}%` }} /></span><span className="tabular-nums">{groupPct}% written</span></span>{summary && <span>{summary}</span>}</span>}
              actions={(
                <div className="flex flex-wrap justify-end gap-2">
                  {gaps.length > 0 && <button className="btn-secondary text-xs" disabled={busy === yg} onClick={() => addMissing(yg, gaps)} title="These reports were created before the area was added to this year group"><Plus size={14} /> Add {[...new Set(gaps.map((g) => subjectByKey(settings, g.key).name))].join(', ')} to {new Set(gaps.map((g) => g.r.id)).size} report{new Set(gaps.map((g) => g.r.id)).size === 1 ? '' : 's'}</button>}
                  {isHead && hasReviewScores(settings, list[0]) && <button className="btn-secondary text-xs" disabled={busy === yg} onClick={() => updateRefs(yg, list)} title="Average this year group's review scores into every report's class reference"><RefreshCw size={14} /> Class references</button>}
                  <Link className="btn-secondary text-xs" to={printUrl('')} target="_blank"><Printer size={14} /> Print all{bi ? ' (English)' : ''}</Link>
                  {bi > 0 && <Link className="btn-secondary text-xs" to={printUrl('vi')} target="_blank" title="Only the reports set to English and Vietnamese"><Printer size={14} /> Tiếng Việt ({bi})</Link>}
                </div>
              )}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/70">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="py-2 pl-5 pr-3">Student</th>
                      {!isHead && <th className="py-2 pr-3"><span className="flex flex-wrap items-center gap-x-3">Your part <WritingLegend className="font-normal normal-case tracking-normal" /></span></th>}
                      <th className="py-2 pr-3">Completion</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="hidden py-2 pr-3 md:table-cell">Updated</th>
                      <th className="py-2 pr-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => {
                      const student = students.find((s) => s.id === r.student_id)
                      const pct = pctOf(r)
                      const photo = photoSrc(student?.photo)
                      const age = studentAge(student?.dob)
                      const mine = shown.filter((s) => s.report_id === r.id && canSubject(s.subject_key, r.year_group))
                      const moved = student?.level && student.level !== r.year_group
                      const meta = [student?.nickname && `“${student.nickname}”`, age != null && `${age} yrs`, moved && `now ${student.level}`].filter(Boolean).join(' · ')
                      return (
                        <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                          <td className="py-2 pl-5 pr-3">
                            <Link to={`/reports/${r.id}`} className="flex items-center gap-2.5 hover:text-pra-blue">
                              {photo ? <img src={photo} alt="" className="h-8 w-8 flex-none rounded-full object-cover" /> : <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{(student?.nickname || r.student_name || '?')[0]}</span>}
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-slate-800">{student?.full_name || r.student_name}</span>
                                {meta && <span className={`block truncate text-xs ${moved ? 'text-amber-700' : 'text-slate-400'}`}>{meta}</span>}
                              </span>
                            </Link>
                          </td>
                          {!isHead && (
                            <td className="py-2 pr-3">
                              <div className="flex flex-wrap gap-1">
                                {mine.map((s) => { const done = sectionDone(settings, s, r); return <span key={s.id} className={pill(done)}>{done && <Check size={12} />}{subjectByKey(settings, s.subject_key).name} <WritingTags settings={settings} subjectKey={s.subject_key} compact size={11} /></span> })}
                                {canHomeroom(r) && <span className={pill(homeroomDone(settings, r))}>{homeroomDone(settings, r) && <Check size={12} />}Homeroom</span>}
                                {!mine.length && !canHomeroom(r) && <span className="text-xs text-slate-400">read-only</span>}
                              </div>
                            </td>
                          )}
                          <td className="py-2 pr-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${pct === 100 ? 'bg-pra-green' : 'bg-pra-blue'}`} style={{ width: `${pct}%` }} /></div>
                              <span className={`text-xs tabular-nums ${pct === 100 ? 'font-semibold text-green-700' : 'text-slate-500'}`}>{pct}%</span>
                            </div>
                          </td>
                          <td className="py-2 pr-3"><ReportStatusChip status={r.status} /></td>
                          <td className="hidden py-2 pr-3 text-xs text-slate-500 md:table-cell">{fmtDate(r.updated_at)}</td>
                          <td className="whitespace-nowrap py-2 pr-4 text-right">
                            <Link to={`/reports/${r.id}`} className="btn-secondary !py-1 text-xs">Open</Link>
                            <Link to={`/print/report/${r.id}`} target="_blank" className="btn-ghost !py-1 text-xs" title="PDF"><ExternalLink size={14} /></Link>
                            {isHead && <button className="btn-ghost !py-1 text-xs text-red-500" onClick={() => remove(r)} title="Delete"><Trash2 size={14} /></button>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        })}
      </>)}

      {translating && <TranslationModal settings={settings} students={students} defaultPeriod={period} defaultGroup={group} onClose={() => setTranslating(false)} onDone={load} />}

      <Modal open={creating} onClose={() => setCreating(false)} title="Create progress reports">
        {creating && <CreateForm onClose={() => setCreating(false)} settings={settings} students={students} defaultPeriod={period} defaultGroup={group} onDone={() => { setCreating(false); load() }} />}
      </Modal>
    </div>
  )
}

// Mounted fresh each time the modal opens, so its state starts from the defaults.
function CreateForm({ onClose, settings, students, defaultPeriod, defaultGroup, onDone }) {
  const { teachers, schedule } = useData()
  const templates = Object.values(settings.templates || {})
  // Start from the template of the year group being looked at, else the one used last time.
  const firstTpl = () => {
    let last = ''
    try { last = localStorage.getItem(TEMPLATE_KEY) || '' } catch { /* ignore */ }
    return (defaultGroup && templateForYearGroup(settings, defaultGroup)) || settings.templates?.[last] || templates[0]
  }
  const [tpl, setTpl] = useState(() => firstTpl()?.key || '')
  const [periodLabel, setPeriodLabel] = useState(defaultPeriod)
  const [groups, setGroups] = useState(() => (defaultGroup && firstTpl()?.yearGroups?.includes(defaultGroup) ? [defaultGroup] : firstTpl()?.yearGroups || []))
  // Reports that already exist for the chosen period (not just the period the list is showing).
  const [existing, setExisting] = useState(null)
  useEffect(() => {
    let alive = true
    db.reports.list({ school_year: settings.schoolYear, period_label: periodLabel }).then((rs) => alive && setExisting({ period: periodLabel, rs })).catch((e) => alert(e.message))
    return () => { alive = false }
  }, [settings.schoolYear, periodLabel])
  const known = existing?.period === periodLabel ? existing.rs : null
  const [single, setSingle] = useState('')
  const [busy, setBusy] = useState(false)

  const template = settings.templates?.[tpl] || templates[0]
  const period = (settings.periods || []).find((p) => p.label === periodLabel)
  const already = new Set((known || []).map((r) => r.student_id))
  const active = students.filter(isEnrolled)
  const candidates = single ? active.filter((s) => s.id === single) : active.filter((s) => groups.includes(s.level))
  const fresh = candidates.filter((s) => !already.has(s.id))
  const homeroomGroups = single ? candidates.map((s) => s.level) : (template?.yearGroups || []).filter((g) => groups.includes(g))

  const create = async () => {
    if (!period || !template) return
    setBusy(true)
    try {
      const reports = [], sections = []
      for (const s of fresh) {
        const t = single ? (templateForYearGroup(settings, s.level) || template) : template
        const r = buildReport(s, period, t, settings, scheduledHomeroom(schedule, s.level))
        const prev = await loadPreviousSections(s.id, settings.schoolYear, period.index)
        reports.push(r); sections.push(...buildSections(r.id, t, settings, { yearGroup: s.level, prevSections: prev, teachers, student: s }))
      }
      await db.reports.saveMany(reports)
      await db.sections.saveMany(sections)
      try { localStorage.setItem(TEMPLATE_KEY, template.key) } catch { /* ignore */ }
      onDone()
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Period"><Select value={periodLabel} onChange={setPeriodLabel} options={(settings.periods || []).map((p) => ({ value: p.label, label: `${p.label} (${fmtDate(p.start, { day: 'numeric', month: 'short' })} – ${fmtDate(p.end, { day: 'numeric', month: 'short' })})` }))} /></Field>
        <Field label="Template"><Select value={tpl} onChange={(v) => { setTpl(v); setGroups(settings.templates?.[v]?.yearGroups || []) }} options={templates.map((t) => ({ value: t.key, label: t.name }))} /></Field>
      </div>
      <Field label="One student only (optional)" hint="Leave blank to create a report for every active student in the year groups below.">
        <Select value={single} onChange={setSingle} options={[{ value: '', label: '— whole year groups —' }, ...active.map((s) => ({ value: s.id, label: `${s.full_name} (${s.level})` }))]} />
      </Field>
      {!single && (
        <div>
          <span className="label">Year groups</span>
          <div className="flex flex-wrap gap-3">
            {(template?.yearGroups || []).map((g) => <Checkbox key={g} checked={groups.includes(g)} onChange={(on) => setGroups(on ? [...groups, g] : groups.filter((x) => x !== g))} label={`${g} (${active.filter((s) => s.level === g).length})`} />)}
          </div>
        </div>
      )}
      {homeroomGroups.length > 0 && (
        <div>
          <span className="label">Homeroom teacher</span>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
            {homeroomGroups.map((g) => <span key={g}>{g}: {scheduledHomeroom(schedule, g) ? <b className="font-semibold">{scheduledHomeroom(schedule, g)}</b> : <span className="text-amber-700">none on the Schedule</span>}</span>)}
          </div>
          <span className="mt-1 block text-xs text-slate-400">From the Schedule. Reports follow it when a class's homeroom teacher changes there.</span>
        </div>
      )}
      <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        {!known ? 'Checking which reports already exist…' : <>{fresh.length} report{fresh.length === 1 ? '' : 's'} will be created</>}{candidates.length - fresh.length > 0 ? `; ${candidates.length - fresh.length} student(s) already have a ${periodLabel} report and are skipped` : ''}.
        {period && Number(period.index) > 1 && <div className="mt-1 text-xs">Previous levels are copied from each student's most recent earlier report this year.</div>}
      </div>
      <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !known || !fresh.length} onClick={create}>{busy ? 'Creating…' : `Create ${fresh.length || ''}`}</button></div>
    </div>
  )
}
