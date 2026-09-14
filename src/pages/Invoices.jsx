import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PlusCircle, Download, Trash2 } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { fmt, fmtDate } from '../lib/money'
import { Card, StatusChip, Empty, Spinner } from '../components/ui'
import { exportWorkbook } from '../lib/exportExcel'

const STATUSES = ['all', 'draft', 'sent', 'partial', 'paid', 'void']

export default function Invoices() {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const { students, families } = useData()
  const [invoices, setInvoices] = useState(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState(() => new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => { db.invoices.list().then(setInvoices).catch(() => setInvoices([])) }, [])

  const removeOne = async (i) => {
    if (!confirm(`${i.number} · ${i.student_names}\n\n${t('confirmDeleteInvoice')}`)) return
    setBusy(true)
    try { await db.invoices.remove(i.id); setInvoices((xs) => xs.filter((x) => x.id !== i.id)); setSelected((s) => { const n = new Set(s); n.delete(i.id); return n }) }
    catch (e) { alert(e.message) } finally { setBusy(false) }
  }
  const removeSelected = async () => {
    const ids = [...selected]
    if (!ids.length || !confirm(`${ids.length} × ${t('invoices').toLowerCase()}\n\n${t('confirmDeleteInvoice')}`)) return
    setBusy(true)
    try { for (const id of ids) await db.invoices.remove(id); setInvoices((xs) => xs.filter((x) => !selected.has(x.id))); setSelected(new Set()) }
    catch (e) { alert(e.message) } finally { setBusy(false) }
  }
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const rows = useMemo(() => {
    if (!invoices) return []
    const needle = q.trim().toLowerCase()
    return invoices
      .filter((i) => status === 'all' || i.status === status)
      .filter((i) => !needle || `${i.number} ${i.student_names} ${i.family_name} ${i.period_label}`.toLowerCase().includes(needle))
      .sort((a, b) => (b.number || '').localeCompare(a.number || ''))
  }, [invoices, q, status])

  const doExport = async () => {
    const payments = await db.payments.list()
    exportWorkbook({ invoices: invoices || [], payments, students, families })
  }

  if (!invoices) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black text-slate-800">{t('invoices')}</h1>
        <div className="flex-1" />
        <input className="input max-w-xs" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        {selected.size > 0 && <button className="btn-danger" onClick={removeSelected} disabled={busy}><Trash2 size={16} /> {t('deleteSelected')} ({selected.size})</button>}
        <button className="btn-secondary" onClick={doExport}><Download size={16} /> {t('export')}</button>
        <button className="btn-green" onClick={() => navigate('/invoices/new')}><PlusCircle size={16} /> {t('newInvoice')}</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 text-xs font-bold ${status === s ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{t(s)} <span className="opacity-60">{s === 'all' ? invoices.length : invoices.filter((i) => i.status === s).length}</span></button>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? <Empty text={t('noData')} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-500">
                <th className="py-2 w-6"><input type="checkbox" checked={rows.length > 0 && rows.every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
                <th>{t('number')}</th><th>{t('student')}</th><th>{t('family')}</th><th>{t('period')}</th><th>{t('issued')}</th><th>{t('due')}</th><th className="text-right">{t('total')}</th><th className="text-right">{t('paidAmt')}</th><th className="text-right">{t('balance')}</th><th>{t('status')}</th><th></th></tr></thead>
              <tbody>
                {rows.map((i) => {
                  const bal = (Number(i.total) || 0) - (Number(i.paid) || 0)
                  return (
                    <tr key={i.id} className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${selected.has(i.id) ? 'bg-sky-50' : ''}`} onClick={() => navigate(`/invoices/${i.id}`)}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(i.id)} onChange={() => toggle(i.id)} /></td>
                      <td className="py-2"><Link className="font-semibold text-pra-blue" to={`/invoices/${i.id}`} onClick={(e) => e.stopPropagation()}>{i.number}</Link> <span className="text-[10px] uppercase text-slate-400">{i.lang}</span>{i.sent_at && <span className="ml-1 text-[10px] text-green-700" title={i.sent_to}>✉</span>}</td>
                      <td>{i.student_names}</td>
                      <td className="text-slate-500">{i.family_name}</td>
                      <td>{i.period_label}</td>
                      <td>{fmtDate(i.issue_date, lang)}</td>
                      <td>{fmtDate(i.due_date, lang)}</td>
                      <td className="text-right tabular-nums">{fmt(i.total)}</td>
                      <td className="text-right tabular-nums text-green-700">{fmt(i.paid)}</td>
                      <td className={`text-right tabular-nums font-semibold ${bal > 0 && i.status !== 'void' ? 'text-amber-700' : ''}`}>{i.status === 'void' ? '—' : fmt(bal)}</td>
                      <td><StatusChip status={i.status} t={t} /></td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}><button className="btn-ghost p-1.5 text-red-500" title={t('delete')} disabled={busy} onClick={() => removeOne(i)}><Trash2 size={15} /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
