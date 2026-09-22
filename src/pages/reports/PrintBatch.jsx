import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { Spinner, Empty } from '../../components/ui'
import { useData } from '../../lib/DataContext'
import { db } from '../../lib/db'
import { downloadBlob } from '../../lib/pdf'
import { loadReportBundle } from '../../lib/report/loaders'
import { reportPdf } from '../../lib/report/reportPdf'
import { LANG_NAMES } from '../../lib/report/strings'

// Every report of a cohort (school year + period + year group) as one PDF, one
// page per student, in one language at a time so English and Vietnamese save
// as separate files. Vietnamese includes only the reports set to "English and Vietnamese".
export default function PrintBatch() {
  const [params, setParams] = useSearchParams()
  const { reportSettings: settings, teachers, schedule } = useData()
  const [bundles, setBundles] = useState(null)
  const [pdf, setPdf] = useState(null)
  const [err, setErr] = useState('')
  const year = params.get('year'), period = params.get('period'), group = params.get('group')
  const lang = params.get('lang') === 'vi' ? 'vi' : 'en'
  const name = `${group || 'All year groups'} – ${period} ${year} (${LANG_NAMES[lang]})`

  useEffect(() => {
    let alive = true
    ;(async () => {
      const filter = { school_year: year, period_label: period }
      if (group) filter.year_group = group
      const reports = await db.reports.list(filter)
      const out = await Promise.all(reports.map((r) => loadReportBundle(r.id)))
      out.sort((a, b) => (a.student?.full_name || '').localeCompare(b.student?.full_name || ''))
      if (alive) setBundles(out)
    })().catch((e) => { if (alive) setErr(e.message || String(e)) })
    return () => { alive = false }
  }, [year, period, group])
  useEffect(() => { document.title = name }, [name])

  const shown = bundles && (lang === 'vi' ? bundles.filter((b) => b.report.lang === 'bi') : bundles)
  useEffect(() => {
    if (!shown?.length || !settings) return
    let url = null
    let alive = true
    reportPdf(shown.map((bundle) => ({ bundle, lang })), { settings, teachers, schedule, title: name })
      .then(({ blob, checks }) => {
        if (!alive) return
        url = URL.createObjectURL(blob)
        setPdf({ blob, url, lang, checks })
      })
      .catch((e) => { if (alive) setErr(e.message || String(e)) })
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [bundles, settings, teachers, schedule, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="p-8 text-red-600">{err}</div>
  if (!bundles || !settings) return <Spinner />
  const setLang = (l) => setParams((p) => { const n = new URLSearchParams(p); if (l === 'vi') n.set('lang', 'vi'); else n.delete('lang'); return n }, { replace: true })
  const who = (i) => shown[i].student?.full_name || shown[i].report.student_name
  const checks = pdf?.lang === lang ? pdf.checks : []
  const tooFull = checks.map((c, i) => (c.overflow ? who(i) : null)).filter(Boolean)
  const untranslated = lang === 'vi' ? checks.filter((c) => c.untranslated).length : 0

  return (
    <div className="flex h-screen flex-col bg-slate-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-300 bg-white px-4 py-2">
        <Link to="/reports" className="btn-secondary"><ArrowLeft size={16} /> Back</Link>
        <span className="text-sm font-semibold text-slate-700">{shown.length} {LANG_NAMES[lang]} report{shown.length === 1 ? '' : 's'} · {group || 'All year groups'} · {period} {year}</span>
        <div className="flex-1" />
        <span className="hidden text-xs text-slate-500 lg:inline">Print or save from the PDF viewer</span>
        <div className="seg" role="group" aria-label="Report language">
          <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
          <button type="button" aria-pressed={lang === 'vi'} onClick={() => setLang('vi')}>Tiếng Việt</button>
        </div>
        <button className="btn-primary" disabled={pdf?.lang !== lang} onClick={() => downloadBlob(pdf.blob, `${name}.pdf`)}><Download size={16} /> Download PDF</button>
      </div>
      {(tooFull.length > 0 || untranslated > 0) && (
        <div className="space-y-0.5 border-b border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold">
          {tooFull.length > 0 && <div className="text-red-600">Too full, so some text is cut off: {tooFull.join(', ')}. Open the report in the editor to see which box.</div>}
          {untranslated > 0 && <div className="text-amber-700">{untranslated} report{untranslated === 1 ? ' has' : 's have'} parts with no Vietnamese yet, printed in English.</div>}
        </div>
      )}
      {!shown.length ? (
        <div className="mx-auto max-w-xl py-10"><Empty text="No reports in this group are set to English and Vietnamese. Choose that under Reports in a report's Overview." /></div>
      ) : pdf ? (
        <iframe key={pdf.url} title="Learning Progress Reports" src={pdf.url} className="w-full flex-1 border-0" />
      ) : <Spinner />}
    </div>
  )
}
