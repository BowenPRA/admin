import { useState } from 'react'
import { Download, ExternalLink, Paperclip, FilePen } from 'lucide-react'
import { Modal, Field, TextInput } from './ui'
import { useT } from '../lib/i18n'
import { useToast } from '../lib/toast'
import { downloadBlob } from '../lib/pdf'
import { invoicePdfBlob } from '../lib/invoicePdf'
import { openComposeWindow, gmailConfigured, getToken, SENDER } from '../lib/gmail'
import { invoiceFilename, emailTemplate } from '../lib/invoiceEmail'
import { draftInvoice } from '../lib/invoiceDraft'

/**
 * Review the email for an invoice, then save it as a Gmail draft. The app
 * never sends: the office checks the draft and sends it from Gmail.
 */
export default function SendInvoiceModal({ onClose, inv, fees, defaultTo, onDrafted }) {
  const { t } = useT()
  const toast = useToast()
  const tpl = emailTemplate(inv, fees)
  const [to, setTo] = useState(defaultTo || '')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(tpl.subject)
  const [text, setText] = useState(tpl.text)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  const makePdf = () => invoicePdfBlob(inv, fees)
  const run = async (kind, fn) => {
    setBusy(kind); setErr('')
    try { await fn() } catch (e) { setErr(e.message || String(e)) } finally { setBusy('') }
  }

  const download = () => run('pdf', async () => downloadBlob(await makePdf(), invoiceFilename(inv)))

  const saveDraft = () => run('draft', async () => {
    if (!to.trim()) throw new Error(t('sendToRequired'))
    if (gmailConfigured) {
      await getToken()
      const d = await draftInvoice({ inv, fees, to: to.trim(), cc: cc.trim(), subject, text })
      await onDrafted?.(d)
      toast(t('draftSaved'))
    } else {
      // Gmail not connected: save the PDF and open a Gmail message (Gmail keeps
      // it in Drafts); attach the PDF there.
      const blob = await makePdf()
      downloadBlob(blob, invoiceFilename(inv))
      openComposeWindow({ to: to.trim(), cc: cc.trim(), subject, text })
      await onDrafted?.({ to: to.trim(), cc: cc.trim(), subject, manual: true })
    }
    onClose()
  })

  return (
    <Modal open onClose={onClose} title={t('gmailDraft')} subtitle={`${inv.number} · ${inv.student_names}`} wide
      footer={(<>
        <button className="btn-ghost mr-auto" onClick={download} disabled={!!busy}><Download size={16} /> {busy === 'pdf' ? t('loading') : t('downloadPdf')}</button>
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" onClick={saveDraft} disabled={!!busy}>{gmailConfigured ? <FilePen size={16} /> : <ExternalLink size={16} />} {busy === 'draft' ? t('saving') : gmailConfigured ? t('saveToDrafts') : t('openGmail')}</button>
      </>)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('sendTo')} hint={t('sendToHint')}><TextInput value={to} onChange={setTo} placeholder="parent@example.com, other@example.com" autoFocus /></Field>
        <Field label="CC"><TextInput value={cc} onChange={setCc} placeholder="" /></Field>
        <Field label={t('subject')} className="sm:col-span-2"><TextInput value={subject} onChange={setSubject} /></Field>
        <Field label={t('body')} className="sm:col-span-2"><textarea className="input font-mono text-xs" rows={12} value={text} onChange={(e) => setText(e.target.value)} /></Field>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Paperclip size={14} /> {invoiceFilename(inv)} · {t('from')}: {SENDER}</div>
      {!gmailConfigured && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{t('gmailNotConfigured')}</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </Modal>
  )
}
