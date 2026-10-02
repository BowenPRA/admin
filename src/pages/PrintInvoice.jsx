import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { db } from '../lib/db'
import { useData } from '../lib/DataContext'
import { useT } from '../lib/i18n'
import { downloadBlob } from '../lib/pdf'
import { invoicePdfBlob } from '../lib/invoicePdf'
import { invoiceFilename } from '../lib/invoiceEmail'
import { Spinner, Empty } from '../components/ui'

/** The invoice PDF full-screen in the browser's PDF viewer, to print or save. */
export default function PrintInvoice() {
  const { id } = useParams()
  const { fees, loading } = useData()
  const { t } = useT()
  const [inv, setInv] = useState(null)
  const [missing, setMissing] = useState(false)
  const [blob, setBlob] = useState(null)
  const [url, setUrl] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { db.invoices.get(id).then((i) => { setInv(i); setMissing(!i) }).catch(() => setMissing(true)) }, [id])
  useEffect(() => { if (inv) document.title = `${inv.number} - ${inv.student_names}` }, [inv])
  useEffect(() => {
    if (!inv || !fees) return
    let made = null
    invoicePdfBlob(inv, fees)
      .then((b) => { made = URL.createObjectURL(b); setBlob(b); setUrl(made) })
      .catch((e) => setError(e.message || String(e)))
    return () => { if (made) URL.revokeObjectURL(made) }
  }, [inv, fees])

  if (missing) return <div className="p-6"><Empty text={t('invoiceMissing')}><div className="mt-3"><Link className="btn-secondary" to="/invoices">{t('backToInvoices')}</Link></div></Empty></div>
  if (loading || !inv) return <Spinner />
  return (
    <div className="flex h-screen flex-col bg-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-300 bg-white px-4 py-2">
        <Link to={`/invoices/${id}`} className="btn-secondary"><ArrowLeft size={16} /> {t('back')}</Link>
        <span className="text-sm font-semibold text-slate-700">{inv.number} · {inv.student_names}</span>
        <div className="flex-1" />
        <span className="hidden text-xs text-slate-500 sm:inline">{t('openPdfHint')}</span>
        <button className="btn-secondary" disabled={!blob} onClick={() => downloadBlob(blob, invoiceFilename(inv))}><Download size={16} /> {t('downloadPdf')}</button>
      </div>
      {error && <p className="p-4 text-sm text-red-600">{error}</p>}
      {url ? <iframe title={inv.number} src={url} className="w-full flex-1 border-0" /> : !error && <Spinner />}
    </div>
  )
}
