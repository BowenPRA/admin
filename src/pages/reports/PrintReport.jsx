import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { Printer, ArrowLeft, Minimize2 } from 'lucide-react'
import ReportDocument from '../../components/report/ReportDocument'
import { Spinner } from '../../components/ui'
import { useData } from '../../lib/DataContext'
import { loadReportBundle } from '../../lib/report/loaders'
import { LANG_NAMES } from '../../lib/report/strings'

// The invoice pages print with a 10mm page margin; the report sheet carries its
// own padding, so the margin is switched off here.
export const PAGE_STYLE = '@page { size: A4; margin: 0; } @media print { .rpt .sheet { width: 210mm; } }'

/** One report, printed as an English page or a Vietnamese page (each saves as its own PDF). */
export default function PrintReport() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const lang = params.get('lang') === 'vi' ? 'vi' : 'en'
  const { reportSettings: settings } = useData()
  const [bundle, setBundle] = useState(null)
  const [err, setErr] = useState('')
  const [compact, setCompact] = useState(false)
  const [check, setCheck] = useState({ overflow: 0, untranslated: 0 })

  useEffect(() => { loadReportBundle(id).then(setBundle).catch((e) => setErr(e.message)) }, [id])
  // The title becomes the PDF file name, so each language saves separately.
  useEffect(() => { if (bundle) document.title = `${bundle.student?.full_name} – ${bundle.report.period_label} ${bundle.report.school_year} (${LANG_NAMES[lang]})` }, [bundle, lang])

  if (err) return <div className="p-8 text-red-600">{err}</div>
  if (!bundle || !settings) return <Spinner />
  const setLang = (l) => setParams(l === 'vi' ? { lang: 'vi' } : {}, { replace: true })
  return (
    <div className="min-h-screen bg-slate-200">
      <style>{PAGE_STYLE}</style>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-slate-300 bg-white/95 px-4 py-2 backdrop-blur">
        <Link to={`/reports/${id}`} className="btn-ghost"><ArrowLeft size={16} /> Back to editor</Link>
        <span className="flex-1 truncate text-sm font-semibold text-slate-700">{bundle.student?.full_name} · {bundle.report.period_label} {bundle.report.school_year}</span>
        {check.overflow > 0 && <span className="text-xs font-semibold text-red-600">{check.overflow} box{check.overflow === 1 ? ' is' : 'es are'} too full (outlined in red){compact ? '' : ' · try Compact'}</span>}
        {lang === 'vi' && check.untranslated > 0 && <span className="text-xs font-semibold text-amber-700">{check.untranslated} part{check.untranslated === 1 ? ' has' : 's have'} no Vietnamese yet and print in English (highlighted)</span>}
        <div className="seg" role="group" aria-label="Report language">
          <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
          <button type="button" aria-pressed={lang === 'vi'} onClick={() => setLang('vi')}>Tiếng Việt</button>
        </div>
        <button className={compact ? 'btn-primary' : 'btn-secondary'} onClick={() => setCompact((v) => !v)} title="Smaller text if a page overflows"><Minimize2 size={16} /> Compact</button>
        <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</button>
      </div>
      <div className="py-6 print:py-0">
        <div className="mx-auto shadow-xl print:shadow-none" style={{ width: '210mm' }}>
          <ReportDocument {...bundle} settings={settings} compact={compact} lang={lang}
            onCheck={(c) => setCheck((cur) => (cur.overflow === c.overflow && cur.untranslated === c.untranslated ? cur : c))} />
        </div>
      </div>
    </div>
  )
}
