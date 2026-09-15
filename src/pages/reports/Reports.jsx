import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Printer, Trash2, RefreshCw, ExternalLink, Settings, ArrowRight, Database } from 'lucide-react'
import { useData } from '../../lib/DataContext'
import { useAuth } from '../../lib/AuthContext'
import { db } from '../../lib/db'
import { loadPreviousSections } from '../../lib/report/loaders'
import { buildReport, buildSections, buildSection, completion, sectionDone, missingAreas, cohortAverages, templateForYearGroup, fmtDate, subjectByKey, currentPeriod } from '../../lib/report/utils'
import { photoSrc } from '../../lib/report/photo'
import { Card, Field, Select, Checkbox, Modal, Empty, Spinner, ReportStatusChip, TextInput } from '../../components/ui'
import { seedYear7 } from '../../lib/seedYear7'

function studentAge(dob) {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--
  return age
}

export default function Reports() {
  const { reportSettings, loading } = useData()
  if (loading || !reportSettings) return <Spinner />
  return <ReportsList settings={reportSettings} />
}

async function fetchPeriod(settings, period) {
  const rs = await db.reports.list({ school_year: settings.schoolYear, period_label: period })
  const ss = rs.length ? await db.sections.list({ report_id: rs.map((r) => r.id) }) : []
  return { rs, ss }
}

function ReportsList({ settings }) {
  const { students, teachers } = useData()
  const { me, isHead, canSubject, canHomeroom, myYearGroups } = useAuth()
  const [period, setPeriod] = useState(() => currentPeriod(settings)?.label || '')
  const [group, setGroup] = useState('')
  const [mineOnly, setMineOnly] = useState(true)
  const scoped = !isHead && mineOnly && !!myYearGroups
  const [reports, setReports] = useState(null)
  const [sections, setSections] = useState([])
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [seeding, setSeeding] = useState(false)

  const load = useCallback(() => setReloadKey((k) => k + 1), [])
  useEffect(() => {
    let alive = true
    fetchPeriod(settings, period).then(({ rs, ss }) => { if (alive) { setReports(rs); setSections(ss) } }).catch((e) => alert(e.message))
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
    return [...m.entries()].sort((a, b) => Number(String(a[0]).replace(/\D/g, '')) - Number(String(b[0]).replace(/\D/g, '')))
  }, [reports, group, scoped, myYearGroups])

  // The learning areas this teacher writes, e.g. "English (Year 7)".
  const mySubjects = (me?.subjects || []).map((k) => { const [s, g] = k.split(':'); return `${subjectByKey(settings, s).name}${g ? ` (${g})` : ''}` })

  // What still needs this teacher's input in the selected period.
  const todo = useMemo(() => {
    const out = []
    for (const r of reports || []) {
      if (r.status === 'published') continue
      const mine = sections.filter((s) => s.report_id === r.id && canSubject(s.subject_key, r.year_group) && !sectionDone(settings, s))
      const overview = canHomeroom(r) && !(r.homeroom_note || '').trim()
      if (mine.length || overview) out.push({ report: r, parts: [...mine.map((s) => subjectByKey(settings, s.subject_key).name), overview ? 'homeroom comment' : null].filter(Boolean) })
    }
    return out
  }, [reports, sections, settings, me]) // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (r) => {
    if (!confirm(`Delete the ${r.period_label} report for ${r.student_name}? This cannot be undone.`)) return
    await db.reports.remove(r.id)
    for (const s of sections.filter((x) => x.report_id === r.id)) await db.sections.remove(s.id).catch(() => {})
    load()
  }
  const updateRefs = async (yg, list) => {
    const ids = list.map((r) => r.id)
    const cohort = sections.filter((s) => ids.includes(s.report_id))
    const avgs = cohortAverages(cohort)
    const changed = cohort.filter((s) => avgs[s.subject_key] != null && Number(s.class_avg) !== avgs[s.subject_key]).map((s) => ({ ...s, class_avg: avgs[s.subject_key] }))
    if (!changed.length) { alert('Nothing to update: no review scores entered yet, or the references already match.'); return }
    setBusy(yg)
    try { await db.sections.saveMany(changed); load(); alert(`Class references for ${yg}: ${Object.entries(avgs).map(([k, v]) => `${subjectByKey(settings, k).name} ${v}%`).join(', ')}`) }
    catch (e) { alert(e.message) } finally { setBusy('') }
  }
  // Reports created before an area was added to their year group (e.g. Movement for Year 7).
  const missingFor = (list) => list.flatMap((r) => missingAreas(settings, r, sections.filter((s) => s.report_id === r.id)).map((key) => ({ r, key })))
  const addMissing = async (yg, gaps) => {
    setBusy(yg)
    try { await db.sections.saveMany(gaps.map(({ r, key }) => buildSection(r.id, key, settings, { yearGroup: r.year_group, teachers }))); load() }
    catch (e) { alert(e.message) } finally { setBusy('') }
  }

  const periods = settings.periods || []
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-2xl font-black text-slate-800">Progress reports <span className="text-base font-normal text-slate-400">{settings.schoolYear}</span></h1>
          {!isHead && (
            <p className="text-sm text-slate-500">
              {mySubjects.length || (me?.homeroom_groups || []).length
                ? <>You write {[mySubjects.join(', '), (me?.homeroom_groups || []).length ? `homeroom parts for ${me.homeroom_groups.join(', ')}` : ''].filter(Boolean).join(' and ')}. Everything else is read-only.</>
                : 'You are not linked to any classes yet, so reports are read-only. Ask the head teacher to add you on the Teachers page.'}
            </p>
          )}
        </div>
        {isHead && <Link to="/reports/settings" className="btn-secondary"><Settings size={16} /> Report settings</Link>}
        {isHead && <button className="btn-secondary" disabled={seeding} onClick={async () => { setSeeding(true); try { const r = await seedYear7(); alert(r.msg); load() } catch (e) { alert(e.message) } finally { setSeeding(false) } }}><Database size={16} /> {seeding ? 'Seeding…' : 'Seed Year 7 demo'}</button>}
        {isHead && <button className="btn-green" onClick={() => setCreating(true)}><Plus size={16} /> Create reports</button>}
      </div>
      <div className="flex flex-wrap gap-2">
        <select className="input max-w-[200px]" value={period} onChange={(e) => setPeriod(e.target.value)}>{periods.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}</select>
        <select className="input max-w-[200px]" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">All year groups</option>
          {[...new Set((reports || []).map((r) => r.year_group))].sort().map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        {!isHead && myYearGroups && (
          <div className="seg" role="group">
            <button type="button" aria-pressed={mineOnly} onClick={() => setMineOnly(true)}>My classes</button>
            <button type="button" aria-pressed={!mineOnly} onClick={() => setMineOnly(false)}>All reports</button>
          </div>
        )}
      </div>

      {todo.length > 0 && (
        <Card title="Needs your input" subtitle="Reports where a part you are responsible for is still empty." className="border-amber-200">
          <ul className="divide-y divide-slate-100">
            {todo.slice(0, 30).map(({ report, parts }) => (
              <li key={report.id} className="flex items-center gap-3 py-1.5 text-sm">
                <Link to={`/reports/${report.id}`} className="font-semibold text-slate-800 hover:text-pra-blue">{report.student_name}</Link>
                <span className="text-xs text-slate-500">{report.year_group} · {parts.join(', ')}</span>
                <span className="flex-1" />
                <Link to={`/reports/${report.id}`} className="btn-ghost text-xs"><ArrowRight size={14} /></Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!reports ? <Spinner /> : !byGroup.length ? (
        <Empty text={`No ${period} reports yet. `}>{isHead && <button className="font-semibold text-pra-blue" onClick={() => setCreating(true)}>Create them →</button>}</Empty>
      ) : byGroup.map(([yg, list]) => { const gaps = isHead ? missingFor(list.filter((r) => r.status !== 'published')) : []; return (
        <Card key={yg} title={`${yg} · ${list.length} report${list.length === 1 ? '' : 's'}`} actions={(
          <div className="flex flex-wrap justify-end gap-2">
            {gaps.length > 0 && <button className="btn-secondary text-xs" disabled={busy === yg} onClick={() => addMissing(yg, gaps)} title="These reports were created before the area was added to this year group"><Plus size={14} /> Add {[...new Set(gaps.map((g) => subjectByKey(settings, g.key).name))].join(', ')} to {new Set(gaps.map((g) => g.r.id)).size} report{new Set(gaps.map((g) => g.r.id)).size === 1 ? '' : 's'}</button>}
            {isHead && <button className="btn-secondary text-xs" disabled={busy === yg} onClick={() => updateRefs(yg, list)} title="Average this year group's review scores into every report's class reference"><RefreshCw size={14} /> Update class references</button>}
            <Link className="btn-secondary text-xs" to={`/print/reports?year=${encodeURIComponent(settings.schoolYear)}&period=${encodeURIComponent(period)}&group=${encodeURIComponent(yg)}`} target="_blank"><Printer size={14} /> Print all{list.some((r) => r.lang === 'bi') ? ' (English)' : ''}</Link>
            {list.some((r) => r.lang === 'bi') && <Link className="btn-secondary text-xs" to={`/print/reports?year=${encodeURIComponent(settings.schoolYear)}&period=${encodeURIComponent(period)}&group=${encodeURIComponent(yg)}&lang=vi`} target="_blank" title="Only the reports set to English and Vietnamese"><Printer size={14} /> Tiếng Việt ({list.filter((r) => r.lang === 'bi').length})</Link>}
          </div>
        )}>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2">Student</th><th>{isHead ? 'Year group' : 'Your part'}</th><th className="hidden sm:table-cell">Age</th><th>Completion</th><th>Status</th><th className="hidden md:table-cell">Updated</th><th></th></tr></thead>
            <tbody>
              {list.map((r) => {
                const student = students.find((s) => s.id === r.student_id)
                const c = completion(r, sections.filter((s) => s.report_id === r.id), settings)
                const photo = photoSrc(student?.photo)
                const age = studentAge(student?.dob)
                return (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="py-2">
                      <Link to={`/reports/${r.id}`} className="flex items-center gap-2 font-semibold text-slate-800 hover:text-pra-blue">
                        {photo ? <img src={photo} alt="" className="h-7 w-7 rounded-full object-cover flex-none" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-400 flex-none">{(student?.nickname || r.student_name || '?')[0]}</span>}
                        <span>{student?.full_name || r.student_name}{student?.nickname && <span className="ml-1 text-xs font-normal text-slate-400">"{student.nickname}"</span>}</span>
                      </Link>
                    </td>
                    <td className="text-xs text-slate-500">
                      {isHead ? (student?.level || r.year_group) : (
                        <div className="flex flex-wrap gap-1 py-1">
                          {sections.filter((s) => s.report_id === r.id && canSubject(s.subject_key, r.year_group)).map((s) => {
                            const done = sectionDone(settings, s)
                            return <span key={s.id} className={`chip ${done ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{done ? '✓ ' : ''}{subjectByKey(settings, s.subject_key).name}</span>
                          })}
                          {canHomeroom(r) && <span className={`chip ${(r.homeroom_note || '').trim() ?'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>Homeroom</span>}
                          {!sections.some((s) => s.report_id === r.id && canSubject(s.subject_key, r.year_group)) && !canHomeroom(r) && <span className="text-slate-400">read-only</span>}
                        </div>
                      )}
                    </td>
                    <td className="hidden text-xs text-slate-500 sm:table-cell">{age != null ? age : '—'}</td>
                    <td><div className="flex items-center gap-2"><div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-pra-green" style={{ width: `${c.pct}%` }} /></div><span className="text-xs text-slate-500">{c.pct}%</span></div></td>
                    <td><ReportStatusChip status={r.status} /></td>
                    <td className="hidden text-xs text-slate-500 md:table-cell">{fmtDate(r.updated_at)}</td>
                    <td className="whitespace-nowrap text-right">
                      <Link to={`/reports/${r.id}`} className="btn-secondary text-xs">Open</Link>
                      <Link to={`/print/report/${r.id}`} target="_blank" className="btn-ghost text-xs" title="Print"><ExternalLink size={14} /></Link>
                      {isHead && <button className="btn-ghost text-xs text-red-500" onClick={() => remove(r)} title="Delete"><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </Card>
      ) })}

      <Modal open={creating} onClose={() => setCreating(false)} title="Create progress reports">
        {creating && <CreateForm onClose={() => setCreating(false)} settings={settings} students={students} existing={reports || []} defaultPeriod={period} onDone={() => { setCreating(false); load() }} />}
      </Modal>
    </div>
  )
}

// Mounted fresh each time the modal opens, so its state starts from the defaults.
function CreateForm({ onClose, settings, students, existing, defaultPeriod, onDone }) {
  const { displayName } = useAuth()
  const { teachers } = useData()
  const templates = Object.values(settings.templates || {})
  const [tpl, setTpl] = useState(templates[0]?.key || '')
  const [periodLabel, setPeriodLabel] = useState(defaultPeriod)
  const [groups, setGroups] = useState(() => templates[0]?.yearGroups || [])
  const [single, setSingle] = useState('')
  const [homeroom, setHomeroom] = useState(displayName)
  const [busy, setBusy] = useState(false)

  const template = settings.templates?.[tpl] || templates[0]
  const period = (settings.periods || []).find((p) => p.label === periodLabel)
  const already = new Set(existing.filter((r) => r.period_label === periodLabel).map((r) => r.student_id))
  const active = students.filter((s) => s.active !== false)
  const candidates = single ? active.filter((s) => s.id === single) : active.filter((s) => groups.includes(s.level))
  const fresh = candidates.filter((s) => !already.has(s.id))

  const create = async () => {
    if (!period || !template) return
    setBusy(true)
    try {
      const reports = [], sections = []
      for (const s of fresh) {
        const t = single ? (templateForYearGroup(settings, s.level) || template) : template
        const r = buildReport(s, period, t, settings, homeroom)
        const prev = await loadPreviousSections(s.id, settings.schoolYear, period.index)
        reports.push(r); sections.push(...buildSections(r.id, t, settings, { yearGroup: s.level, prevSections: prev, teachers }))
      }
      await db.reports.saveMany(reports)
      await db.sections.saveMany(sections)
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
      <Field label="Homeroom teacher" hint="Printed on the report; can be changed per report later."><TextInput value={homeroom} onChange={setHomeroom} /></Field>
      <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        {fresh.length} report{fresh.length === 1 ? '' : 's'} will be created{candidates.length - fresh.length > 0 ? `; ${candidates.length - fresh.length} student(s) already have a ${periodLabel} report and are skipped` : ''}.
        {period && Number(period.index) > 1 && <div className="mt-1 text-xs">Previous levels are copied from each student's most recent earlier report this year.</div>}
      </div>
      <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy || !fresh.length} onClick={create}>Create {fresh.length || ''}</button></div>
    </div>
  )
}
