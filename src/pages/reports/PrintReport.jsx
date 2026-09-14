import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Printer, ArrowLeft, Languages, Minimize2 } from 'lucide-react'
import ReportDocument from '../../components/report/ReportDocument'
import { Spinner } from '../../components/ui'
import { useData } from '../../lib/DataContext'
import { loadReportBundle } from '../../lib/report/loaders'

// The invoice pages print with a 10mm page margin; the report sheet carries its
// own padding, so the margin is switched off here.
export const PAGE_STYLE = '@page { size: A4; margin: 0; } @media print { .rpt .sheet { width: 210mm; } }'

export default function PrintReport() {
  const { id } = useParams()
  const { reportSettings: settings } = useData()
  const [bundle, setBundle] = useState(null)
  const [err, setErr] = useState('')
  const [bi, setBi] = useState(null)
  const [compact, setCompact] = useState(false)

  useEffect(() => { loadReportBundle(id).then(setBundle).catch((e) => setErr(e.message)) }, [id])
  useEffect(() => { if (bundle) document.title = `${bundle.student?.full_name} – ${bundle.report.period_label} ${bundle.report.school_year}` }, [bundle])

  if (err) return <div className="p-8 text-red-600">{err}</div>
  if (!bundle || !settings) return <Spinner />
  const report = bi == null ? bundle.report : { ...bundle.report, lang: bi ? 'bi' : 'en' }
  return (
    <div className="min-h-screen bg-slate-200">
      <style>{PAGE_STYLE}</style>
      <div className="no-print sticky top-0 z-10 flex items-center gap-2 border-b border-slate-300 bg-white/95 px-4 py-2 backdrop-blur">
        <Link to={`/reports/${id}`} className="btn-ghost"><ArrowLeft size={16} /> Back to editor</Link>
        <span className="flex-1 truncate text-sm font-semibold text-slate-700">{bundle.student?.full_name} · {report.period_label} {report.school_year}</span>
        <button className="btn-secondary" onClick={() => setBi(!(bi ?? bundle.report.lang === 'bi'))}><Languages size={16} /> {report.lang === 'bi' ? 'Bilingual' : 'English only'}</button>
        <button className={compact ? 'btn-primary' : 'btn-secondary'} onClick={() => setCompact((v) => !v)} title="Smaller text if a page overflows"><Minimize2 size={16} /> Compact</button>
        <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</button>
      </div>
      <div className="py-6 print:py-0">
        <div className="mx-auto shadow-xl print:shadow-none" style={{ width: '210mm' }}>
          <ReportDocument {...bundle} report={report} settings={settings} compact={compact} />
        </div>
      </div>
    </div>
  )
}
