import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Printer, Eye, EyeOff, Lock, ChevronDown, ChevronUp, Plus, Users, Copy, Check, Languages, AlertTriangle, PenLine } from 'lucide-react'
import { useData } from '../../lib/DataContext'
import { photoSrc } from '../../lib/report/photo'
import { partialFrom } from '../../lib/studentRecords'
import { useAuth } from '../../lib/AuthContext'
import { db, genId } from '../../lib/db'
import { loadReportBundle } from '../../lib/report/loaders'
import { subjectByKey, completion, charCount, levelInfo, hasNum, sectionsByTier, missingAreas, buildSection, pctFromRaw, isNA, teacherNameFor, sectionTeacher, hasReviewScores, scheduledHomeroom, reportHomeroom, isHomeroomSignature, templateOf, skillGroupsFor, textLimits, textMinimums } from '../../lib/report/utils'
import { TIERS, TEXT_LIMITS, TEXT_MINIMUMS } from '../../lib/report/defaults'
import { reportTitle, voiceQuoted } from '../../lib/report/strings'
import { Card, Field, TextInput, TextArea, NumberInput, Select, Spinner, LevelPicker, SaveState, BulletList, ReportStatusChip } from '../../components/ui'
import { Icon } from '../../components/report/icons'
import ReportPdfPreview, { ReportCheckNotes } from '../../components/report/ReportPdfPreview'
import { wordingIssues } from '../../lib/report/wording'
import { legalFirstName } from '../../lib/names'

const SAVE_DELAY = 900

// Browser spell check on everything teachers write.
const EN = { spellCheck: true, lang: 'en' }
const VI = { spellCheck: true, lang: 'vi' }

/** Wording advice under a text box (school, report card, grades/tests, nickname, missing accents). Never blocks. */
function Wording({ text, lang = 'en', name }) {
  const issues = wordingIssues(Array.isArray(text) ? text.join('\n') : text, { lang, legalName: name?.legal, nickname: name?.nickname })
  if (!issues.length) return null
  return issues.map((m) => <span key={m} className="mt-0.5 flex items-start gap-1 font-semibold text-amber-700"><AlertTriangle size={12} className="mt-0.5 flex-none" />{m}</span>)
}

const GUIDE_KEY = 'pra-report-guide-hidden'

/** Notes for teachers, with the student's legal first name ready to copy. */
function WritingGuide({ name }) {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(GUIDE_KEY) === '1' } catch { return false } })
  const [copied, setCopied] = useState(false)
  const toggle = () => setHidden((h) => { try { localStorage.setItem(GUIDE_KEY, h ? '0' : '1') } catch { /* private window */ } return !h })
  const copy = async () => {
    try { await navigator.clipboard.writeText(name.legal); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked: the name is still visible to type */ }
  }
  const showNick = name.nickname && name.nickname.trim().toLowerCase() !== name.legal.toLowerCase()
  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-2.5 text-sm text-indigo-950">
      <div className="flex flex-wrap items-center gap-2">
        <PenLine size={15} className="text-indigo-600" />
        <span className="font-bold">Writing comments</span>
        {name.legal && (<>
          <span className="text-indigo-900/80">· Use the legal first name</span>
          <button type="button" onClick={copy} title="Copy the name" className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-0.5 font-bold text-slate-800 ring-1 ring-indigo-200 hover:bg-indigo-100">
            {name.legal} {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} className="text-indigo-500" />}
          </button>
          {showNick && <span className="text-xs text-indigo-900/70">not the nickname “{name.nickname}”</span>}
        </>)}
        <button type="button" className="btn-ghost ml-auto !py-1 text-xs" onClick={toggle}>{hidden ? <ChevronDown size={14} /> : <ChevronUp size={14} />} {hidden ? 'Show guidelines' : 'Hide guidelines'}</button>
      </div>
      {!hidden && (
        <>
          <ul className="mt-2 grid list-disc gap-x-8 gap-y-1 pl-5 text-[13px] sm:grid-cols-2">
            <li>Use the student’s <b>legal first name</b>, not their nickname, with Vietnamese accents where the name has them.</li>
            <li>Never refer to Palm River Academy as a <b>school</b>. Say “Palm River Academy” or “our learning community”.</li>
            <li>Never call this a <b>report card</b>. It is a Learning Progress Report.</li>
            <li>Avoid <b>grades</b> and <b>tests</b>. Say <b>scores</b> and <b>assessments</b>.</li>
            <li className="sm:col-span-2">Spell check is on: fix words underlined in red (right-click a word for suggestions). Words that break these rules are flagged under the box as you type.</li>
          </ul>
          {name.legal && name.guessed && <p className="mt-1.5 text-xs text-indigo-900/70">“{name.legal}” was worked out from the full name “{name.full}”. If it is not right, ask the office to enter the legal first name on the student record.</p>}
        </>
      )}
    </section>
  )
}

const filled = (v) => (Array.isArray(v) ? v.some((x) => (x || '').trim()) : !!(v || '').trim())

/**
 * Vietnamese versions folded away under one button per card, so the English
 * fields stay compact. `pairs` = [[english, vietnamese], ...] for the status chip.
 */
function ViPanel({ pairs, openAll, children }) {
  const [open, setOpen] = useState(!!openAll?.open)
  // The header's Show/Hide button opens or closes every panel; each can still be toggled on its own after.
  const [seen, setSeen] = useState(openAll)
  if (openAll !== seen) { setSeen(openAll); if (openAll) setOpen(openAll.open) }
  const needed = pairs.filter(([en]) => filled(en))
  const done = needed.filter(([, vi]) => filled(vi)).length
  const [label, tone] = !needed.length ? ['nothing to translate yet', 'bg-slate-100 text-slate-500']
    : done === needed.length ? ['all written', 'bg-green-100 text-green-800']
      : [`${done} of ${needed.length} written`, 'bg-amber-100 text-amber-800']
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100">
        <Languages size={14} className="text-pra-navy" /> Tiếng Việt
        <span className={`chip !py-0 ${tone}`}>{label}</span>
        <span className="ml-auto flex items-center gap-1 font-normal text-slate-400">{open ? 'Hide' : 'Show'} {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>
      {open && <div className="space-y-2 border-t border-slate-200 p-3">{children}</div>}
    </div>
  )
}

const COUNT_TONES = {
  short: { text: 'text-sky-700', bar: 'bg-sky-400' },
  ok: { text: 'text-green-700', bar: 'bg-green-500' },
  full: { text: 'text-green-700', bar: 'bg-amber-400' },
  over: { text: 'font-semibold text-red-600', bar: 'bg-red-500' },
}

/**
 * "312 / 480" with a small meter: blue below the suggested minimum (advice
 * only, never blocks saving), green in range (the meter turns amber when nearly
 * full), red when it will not fit. The tick on the meter marks the suggested minimum.
 */
function Count({ text, max, min }) {
  const n = charCount(text)
  const state = n > max ? 'over' : min && n < min ? 'short' : n > max * 0.9 ? 'full' : 'ok'
  const note = { over: 'too long to fit', short: `suggested at least ${min}`, full: 'nearly full', ok: '' }[state]
  return (
    <span className={`inline-flex items-center gap-2 ${COUNT_TONES[state].text}`} title={min ? `Suggested ${min}–${max} characters` : `Up to ${max} characters`}>
      <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
        <span className={`absolute inset-y-0 left-0 ${COUNT_TONES[state].bar}`} style={{ width: `${Math.min(100, (n / max) * 100)}%` }} />
        {min ? <span className="absolute inset-y-0 w-0.5 bg-slate-500/70" style={{ left: `${(min / max) * 100}%` }} /> : null}
      </span>
      <span>{n} / {max}{note ? ` · ${note}` : ''}</span>
    </span>
  )
}

/** "2 of 5 lines · suggested at least 3" for the experiences list. */
function LineCount({ items, limits = TEXT_LIMITS, minimums = TEXT_MINIMUMS }) {
  const n = (items || []).filter((e) => (e || '').trim()).length
  const short = n < minimums.experience_lines
  return (
    <span className={`text-xs ${short ? 'text-sky-700' : 'text-green-700'}`}>
      {n} of {limits.experience_lines} lines{short ? ` · suggested at least ${minimums.experience_lines}` : ''} · up to {limits.experience} characters each
    </span>
  )
}

export default function ReportEditor() {
  const { id } = useParams()
  const { reportSettings: settings, teachers, schedule } = useData()
  const { me, isHead, canSubject, canHomeroom, displayName } = useAuth()
  const [bundle, setBundle] = useState(null)
  const [report, setReport] = useState(null)
  const [sections, setSections] = useState([])
  const [notes, setNotes] = useState({})
  const [err, setErr] = useState('')
  const [saveState, setSaveState] = useState('idle')
  const [preview, setPreview] = useState(false)
  const [previewLang, setPreviewLang] = useState('en')
  const [check, setCheck] = useState(null)
  const [showHomeroom, setShowHomeroom] = useState(false)
  // Header button that opens or closes every Vietnamese panel at once.
  const [viAll, setViAll] = useState(null)

  // `latest` mirrors the three pieces of state so rapid keystrokes always build
  // on the newest value; it is only touched inside event handlers.
  const latest = useRef({ report: null, sections: [], notes: {} })
  // Autosave. Only the fields that changed are sent, so a report left open does
  // not write old values over what someone else saved meanwhile. Per key
  // (the report, each section, each shared note): `waiting` holds the fields
  // not saved yet, `chains` keeps saves in order, and a failed save is kept and
  // tried again rather than dropped.
  const timers = useRef({})
  const waiting = useRef({})
  const chains = useRef({})
  const failed = useRef({})

  useEffect(() => {
    loadReportBundle(id, settings).then((b) => {
      const notesMap = Object.fromEntries(b.courseNotes.map((n) => [n.subject_key, n]))
      latest.current = { report: b.report, sections: b.sections, notes: notesMap }
      setBundle(b); setReport(b.report); setSections(b.sections); setNotes(notesMap)
    }).catch((e) => setErr(e.message))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps -- load once per report; a settings refresh must not reset the editor

  const runKey = useCallback(function run(key) {
    clearTimeout(timers.current[key])
    const job = waiting.current[key]
    if (!job) return chains.current[key] || Promise.resolve()
    delete waiting.current[key]
    chains.current[key] = (chains.current[key] || Promise.resolve())
      .then(() => job.save(job.fields))
      .then(() => { delete failed.current[key] }, (e) => {
        console.error(e)
        const tries = (failed.current[key] || 0) + 1
        failed.current[key] = tries
        // Keep what was not saved (newer typing wins) and try again shortly, a few times.
        waiting.current[key] = { save: job.save, fields: { ...job.fields, ...(waiting.current[key]?.fields || {}) } }
        if (tries <= 3 && !timers.current[`retry:${key}`]) timers.current[`retry:${key}`] = setTimeout(() => { delete timers.current[`retry:${key}`]; run(key) }, 4000)
      })
      .then(() => {
        if (Object.keys(failed.current).length) setSaveState('error')
        else if (!Object.keys(waiting.current).length) { setSaveState('saved'); setTimeout(() => setSaveState((st) => (st === 'saved' ? 'idle' : st)), 2500) }
      })
    return chains.current[key]
  }, [])
  const queue = useCallback((key, fields, save) => {
    waiting.current[key] = { save, fields: { ...(waiting.current[key]?.fields || {}), ...fields } }
    setSaveState('saving')
    clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(() => runKey(key), SAVE_DELAY)
  }, [runKey])
  /** Saves everything still waiting, e.g. before the PDF (which reads the saved report) opens. */
  const flush = useCallback(() => Promise.all(Object.keys(waiting.current).map(runKey)), [runKey])
  // Leaving the page saves what is waiting; closing the tab mid-save asks first.
  useEffect(() => {
    const onLeave = (e) => { if (!Object.keys(waiting.current).length) return; flush(); e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onLeave)
    const held = timers.current
    return () => { window.removeEventListener('beforeunload', onLeave); flush(); Object.values(held).forEach(clearTimeout) }
  }, [flush])
  const openPdf = async (e, lang) => {
    if (!Object.keys(waiting.current).length) return // nothing unsaved: the link opens as usual
    e.preventDefault()
    const tab = window.open('', '_blank')
    await flush()
    const url = `${window.location.href.split('#')[0]}#/print/report/${id}${lang ? `?lang=${lang}` : ''}`
    if (tab) tab.location = url; else window.location.assign(url)
  }
  // The live report for the PDF preview (a new object only when something changes).
  const pdfBundle = useMemo(() => bundle && { ...bundle, report, sections, courseNotes: Object.values(notes) }, [bundle, report, sections, notes])

  const patchReport = (p) => {
    const n = { ...latest.current.report, ...p }; latest.current.report = n; setReport(n)
    queue('report', p, (fields) => db.reports.patch(n.id, fields))
  }
  const patchSection = (sid, p) => {
    const fields = { ...p, updated_by: me?.email || null }
    const list = latest.current.sections.map((s) => (s.id === sid ? { ...s, ...fields } : s))
    latest.current.sections = list; setSections(list)
    queue(`section:${sid}`, fields, (f) => db.sections.patch(sid, f))
  }
  const patchNote = (key, p) => {
    const r = latest.current.report
    const cur = latest.current.notes[key] || { id: genId(), school_year: r.school_year, period_label: r.period_label, year_group: r.year_group, subject_key: key, description: '', description_vi: '', teacher_name: '' }
    const n = { ...cur, ...p }
    const map = { ...latest.current.notes, [key]: n }; latest.current.notes = map; setNotes(map)
    // Notes are shared by the year group and saved whole, by year group + period + area.
    queue(`note:${key}`, n, (note) => db.courseNotes.save(note))
  }
  // Vietnamese lines are paired with the English ones by position, so removing an English line removes its pair.
  const setExperiences = (v) => {
    const old = latest.current.report.experiences || []
    const vi = latest.current.report.experiences_vi || []
    if (v.length === old.length - 1 && vi.length) {
      let at = v.findIndex((x, i) => x !== old[i])
      if (at < 0) at = old.length - 1
      patchReport({ experiences: v, experiences_vi: vi.filter((_, j) => j !== at) })
    } else patchReport({ experiences: v })
  }
  const [adding, setAdding] = useState('')
  const addArea = async (key) => {
    if (adding) return
    setAdding(key)
    const r = latest.current.report
    const sec = buildSection(r.id, key, settings, { yearGroup: r.year_group, teachers })
    try {
      await db.sections.save(sec)
      const list = [...latest.current.sections, sec]; latest.current.sections = list; setSections(list)
    } catch (e) { alert(e.message) } finally { setAdding('') }
  }

  if (err) return <div className="p-8 text-red-600">{err}</div>
  if (!bundle || !report || !settings) return <Spinner />

  const student = bundle.student
  const published = report.status === 'published'
  const homeroomOk = canHomeroom(report) && (!published || isHead)
  const subjectOk = (key) => canSubject(key, report.year_group) && (!published || isHead)
  const levels = settings.levels || []
  // 'bi' = this student also gets a Vietnamese report (printed as its own page)
  const bi = report.lang === 'bi'
  const shownLang = bi ? previewLang : 'en'
  const tiers = sectionsByTier(settings, sections)
  const comp = completion(report, sections, settings)
  const periods = settings.periods || []
  const isLastPeriod = periods.length > 0 && Number(report.period_index) >= Math.max(...periods.map((p) => Number(p.index)))
  const lastLabel = periods.length ? periods[periods.length - 1].label : 'final'
  const missing = missingAreas(settings, report, sections, student).filter((k) => subjectOk(k))
  const teacherNames = teachers.filter((t) => t.active !== false).map((t) => `${t.title ? t.title + ' ' : ''}${t.name}`)
  // The homeroom teacher comes from the Schedule; the name typed here counts only while the Schedule has none.
  const scheduledHr = scheduledHomeroom(schedule, report.year_group)
  const fromSchedule = <>From the <Link to="/schedule" className="font-semibold text-pra-blue">Schedule</Link></>
  const legal = legalFirstName(student)
  const name = { legal: legal.name, guessed: legal.guessed, nickname: student?.nickname || '', full: student?.full_name || report.student_name || '' }
  const reviewScores = hasReviewScores(settings, report)
  // Character limits and suggested minimums (a template can raise them, e.g. Early Years Applied English).
  const L = textLimits(settings, report)
  const MIN = textMinimums(settings, report)
  const cardProps = { reviewScores, settings, levels, bi, teachers, isHead, signName: displayName, yearGroup: report.year_group, isLastPeriod, lastLabel, name, viAll, limits: L, minimums: MIN }
  // Headings and learner skills follow the report's template (Early Years has its own).
  const template = templateOf(settings, report)
  const tierHint = (tier) => (tier.key === 'academic' && !reviewScores ? 'Level, comment and next focus for each student. Topics covered is optional and shared by the year group.' : tier.hint)
  const quotedVoice = voiceQuoted(template)
  const voiceLabel = quotedVoice ? "In the student's words" : reportTitle(template, 'voice', 'en', { nickname: name.legal || 'the student' })
  const voiceHint = quotedVoice ? 'What they enjoyed most this quarter.' : 'Favourite activities, songs, games or friends this quarter. Put anything they said in quotation marks.'

  return (
    <div className={`grid gap-6 ${preview ? 'xl:grid-cols-[1fr_auto]' : ''}`}>
      <div className="min-w-0 space-y-5">
        <div className="sticky top-[57px] z-30 -mx-4 border-b border-slate-200 bg-[#f5f7fa]/95 px-4 py-2 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/reports" className="btn-ghost"><ArrowLeft size={16} /></Link>
            {photoSrc(student?.photo) ? <img src={photoSrc(student.photo)} alt="" className="h-9 w-9 rounded-full object-cover" /> : null}
            <div className="mr-auto">
              <div className="font-bold leading-tight">{student?.full_name || report.student_name}</div>
              <div className="text-xs text-slate-500">{report.year_group} · {report.period_label} {report.school_year} · {comp.pct}% complete{partialFrom(student) && <> · <span className="font-semibold text-amber-700" title="Joins after the morning lessons, so this report has no academic learning">Partial day, from {partialFrom(student)}</span></>}</div>
            </div>
            <SaveState state={saveState} />
            {homeroomOk ? (
              <select className="input w-auto" value={report.status} onChange={(e) => patchReport({ status: e.target.value })}>
                <option value="draft">Draft</option><option value="ready">Ready to review</option>{(isHead || published) && <option value="published">Published</option>}
              </select>
            ) : <ReportStatusChip status={report.status} />}
            {bi && <button className="btn-secondary" onClick={() => setViAll((v) => ({ open: !v?.open }))} title="Open or close every Vietnamese version"><Languages size={16} /> {viAll?.open ? 'Hide' : 'Show'} Tiếng Việt</button>}
            <button className="btn-secondary hidden xl:inline-flex" onClick={() => setPreview((v) => !v)}>{preview ? <EyeOff size={16} /> : <Eye size={16} />} Preview</button>
            <Link to={`/print/report/${id}`} target="_blank" className="btn-primary" title="Open the PDF to print or save" onClick={(e) => openPdf(e, '')}><Printer size={16} /> {bi ? 'English PDF' : 'PDF'}</Link>
            {bi && <Link to={`/print/report/${id}?lang=vi`} target="_blank" className="btn-primary" title="Open the PDF to print or save" onClick={(e) => openPdf(e, 'vi')}><Printer size={16} /> Tiếng Việt PDF</Link>}
          </div>
          {published && !isHead && <div className="mt-1 text-xs font-semibold text-amber-700">This report is published. Only the head teacher can change it now.</div>}
          {preview && <ReportCheckNotes check={check} lang={shownLang} className="mt-1 hidden xl:block" />}
        </div>

        {(!published || isHead) && <WritingGuide name={name} />}

        {!isHead && !published && (() => {
          const mine = sections.filter((s) => subjectOk(s.subject_key))
          return (
            <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${mine.length || homeroomOk ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
              {mine.length || homeroomOk ? (<>
                <span className="font-semibold">You can edit:</span>
                {mine.map((s) => <a key={s.id} href={`#sec-${s.subject_key}`} onClick={(e) => { e.preventDefault(); document.getElementById(`sec-${s.subject_key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }} className="chip bg-white text-sky-800 ring-1 ring-sky-200 hover:bg-sky-100">{subjectByKey(settings, s.subject_key).name}</a>)}
                {homeroomOk && <span className="chip bg-white text-amber-800 ring-1 ring-amber-200">Homeroom parts</span>}
                <span className="text-xs text-sky-700/80">Other sections are shown for reference.</span>
              </>) : <span><Lock size={14} className="mr-1 inline" />You are not linked to any part of this {report.year_group} report, so it is read-only.</span>}
            </div>
          )
        })()}

        {missing.length > 0 && !published && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            <span>This report was created before {missing.map((k) => subjectByKey(settings, k).name).join(' and ')} {missing.length === 1 ? 'was' : 'were'} added to {report.year_group}.</span>
            {missing.map((k) => <button key={k} className="btn-secondary text-xs" disabled={!!adding} onClick={() => addArea(k)}><Plus size={14} /> Add {subjectByKey(settings, k).name}</button>)}
          </div>
        )}

        {!homeroomOk && (
          <Card locked title="Homeroom parts" subtitle={`Written by ${reportHomeroom(schedule, report) || 'the homeroom teacher'}. Shown for reference.`}
            actions={<button type="button" className="btn-ghost text-xs" onClick={() => setShowHomeroom((v) => !v)}>{showHomeroom ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {showHomeroom ? 'Hide details' : 'Show details'}</button>}>
            <div className="text-sm"><div className="label">Homeroom teacher comment</div><p className="line-clamp-4 text-slate-600">{report.homeroom_note || <span className="italic text-slate-400">Not written yet</span>}</p></div>
          </Card>
        )}

        {(homeroomOk || showHomeroom) && (
          <Card title="Overview" locked={!homeroomOk} subtitle="Report details and the comment printed at the top of the page. Homeroom teacher or head.">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Report date"><TextInput type="date" value={report.report_date || ''} onChange={(v) => patchReport({ report_date: v })} disabled={!homeroomOk} /></Field>
              {scheduledHr ? (
                <Field label="Homeroom teacher" hint={fromSchedule}><div className="input flex items-center bg-slate-50 text-slate-700">{scheduledHr}</div></Field>
              ) : (
                <Field label="Homeroom teacher" hint={`No homeroom teacher for ${report.year_group} on the Schedule yet`}><input className="input" list="teacher-names" value={report.homeroom_teacher || ''} onChange={(e) => patchReport({ homeroom_teacher: e.target.value })} disabled={!homeroomOk} /><datalist id="teacher-names">{teacherNames.map((n) => <option key={n} value={n} />)}</datalist></Field>
              )}
              <Field label="Class name" hint="Optional, e.g. Secondary"><TextInput value={report.class_name} onChange={(v) => patchReport({ class_name: v })} disabled={!homeroomOk} /></Field>
              <Field label="Reports" hint={bi ? 'Vietnamese prints as its own page' : undefined}><Select value={report.lang || 'en'} onChange={(v) => patchReport({ lang: v })} disabled={!homeroomOk} options={[{ value: 'en', label: 'English only' }, { value: 'bi', label: 'English and Vietnamese' }]} /></Field>
            </div>
            <Field label="Homeroom teacher comment" className="mt-3" right={<Count text={report.homeroom_note} max={L.homeroom_note} min={MIN.homeroom_note} />} hint={<Wording text={report.homeroom_note} name={name} />}>
              <TextArea {...EN} rows={4} value={report.homeroom_note} onChange={(v) => patchReport({ homeroom_note: v })} disabled={!homeroomOk} placeholder={`How has ${name.legal || 'the student'} settled in and approached learning this quarter?`} />
            </Field>
            {bi && (
              <div className="mt-3">
                <ViPanel pairs={[[report.homeroom_note, report.homeroom_note_vi]]} openAll={viAll}>
                  <Field label="Homeroom teacher comment" right={<Count text={report.homeroom_note_vi} max={L.homeroom_note} min={MIN.homeroom_note} />} hint={<Wording lang="vi" text={report.homeroom_note_vi} name={name} />}>
                    <TextArea {...VI} rows={3} value={report.homeroom_note_vi} onChange={(v) => patchReport({ homeroom_note_vi: v })} disabled={!homeroomOk} />
                  </Field>
                </ViPanel>
              </div>
            )}
          </Card>
        )}

        {TIERS.map((tier) => tiers[tier.key].length > 0 && (
          <div key={tier.key}>
            <h2 className="text-lg font-bold">{reportTitle(template, tier.key, 'en')}</h2>
            <p className="mb-2 text-xs text-slate-500">{tierHint(tier)}</p>
            <div className="space-y-4">
              {tiers[tier.key].map((s) => (
                <SubjectCard key={s.id} tier={tier.key} section={s} editable={subjectOk(s.subject_key)} onPatch={(p) => patchSection(s.id, p)}
                  cohortAvg={bundle.cohortAvg[s.subject_key]} note={notes[s.subject_key]} onNote={(p) => patchNote(s.subject_key, p)} {...cardProps} />
              ))}
            </div>
          </div>
        ))}

        {(homeroomOk || showHomeroom) && (<>
          <Card title="How I learn" locked={!homeroomOk} subtitle="Learner skills, printed as a level beside each skill.">
            <div className="space-y-4">
              {skillGroupsFor(settings, report).map((g) => (
                <div key={g.key}>
                  <div className="label">{g.name}</div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map((it) => (
                      <div key={it.key} className="rounded-xl border border-slate-200 p-3">
                        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Icon name={it.icon} size={15} className="text-pra-navy" /> {it.name}</div>
                        <LevelPicker size="sm" levels={levels} value={report.skills?.[it.key]} disabled={!homeroomOk} onChange={(v) => patchReport({ skills: { ...(report.skills || {}), [it.key]: v } })} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Experiences and student voice" locked={!homeroomOk}>
            <div className="mb-1 flex items-center justify-between">
              <span className="label !mb-0">Experiences &amp; growth this quarter</span>
              <LineCount items={report.experiences} limits={L} minimums={MIN} />
            </div>
            <BulletList items={report.experiences} onChange={setExperiences} disabled={!homeroomOk} placeholder="Add an experience" max={L.experience_lines} inputProps={EN} />
            <div className="text-xs"><Wording text={report.experiences} name={name} /></div>
            {[...(report.experiences || []), ...(bi ? report.experiences_vi || [] : [])].some((e) => charCount(e) > L.experience) && <p className="mt-1 text-xs font-semibold text-red-600">A line is longer than {L.experience} characters and may not fit.</p>}
            <Field label={voiceLabel} className="mt-4" hint={<>{voiceHint}<Wording text={report.student_voice} name={name} /></>} right={<Count text={report.student_voice} max={L.student_voice} min={MIN.student_voice} />}>
              <TextArea {...EN} rows={2} value={report.student_voice} onChange={(v) => patchReport({ student_voice: v })} disabled={!homeroomOk} />
            </Field>
            {bi && (
              <div className="mt-3">
                <ViPanel pairs={[[report.experiences, report.experiences_vi], [report.student_voice, report.student_voice_vi]]} openAll={viAll}>
                  <div className="flex items-center justify-between"><span className="label !mb-0">Experiences &amp; growth</span><LineCount items={report.experiences_vi} limits={L} minimums={MIN} /></div>
                  <BulletList items={report.experiences_vi} onChange={(v) => patchReport({ experiences_vi: v })} disabled={!homeroomOk} placeholder="Thêm trải nghiệm" max={L.experience_lines} inputProps={VI} />
                  <div className="text-xs"><Wording lang="vi" text={report.experiences_vi} name={name} /></div>
                  <Field label={voiceLabel} right={<Count text={report.student_voice_vi} max={L.student_voice} min={MIN.student_voice} />} hint={<Wording lang="vi" text={report.student_voice_vi} name={name} />}>
                    <TextArea {...VI} rows={2} value={report.student_voice_vi} onChange={(v) => patchReport({ student_voice_vi: v })} disabled={!homeroomOk} />
                  </Field>
                </ViPanel>
              </div>
            )}
          </Card>

          <Card title="Signatures" locked={!homeroomOk} subtitle="Names printed on the signature lines.">
            <div className="grid gap-3 sm:grid-cols-2">
              {(report.signatures || []).map((sg, i) => (
                scheduledHr && isHomeroomSignature(sg)
                  ? <Field key={i} label={sg.role} hint={fromSchedule}><div className="input flex items-center bg-slate-50 text-slate-700">{scheduledHr}</div></Field>
                  : <Field key={i} label={sg.role}><TextInput value={sg.name} disabled={!homeroomOk} onChange={(v) => patchReport({ signatures: report.signatures.map((x, j) => (j === i ? { ...x, name: v } : x)) })} /></Field>
              ))}
            </div>
          </Card>
        </>)}
      </div>

      {preview && (
        <div className="hidden xl:block">
          <div className="sticky top-[70px] max-h-[calc(100vh-80px)] overflow-auto rounded-xl border border-slate-300 bg-slate-200 p-3 shadow-inner" style={{ width: 'calc(210mm * 0.62 + 24px)' }}>
            {bi && (
              <div className="seg mb-2" role="group">
                <button type="button" aria-pressed={previewLang === 'en'} onClick={() => setPreviewLang('en')}>English</button>
                <button type="button" aria-pressed={previewLang === 'vi'} onClick={() => setPreviewLang('vi')}>Tiếng Việt</button>
              </div>
            )}
            <ReportPdfPreview bundle={pdfBundle} settings={settings} teachers={teachers} schedule={schedule} lang={shownLang} className="shadow"
              onCheck={(c) => setCheck((cur) => (JSON.stringify(cur) === JSON.stringify(c) ? cur : c))} />
          </div>
        </div>
      )}
    </div>
  )
}

function SubjectCard({ tier, section: s, reviewScores, settings, levels, bi, teachers, isHead, editable, onPatch, cohortAvg, note, onNote, signName, yearGroup, isLastPeriod, lastLabel, name, viAll, limits, minimums }) {
  const sub = subjectByKey(settings, s.subject_key)
  // The teacher comes from the Teachers page; a typed name is only used while nobody is linked.
  const linkedTeacher = teacherNameFor(teachers, s.subject_key, yearGroup)
  const teacher = sectionTeacher(teachers, s, yearGroup)
  const scored = reviewScores && tier === 'academic' && sub.scored !== false

  if (!editable) {
    const lvl = levelInfo(settings, s.level)
    const text = tier === 'vocational' ? note?.description : s.comment
    return (
      <section id={`sec-${s.subject_key}`} className="card flex items-start gap-3 bg-slate-50/70 !px-4 !py-3">
        <Icon name={sub.icon} size={18} className="mt-0.5 flex-none text-slate-400" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold text-slate-700">{sub.name}</span>
            {lvl ? <span className="chip text-white" style={{ background: lvl.color }}>{lvl.code} · {lvl.name}</span> : <span className="chip bg-slate-100 text-slate-500">Not yet assessed</span>}
            {scored && (isNA(s.score_raw) ? <span className="text-xs text-slate-500">N/A</span> : hasNum(s.score_pct) && <span className="text-xs text-slate-500">{s.score_pct}%</span>)}
            {teacher && <span className="text-xs text-slate-400">{teacher}</span>}
            <Lock size={12} className="ml-auto text-slate-300" />
          </div>
          {(text || '').trim()
            ? <p className="mt-1 line-clamp-2 text-xs text-slate-600">{tier === 'vocational' && <b className="font-semibold">Topics: </b>}{text}</p>
            : <p className="mt-1 text-xs italic text-slate-400">{tier === 'vocational' ? 'No topics described yet' : 'No comment yet'}</p>}
        </div>
      </section>
    )
  }

  const rawPatch = (raw, rawKey, pctKey) => {
    const patch = { [rawKey]: raw }
    if (isNA(raw) || !String(raw || '').trim()) patch[pctKey] = null
    else {
      const pct = pctFromRaw(raw)
      if (pct != null) patch[pctKey] = pct
    }
    if (rawKey === 'score_raw' && patch.score_pct != null && cohortAvg != null && !hasNum(s.class_avg)) patch.class_avg = cohortAvg
    onPatch(patch)
  }
  const commentMax = tier === 'academic' ? limits.academic_comment : limits.specialist_comment
  const commentMin = tier === 'academic' ? minimums.academic_comment : minimums.specialist_comment
  const topicsKey = tier === 'academic' ? 'academic_topics' : 'vocational_topics'

  return (
    <div id={`sec-${s.subject_key}`} className="scroll-mt-28">
      <Card className="!p-4" title={<span className="flex items-center gap-2"><Icon name={sub.icon} size={18} className="text-pra-navy" /> {sub.name}</span>}
        actions={!teacher && signName ? <button className="btn-ghost text-xs" onClick={() => onPatch({ teacher_name: signName })}>Sign as {signName}</button> : null}>
        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
          <div className="space-y-3">
            <div>
              <div className="label">Level this quarter</div>
              <LevelPicker levels={levels} value={s.level} onChange={(v) => onPatch({ level: v })} />
              <div className="mt-1 text-xs text-slate-500">
                {levelInfo(settings, s.level) ? <>{levelInfo(settings, s.level).name}{levelInfo(settings, s.level).short && <span className="text-slate-400"> · {levelInfo(settings, s.level).short.toLowerCase()}</span>}</> : 'Not yet assessed'}
                {s.level_prev != null && <span className="ml-2 text-slate-400">(prev: {levelInfo(settings, s.level_prev)?.name || '—'})</span>}
              </div>
            </div>
            {scored && (
              <div className="space-y-2 rounded-lg bg-slate-50 p-2">
                <div className="label !mb-0">Progress review score</div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Raw score"><TextInput value={s.score_raw} onChange={(v) => rawPatch(v, 'score_raw', 'score_pct')} placeholder="45/50" /></Field>
                  <Field label="%" hint="Auto from raw"><NumberInput value={s.score_pct} onChange={(v) => onPatch({ score_pct: v })} disabled={isNA(s.score_raw)} min={0} max={100} /></Field>
                </div>
                <Field label="Class average %" hint={cohortAvg != null ? `Cohort: ${cohortAvg}%` : 'No cohort scores yet'}>
                  <NumberInput value={s.class_avg ?? ''} placeholder={cohortAvg ?? ''} onChange={(v) => onPatch({ class_avg: v === '' ? null : v })} min={0} max={100} />
                </Field>
                {isLastPeriod ? (
                  <div className="border-t border-slate-200 pt-2">
                    <div className="label !mb-1">Summative (end-of-year assessment)</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Raw score"><TextInput value={s.summative_raw} onChange={(v) => rawPatch(v, 'summative_raw', 'summative_pct')} placeholder="88/100" /></Field>
                      <Field label="%" hint="Type N/A if not taken"><NumberInput value={s.summative_pct} onChange={(v) => onPatch({ summative_pct: v })} disabled={isNA(s.summative_raw)} min={0} max={100} /></Field>
                    </div>
                  </div>
                ) : <p className="max-w-[16rem] text-[11px] text-slate-400">Type N/A if the student was not reviewed. The summative end-of-year assessment score is entered on the {lastLabel} report.</p>}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {tier !== 'specialist' && (
              <div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
                <Field label={tier === 'academic' ? 'Topics covered this quarter (optional)' : 'Topics covered this quarter'} right={<Count text={note?.description} max={limits[topicsKey]} min={minimums[topicsKey]} />} hint={<Wording text={note?.description} />}>
                  <TextArea {...EN} rows={tier === 'academic' ? 2 : 3} value={note?.description || ''} onChange={(v) => onNote({ description: v, teacher_name: teacher || note?.teacher_name || '' })} placeholder={`What the ${yearGroup} group explored in ${sub.name} this quarter…`} />
                </Field>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Users size={13} /> Shared by every {yearGroup} report this quarter, so it only needs writing once.
                  {tier === 'vocational' ? ` It prints as the course description; there is no individual comment for ${sub.name}.` : ' It prints above the comment.'}
                </p>
              </div>
            )}
            {tier !== 'vocational' && (<>
              <Field label="Teacher comment" right={<Count text={s.comment} max={commentMax} min={commentMin} />} hint={<Wording text={s.comment} name={name} />}>
                <TextArea {...EN} rows={tier === 'academic' ? 5 : 4} value={s.comment} onChange={(v) => onPatch({ comment: v })} placeholder={`${name?.legal ? `${name.legal}'s s` : 'S'}trengths, progress and evidence from this quarter…`} />
              </Field>
            </>)}
            <div className={`grid gap-3 ${tier === 'academic' ? 'sm:grid-cols-[1fr_auto]' : 'sm:max-w-xs'}`}>
              {tier === 'academic' && (
                <Field label="Next focus" hint={<>One short sentence.<Wording text={s.next_focus} name={name} /></>} right={<Count text={s.next_focus} max={limits.next_focus} min={minimums.next_focus} />}>
                  <TextInput {...EN} value={s.next_focus} onChange={(v) => onPatch({ next_focus: v })} />
                </Field>
              )}
              {linkedTeacher ? (
                <Field label="Teacher" hint={<>Linked on the {isHead ? <Link to="/teachers" className="font-semibold text-pra-blue">Teachers page</Link> : 'Teachers page'}</>}>
                  <div className="input flex items-center bg-slate-50 text-slate-700">{linkedTeacher}</div>
                </Field>
              ) : (
                <Field label="Teacher" hint={`Nobody is linked to ${sub.name} for ${yearGroup} on the Teachers page yet`}>
                  <TextInput value={s.teacher_name} onChange={(v) => onPatch({ teacher_name: v })} placeholder="Mr. Alex" />
                </Field>
              )}
            </div>
            {bi && (
              <ViPanel openAll={viAll} pairs={[
                ...(tier !== 'specialist' ? [[note?.description, note?.description_vi]] : []),
                ...(tier !== 'vocational' ? [[s.comment, s.comment_vi]] : []),
                ...(tier === 'academic' ? [[s.next_focus, s.next_focus_vi]] : []),
              ]}>
                {tier !== 'specialist' && (
                  <Field label={<span className="inline-flex items-center gap-1">Topics covered <Users size={12} className="text-slate-400" /></span>} right={<Count text={note?.description_vi} max={limits[topicsKey]} min={minimums[topicsKey]} />} hint={<Wording lang="vi" text={note?.description_vi} />}>
                    <TextArea {...VI} rows={2} value={note?.description_vi || ''} onChange={(v) => onNote({ description_vi: v })} />
                  </Field>
                )}
                {tier !== 'vocational' && (
                  <Field label="Teacher comment" right={<Count text={s.comment_vi} max={commentMax} min={commentMin} />} hint={<Wording lang="vi" text={s.comment_vi} name={name} />}>
                    <TextArea {...VI} rows={3} value={s.comment_vi} onChange={(v) => onPatch({ comment_vi: v })} />
                  </Field>
                )}
                {tier === 'academic' && (
                  <Field label="Next focus" right={<Count text={s.next_focus_vi} max={limits.next_focus} min={minimums.next_focus} />} hint={<Wording lang="vi" text={s.next_focus_vi} name={name} />}>
                    <TextInput {...VI} value={s.next_focus_vi} onChange={(v) => onPatch({ next_focus_vi: v })} />
                  </Field>
                )}
              </ViPanel>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
