// Invoice status: what the office picks by hand, and what recorded payments imply.

import { lastDraft } from './invoiceDraft'

export const INVOICE_STATUSES = ['draft', 'sent', 'partial', 'paid', 'void']

/**
 * The fields to write when the office sets a status by hand. "Sent" notes when
 * it went and to whom (the last Gmail draft's address, else `to`); back to
 * "draft" clears that again.
 */
export function statusFields(inv, status, to = '') {
  if (status === 'draft') return { status, sent_at: null, sent_to: null }
  if (status === 'sent' && !inv.sent_at) return { status, sent_at: new Date().toISOString(), sent_to: lastDraft(inv)?.to || to || null }
  return { status }
}

/**
 * The status once payments or the total change. Money received decides between
 * partial and paid; with nothing received, the status picked by hand stays.
 */
export function statusWithPayments(status, paid, total) {
  if (status === 'void') return status
  if (paid > 0 && paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return status
}
