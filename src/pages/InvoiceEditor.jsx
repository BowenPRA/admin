import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Printer, Save, Trash2, Plus, Copy, Settings2, Receipt, Ban, Send, Download, FilePen, ExternalLink, Paperclip } from 'lucide-react'
import { useToast } from '../lib/toast'
import { MAX_PROOFS, prepareProofFile, uploadProof, removeProofs } from '../lib/proof'
import ProofPicker from '../components/ProofPicker'
import { gmailConfigured, draftLink, getToken, prepareGmail } from '../lib/gmail'
import { draftInvoice, logDraft, lastDraft, invoiceRecipients } from '../lib/invoiceDraft'
import { db, genId } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { docTotals, recomputeRow, columnTotal, buildDocument, withStudentChoice, defaultQ4Full, smartDueDate } from '../lib/pricing'
import { LEVELS, PROGRAMS } from '../lib/fees'
import { fmt, todayISO, fmtDate } from '../lib/money'
import { downloadBlob } from '../lib/pdf'
import { invoicePdfBlob } from '../lib/invoicePdf'
import InvoicePdfPreview from '../components/InvoicePdfPreview'
import SendInvoiceModal from '../components/SendInvoiceModal'
import { invoiceFilename } from '../lib/invoiceEmail'
import { Card, Field, TextInput, NumberInput, MoneyInput, Select, Checkbox, Modal, StatusChip, Spinner } from '../components/ui'

let seq = 0
const uid = (p = 'r') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`

function CellEditor({ col, value, onChange }) {
  if (col.type === 'money') return <MoneyInput value={value ?? 0} onChange={onChange} className="!py-1 text-xs" />
  if (col.type === 'number') return <NumberInput value={value ?? 0} onChange={onChange} className="!py-1 text-xs" />
  return <textarea className="input !py-1 text-xs" rows={String(value || '').includes('\n') ? 2 : 1} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
}

// Year + program pickers for a student's tuition row. Picking re-prices the invoice.
function CurriculumPicker({ entry, quarterly, lang, t, onChange }) {
  const s = entry.student
  const small = 'input !py-1 !px-1.5 text-xs'
  return (
    <div className="space-y-1" style={{ minWidth: 150 }}>
      <select className={small} value={s.level} onChange={(e) => onChange({ student: { level: e.target.value } })} aria-label={t('levelForInvoice')}>
        {!LEVELS.includes(s.level) && <option value={s.level}>{s.level || '—'}</option>}
        {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
      <select className={small} value={s.program || 'regular'} onChange={(e) => onChange({ student: { program: e.target.value } })} aria-label={t('programForInvoice')}>
        {PROGRAMS.map((p) => <option key={p.id} value={p.id}>{lang === 'vi' ? p.vi : p.en}</option>)}
      </select>
      {quarterly && (
        <label className="flex items-center gap-1 text-[10px] text-slate-500" title={t('q4FullNew')}>
          <input type="checkbox" checked={entry.opts.q4Full ?? defaultQ4Full(s)} onChange={(e) => onChange({ opts: { q4Full: e.target.checked } })} /> {t('fullQ4Short')}
        </label>
      )}
    </div>
  )
}

export default function InvoiceEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang: uiLang } = useT()
  const { fees, calendar, loading, families, students, refresh } = useData()
  const [inv, setInv] = useState(null)
  const [payments, setPayments] = useState([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editHeads, setEditHeads] = useState(false)
  const [payModal, setPayModal] = useState(null)
  const [proofModal, setProofModal] = useState(null) // the saved payment whose proof is open
  const [proofBusy, setProofBusy] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [params, setParams] = useSearchParams()
  const toast = useToast()

  // Where the invoice should go: the family's contacts, else the parents'
  // emails on the students' records.
  const defaultTo = useMemo(() => (inv ? invoiceRecipients(inv, families, students) : ''), [inv, families, students])
  const draft = lastDraft(inv)

  const recordDraft = async (d) => { const saved = await logDraft(inv, d); setInv(saved); setDirty(false) }

  // PDF + email from the template, saved to admin@'s Gmail Drafts without a review step
  // (used after "Create + Gmail draft" in the builder).
  const quickDraft = async () => {
    if (!gmailConfigured) { setSendOpen(true); return }
    setDrafting(true)
    try {
      await getToken()
      const d = await draftInvoice({ inv, fees, to: defaultTo })
      await recordDraft(d)
      toast(<span>{t('draftSaved')} · <a className="font-semibold text-pra-blue underline" href={d.link} target="_blank" rel="noreferrer">{t('openInGmail')}</a></span>)
    } catch (e) { toast.error(e.message) } finally { setDrafting(false) }
  }

  // Arriving from "Create + Gmail draft".
  useEffect(() => { prepareGmail() }, [])
  const autoDraft = params.get('draft') === '1'
  const autoRan = useRef(false)
  useEffect(() => {
    if (!autoDraft || !inv || !fees || autoRan.current) return
    autoRan.current = true
    Promise.resolve().then(() => {
      setParams({}, { replace: true })
      if (gmailConfigured) quickDraft()
      else toast.info(t('gmailNotConfigured'))
    })
  }, [autoDraft, inv, fees]) // eslint-disable-line react-hooks/exhaustive-deps

  const downloadPdf = async () => {
    setBusy(true)
    try { downloadBlob(await invoicePdfBlob(inv, fees), invoiceFilename(inv)) } catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  useEffect(() => {
    let alive = true
    Promise.all([db.invoices.get(id), db.payments.list()]).then(([i, ps]) => {
      if (!alive) return
      setInv(i); setPayments(ps.filter((p) => p.invoice_id === id).sort((a, b) => (a.paid_on || '').localeCompare(b.paid_on || '')))
      setDirty(false)
    })
    return () => { alive = false }
  }, [id])

  const totals = useMemo(() => (inv ? docTotals(inv.doc) : null), [inv])

  const patch = (p) => { setInv((s) => ({ ...s, ...p })); setDirty(true) }
  const patchDoc = (fn) => { setInv((s) => { const doc = structuredClone(s.doc); fn(doc); return { ...s, doc } }); setDirty(true) }

  // Change a student's year / program / Q4 choice: rebuild the tuition table
  // from the invoice's options and refresh that student's meal rate. Headings,
  // summary label and the quarters being billed are kept.
  const repriceStudent = (studentId, change) => {
    setInv((cur) => {
      const inputs = structuredClone(cur.inputs)
      inputs.students = inputs.students.map((e) => {
        if (e.student.id !== studentId) return e
        const next = change.student ? withStudentChoice(e, change.student, fees) : e
        return change.opts ? { ...next, opts: { ...next.opts, ...change.opts } } : next
      })
      const fresh = buildDocument(inputs, fees, calendar)
      const doc = structuredClone(cur.doc)
      const oldIdx = doc.sections.findIndex((x) => x.kind === 'tuition')
      const newTui = fresh.sections.find((x) => x.kind === 'tuition')
      if (oldIdx >= 0 && !newTui) {
        // Everyone on the invoice is now billed for extras only: drop the tuition table.
        doc.sections.splice(oldIdx, 1)
      } else if (oldIdx < 0 && newTui) {
        doc.sections.unshift(newTui)
      } else if (oldIdx >= 0 && newTui) {
        const old = doc.sections[oldIdx]
        const keys = newTui.columns.map((c) => c.key)
        const keptBilled = old.billedKeys.filter((k) => /^(q\d|p\d)$/.test(k) && keys.includes(k))
        doc.sections[oldIdx] = {
          ...newTui,
          id: old.id, heading: old.heading, subheading: old.subheading, summaryLabel: old.summaryLabel,
          columns: newTui.columns.map((c) => ({ ...c, label: old.columns.find((o) => o.key === c.key)?.label ?? c.label })),
          billedKeys: keptBilled.length ? keptBilled : newTui.billedKeys,
          note: newTui.note || /Acellus/.test(old.note || '') ? newTui.note : old.note,
        }
      }
      const entry = inputs.students.find((e) => e.student.id === studentId)
      doc.sections.filter((x) => x.kind === 'meals').forEach((sec) => sec.rows.forEach((r) => {
        if (r.meta?.studentId === studentId) { r.cells.rate = entry.opts.mealRate; recomputeRow(sec, r) }
      }))
      // Re-pricing can change who is the most expensive: keep every table in that order.
      const order = fresh.sections.flatMap((s) => s.rows.map((r) => r.meta?.studentId)).filter((v, i, a) => v && a.indexOf(v) === i)
      if (order.length > 1) {
        const rank = (r) => { const i = order.indexOf(r.meta?.studentId); return i < 0 ? order.length : i }
        doc.sections.filter((x) => x.kind !== 'tuition').forEach((sec) => {
          sec.rows = sec.rows.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map((x) => x.r)
        })
      }
      return { ...cur, inputs, doc }
    })
    setDirty(true)
  }

  // Switch the invoice between English and Vietnamese: the document is rebuilt
  // from the choices made in the builder, in the other language. Which columns
  // are billed now, the deductions and the flags are kept; numbers typed by hand
  // into the tables are replaced.
  const switchLang = (lang) => {
    if (!inv || lang === inv.lang) return
    if (inv.inputs?.students?.length && !confirm(t('confirmSwitchLang'))) return
    setInv((cur) => {
      if (!cur.inputs?.students?.length) return { ...cur, lang, doc: { ...cur.doc, lang } }
      const inputs = { ...structuredClone(cur.inputs), lang }
      const fresh = buildDocument(inputs, fees, calendar)
      const oldByKind = {}
      cur.doc.sections.forEach((s) => { (oldByKind[s.kind] ||= []).push(s) })
      const seen = {}
      fresh.sections.forEach((s) => {
        const i = (seen[s.kind] = (seen[s.kind] ?? -1) + 1)
        const old = oldByKind[s.kind]?.[i]
        if (!old) return
        const keys = s.columns.map((c) => c.key)
        const kept = old.billedKeys.filter((key) => keys.includes(key))
        if (kept.length) s.billedKeys = kept
      })
      fresh.deductions = structuredClone(cur.doc.deductions || [])
      fresh.flags = { ...fresh.flags, ...(cur.doc.flags || {}) }
      return { ...cur, lang, inputs, doc: fresh, period_label: lang === 'vi' ? fresh.periodLabelVi : fresh.periodLabelEn }
    })
    setDirty(true)
  }

  const save = async () => {
    setBusy(true)
    try {
      // A year picked on the invoice is the student's year: keep the record in step.
      const moved = (inv.inputs?.students || []).map((e) => [students.find((s) => s.id === e.student.id), e.student.level]).filter(([rec, lvl]) => rec && lvl && rec.level !== lvl)
      if (moved.length) { await db.students.saveMany(moved.map(([rec, level]) => ({ ...rec, level }))); await refresh() }
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
        forEn: `Receipt confirming payment of tuition and fees for ${period}, academic year ${inv.school_year}`,
        cashier: '', accountant: '', payer: '',
      },
    })
  }
  // Picked / pasted screenshots wait in the modal (shrunk already) until the payment is saved.
  const addPayFiles = async (files) => {
    try {
      const ready = []
      for (const f of files) ready.push(await prepareProofFile(f))
      setPayModal((m) => (m ? { ...m, files: [...(m.files || []), ...ready].slice(0, MAX_PROOFS) } : m))
    } catch (e) { toast.error(e.message) }
  }
  const savePayment = async () => {
    setBusy(true)
    const proof = []
    try {
      const { files = [], ...fields } = payModal
      const paymentId = genId()
      for (const f of files) proof.push(await uploadProof(paymentId, f))
      const receipt_number = await db.nextNumber('receipt', inv.school_year)
      // `proof` is only sent when there is some, so payments still save before the proof SQL has run.
      await db.payments.save({ ...fields, id: paymentId, invoice_id: inv.id, student_names: inv.student_names, receipt_number, ...(proof.length ? { proof } : {}) })
      proof.length = 0
      const ps = (await db.payments.list()).filter((p) => p.invoice_id === id).sort((a, b) => (a.paid_on || '').localeCompare(b.paid_on || ''))
      const paid = ps.reduce((s, p) => s + (Number(p.amount) || 0), 0)
      const total = docTotals(inv.doc).total
      const status = inv.status === 'void' ? 'void' : paid >= total ? 'paid' : paid > 0 ? 'partial' : inv.status
      const saved = await db.invoices.save({ ...inv, total, paid, status })
      setInv(saved); setPayments(ps); setPayModal(null)
    } catch (e) {
      removeProofs(proof).catch(() => {}) // uploaded, but the payment was not saved
      toast.error(e.message || String(e))
    } finally { setBusy(false) }
  }
  // Proof on a payment that is already saved: each change is stored straight away.
  const setProof = async (p, proof) => {
    const saved = await db.payments.patch(p.id, { proof })
    setPayments((ps) => ps.map((x) => (x.id === p.id ? saved : x)))
    setProofModal(saved)
  }
  const addProof = async (p, files) => {
    setProofBusy(true)
    const added = []
    try {
      for (const f of files) added.push(await uploadProof(p.id, await prepareProofFile(f)))
      await setProof(p, [...(p.proof || []), ...added])
    } catch (e) {
      removeProofs(added).catch(() => {})
      toast.error(e.message || String(e))
    } finally { setProofBusy(false) }
  }
  const removeProof = async (p, index) => {
    const entry = (p.proof || [])[index]
    if (!entry || !confirm(t('proofConfirmRemove'))) return
    setProofBusy(true)
    try {
      await setProof(p, p.proof.filter((_, i) => i !== index))
      await removeProofs([entry]).catch(() => {})
    } catch (e) { toast.error(e.message || String(e)) } finally { setProofBusy(false) }
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
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <Link className="btn-secondary" to={`/invoices/new?copy=${id}`}><Copy size={16} /> {t('duplicate')}</Link>
          <Link className="btn-secondary" to={`/invoices/new?edit=${id}`} title={t('rebuild')}><Settings2 size={16} /> {t('rebuild')}</Link>
          <Link className="btn-secondary" to={`/print/invoice/${id}`} target="_blank" title={t('openPdfHint')}><ExternalLink size={16} /> {t('openPdf')}</Link>
          <button className="btn-secondary" onClick={downloadPdf} disabled={busy}><Download size={16} /> {t('downloadPdf')}</button>
          <button className="btn-green" onClick={() => setSendOpen(true)} disabled={busy || drafting || inv.status === 'void'} title={gmailConfigured ? `${t('gmailDraftHint')} ${defaultTo || '—'}` : t('gmailNotConfigured')}>
            <FilePen size={16} /> {drafting ? t('makingDraft') : t('sendInvoice')}
          </button>
          <button className="btn-primary" onClick={save} disabled={busy || !dirty}><Save size={16} /> {busy ? t('saving') : dirty ? t('save') : t('saved')}</button>
        </div>
      </div>
      {(inv.sent_at || draft) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {inv.sent_at && <span className="text-green-700">✉ {t('sentAt')}: {new Date(inv.sent_at).toLocaleString()} → {inv.sent_to}</span>}
          {draft && <span className="text-slate-600"><FilePen size={12} className="mr-1 inline" />{t('draftSavedAt')}: {new Date(draft.at).toLocaleString()} → {draft.to} · <a className="font-semibold text-pra-blue hover:underline" href={draftLink(draft.message_id)} target="_blank" rel="noreferrer">{t('openInGmail')}</a></span>}
        </div>
      )}

      {sendOpen && <SendInvoiceModal onClose={() => setSendOpen(false)} inv={inv} fees={fees} defaultTo={defaultTo} onDrafted={recordDraft} />}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---------- Editor ---------- */}
        <div className="space-y-4">
          <Card>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label={t('status')}>
                <Select value={inv.status} onChange={(v) => patch({ status: v })} options={['draft', 'sent', 'partial', 'paid', 'void'].map((s) => ({ value: s, label: t(s) }))} />
              </Field>
              <Field label={t('issueDate')}><input type="date" className="input" value={inv.issue_date || ''} onChange={(e) => patch({ issue_date: e.target.value })} /></Field>
              <Field label={t('dueDate')} hint={t('dueOnInvoice')}>
                <input type="date" className="input border-red-300 font-semibold text-red-700 focus:border-red-500" value={inv.due_date || ''} onChange={(e) => patch({ due_date: e.target.value })} />
                {inv.inputs && (
                  <button type="button" className="mt-1 text-left text-xs text-pra-blue hover:underline"
                    onClick={() => patch({ due_date: smartDueDate(inv.inputs, fees, inv.issue_date) })}>{t('dueAutoReset')}</button>
                )}
              </Field>
              <Field label={t('invoiceLang')}>
                <Select value={inv.lang} onChange={switchLang} options={[{ value: 'en', label: t('english') }, { value: 'vi', label: t('vietnamese') }]} />
              </Field>
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
                        <button className={`btn-ghost p-1.5 ${p.proof?.length ? 'text-green-700' : 'text-slate-400'}`} onClick={() => setProofModal(p)} title={t('proofOfPayment')}><Paperclip size={14} />{p.proof?.length ? <span className="text-xs font-bold">{p.proof.length}</span> : null}</button>
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
                  {s.kind === 'tuition' && inv.inputs?.students?.length > 0 && <p className="mb-1 text-[11px] text-slate-500">{t('repriceHint')}</p>}
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
                            {s.columns.map((c) => {
                              const entry = s.kind === 'tuition' && c.key === 'curriculum' && r.meta?.item !== 'acellus' && inv.inputs?.students?.find((e) => e.student.id === r.meta?.studentId)
                              return (
                              <td key={c.key} className="p-1 align-top" style={{ minWidth: c.type === 'text' ? 120 : 90 }}>
                                {entry ? <CurriculumPicker entry={entry} quarterly={inv.inputs.plan === 'quarterly'} lang={uiLang} t={t} onChange={(ch) => repriceStudent(entry.student.id, ch)} /> : <CellEditor col={c} value={r.cells[c.key]} onChange={(v) => patchDoc((d) => { const row = d.sections[si].rows[ri]; row.cells[c.key] = v; if (c.key !== 'total' && c.key !== 'disc') recomputeRow(d.sections[si], row) })} />}
                              </td>
                              )
                            })}
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
                  id: uid('s'), kind: 'fees', heading: vi ? `CÁC KHOẢN PHÍ KHÁC, NĂM HỌC ${d.schoolYear}` : `OTHER FEES, ACADEMIC YEAR ${d.schoolYear}`, subheading: '',
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
        <div className="min-w-0">
          <div className="sticky top-20">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase text-slate-500"><span>{t('preview')} · PDF</span><span className="text-base normal-case text-slate-800">{t('total')}: {fmt(totals.total)}</span></div>
            {/* As wide as the column allows while the whole page stays on screen. */}
            <div className="mx-auto" style={{ maxWidth: 'calc((100vh - 10rem) * 210 / 297)' }}>
              <InvoicePdfPreview inv={inv} fees={fees} className="overflow-hidden rounded-lg border border-slate-300 shadow-md" />
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
            <div className="sm:col-span-3 mt-2 border-t border-slate-200 pt-3">
              <div className="mb-2 text-sm font-bold">{t('proofOfPayment')}</div>
              <ProofPicker items={payModal.files || []} onAdd={addPayFiles} busy={busy}
                onRemove={(i) => setPayModal({ ...payModal, files: payModal.files.filter((_, j) => j !== i) })} />
            </div>
            <div className="sm:col-span-3 mt-3 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setPayModal(null)}>{t('cancel')}</button>
              <button className="btn-primary" onClick={savePayment} disabled={busy}>{busy ? t('saving') : t('save')}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Proof of payment on a saved payment */}
      <Modal open={!!proofModal} onClose={() => setProofModal(null)} title={t('proofOfPayment')}
        subtitle={proofModal && `${proofModal.receipt_number} · ${fmtDate(proofModal.paid_on, uiLang)} · ${fmt(proofModal.amount)} VND`}
        footer={<button className="btn-primary" onClick={() => setProofModal(null)}>{t('done')}</button>}>
        {proofModal && (
          <ProofPicker items={proofModal.proof || []} busy={proofBusy}
            onAdd={(files) => addProof(proofModal, files)} onRemove={(i) => removeProof(proofModal, i)} />
        )}
      </Modal>
    </div>
  )
}
