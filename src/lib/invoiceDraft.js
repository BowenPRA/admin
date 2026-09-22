// Invoice → PDF → Gmail draft in admin@'s Drafts folder, ready to review and send.

import { db } from './db'
import { blobToBase64 } from './pdf'
import { invoicePdfBlob } from './invoicePdf'
import { createDraft } from './gmail'
import { invoiceFilename, emailTemplate } from './invoiceEmail'
import { docTotals } from './pricing'
import { emailsOf } from './families'
import { contactsOf } from './studentRecords'

/** Parent emails for an invoice: the family's contacts, then the children's records. */
export function invoiceRecipients(inv, families = [], students = []) {
  const fam = families.find((f) => f.id === inv.family_id)
  const kids = students.filter((s) => (inv.student_ids || []).includes(s.id))
  const fromFam = fam ? contactsOf(fam, kids).map((c) => (c.email || '').trim().toLowerCase()).filter((e) => e.includes('@')) : []
  return [...new Set([...fromFam, ...kids.flatMap(emailsOf)])].join(', ')
}

/**
 * Makes the invoice PDF and saves a Gmail draft with it attached.
 * Subject and text default to the invoice's email template.
 */
export async function draftInvoice({ inv, fees, to, cc = '', subject, text }) {
  if (!to) throw new Error(`${inv.number}: no parent email on file. Add one to the family, then try again.`)
  const tpl = emailTemplate(inv, fees)
  const blob = await invoicePdfBlob(inv, fees)
  const draft = await createDraft({
    to, cc, subject: subject || tpl.subject, text: text || tpl.text,
    attachment: { filename: invoiceFilename(inv), base64: await blobToBase64(blob) },
  })
  return { ...draft, to, cc, subject: subject || tpl.subject }
}

/** Notes the draft on the invoice's send log (the invoice stays unsent until the email goes out). */
export async function logDraft(inv, { to, cc, subject, id, messageId }) {
  const entry = { at: new Date().toISOString(), to, cc, subject, draft: true, draft_id: id, message_id: messageId }
  return db.invoices.save({ ...inv, total: docTotals(inv.doc).total, send_log: [...(inv.send_log || []), entry] })
}

export const lastDraft = (inv) => [...(inv?.send_log || [])].reverse().find((e) => e.draft) || null
