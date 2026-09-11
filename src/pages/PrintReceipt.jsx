import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { db } from '../lib/db'
import { useData } from '../lib/DataContext'
import { useT } from '../lib/i18n'
import ReceiptDocument from '../components/ReceiptDocument'
import { Spinner } from '../components/ui'

export default function PrintReceipt() {
  const { id } = useParams()
  const { fees, loading } = useData()
  const { t } = useT()
  const [p, setP] = useState(null)
  useEffect(() => { db.payments.get(id).then(setP) }, [id])
  useEffect(() => { if (p) document.title = `${p.receipt_number} - ${p.student_names}` }, [p])

  if (loading || !p) return <Spinner />
  return (
    <div className="bg-slate-200 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex w-[210mm] items-center gap-2">
        <Link to={`/invoices/${p.invoice_id}`} className="btn-secondary"><ArrowLeft size={16} /> {t('back')}</Link>
        <div className="flex-1" />
        <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> {t('print')}</button>
      </div>
      <div className="mx-auto shadow-lg print:shadow-none" style={{ width: '210mm' }}>
        <ReceiptDocument payment={p} fees={fees} />
      </div>
    </div>
  )
}
