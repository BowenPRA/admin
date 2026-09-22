import { useEffect, useMemo, useState } from 'react'
import { Download, Upload, Copy, Check, AlertTriangle, Languages, FileJson } from 'lucide-react'
import { db } from '../../lib/db'
import { buildTranslationFile, parseTranslationFile, planTranslationImport, applyTranslationImport, CLAUDE_PROMPT } from '../../lib/report/translationFile'
import { Modal, Field, Select, Checkbox, Spinner } from '../ui'

async function loadPeriod(settings, period, schoolYear = settings.schoolYear) {
  const reports = await db.reports.list({ school_year: schoolYear, period_label: period })
  const sections = reports.length ? await db.sections.list({ report_id: reports.map((r) => r.id) }) : []
  const notes = await db.courseNotes.list({ school_year: schoolYear, period_label: period })
  return { reports, sections, notes }
}

function Step({ n, title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h4 className="mb-2 flex items-center gap-2 font-bold text-slate-800">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-pra-navy text-xs text-white">{n}</span>{title}
      </h4>
      {children}
    </section>
  )
}

/**
 * Head teacher tool: download the reports' English as a file for the Claude
 * desktop app, then upload the file Claude returns to fill in the Vietnamese.
 */
export default function TranslationModal({ settings, students, defaultPeriod, defaultGroup, onClose, onDone }) {
  const [period, setPeriod] = useState(defaultPeriod)
  const [group, setGroup] = useState(defaultGroup || '')
  const [onlyMissing, setOnlyMissing] = useState(true)
  const [data, setData] = useState(null)
  const [copied, setCopied] = useState(false)
  const [upload, setUpload] = useState(null) // { file, plan, name }
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  useEffect(() => {
    let alive = true
    loadPeriod(settings, period).then((d) => alive && setData(d)).catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [settings, period])

  const groups = useMemo(() => [...new Set((data?.reports || []).filter((r) => r.lang === 'bi').map((r) => r.year_group))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })), [data])
  // The list page's year group may have no English and Vietnamese reports; fall back to all.
  const yg = groups.includes(group) ? group : ''
  const file = useMemo(() => (data ? buildTranslationFile({ ...data, students, settings, period, yearGroup: yg, onlyMissing }) : null), [data, students, settings, period, yg, onlyMissing])
  const biCount = (data?.reports || []).filter((r) => r.lang === 'bi' && (!yg || r.year_group === yg)).length

  const download = () => {
    const blob = new Blob([JSON.stringify(file.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: file.filename })
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(CLAUDE_PROMPT); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* the text is shown to copy by hand */ }
  }

  const readUpload = async (f) => {
    if (!f) return
    setError(''); setDone(''); setUpload(null); setBusy(true)
    try {
      const parsed = parseTranslationFile(await f.text())
      if (parsed.academic_year !== settings.schoolYear) throw new Error(`This file is for ${parsed.academic_year}, not ${settings.schoolYear}.`)
      const current = await loadPeriod(settings, parsed.period)
      const plan = planTranslationImport(parsed, { ...current, students, settings })
      setUpload({ file: parsed, plan, name: f.name })
      setReplace(false)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const plan = upload?.plan
  const replacing = plan ? plan.changes.filter((c) => c.current.trim()) : []
  const chosen = plan ? plan.changes.filter((c) => replace || !c.current.trim()) : []
  const warnings = chosen.flatMap((c) => [
    c.over && `${c.who} · ${c.where}: ${c.vi.length} characters, the box holds ${c.max}`,
    ...c.issues.map((m) => `${c.who} · ${c.where}: ${m}`),
    c.englishChanged && `${c.who} · ${c.where}: the English was changed after the file was downloaded`,
  ].filter(Boolean))
  const publishedCount = chosen.filter((c) => c.published).length
  const reportCount = new Set(chosen.filter((c) => c.kind !== 'note').map((c) => c.who)).size

  const apply = async () => {
    setBusy(true); setError('')
    try {
      const rows = await applyTranslationImport(chosen, db, { period: upload.file.period, schoolYear: upload.file.academic_year })
      setDone(`Saved Vietnamese for ${chosen.length} part${chosen.length === 1 ? '' : 's'} (${rows} record${rows === 1 ? '' : 's'}). Open the reports' Tiếng Việt pages to read them through before publishing.`)
      setUpload(null)
      onDone?.()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={busy ? undefined : onClose} wide title="Translate reports with Claude" subtitle="Download the English, translate it in your Claude desktop app, then upload the file Claude gives back."
      footer={<button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Close</button>}>
      <div className="space-y-4 text-sm text-slate-700">
        <Step n={1} title="Download the English">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Period"><Select value={period} onChange={(v) => { setPeriod(v); setGroup(''); setData(null) }} options={(settings.periods || []).map((p) => ({ value: p.label, label: p.label }))} /></Field>
            <Field label="Year group"><Select value={yg} onChange={setGroup} options={[{ value: '', label: 'All year groups' }, ...groups.map((g) => ({ value: g, label: g }))]} /></Field>
            <div className="flex items-end pb-2"><Checkbox checked={onlyMissing} onChange={setOnlyMissing} label="Only parts with no Vietnamese yet" /></div>
          </div>
          {!data ? <Spinner /> : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary" onClick={download} disabled={!file?.total}><Download size={16} /> Download file</button>
              <span className="text-xs text-slate-500">
                {!biCount ? 'No reports here are set to "English and Vietnamese" (change it in a report\'s Overview).'
                  : !file.total ? 'Everything already has Vietnamese. Untick the box to download it all again.'
                    : `${file.total} part${file.total === 1 ? '' : 's'}${file.total === file.count ? ' to translate' : file.count ? ` (${file.count} still without Vietnamese)` : ', all with Vietnamese already'} from ${biCount} report${biCount === 1 ? '' : 's'} set to English and Vietnamese.`}
              </span>
            </div>
          )}
        </Step>

        <Step n={2} title="Translate it in the Claude desktop app">
          <ol className="list-decimal space-y-1 pl-5 text-[13px]">
            <li>Open the Claude desktop app, start a new chat and attach the downloaded file.</li>
            <li>
              Send this message (the rules are inside the file):
              <div className="mt-1 flex items-start gap-2 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200">
                <span className="flex-1 text-slate-600">{CLAUDE_PROMPT}</span>
                <button type="button" className="btn-ghost flex-none !py-1 text-xs" onClick={copyPrompt}>{copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
              </div>
            </li>
            <li>Download the JSON file Claude gives back.</li>
          </ol>
        </Step>

        <Step n={3} title="Upload Claude's file">
          <label className="btn-secondary cursor-pointer"><Upload size={16} /> Choose file<input type="file" accept=".json,application/json,.txt" className="hidden" onChange={(e) => { readUpload(e.target.files?.[0]); e.target.value = '' }} /></label>
          {busy && !upload && <p className="mt-2 text-xs text-slate-500">Reading the file…</p>}

          {plan && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <FileJson size={16} className="text-slate-400" /> <span className="font-semibold">{upload.name}</span>
                <span className="text-slate-500">· {upload.file.period} · {upload.file.year_group}</span>
              </div>
              {!plan.changes.length ? (
                <p className="rounded-lg bg-slate-50 p-3">Nothing new to fill in: {plan.unchanged} part{plan.unchanged === 1 ? ' is' : 's are'} already the same{plan.emptyParts ? `, ${plan.emptyParts} came back without Vietnamese` : ''}.</p>
              ) : (<>
                <p><Languages size={15} className="mr-1 inline text-pra-navy" /><b>{chosen.length} part{chosen.length === 1 ? '' : 's'}</b> will be filled in{reportCount ? ` across ${reportCount} report${reportCount === 1 ? '' : 's'}` : ''}{chosen.some((c) => c.kind === 'note') ? ', including topics covered shared by a whole year group' : ''}.</p>
                {replacing.length > 0 && <Checkbox checked={replace} onChange={setReplace} label={`Also replace Vietnamese that is already written (${replacing.length} part${replacing.length === 1 ? '' : 's'})`} />}
                {(plan.emptyParts > 0 || plan.notFound > 0) && (
                  <p className="text-xs text-slate-500">{[plan.emptyParts && `${plan.emptyParts} part${plan.emptyParts === 1 ? '' : 's'} came back without Vietnamese`, plan.notFound && `${plan.notFound} no longer exist${plan.notFound === 1 ? 's' : ''} (report or area deleted)`].filter(Boolean).join('; ')} and will be skipped.</p>
                )}
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                  <div className="mb-1 flex items-center gap-1.5 font-bold"><AlertTriangle size={16} /> Before you continue</div>
                  <ul className="list-disc space-y-1 pl-5 text-[13px]">
                    <li><b>Check it before parents see it.</b> Translation can get meaning or tone wrong. Read each Tiếng Việt page and fix anything that sounds off.</li>
                    {publishedCount > 0 && <li>{publishedCount} part{publishedCount === 1 ? ' is' : 's are'} on reports that are already published.</li>}
                    {warnings.length > 0 && <li>Please look at these after saving:
                      <ul className="mt-1 max-h-40 list-[circle] space-y-0.5 overflow-y-auto pl-5 text-xs">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                    </li>}
                  </ul>
                </div>
                <button type="button" className="btn-green" onClick={apply} disabled={busy || !chosen.length}>{busy ? 'Saving…' : `Fill in ${chosen.length} part${chosen.length === 1 ? '' : 's'}`}</button>
              </>)}
            </div>
          )}
          {done && <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-2.5 text-[13px] font-semibold text-green-800">{done}</p>}
          {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[13px] font-semibold text-red-700">{error}</p>}
        </Step>
      </div>
    </Modal>
  )
}
