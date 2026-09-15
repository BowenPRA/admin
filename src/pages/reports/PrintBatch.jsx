import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Printer, ArrowLeft, Minimize2 } from 'lucide-react'
import ReportDocument from '../../components/report/ReportDocument'
import { Spinner, Empty } from '../../components/ui'
import { useData } from '../../lib/DataContext'
import { db } from '../../lib/db'
import { loadReportBundle } from '../../lib/report/loaders'
import { PAGE_STYLE } from './PrintReport'
import { LANG_NAMES } from '../../lib/report/strings'

// Prints every report of a cohort (school year + period + year group) in one go,
// in one language at a time so English and Vietnamese save as separate PDFs.
// Vietnamese includes only the reports set to "English and Vietnamese".
export default function PrintBatch() {
  const [params, setParams] = useSearchParams()
  const { reportSettings: settings } = useData()
  const [bundles, setBundles] = useState(null)
  const [compact, setCompact] = useState(false)
  const [checks, setChecks] = useState({})
  const year = params.get('year'), period = params.get('period'), group = params.get('group')
  const lang = params.get('lang') === 'vi' ? 'vi' : 'en'

  useEffect(() => {
    let alive = true
    ;(async () => {
      const filter = { school_year: year, period_label: period }
      if (group) filter.year_group = group
      const reports = await db.reports.list(filter)
      const out = await Promise.all(reports.map((r) => loadReportBundle(r.id)))
      out.sort((a, b) => (a.student?.full_name || '').localeCompare(b.student?.full_name || ''))
      if (alive) setBundles(out)
    })()
    return () => { alive = false }
  }, [year, period, group])
  useEffect(() => { document.title = `${group || 'All year groups'} – ${period} ${year} (${LANG_NAMES[lang]})` }, [group, period, year, lang])

  if (!bundles || !settings) return <Spinner />
  const shown = lang === 'vi' ? bundles.filter((b) => b.report.lang === 'bi') : bundles
  const ids = new Set(shown.map((b) => b.report.id))
  const current = Object.entries(checks).filter(([rid]) => ids.has(rid.split(':')[0]) && rid.endsWith(`:${lang}`)).map(([, c]) => c)
  const tooFull = current.filter((c) => c.overflow).length
  const untranslated = current.filter((c) => c.untranslated).length
  const setLang = (l) => setParams((p) => { const n = new URLSearchParams(p); if (l === 'vi') n.set('lang', 'vi'); else n.delete('lang'); return n }, { replace: true })

  return (
    <div className="min-h-screen bg-slate-200">
      <style>{PAGE_STYLE}</style>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-slate-300 bg-white/95 px-4 py-2 backdrop-blur">
        <Link to="/reports" className="btn-ghost"><ArrowLeft size={16} /> Back</Link>
        <span className="flex-1 text-sm font-semibold text-slate-700">{shown.length} {LANG_NAMES[lang]} report{shown.length === 1 ? '' : 's'} · {group || 'All year groups'} · {period} {year}</span>
        {tooFull > 0 && <span className="text-xs font-semibold text-red-600">{tooFull} report{tooFull === 1 ? ' has' : 's have'} a box that is too full (outlined in red)</span>}
        {lang === 'vi' && untranslated > 0 && <span className="text-xs font-semibold text-amber-700">{untranslated} report{untranslated === 1 ? ' has' : 's have'} parts with no Vietnamese yet (highlighted)</span>}
        <div className="seg" role="group" aria-label="Report language">
          <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
          <button type="button" aria-pressed={lang === 'vi'} onClick={() => setLang('vi')}>Tiếng Việt</button>
        </div>
        <button className={compact ? 'btn-primary' : 'btn-secondary'} onClick={() => setCompact((v) => !v)}><Minimize2 size={16} /> Compact</button>
        <button className="btn-primary" disabled={!shown.length} onClick={() => window.print()}><Printer size={16} /> Print all</button>
      </div>
      {!shown.length ? (
        <div className="mx-auto max-w-xl py-10"><Empty text="No reports in this group are set to English and Vietnamese. Choose that under Reports in a report's Overview." /></div>
      ) : (
        <div className="space-y-6 py-6 print:space-y-0 print:py-0">
          {shown.map((b) => {
            const key = `${b.report.id}:${lang}`
            return (
              <div key={key} className="mx-auto shadow-xl print:shadow-none" style={{ width: '210mm' }}>
                <ReportDocument {...b} settings={settings} compact={compact} lang={lang}
                  onCheck={(c) => setChecks((cur) => (cur[key]?.overflow === c.overflow && cur[key]?.untranslated === c.untranslated ? cur : { ...cur, [key]: c }))} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
