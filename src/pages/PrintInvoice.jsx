import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { db } from '../lib/db'
import { useData } from '../lib/DataContext'
import { useT } from '../lib/i18n'
import { fmtDate } from '../lib/money'
import InvoiceDocument from '../components/InvoiceDocument'
import { Spinner } from '../components/ui'

export default function PrintInvoice() {
  const { id } = useParams()
  const { fees, loading } = useData()
  const { t } = useT()
  const [inv, setInv] = useState(null)
  useEffect(() => { db.invoices.get(id).then(setInv) }, [id])
  useEffect(() => { if (inv) document.title = `${inv.number} - ${inv.student_names}` }, [inv])

  if (loading || !inv) return <Spinner />
  return (
    <div className="bg-slate-200 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex w-[210mm] items-center gap-2">
        <Link to={`/invoices/${id}`} className="btn-secondary"><ArrowLeft size={16} /> {t('back')}</Link>
        <div className="flex-1" />
        <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> {t('print')}</button>
      </div>
      <div className="mx-auto shadow-lg print:shadow-none" style={{ width: '210mm' }}>
        <InvoiceDocument doc={inv.doc} fees={fees} number={inv.number} issueDate={fmtDate(inv.issue_date, inv.lang)} />
      </div>
    </div>
  )
}
