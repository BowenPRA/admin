import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { Spinner } from '../../components/ui'
import { ReportCheckNotes } from '../../components/report/ReportPdfPreview'
import { useData } from '../../lib/DataContext'
import { downloadBlob } from '../../lib/pdf'
import { loadReportBundle } from '../../lib/report/loaders'
import { reportPdf, reportFilename } from '../../lib/report/reportPdf'

/**
 * One report's PDF in the browser's PDF viewer, to print or save: an English
 * page or a Vietnamese page (each is its own PDF).
 */
export default function PrintReport() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const lang = params.get('lang') === 'vi' ? 'vi' : 'en'
  const { reportSettings: settings, teachers, schedule } = useData()
  const [bundle, setBundle] = useState(null)
  const [pdf, setPdf] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => { loadReportBundle(id, settings).then(setBundle).catch((e) => setErr(e.message)) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps -- load once
  useEffect(() => { if (bundle) document.title = reportFilename(bundle, lang).replace(/\.pdf$/, '') }, [bundle, lang])
  useEffect(() => {
    if (!bundle || !settings) return
    let url = null
    let alive = true
    reportPdf([{ bundle, lang }], { settings, teachers, schedule })
      .then(({ blob, checks }) => {
        if (!alive) return
        url = URL.createObjectURL(blob)
        setPdf({ blob, url, lang, check: checks[0] })
      })
      .catch((e) => { if (alive) setErr(e.message || String(e)) })
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [bundle, settings, teachers, schedule, lang])

  if (err) return <div className="p-8 text-red-600">{err}</div>
  if (!bundle || !settings) return <Spinner />
  const setLang = (l) => setParams(l === 'vi' ? { lang: 'vi' } : {}, { replace: true })
  return (
    <div className="flex h-screen flex-col bg-slate-200">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-300 bg-white px-4 py-2">
        <Link to={`/reports/${id}`} className="btn-secondary"><ArrowLeft size={16} /> Back to editor</Link>
        <span className="truncate text-sm font-semibold text-slate-700">{bundle.student?.full_name} · {bundle.report.period_label} {bundle.report.school_year}</span>
        <div className="flex-1" />
        <span className="hidden text-xs text-slate-500 lg:inline">Print or save from the PDF viewer</span>
        {bundle.report.lang === 'bi' || lang === 'vi' ? (
          <div className="seg" role="group" aria-label="Report language">
            <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
            <button type="button" aria-pressed={lang === 'vi'} onClick={() => setLang('vi')}>Tiếng Việt</button>
          </div>
        ) : null}
        <button className="btn-primary" disabled={pdf?.lang !== lang} onClick={() => downloadBlob(pdf.blob, reportFilename(bundle, lang))}><Download size={16} /> Download PDF</button>
      </div>
      {pdf?.check && (pdf.check.overflow > 0 || (lang === 'vi' && pdf.check.untranslated > 0)) && (
        <ReportCheckNotes check={{ ...pdf.check, shrunk: 0 }} lang={lang} className="border-b border-slate-300 bg-white px-4 py-1.5" />
      )}
      {pdf ? <iframe key={pdf.url} title="Learning Progress Report" src={pdf.url} className="w-full flex-1 border-0" /> : <Spinner />}
    </div>
  )
}
