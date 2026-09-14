import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Printer, ArrowLeft, Minimize2 } from 'lucide-react'
import ReportDocument from '../../components/report/ReportDocument'
import { Spinner } from '../../components/ui'
import { useData } from '../../lib/DataContext'
import { db } from '../../lib/db'
import { loadReportBundle } from '../../lib/report/loaders'
import { PAGE_STYLE } from './PrintReport'

// Prints every report of a cohort (school year + period + year group) in one go.
export default function PrintBatch() {
  const [params] = useSearchParams()
  const { reportSettings: settings } = useData()
  const [bundles, setBundles] = useState(null)
  const [compact, setCompact] = useState(false)
  const year = params.get('year'), period = params.get('period'), group = params.get('group')

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

  if (!bundles || !settings) return <Spinner />
  return (
    <div className="min-h-screen bg-slate-200">
      <style>{PAGE_STYLE}</style>
      <div className="no-print sticky top-0 z-10 flex items-center gap-2 border-b border-slate-300 bg-white/95 px-4 py-2 backdrop-blur">
        <Link to="/reports" className="btn-ghost"><ArrowLeft size={16} /> Back</Link>
        <span className="flex-1 text-sm font-semibold text-slate-700">{bundles.length} report{bundles.length === 1 ? '' : 's'} · {group || 'All year groups'} · {period} {year}</span>
        <button className={compact ? 'btn-primary' : 'btn-secondary'} onClick={() => setCompact((v) => !v)}><Minimize2 size={16} /> Compact</button>
        <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> Print all</button>
      </div>
      <div className="space-y-6 py-6 print:space-y-0 print:py-0">
        {bundles.map((b) => (
          <div key={b.report.id} className="mx-auto shadow-xl print:shadow-none" style={{ width: '210mm' }}>
            <ReportDocument {...b} settings={settings} compact={compact} />
          </div>
        ))}
      </div>
    </div>
  )
}
