import { useState } from 'react'
import { Send, Download, ExternalLink, Paperclip } from 'lucide-react'
import { Modal, Field, TextInput } from './ui'
import { useT } from '../lib/i18n'
import { nodeToPdfBlob, downloadBlob, blobToBase64 } from '../lib/pdf'
import { sendMail, openComposeWindow, gmailConfigured, SENDER } from '../lib/gmail'
import { invoiceFilename, emailTemplate } from '../lib/invoiceEmail'

/**
 * Email the invoice as a PDF. `docNode` is a ref to a full-size rendered
 * InvoiceDocument (kept off-screen by the editor).
 */
export default function SendInvoiceModal({ open, onClose, inv, fees, docNode, defaultTo, onSent }) {
  const { t } = useT()
  const tpl = emailTemplate(inv, fees)
  const [to, setTo] = useState(defaultTo || '')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(tpl.subject)
  const [text, setText] = useState(tpl.text)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  const makePdf = async () => {
    if (!docNode?.current) throw new Error('Preview not ready')
    return nodeToPdfBlob(docNode.current)
  }

  const download = async () => {
    setBusy('pdf'); setErr('')
    try { downloadBlob(await makePdf(), invoiceFilename(inv)) } catch (e) { setErr(e.message) } finally { setBusy('') }
  }

  const send = async () => {
    if (!to.trim()) { setErr(t('sendToRequired')); return }
    setBusy('send'); setErr('')
    try {
      const blob = await makePdf()
      if (gmailConfigured) {
        await sendMail({ to: to.trim(), cc: cc.trim(), subject, text, attachment: { filename: invoiceFilename(inv), base64: await blobToBase64(blob) } })
        await onSent?.({ to: to.trim(), cc: cc.trim(), subject })
        onClose()
      } else {
        // No Google client configured: save the PDF, then open Gmail with the
        // message ready; the office attaches the file by hand. Record first so
        // the invoice is marked sent even if the new tab steals focus.
        await onSent?.({ to: to.trim(), cc: cc.trim(), subject, manual: true })
        downloadBlob(blob, invoiceFilename(inv))
        openComposeWindow({ to: to.trim(), cc: cc.trim(), subject, text })
        onClose()
      }
    } catch (e) { setErr(e.message || String(e)) } finally { setBusy('') }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('sendInvoice')} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('sendTo')} hint={t('sendToHint')}><TextInput value={to} onChange={setTo} placeholder="parent@example.com, other@example.com" autoFocus /></Field>
        <Field label="CC"><TextInput value={cc} onChange={setCc} placeholder="" /></Field>
        <Field label={t('subject')} className="sm:col-span-2"><TextInput value={subject} onChange={setSubject} /></Field>
        <Field label={t('body')} className="sm:col-span-2"><textarea className="input font-mono text-xs" rows={14} value={text} onChange={(e) => setText(e.target.value)} /></Field>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Paperclip size={14} /> {invoiceFilename(inv)} · {t('from')}: {SENDER}</div>
      {!gmailConfigured && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{t('gmailNotConfigured')}</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="btn-secondary" onClick={download} disabled={!!busy}><Download size={16} /> {busy === 'pdf' ? t('loading') : t('downloadPdf')}</button>
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" onClick={send} disabled={!!busy}>{gmailConfigured ? <Send size={16} /> : <ExternalLink size={16} />} {busy === 'send' ? t('sending') : gmailConfigured ? t('sendNow') : t('openGmail')}</button>
      </div>
    </Modal>
  )
}
