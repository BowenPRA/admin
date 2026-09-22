import { useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Plus, Pencil, Trash2, KeyRound, CalendarPlus, Eye, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { useData } from '../../lib/DataContext'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { db, dbMode } from '../../lib/db'
import { hasSupabase } from '../../lib/supabaseClient'
import { LEVELS } from '../../lib/fees'
import { isEnrolled } from '../../lib/studentRecords'
import { TEACHER_SCHEDULE, OFFICE_ACCOUNTS, ACCESS_ROLES, splitSubjectKey } from '../../data/staff'
import { sameTeacher } from '../../lib/schedule'
import { scheduledHomeroom, templateForYearGroup, areasFor } from '../../lib/report/utils'
import { Card, Field, TextInput, Select, Checkbox, Modal, Empty, Spinner, Chip, PageHeader, Avatar } from '../../components/ui'

const blank = () => ({ email: '', name: '', title: 'Mr.', role: 'teacher', subjects: [], homeroom_groups: [], active: true })
const shortLevel = (g) => (g === 'Nursery' ? 'N' : g === 'Kindergarten' ? 'K' : g === 'Upper Secondary' ? 'US' : g === '*' ? 'All' : g.replace('Year ', 'Y'))
const levelIndex = (l) => { const i = LEVELS.indexOf(l); return i < 0 ? 99 : i }

// A second, non-persisting client used only to create teacher logins. Signing
// up with the main client would replace the head teacher's own session.
function signupClient() {
  if (!hasSupabase) return null
  return createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

// Head teacher only: which teacher edits which learning area in which year group.
export default function Teachers() {
  const { teachers, students, reportSettings: settings, schedule, loading, refresh } = useData()
  const { isHead, refreshMe, me, setViewAs } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showAccess, setShowAccess] = useState(false)

  const subjects = useMemo(() => settings?.subjects || [], [settings])
  const subjName = (k) => (subjects.find((s) => s.key === k) || { name: k }).name
  const activeTeachers = useMemo(() => teachers.filter((t) => t.active !== false).sort((a, b) => (a.role === 'head' ? 0 : 1) - (b.role === 'head' ? 0 : 1) || a.name.localeCompare(b.name)), [teachers])
  const missingFromSchedule = TEACHER_SCHEDULE.filter((s) => !teachers.some((t) => (t.email || '').toLowerCase() === s.email))

  // Classes on the 2026-27 schedule that a listed teacher does not have yet (e.g. the Primary areas added later).
  const newClasses = TEACHER_SCHEDULE.map((s) => {
    const row = teachers.find((t) => (t.email || '').toLowerCase() === s.email)
    return row ? { row, add: s.subjects.filter((k) => !(row.subjects || []).includes(k)) } : null
  }).filter((x) => x?.add.length)

  // year group -> subject key -> [teacher names]; only year groups with enrolled students.
  const coverage = useMemo(() => {
    const groups = [...new Set(students.filter(isEnrolled).map((s) => s.level).filter(Boolean))].sort((a, b) => levelIndex(a) - levelIndex(b))
    return groups.map((g) => {
      const cells = Object.fromEntries(subjects.map((s) => [s.key, activeTeachers.filter((t) => (t.subjects || []).includes(`${s.key}:${g}`)).map((t) => t.name)]))
      // Areas this year group's reports contain (from its template); the rest are left plain, not flagged.
      const template = templateForYearGroup(settings, g)
      const onReport = new Set(template ? areasFor(settings, template, g) : subjects.map((s) => s.key))
      // The homeroom teacher is the one on the Schedule; flag when their Teachers row cannot write the homeroom parts.
      const homeroom = scheduledHomeroom(schedule, g)
      const row = homeroom && activeTeachers.find((t) => sameTeacher(t.name, homeroom))
      const canWrite = !!row && ['*', g].some((x) => (row.homeroom_groups || []).includes(x))
      return { group: g, count: students.filter((s) => isEnrolled(s) && s.level === g).length, cells, onReport, homeroom, linked: !!row, canWrite }
    })
  }, [students, subjects, activeTeachers, schedule, settings])

  // Year groups whose homeroom teacher on the Schedule cannot write the homeroom parts yet.
  const homeroomGaps = useMemo(() => {
    const byRow = new Map()
    const groups = [...new Set((schedule?.classes || []).flatMap((c) => c.yearGroups || []))]
    for (const g of groups) {
      const name = scheduledHomeroom(schedule, g)
      const row = name && activeTeachers.find((t) => sameTeacher(t.name, name))
      if (!row || ['*', g].some((x) => (row.homeroom_groups || []).includes(x))) continue
      if (!byRow.has(row.id)) byRow.set(row.id, { row, add: [] })
      byRow.get(row.id).add.push(g)
    }
    return [...byRow.values()]
  }, [schedule, activeTeachers])

  if (!isHead) return <Empty text="Only the head teacher can manage teachers." />
  if (loading || !settings) return <Spinner />

  const save = async (t) => {
    setBusy(true)
    try {
      await db.teachers.save({ ...t, email: t.email.trim().toLowerCase(), subjects: [...new Set(t.subjects)].sort() })
      await refresh(); await refreshMe(); setEditing(null)
      toast(`Saved ${t.name}`)
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  const remove = async (t) => {
    if (!confirm(`Remove ${t.name} from the teacher list? Their login (if any) stays but loses all report editing rights.`)) return
    try { await db.teachers.remove(t.id); await refresh(); setEditing(null); toast(`Removed ${t.name}`) } catch (e) { toast.error(e.message) }
  }
  const addSchedule = async () => {
    if (!confirm(`Add ${missingFromSchedule.map((s) => s.name).join(', ')} with their 2026-2027 classes?`)) return
    setBusy(true)
    try { await db.teachers.saveMany(missingFromSchedule.map((s) => ({ ...blank(), ...s }))); await refresh(); await refreshMe(); toast(`Added ${missingFromSchedule.length} teachers`) }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const addNewClasses = async () => {
    const lines = newClasses.map(({ row, add }) => `${row.name}: ${add.map((k) => { const [s, g] = splitSubjectKey(k); return `${subjName(s)} (${shortLevel(g || '')})` }).join(', ')}`)
    if (!confirm(`Add these classes from the 2026-27 schedule?\n\n${lines.join('\n')}`)) return
    setBusy(true)
    try { await db.teachers.saveMany(newClasses.map(({ row, add }) => ({ ...row, subjects: [...new Set([...(row.subjects || []), ...add])].sort() }))); await refresh(); await refreshMe(); toast('Classes added') }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const addHomerooms = async () => {
    const lines = homeroomGaps.map(({ row, add }) => `${row.name}: ${add.join(', ')}`)
    if (!confirm(`Let these homeroom teachers from the Schedule write the homeroom parts of their reports?\n\n${lines.join('\n')}`)) return
    setBusy(true)
    try { await db.teachers.saveMany(homeroomGaps.map(({ row, add }) => ({ ...row, homeroom_groups: [...new Set([...(row.homeroom_groups || []), ...add])] }))); await refresh(); await refreshMe(); toast('Homeroom access added') }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Teachers & classes" subtitle="Link each teacher to the learning areas and year groups they teach. They can edit only those parts of progress reports.">
        {missingFromSchedule.length > 0 && <button className="btn-secondary" disabled={busy} onClick={addSchedule}><CalendarPlus size={16} /> Add {missingFromSchedule.length} from 2026-27 schedule</button>}
        {newClasses.length > 0 && <button className="btn-secondary" disabled={busy} onClick={addNewClasses} title="Classes on the schedule that these teachers are not linked to yet"><CalendarPlus size={16} /> Add {newClasses.reduce((n, x) => n + x.add.length, 0)} new classes from the schedule</button>}
        {homeroomGaps.length > 0 && <button className="btn-secondary" disabled={busy} onClick={addHomerooms} title="Homeroom teachers on the Schedule who cannot write the homeroom parts of those reports yet"><CalendarPlus size={16} /> Add {homeroomGaps.reduce((n, x) => n + x.add.length, 0)} homerooms from the schedule</button>}
        <button className="btn-green" onClick={() => setEditing(blank())}><Plus size={16} /> Add teacher</button>
      </PageHeader>

      <Card className="!p-0">
        <button type="button" className="flex w-full items-center gap-3 px-5 py-3 text-left" onClick={() => setShowAccess((v) => !v)}>
          <ShieldCheck size={18} className="flex-none text-pra-navy" />
          <span className="flex-1 text-sm"><span className="font-bold text-slate-800">Access levels.</span> <span className="text-slate-500">You are signed in as <b>{ACCESS_ROLES[me?.access]?.label}</b>. Office roles are set on the Supabase account; classes are set here.</span></span>
          {showAccess ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>
        {showAccess && (
          <div className="grid gap-4 border-t border-slate-100 px-5 py-4 md:grid-cols-2">
            <div className="space-y-2">
              {['super_admin', 'head', 'admin', 'teacher'].map((k) => (
                <div key={k} className="flex gap-3 text-sm">
                  <span className="w-28 flex-none"><Chip tone={ACCESS_ROLES[k].tone}>{ACCESS_ROLES[k].label}</Chip></span>
                  <span className="text-slate-600">{ACCESS_ROLES[k].summary}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="label">Office accounts</div>
              <ul className="space-y-1 text-sm">
                {OFFICE_ACCOUNTS.map((a) => (
                  <li key={a.email} className="flex items-center gap-2"><span className="w-16 font-semibold text-slate-700">{a.name}</span><span className="flex-1 truncate font-mono text-xs text-slate-500">{a.email}</span><Chip tone={ACCESS_ROLES[a.access].tone}>{ACCESS_ROLES[a.access].label}</Chip></li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-400">Created and kept in sync by <code>scripts/create-staff-accounts.mjs</code>.</p>
            </div>
          </div>
        )}
      </Card>

      {!teachers.length ? <Empty text="No teachers yet. " >{missingFromSchedule.length > 0 && <button className="font-semibold text-pra-blue" onClick={addSchedule}>Add the 2026-27 teachers →</button>}</Empty> : (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/60"><tr><th className="th pl-5">Teacher</th><th className="th">Teaches</th><th className="th">Homeroom</th><th className="th" /></tr></thead>
            <tbody>
              {[...activeTeachers, ...teachers.filter((t) => t.active === false)].map((t) => {
                const byGroup = {}
                ;(t.subjects || []).forEach((k) => { const [s, g] = splitSubjectKey(k); (byGroup[g || 'any'] ||= []).push(s) })
                return (
                  <tr key={t.id} className={`border-t border-slate-100 align-top hover:bg-slate-50/60 ${t.active === false ? 'opacity-50' : ''}`}>
                    <td className="td pl-5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={t.name} size={32} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 whitespace-nowrap font-semibold text-slate-800">{t.title} {t.name}{t.role === 'head' && <Chip tone="navy">Head</Chip>}</div>
                          <div className="truncate font-mono text-xs text-slate-500">{t.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      {t.role === 'head' && <div className="mb-1 text-xs font-semibold text-green-700">Can edit every report</div>}
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(byGroup).sort((a, b) => levelIndex(a[0]) - levelIndex(b[0])).map(([g, subs]) => (
                          <span key={g} className="inline-flex items-center overflow-hidden rounded-full border border-sky-200 text-xs">
                            <span className="bg-sky-100 px-2 py-0.5 font-bold text-sky-800">{g === 'any' ? 'Any year' : shortLevel(g)}</span>
                            <span className="px-2 py-0.5 text-slate-700">{subs.map(subjName).join(', ')}</span>
                          </span>
                        ))}
                        {!(t.subjects || []).length && t.role !== 'head' && <span className="text-xs text-slate-400">No learning areas</span>}
                      </div>
                    </td>
                    <td className="td whitespace-nowrap">{(t.homeroom_groups || []).length ? <span className="text-xs font-semibold text-amber-800">{t.homeroom_groups.map((g) => (g === '*' ? 'All' : g)).join(', ')}</span> : <span className="text-xs text-slate-300">—</span>}</td>
                    <td className="td whitespace-nowrap pr-4 text-right">
                      {dbMode === 'local' && <button className="btn-ghost px-2" title={`Preview the app as ${t.name}`} onClick={() => setViewAs(t.email)}><Eye size={16} /></button>}
                      <button className="btn-ghost px-2" aria-label={`Edit ${t.name}`} onClick={() => setEditing({ ...blank(), ...t })}><Pencil size={16} /></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {coverage.length > 0 && (
        <Card title="Who teaches what" subtitle="Year groups with enrolled students. Homeroom teachers come from the Schedule. Amber cells are on that year group's reports but have no teacher linked yet, so only the head teacher can write that part. Grey names are linked to an area those reports do not have." className="!p-0 [&>div:first-child]:px-5 [&>div:first-child]:pt-4">
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-100">
                <th className="th pl-5">Year group</th>
                <th className="th">Homeroom</th>
                {subjects.map((s) => <th key={s.key} className="th whitespace-nowrap">{s.name}</th>)}
              </tr></thead>
              <tbody>
                {coverage.map((row) => (
                  <tr key={row.group} className="border-t border-slate-100">
                    <td className="td whitespace-nowrap pl-5 font-semibold text-slate-700">{row.group} <span className="font-normal text-slate-400">· {row.count}</span></td>
                    <td className={`td whitespace-nowrap ${row.canWrite ? 'text-slate-700' : 'bg-amber-50/70 text-amber-600'}`}>
                      {row.homeroom || '—'}
                      {row.homeroom && !row.canWrite && <span className="text-amber-700/70"> · {row.linked ? 'no homeroom access' : 'not on this page'}</span>}
                    </td>
                    {subjects.map((s) => {
                      const names = row.cells[s.key]
                      if (!row.onReport.has(s.key)) return <td key={s.key} className="td whitespace-nowrap text-slate-300">{names.join(', ')}</td>
                      return <td key={s.key} className={`td whitespace-nowrap ${names.length ? 'text-slate-700' : 'bg-amber-50/70 text-amber-500'}`}>{names.join(', ') || '—'}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing.id ? `${editing.title} ${editing.name}` : 'Add teacher'} subtitle={editing.email} wide
          footer={(<>
            {editing.id && <button type="button" className="btn-ghost mr-auto text-red-600 hover:bg-red-50" onClick={() => remove(editing)}><Trash2 size={16} /> Remove</button>}
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" form="teacher-form" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save teacher'}</button>
          </>)}>
          <TeacherForm value={editing} onChange={setEditing} settings={settings} students={students} onSave={() => save(editing)} />
        </Modal>
      )}
    </div>
  )
}

function TeacherForm({ value: t, onChange, settings, students, onSave }) {
  const set = (k) => (v) => onChange({ ...t, [k]: v })
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [signupBusy, setSignupBusy] = useState(false)
  const [allGroups, setAllGroups] = useState(false)
  const has = (k) => (t.subjects || []).includes(k)
  const toggleKey = (k) => onChange({ ...t, subjects: has(k) ? t.subjects.filter((x) => x !== k) : [...(t.subjects || []), k] })
  const toggleHomeroom = (g) => onChange({ ...t, homeroom_groups: (t.homeroom_groups || []).includes(g) ? t.homeroom_groups.filter((x) => x !== g) : [...(t.homeroom_groups || []), g] })

  // Year groups with enrolled students first; the rest on request.
  const enrolled = new Set(students.filter(isEnrolled).map((s) => s.level))
  const assigned = new Set((t.subjects || []).map((k) => splitSubjectKey(k)[1]).concat(t.homeroom_groups || []))
  const groups = LEVELS.filter((g) => allGroups || enrolled.has(g) || assigned.has(g))
  const legacyKeys = (t.subjects || []).filter((k) => !k.includes(':'))

  const createLogin = async () => {
    const client = signupClient()
    if (!client) { setMsg('Logins can only be created when the app is connected to Supabase.'); return }
    if (!t.email.includes('@') || pw.length < 6) { setMsg('Enter the email above and a temporary password of at least 6 characters.'); return }
    setSignupBusy(true); setMsg('')
    try {
      const { data, error } = await client.auth.signUp({ email: t.email.trim().toLowerCase(), password: pw, options: { data: { name: t.name } } })
      if (error) throw error
      if (data.user && !data.session && data.user.identities?.length === 0) setMsg('An account with this email already exists; the teacher can sign in with their existing password.')
      else if (data.user && !data.session) setMsg('Login created, but Supabase requires email confirmation. Either the teacher confirms via the email they receive, or turn off "Confirm email" under Authentication → Providers → Email.')
      else setMsg(`Login created. ${t.name} can sign in with ${t.email} and the temporary password, then change it from the menu.`)
      setPw('')
    } catch (e) { setMsg(`Could not create the login: ${e.message}. Run scripts/create-staff-accounts.mjs instead.`) }
    finally { setSignupBusy(false) }
  }

  return (
    <form id="teacher-form" onSubmit={(e) => { e.preventDefault(); onSave() }} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-6">
        <Field label="Title"><Select value={t.title} onChange={set('title')} options={['Mr.', 'Ms.', 'Mrs.', 'Dr.', ''].map((x) => ({ value: x, label: x || '—' }))} /></Field>
        <Field label="Name" className="sm:col-span-2"><TextInput value={t.name} onChange={set('name')} required placeholder="Alex" /></Field>
        <Field label="Sign-in email" className="sm:col-span-3"><TextInput type="email" value={t.email} onChange={set('email')} required placeholder="name@pra.edu.vn" /></Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Checkbox checked={t.role === 'head'} onChange={(on) => set('role')(on ? 'head' : 'teacher')} label="Head teacher (can edit every report)" />
        <Checkbox checked={t.active !== false} onChange={set('active')} label="Active" />
      </div>

      <>
        <div>
          <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="label !mb-0">Learning areas they teach</div>
              <p className="text-xs text-slate-500">
                {t.role === 'head'
                  ? 'Head teachers can edit every report anyway. Tick the classes they actually teach so they are named as the teacher on new reports and appear in "Who teaches what".'
                  : 'Tick each learning area in each year group. Only those sections of a report open for editing.'}
              </p>
            </div>
            <Checkbox checked={allGroups} onChange={setAllGroups} label="Show every year group" className="text-xs" />
          </div>
          {legacyKeys.length > 0 && <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Old assignments without a year group ({legacyKeys.join(', ')}) no longer grant access. Tick the year groups below, then save.</p>}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50"><tr>
                <th className="th pl-3">Learning area</th>
                {groups.map((g) => <th key={g} className="th !pr-1 text-center" title={g}>{shortLevel(g)}</th>)}
              </tr></thead>
              <tbody>
                {settings.subjects.map((s) => (
                  <tr key={s.key} className="border-t border-slate-100">
                    <td className="whitespace-nowrap py-1.5 pl-3 pr-3 font-semibold text-slate-700">{s.name} <span className="font-normal text-slate-400">{s.kind === 'specialist' ? '· spec.' : s.kind === 'vocational' ? '· voc.' : ''}</span></td>
                    {groups.map((g) => {
                      const k = `${s.key}:${g}`
                      return (
                        <td key={g} className="px-0.5 py-1 text-center">
                          <button type="button" onClick={() => toggleKey(k)} aria-pressed={has(k)} title={`${s.name}, ${g}`}
                            className={`h-7 w-8 rounded-md text-[11px] font-bold transition-colors ${has(k) ? 'bg-sky-500 text-white shadow-sm' : 'bg-slate-100 text-slate-300 hover:bg-sky-100 hover:text-sky-600'}`}>
                            {has(k) ? '✓' : shortLevel(g)}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-amber-50/40">
                  <td className="whitespace-nowrap py-1.5 pl-3 pr-3 font-semibold text-amber-900">Homeroom <span className="font-normal text-amber-700/70">· overview, skills, note</span></td>
                  {groups.map((g) => {
                    const on = (t.homeroom_groups || []).includes(g)
                    return (
                      <td key={g} className="px-0.5 py-1 text-center">
                        <button type="button" onClick={() => toggleHomeroom(g)} aria-pressed={on} title={`Homeroom ${g}`}
                          className={`h-7 w-8 rounded-md text-[11px] font-bold transition-colors ${on ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-300 hover:bg-amber-100 hover:text-amber-700'}`}>
                          {on ? '✓' : shortLevel(g)}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-2"><Checkbox checked={(t.homeroom_groups || []).includes('*')} onChange={() => toggleHomeroom('*')} label="Homeroom for all year groups" className="text-xs" /></div>
        </div>
      </>

      <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700"><KeyRound size={16} /> Create a login for this teacher</summary>
        <p className="mb-2 mt-2 text-xs text-slate-500">Only needed for someone not in <code>scripts/create-staff-accounts.mjs</code>. {dbMode === 'local' && 'Not available in offline mode.'}</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Temporary password" className="min-w-[220px]"><TextInput type="text" value={pw} onChange={setPw} autoComplete="new-password" placeholder="at least 6 characters" /></Field>
          <button type="button" className="btn-secondary" disabled={signupBusy || dbMode === 'local'} onClick={createLogin}>Create login</button>
        </div>
        {msg && <p className="mt-2 text-xs text-slate-700">{msg}</p>}
      </details>
    </form>
  )
}
