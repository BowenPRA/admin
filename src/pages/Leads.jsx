import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, FileSpreadsheet, MoreHorizontal, Printer, Upload, UserPlus } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useAuth } from '../lib/AuthContext'
import { useData } from '../lib/DataContext'
import { useToast } from '../lib/toast'
import { OFFICE_ACCOUNTS } from '../data/staff'
import {
  STAGES, LEAD_PROGRAMS, SOURCES, labelOf, stageOf, summarize, isDue, byFirstContact, blankLead,
  parseTracker, planImport, exportLeads, leadsError, personName, todayIso, fmtDay, leadForMessage, leadFromMessage, studentsOfLead,
} from '../lib/leads'
import { ChecklistSetupError } from '../lib/onboarding'
import { Card, Checkbox, Empty, Menu, PageHeader, SearchInput, Segmented, Spinner } from '../components/ui'
import LeadModal from '../components/leads/LeadModal'
import MakeStudentsModal from '../components/leads/MakeStudentsModal'
import WebMessages from '../components/leads/WebMessages'

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

// `messages` is null until supabase/updates-2026-09-30-website-forms.sql has run; the website panel is then left out.
// Any other failure is shown on the page (`messagesError`), so waiting messages are not hidden without a word.
async function fetchLeads() {
  let messages = null
  let messagesError = ''
  try { messages = await db.webMessages.list() } catch (e) { if (!/does not exist|schema cache/i.test(e?.message || '')) messagesError = leadsError(e) }
  try { return { leads: await db.leads.list(), messages, messagesError, error: '' } } catch (e) { return { leads: [], messages, messagesError: '', error: leadsError(e) } }
}

/** A figure at the top; clicking it filters the list to those families. */
function Stat({ label, value, sub, tone = '', active, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!active}
      className={`card p-4 text-left transition-colors hover:border-pra-blue ${active ? 'border-pra-blue ring-2 ring-pra-sky/30' : ''}`}>
      <div className="label">{label}</div>
      <div className={`text-2xl font-black tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </button>
  )
}

/** The stage as a coloured pill that is also a drop-down, so it can be changed from the list. */
function StageSelect({ value, onChange, lang, disabled }) {
  const s = stageOf(value)
  return (
    <span className="relative inline-flex">
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} onClick={(e) => e.stopPropagation()}
        aria-label="Stage"
        className={`cursor-pointer appearance-none rounded-full border-0 py-1 pl-2.5 pr-6 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-pra-sky/40 disabled:cursor-wait ${s.tone}`}>
        {STAGES.map((x) => <option key={x.id} value={x.id}>{lang === 'vi' ? x.vi : x.en}</option>)}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-60" />
    </span>
  )
}

function FollowUp({ date, due, lang }) {
  if (!date) return null
  const late = due && date < todayIso()
  const cls = due ? (late ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800') : 'bg-slate-100 text-slate-600'
  return <span className={`chip whitespace-nowrap ${cls}`}>↻ {fmtDay(date, lang)}</span>
}

// Families who have asked about joining. Replaces the Inquiries Tracker
// spreadsheet: office accounts see, add and change everything here, and the
// daily inbox triage adds new enquiries through its own account.
export default function Leads() {
  const { t, lang } = useT()
  const toast = useToast()
  const { me } = useAuth()
  const { students, families, fees, refresh } = useData()
  const [params, setParams] = useSearchParams()
  const [making, setMaking] = useState(null) // the lead whose student records are being made
  const [state, setState] = useState(null)
  const [view, setView] = useState('active')
  const [stage, setStage] = useState('')
  const [program, setProgram] = useState('')
  const [owner, setOwner] = useState('')
  const [dueOnly, setDueOnly] = useState(false)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState('')
  const [marking, setMarking] = useState('')
  const fileInput = useRef(null)

  // A link from a student's checklist opens their family once the list is in: /leads?lead=<id>.
  useEffect(() => {
    let on = true
    const wanted = params.get('lead')
    fetchLeads().then((s) => {
      if (!on) return
      setState(s)
      const l = wanted ? s.leads.find((x) => x.id === wanted) : null
      if (l) { setEditing(l); setView(l.archived ? 'archive' : 'active') }
      if (wanted) setParams({}, { replace: true })
    })
    return () => { on = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const reload = () => fetchLeads().then(setState)
  const leads = state?.leads
  const studentsOf = (l) => studentsOfLead(l, students || [], families || [])
  const messages = state?.messages
  const put = (row) => setState((st) => ({ ...st, leads: st.leads.some((l) => l.id === row.id) ? st.leads.map((l) => (l.id === row.id ? row : l)) : [...st.leads, row] }))
  const myEmail = me?.email || null

  const today = todayIso()
  const sum = useMemo(() => summarize(leads || [], today), [leads, today])
  const inView = useMemo(() => (leads || []).filter((l) => (view === 'archive') === !!l.archived), [leads, view])
  const needle = norm(q)
  // 'won' is the "Trial or enrolled" figure: both stages at once.
  const inStage = (l) => !stage || (stage === 'won' ? ['trial', 'enrolled'].includes(l.stage) : l.stage === stage)
  const filtered = (ignoreStage) => inView.filter((l) =>
    (ignoreStage || inStage(l))
    && (!program || l.program === program)
    && (!owner || (owner === 'none' ? !l.owner : l.owner === owner))
    && (!dueOnly || isDue(l, today))
    && (!needle || [l.family, l.email, l.phone, l.children, l.notes, l.next_step, l.timing].some((v) => norm(v).includes(needle))))
  const rows = filtered(false).sort(byFirstContact)
  const stageCounts = filtered(true).reduce((m, l) => { m[l.stage] = (m[l.stage] || 0) + 1; return m }, {})
  const filtersOn = !!(stage || program || owner || dueOnly || q)
  const clearFilters = () => { setStage(''); setProgram(''); setOwner(''); setDueOnly(false); setQ('') }
  const only = (fn) => { clearFilters(); setView('active'); fn() }

  const changeStage = async (l, next) => {
    setSaving(l.id)
    try {
      put(await db.leads.patch(l.id, { stage: next, updated_by: myEmail }))
      toast(`${l.family}: ${labelOf(STAGES, next, lang)}`)
    } catch (e) { toast.error(leadsError(e)) } finally { setSaving('') }
  }

  const save = async (row) => {
    try {
      const saved = row.id
        ? await db.leads.patch(row.id, { ...row, updated_by: myEmail })
        : await db.leads.save({ ...row, created_by: myEmail, updated_by: myEmail })
      put(saved); setEditing(null); toast(t('ldSaved', { name: saved.family }))
    } catch (e) { toast.error(leadsError(e)) }
  }
  // `changed` is what was typed in the form before Archive was pressed; it is saved in the same step.
  const toggleArchive = async (l, changed = {}) => {
    try {
      const saved = await db.leads.patch(l.id, { ...changed, archived: !l.archived, updated_by: myEmail })
      put(saved); setEditing(null); toast(t(saved.archived ? 'ldArchived' : 'ldRestored', { name: l.family }))
    } catch (e) { toast.error(leadsError(e)) }
  }
  const remove = async (l) => {
    if (!confirm(t('ldConfirmDelete', { name: l.family }))) return
    try {
      await db.leads.remove(l.id)
      setState((st) => ({ ...st, leads: st.leads.filter((x) => x.id !== l.id) })); setEditing(null); toast(t('deletedName', { name: l.family }))
    } catch (e) { toast.error(leadsError(e)) }
  }

  // Making the student records for a family: what was typed in its window is saved first.
  const startMaking = async (l, changed = {}) => {
    try {
      const saved = Object.keys(changed).length ? await db.leads.patch(l.id, { ...changed, updated_by: myEmail }) : l
      put(saved); setEditing(null); setMaking(saved)
    } catch (e) { toast.error(leadsError(e)) }
  }
  const madeStudents = async (made, { stage: next }) => {
    const l = making
    setMaking(null)
    await refresh()
    if (next !== l.stage || l.archived) put({ ...l, stage: next, archived: false })
    toast(t('mkDone', { n: made.length, name: l.family }))
    setEditing({ ...l, stage: next, archived: false })
  }
  const linkStudent = async (st) => {
    try {
      const row = await db.students.patch(st.id, { lead_id: editing.id })
      if (!('lead_id' in row)) throw new ChecklistSetupError('lead_id')
      await refresh()
      toast(t('ldLinked', { name: st.full_name }))
    } catch (e) { toast.error(e instanceof ChecklistSetupError ? t('checklistSetup') : e.message) }
  }

  // A message from the website: open its family (or start one from it), and mark it dealt with.
  const officeOwner = OFFICE_ACCOUNTS.some((a) => a.email === myEmail) ? myEmail : ''
  const openMessage = (m) => setEditing(leadForMessage(m, leads) || leadFromMessage(m, officeOwner))
  const markMessage = async (m, done) => {
    setMarking(m.id)
    try {
      const saved = await db.webMessages.patch(m.id, { done_at: done ? new Date().toISOString() : null, done_by: done ? myEmail : null })
      setState((st) => ({ ...st, messages: st.messages.map((x) => (x.id === saved.id ? saved : x)) }))
      toast(t(done ? 'ldWebMarked' : 'ldWebUnmarked', { name: m.name }))
    } catch (e) { toast.error(leadsError(e)) } finally { setMarking('') }
  }

  // Moving over from the spreadsheet: adds only the families that are not here yet.
  const importFile = async (file) => {
    let parsed
    try { parsed = parseTracker(await file.arrayBuffer()) } catch { parsed = [] }
    if (!parsed.length) { toast.error(t('ldImportBad')); return }
    const { add, skip } = planImport(parsed, leads || [])
    if (!add.length) { toast.info(t('ldImportNothing', { n: skip.length })); return }
    const active = add.filter((l) => !l.archived).length
    if (!confirm(t('ldImportConfirm', { n: add.length, active, archived: add.length - active, skip: skip.length }))) return
    setBusy(true)
    try {
      await db.leads.saveMany(add.map((l) => ({ ...l, created_by: myEmail, updated_by: myEmail })))
      await reload(); toast(t('ldImportDone', { n: add.length }))
    } catch (e) { toast.error(leadsError(e)) } finally { setBusy(false) }
  }

  if (!leads) return <Spinner />
  const error = state.error
  const programLabel = (id) => labelOf(LEAD_PROGRAMS, id, lang)

  return (
    <div className="space-y-5">
      <PageHeader title={t('leadsNav')} subtitle={t('ldSubtitle')}>
        <Link className="btn-secondary" to="/print/admissions"><Printer size={16} /> {t('printSummary')}</Link>
        <Menu label={t('more')} icon={MoreHorizontal} items={[
          { label: t('ldImport'), icon: Upload, onClick: () => fileInput.current?.click(), disabled: busy || !!error, hint: t('ldImportHint') },
          { label: t('ldExport'), icon: FileSpreadsheet, onClick: () => exportLeads(leads), disabled: !leads.length, hint: t('ldExportHint') },
        ]} />
        <input ref={fileInput} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f) }} />
        <button className="btn-primary" disabled={!!error} onClick={() => setEditing(blankLead(officeOwner))}><UserPlus size={16} /> {t('ldAdd')}</button>
      </PageHeader>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {state.messagesError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{t('ldWebLoadError', { error: state.messagesError })}</div>}

      {messages && !error && <WebMessages messages={messages} leads={leads} busyId={marking} onOpen={openMessage} onDone={markMessage} t={t} lang={lang} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label={t('ldStatActive')} value={sum.active} sub={t(sum.children === 1 ? 'ldChild' : 'ldChildren', { n: sum.children })}
          active={view === 'active' && !filtersOn} onClick={() => only(() => {})} />
        <Stat label={t('ldStatNew')} value={sum.new} tone={sum.new ? 'text-amber-700' : ''} active={view === 'active' && stage === 'new'} onClick={() => only(() => setStage('new'))} />
        <Stat label={t('ldStatDue')} value={sum.due} tone={sum.due ? 'text-red-600' : ''} active={view === 'active' && dueOnly} onClick={() => only(() => setDueOnly(true))} />
        <Stat label={t('ldStatTours')} value={sum.toursBooked} active={view === 'active' && stage === 'tour_booked'} onClick={() => only(() => setStage('tour_booked'))} />
        <Stat label={t('ldStatWon')} value={sum.trialOrEnrolled} active={view === 'active' && stage === 'won'} onClick={() => only(() => setStage('won'))} />
      </div>

      <Card className="!p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <Segmented value={view} onChange={(v) => { setView(v); setStage('') }} options={[
            { value: 'active', label: `${t('ldActiveTab')} · ${sum.active}` },
            { value: 'archive', label: `${t('ldArchiveTab')} · ${sum.archived}` },
          ]} />
          <SearchInput value={q} onChange={setQ} placeholder={t('ldSearch')} className="w-full sm:w-60" />
          <select className="input w-auto" value={program} onChange={(e) => setProgram(e.target.value)} aria-label={t('program')}>
            <option value="">{t('ldAllPrograms')}</option>
            {LEAD_PROGRAMS.map((p) => <option key={p.id} value={p.id}>{lang === 'vi' ? p.vi : p.en}</option>)}
          </select>
          <select className="input w-auto" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label={t('ldOwner')}>
            <option value="">{t('ldAnyone')}</option>
            {OFFICE_ACCOUNTS.map((a) => <option key={a.email} value={a.email}>{a.name}</option>)}
            <option value="none">{t('ldNobody')}</option>
          </select>
          {view === 'active' && <Checkbox checked={dueOnly} onChange={setDueOnly} label={t('ldDueOnly')} className="px-1" />}
          {filtersOn && <button className="btn-ghost text-xs" onClick={clearFilters}>{t('clearFilters')}</button>}
          <span className="ml-auto text-xs text-slate-400">{t('familiesCount', { n: rows.length })}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-3 py-2">
          {STAGES.map((s) => {
            const n = stageCounts[s.id] || 0
            if (!n && stage !== s.id) return null
            const on = stage === s.id
            return (
              <button key={s.id} type="button" aria-pressed={on} onClick={() => setStage(on ? '' : s.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${on ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />{lang === 'vi' ? s.vi : s.en} <span className={on ? 'text-white/70' : 'text-slate-400'}>{n}</span>
              </button>
            )
          })}
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            {inView.length ? <Empty text={t('noMatches')} /> : view === 'archive' ? <Empty text={t('ldNoneArchive')} /> : <Empty text={t('ldNone')}><p className="mt-1">{t('ldNoneHint')}</p></Empty>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  <th className="th pl-4">{t('family')}</th>
                  <th className="th hidden md:table-cell">{t('ldColChildren')}</th>
                  <th className="th hidden lg:table-cell">{t('program')}</th>
                  <th className="th hidden sm:table-cell">{t('ldColFirst')}</th>
                  <th className="th">{t('ldColStage')}</th>
                  <th className="th hidden md:table-cell">{t('ldColNext')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const due = isDue(l, today)
                  // A step shared between people already names them ("Seth: … · Yvonne: …").
                  const who = l.owner && !String(l.next_step || '').includes(personName(l.owner)) ? personName(l.owner, lang) : ''
                  const next = (who || l.next_step) && (
                    <span className="line-clamp-2 text-slate-700">{who && <span className="font-semibold text-slate-800">{who}: </span>}{l.next_step}</span>
                  )
                  return (
                    <tr key={l.id} className="cursor-pointer border-t border-slate-100 align-top hover:bg-slate-50" onClick={() => setEditing(l)}>
                      <td className="td pl-4">
                        <div className="font-semibold text-slate-800">{l.family}</div>
                        {l.email && <div className="max-w-[16rem] truncate text-xs text-slate-500">{l.email}</div>}
                        <div className="mt-1 space-y-1 text-xs md:hidden">
                          {next}
                          <FollowUp date={l.follow_up} due={due} lang={lang} />
                        </div>
                      </td>
                      <td className="td hidden max-w-[15rem] md:table-cell">
                        <span className="line-clamp-2 text-slate-700">{l.children}</span>
                        {Number(l.kids) > 0 && <span className="text-xs text-slate-400">{t(Number(l.kids) === 1 ? 'ldChild' : 'ldChildren', { n: l.kids })}</span>}
                      </td>
                      <td className="td hidden max-w-[12rem] lg:table-cell">
                        <div className="text-slate-700">{programLabel(l.program)}</div>
                        <div className="line-clamp-2 text-xs text-slate-500">{l.timing}</div>
                      </td>
                      <td className="td hidden whitespace-nowrap sm:table-cell">
                        <div className="text-slate-700">{fmtDay(l.first_contact, lang)}</div>
                        <div className="text-xs text-slate-500">{labelOf(SOURCES, l.source, lang)}</div>
                      </td>
                      <td className="td">
                        <StageSelect value={l.stage} lang={lang} disabled={saving === l.id} onChange={(v) => changeStage(l, v)} />
                        {['trial', 'enrolled'].includes(l.stage) && (() => { const x = studentsOf(l); return !x.linked.length && !x.matched.length })() && (
                          <div className="mt-1"><span className="chip bg-amber-100 text-amber-800" title={t('ldNoStudentWarnShort')}>{t('ldNoStudentChip')}</span></div>
                        )}
                        {l.tour_date && ['tour_booked', 'tour_done', 'trial'].includes(l.stage) && <div className="mt-1 text-xs text-slate-500">{t('ldTour')}: {fmtDay(l.tour_date, lang)}</div>}
                      </td>
                      <td className="td hidden max-w-[20rem] md:table-cell">
                        <div className="space-y-1">
                          {next}
                          <FollowUp date={l.follow_up} due={due} lang={lang} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <LeadModal value={editing} leads={leads} messages={editing.id ? (messages || []).filter((m) => leadForMessage(m, leads)?.id === editing.id) : []}
          {...(editing.id ? studentsOf(editing) : {})} onMakeStudents={startMaking} onLinkStudent={linkStudent}
          onClose={() => setEditing(null)} onSave={save} onArchive={toggleArchive} onDelete={remove} t={t} lang={lang} />
      )}
      {making && (
        <MakeStudentsModal lead={making} students={students || []} families={families || []} schoolYear={fees?.schoolYear} me={me}
          onClose={() => setMaking(null)} onDone={madeStudents} t={t} lang={lang} />
      )}
    </div>
  )
}
