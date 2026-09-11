import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, Users, FileText } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { fmt, fmtDate } from '../lib/money'
import { Card, StatusChip, Empty, Spinner } from '../components/ui'

export default function Home() {
  const { t, lang } = useT()
  const data = useData()
  const [invoices, setInvoices] = useState(null)

  useEffect(() => { db.invoices.list().then(setInvoices).catch(() => setInvoices([])) }, [])

  if (!invoices || data.loading) return <Spinner />

  const live = invoices.filter((i) => i.status !== 'void')
  const invoiced = live.reduce((s, i) => s + (Number(i.total) || 0), 0)
  const collected = live.reduce((s, i) => s + (Number(i.paid) || 0), 0)
  const outstanding = invoiced - collected
  const recent = [...live].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 8)

  const stat = (label, value, cls = '') => (
    <div className="card p-5"><div className="label">{label}</div><div className={`text-2xl font-black tabular-nums ${cls}`}>{fmt(value)} <span className="text-sm font-semibold text-slate-400">VND</span></div></div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800">{t('welcome')}</h1>
        <p className="text-sm text-slate-500">{data.fees?.schoolYear} · {data.students.filter((s) => s.active !== false).length} {t('students').toLowerCase()} · {live.length} {t('invoiceCount')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stat(t('invoicedTotal'), invoiced)}
        {stat(t('paidTotal'), collected, 'text-green-700')}
        {stat(t('outstanding'), outstanding, outstanding > 0 ? 'text-amber-700' : '')}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/invoices/new" className="card flex items-center gap-3 p-5 hover:border-pra-blue"><PlusCircle className="text-pra-green" /><div><div className="font-bold">{t('newInvoice')}</div><div className="text-xs text-slate-500">{t('quickStart')}</div></div></Link>
        <Link to="/students" className="card flex items-center gap-3 p-5 hover:border-pra-blue"><Users className="text-pra-blue" /><div><div className="font-bold">{t('students')}</div><div className="text-xs text-slate-500">{t('families')}</div></div></Link>
        <Link to="/invoices" className="card flex items-center gap-3 p-5 hover:border-pra-blue"><FileText className="text-pra-navy" /><div><div className="font-bold">{t('invoices')}</div><div className="text-xs text-slate-500">{t('viewAll')}</div></div></Link>
      </div>

      <Card title={t('recent')}>
        {recent.length === 0 ? <Empty text={t('noData')} /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2">{t('number')}</th><th>{t('student')}</th><th>{t('period')}</th><th>{t('issued')}</th><th className="text-right">{t('total')}</th><th className="text-right">{t('balance')}</th><th>{t('status')}</th></tr></thead>
            <tbody>
              {recent.map((i) => (
                <tr key={i.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-2"><Link className="font-semibold text-pra-blue" to={`/invoices/${i.id}`}>{i.number}</Link></td>
                  <td>{i.student_names}</td>
                  <td>{i.period_label}</td>
                  <td>{fmtDate(i.issue_date, lang)}</td>
                  <td className="text-right tabular-nums">{fmt(i.total)}</td>
                  <td className="text-right tabular-nums">{fmt((i.total || 0) - (i.paid || 0))}</td>
                  <td><StatusChip status={i.status} t={t} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
