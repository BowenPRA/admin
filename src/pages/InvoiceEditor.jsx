import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Printer, Save, Trash2, Plus, Copy, Settings2, Receipt, Ban, Send } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { docTotals, recomputeRow, columnTotal } from '../lib/pricing'
import { fmt, todayISO, fmtDate } from '../lib/money'
import InvoiceDocument from '../components/InvoiceDocument'
import { Card, Field, TextInput, NumberInput, MoneyInput, Select, Checkbox, Modal, StatusChip, Spinner } from '../components/ui'

let seq = 0
const uid = (p = 'r') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`

function CellEditor({ col, value, onChange }) {
  if (col.type === 'money') return <MoneyInput value={value ?? 0} onChange={onChange} className="!py-1 text-xs" />
  if (col.type === 'number') return <NumberInput value={value ?? 0} onChange={onChange} className="!py-1 text-xs" />
  return <textarea className="input !py-1 text-xs" rows={String(value || '').includes('\n') ? 2 : 1} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
}

export default function InvoiceEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang: uiLang } = useT()
  const { fees, loading } = useData()
  const [inv, setInv] = useState(null)
  const [payments, setPayments] = useState([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editHeads, setEditHeads] = useState(false)
  const [payModal, setPayModal] = useState(null)
  const [scale, setScale] = useState(0.6)
  const previewRef = useRef(null)

  useEffect(() => {
    let alive = true
    Promise.all([db.invoices.get(id), db.payments.list()]).then(([i, ps]) => {
      if (!alive) return
      setInv(i); setPayments(ps.filter((p) => p.invoice_id === id).sort((a, b) => (a.paid_on || '').localeCompare(b.paid_on || '')))
      setDirty(false)
    })
    return () => { alive = false }
  }, [id])

  useEffect(() => {
    const el = previewRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / (210 * 3.7795))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [inv])

  const totals = useMemo(() => (inv ? docTotals(inv.doc) : null), [inv])

  const patch = (p) => { setInv((s) => ({ ...s, ...p })); setDirty(true) }
  const patchDoc = (fn) => { setInv((s) => { const doc = structuredClone(s.doc); fn(doc); return { ...s, doc } }); setDirty(true) }

  const save = async () => {
    setBusy(true)
    try {
      const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
      const total = docTotals(inv.doc).total
      let status = inv.status
      if (status !== 'void') status = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : (status === 'paid' || status === 'partial' ? 'sent' : status)
      const saved = await db.invoices.save({ ...inv, total, paid, status })
      setInv(saved); setDirty(false)
    } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!confirm(t('confirmDelete'))) return
    await db.invoices.remove(id); navigate('/invoices')
  }

  const openPayment = () => {
    const bal = Math.max(0, totals.total - payments.reduce((s, p) => s + (Number(p.amount) || 0), 0))
    const period = inv.lang === 'vi' ? inv.doc.periodLabelVi : inv.doc.periodLabelEn
    setPayModal({
      amount: bal, paid_on: todayISO(), method: 'transfer', reference: '', note: '',
      receipt: {
        student: inv.student_names, address: fees.school.receiptAddress,
        forVi: `Thu học phí và các khoản phí ${inv.doc.periodLabelVi}, năm học ${inv.school_year}`,
        forEn: `Receipt confirming payment of tuition and fees for ${period}, year ${inv.school_year}`,
        cashier: '', accountant: '', payer: '',
      },
    })
  }
  const savePayment = async () => {
    setBusy(true)
    try {
      const receipt_number = await db.nextNumber('receipt', inv.school_year)
      await db.payments.save({ ...payModal, invoice_id: inv.id, student_names: inv.student_names, receipt_number })
      const ps = (await db.payments.list()).filter((p) => p.invoice_id === id)
      const paid = ps.reduce((s, p) => s + (Number(p.amount) || 0), 0)
      const total = docTotals(inv.doc).total
      const status = inv.status === 'void' ? 'void' : paid >= total ? 'paid' : paid > 0 ? 'partial' : inv.status
      const saved = await db.invoices.save({ ...inv, total, paid, status })
      setInv(saved); setPayments(ps); setPayModal(null)
    } finally { setBusy(false) }
  }
  const removePayment = async (p) => {
    if (!confirm(t('confirmDelete'))) return
    await db.payments.remove(p.id)
    const ps = payments.filter((x) => x.id !== p.id)
    const paid = ps.reduce((s, x) => s + (Number(x.amount) || 0), 0)
    const total = docTotals(inv.doc).total
    const status = inv.status === 'void' ? 'void' : paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'sent'
    const saved = await db.invoices.save({ ...inv, total, paid, status })
    setInv(saved); setPayments(ps)
  }

  if (loading || !inv) return <Spinner />
  const doc = inv.doc
  const vi = inv.lang === 'vi'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-black text-slate-800">{inv.number}</h1>
        <StatusChip status={inv.status} t={t} />
        <span className="text-sm text-slate-500">{inv.student_names} · {inv.period_label}</span>
        <div className="flex-1" />
        <Link className="btn-secondary" to={`/invoices/new?copy=${id}`}><Copy size={16} /> {t('duplicate')}</Link>
        <Link className="btn-secondary" to={`/invoices/new?edit=${id}`} title={t('rebuild')}><Settings2 size={16} /> {t('rebuild')}</Link>
        <Link className="btn-secondary" to={`/print/invoice/${id}`} target="_blank"><Printer size={16} /> {t('print')}</Link>
        <button className="btn-primary" onClick={save} disabled={busy || !dirty}><Save size={16} /> {busy ? t('saving') : dirty ? t('save') : t('saved')}</button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---------- Editor ---------- */}
        <div className="space-y-4">
          <Card>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label={t('status')}>
                <Select value={inv.status} onChange={(v) => patch({ status: v })} options={['draft', 'sent', 'partial', 'paid', 'void'].map((s) => ({ value: s, label: t(s) }))} />
              </Field>
              <Field label={t('issueDate')}><input type="date" className="input" value={inv.issue_date || ''} onChange={(e) => patch({ issue_date: e.target.value })} /></Field>
              <Field label={t('dueDate')}><input type="date" className="input" value={inv.due_date || ''} onChange={(e) => patch({ due_date: e.target.value })} /></Field>
              <Field label={t('invoiceLang')}><div className="input bg-slate-50 uppercase">{inv.lang}</div></Field>
              <Field label={t('internalNotes')} className="sm:col-span-4"><TextInput value={inv.notes || ''} onChange={(v) => patch({ notes: v })} /></Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {inv.status === 'draft' && <button className="btn-secondary" onClick={() => patch({ status: 'sent' })}><Send size={14} /> {t('markSent')}</button>}
              {inv.status !== 'void' && <button className="btn-danger" onClick={() => { if (confirm(t('confirmVoid'))) patch({ status: 'void' }) }}><Ban size={14} /> {t('void')}</button>}
              <button className="btn-danger" onClick={remove}><Trash2 size={14} /> {t('delete')}</button>
            </div>
          </Card>

          {/* Payments */}
          <Card title={t('payments')} actions={<button className="btn-green" onClick={openPayment}><Receipt size={16} /> {t('recordPayment')}</button>}>
            {payments.length === 0 ? <p className="text-sm text-slate-400">{t('noData')}</p> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-1">{t('receiptNumber')}</th><th>{t('paidOn')}</th><th>{t('method')}</th><th className="text-right">{t('amount')}</th><th></th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="py-1 font-semibold">{p.receipt_number}</td><td>{fmtDate(p.paid_on, uiLang)}</td><td>{t(p.method)}</td>
                      <td className="text-right tabular-nums">{fmt(p.amount)}</td>
                      <td className="whitespace-nowrap text-right">
                        <Link className="btn-ghost p-1.5" to={`/print/receipt/${p.id}`} target="_blank" title={t('printReceipt')}><Printer size={14} /></Link>
                        <button className="btn-ghost p-1.5 text-red-500" onClick={() => removePayment(p)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 font-bold"><td colSpan={3} className="py-1">{t('balance')}</td><td className="text-right tabular-nums">{fmt(totals.total - payments.reduce((s, p) => s + (Number(p.amount) || 0), 0))}</td><td></td></tr>
                </tbody>
              </table>
            )}
          </Card>

          {/* Sections */}
          <Card title={t('sections')} actions={<Checkbox checked={editHeads} onChange={setEditHeads} label={t('heading')} />}>
            <div className="space-y-5">
              {doc.sections.map((s, si) => (
                <div key={s.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Field label={t('heading')}><TextInput value={s.heading} onChange={(v) => patchDoc((d) => { d.sections[si].heading = v })} /></Field>
                    <Field label={t('subheading')}><TextInput value={s.subheading} onChange={(v) => patchDoc((d) => { d.sections[si].subheading = v })} /></Field>
                    <button className="btn-ghost self-end text-red-500" onClick={() => patchDoc((d) => { d.sections.splice(si, 1) })}><Trash2 size={14} /></button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          {s.columns.map((c, ci) => (
                            <th key={c.key} className="p-1 text-left align-bottom">
                              {editHeads ? <textarea className="input !py-1 text-xs" rows={2} value={c.label} onChange={(e) => patchDoc((d) => { d.sections[si].columns[ci].label = e.target.value })} />
                                : <span className="whitespace-pre-line font-semibold text-slate-600">{c.label}</span>}
                              {c.type === 'money' && (
                                <label className="mt-1 flex items-center gap-1 text-[10px] font-normal text-slate-500" title={t('billNow')}>
                                  <input type="checkbox" checked={s.billedKeys.includes(c.key)} onChange={(e) => patchDoc((d) => { const sec = d.sections[si]; sec.billedKeys = e.target.checked ? [...sec.billedKeys, c.key] : sec.billedKeys.filter((k) => k !== c.key) })} /> {t('billNow')}
                                </label>
                              )}
                            </th>
                          ))}
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.rows.map((r, ri) => (
                          <tr key={r.id}>
                            {s.columns.map((c) => (
                              <td key={c.key} className="p-1 align-top" style={{ minWidth: c.type === 'text' ? 120 : 90 }}>
                                <CellEditor col={c} value={r.cells[c.key]} onChange={(v) => patchDoc((d) => { const row = d.sections[si].rows[ri]; row.cells[c.key] = v; if (c.key !== 'total' && c.key !== 'disc') recomputeRow(d.sections[si], row) })} />
                              </td>
                            ))}
                            <td className="p-1 align-top"><button className="btn-ghost p-1 text-red-500" onClick={() => patchDoc((d) => { d.sections[si].rows.splice(ri, 1) })}><Trash2 size={13} /></button></td>
                          </tr>
                        ))}
                        {s.rows.length > 1 && (
                          <tr className="font-bold text-slate-600">
                            {s.columns.map((c) => <td key={c.key} className="p-1 text-right">{c.type === 'money' && c.key !== 'rate' ? fmt(columnTotal(s, c.key)) : ''}</td>)}<td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr_1fr]">
                    <button className="btn-secondary self-end" onClick={() => patchDoc((d) => { const sec = d.sections[si]; const cells = {}; sec.columns.forEach((c) => { cells[c.key] = c.type === 'text' ? '' : 0 }); sec.rows.push({ id: uid(), cells, meta: {} }) })}><Plus size={14} /> {t('addRow')}</button>
                    <Field label={t('summaryLabel')}><TextInput value={s.summaryLabel} onChange={(v) => patchDoc((d) => { d.sections[si].summaryLabel = v })} /></Field>
                    <Field label={t('note')}><TextInput value={s.note || ''} onChange={(v) => patchDoc((d) => { d.sections[si].note = v })} /></Field>
                  </div>
                </div>
              ))}
              <button className="btn-secondary" onClick={() => patchDoc((d) => {
                d.sections.push({
                  id: uid('s'), kind: 'fees', heading: vi ? `CÁC KHOẢN PHÍ KHÁC, NĂM HỌC ${d.schoolYear}` : `OTHER FEES, YEAR ${d.schoolYear}`, subheading: '',
                  columns: [
                    { key: 'name', label: vi ? 'Tên học sinh' : "Student's Name", type: 'text' },
                    { key: 'desc', label: vi ? 'Nội dung' : 'Description', type: 'text' },
                    { key: 'total', label: vi ? 'Số tiền' : 'Amount', type: 'money' },
                  ],
                  rows: [{ id: uid(), cells: { name: '', desc: '', total: 0 }, meta: {} }], billedKeys: ['total'], summaryLabel: vi ? 'Phí khác' : 'Other fees', note: '',
                })
              })}><Plus size={14} /> {t('addSection')}</button>
            </div>
          </Card>

          {/* Deductions + notes + flags */}
          <Card title={t('extras')}>
            <span className="label">{t('deductions')}</span>
            <div className="space-y-2">
              {doc.deductions.map((d, i) => (
                <div key={d.id} className="flex gap-2">
                  <TextInput value={d.label} onChange={(v) => patchDoc((x) => { x.deductions[i].label = v })} />
                  <MoneyInput value={d.amount} onChange={(v) => patchDoc((x) => { x.deductions[i].amount = v })} className="max-w-[180px]" />
                  <button className="btn-ghost p-1 text-red-500" onClick={() => patchDoc((x) => { x.deductions.splice(i, 1) })}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="btn-secondary" onClick={() => patchDoc((x) => { x.deductions.push({ id: uid('d'), label: vi ? 'Đã thanh toán' : 'Already paid', amount: 0 }) })}><Plus size={14} /> {t('addDeduction')}</button>
            </div>
            <div className="mt-4">
              <span className="label">{t('extraNotes')}</span>
              {(doc.notes || []).map((n, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <TextInput value={n} onChange={(v) => patchDoc((x) => { x.notes[i] = v })} />
                  <button className="btn-ghost p-1 text-red-500" onClick={() => patchDoc((x) => { x.notes.splice(i, 1) })}><Trash2 size={14} /></button>
                </div>
              ))}
              <button className="btn-secondary" onClick={() => patchDoc((x) => { x.notes = [...(x.notes || []), ''] })}><Plus size={14} /> {t('add')}</button>
            </div>
            <div className="mt-4 flex flex-wrap gap-4">
              <Checkbox checked={doc.flags?.bank} onChange={(v) => patchDoc((x) => { x.flags.bank = v })} label={t('showBank')} />
              <Checkbox checked={doc.flags?.qr} onChange={(v) => patchDoc((x) => { x.flags.qr = v })} label={t('showQR')} />
              <Checkbox checked={doc.flags?.forceMajeure} onChange={(v) => patchDoc((x) => { x.flags.forceMajeure = v })} label={t('showFM')} />
            </div>
          </Card>
        </div>

        {/* ---------- Preview ---------- */}
        <div ref={previewRef} className="min-w-0">
          <div className="sticky top-20">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase text-slate-500"><span>{t('preview')}</span><span className="text-base normal-case text-slate-800">{t('total')}: {fmt(totals.total)}</span></div>
            <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-200" style={{ height: `${297 * 3.7795 * scale + 16}px` }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: '210mm', margin: 8 }} className="shadow-lg">
                <InvoiceDocument doc={doc} fees={fees} number={inv.number} issueDate={fmtDate(inv.issue_date, inv.lang)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Record payment modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={t('recordPayment')} wide>
        {payModal && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('amount')}><MoneyInput value={payModal.amount} onChange={(v) => setPayModal({ ...payModal, amount: v })} /></Field>
            <Field label={t('paidOn')}><input type="date" className="input" value={payModal.paid_on} onChange={(e) => setPayModal({ ...payModal, paid_on: e.target.value })} /></Field>
            <Field label={t('method')}><Select value={payModal.method} onChange={(v) => setPayModal({ ...payModal, method: v })} options={[{ value: 'transfer', label: t('transfer') }, { value: 'cash', label: t('cash') }]} /></Field>
            <Field label={t('reference')} className="sm:col-span-3"><TextInput value={payModal.reference} onChange={(v) => setPayModal({ ...payModal, reference: v })} /></Field>
            <div className="sm:col-span-3 mt-2 border-t border-slate-200 pt-3 text-sm font-bold">{t('receipt')}</div>
            <Field label={t('payer')}><TextInput value={payModal.receipt.student} onChange={(v) => setPayModal({ ...payModal, receipt: { ...payModal.receipt, student: v } })} /></Field>
            <Field label={t('address')} className="sm:col-span-2"><TextInput value={payModal.receipt.address} onChange={(v) => setPayModal({ ...payModal, receipt: { ...payModal.receipt, address: v } })} /></Field>
            <Field label={t('receiptForVi')} className="sm:col-span-3"><TextInput value={payModal.receipt.forVi} onChange={(v) => setPayModal({ ...payModal, receipt: { ...payModal.receipt, forVi: v } })} /></Field>
            <Field label={t('receiptForEn')} className="sm:col-span-3"><TextInput value={payModal.receipt.forEn} onChange={(v) => setPayModal({ ...payModal, receipt: { ...payModal.receipt, forEn: v } })} /></Field>
            <Field label={t('accountant')}><TextInput value={payModal.receipt.accountant} onChange={(v) => setPayModal({ ...payModal, receipt: { ...payModal.receipt, accountant: v } })} /></Field>
            <Field label={t('cashier')}><TextInput value={payModal.receipt.cashier} onChange={(v) => setPayModal({ ...payModal, receipt: { ...payModal.receipt, cashier: v } })} /></Field>
            <Field label={t('payer')}><TextInput value={payModal.receipt.payer} onChange={(v) => setPayModal({ ...payModal, receipt: { ...payModal.receipt, payer: v } })} /></Field>
            <div className="sm:col-span-3 mt-3 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setPayModal(null)}>{t('cancel')}</button>
              <button className="btn-primary" onClick={savePayment} disabled={busy}>{busy ? t('saving') : t('save')}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
