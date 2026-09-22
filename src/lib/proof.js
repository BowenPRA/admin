// Proof of payment: screenshots (or PDFs) of a bank transfer, kept with the
// payment they prove. With Supabase the files go in the private `adm-receipts`
// bucket and the payment row lists them; offline they are kept as data URLs in
// the row itself. See supabase/updates-2026-09-21-receipt-proof.sql.

import { supabase, hasSupabase } from './supabaseClient.js'

const BUCKET = 'adm-receipts'
export const MAX_PROOFS = 6
const MAX_PDF_BYTES = 10 * 1024 * 1024
export const PROOF_ACCEPT = 'image/*,application/pdf'

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
const isImage = (type) => /^image\//.test(type || '')
export const isPdfProof = (entry) => (entry?.type || '') === 'application/pdf'

const setupHint = 'Proof of payment is not set up in the database yet. Run supabase/updates-2026-09-21-receipt-proof.sql in Supabase, then try again.'
/** Turns "bucket not found" / "no proof column" into something the office can act on. */
export const proofError = (e) => {
  const msg = e?.message || String(e)
  return new Error(/bucket not found|'proof' column|column .*proof.* does not exist|row-level security/i.test(msg) ? `${setupHint} (${msg})` : msg)
}

const toBlob = (canvas, type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q))
const readDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result))
  r.onerror = reject
  r.readAsDataURL(blob)
})

// Phone screenshots are often 3–8 MB PNGs. Scaled to a size where the bank's
// text is still sharp and saved as JPEG they are a few hundred KB.
async function shrinkImage(file) {
  const maxEdge = hasSupabase ? 2200 : 1400
  const quality = hasSupabase ? 0.85 : 0.72
  let bitmap
  try { bitmap = await createImageBitmap(file) } catch { throw new Error(`"${file.name || 'This file'}" could not be read as a picture.`) }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const g = canvas.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  const jpeg = await toBlob(canvas, 'image/jpeg', quality)
  // A small PNG can be smaller than its JPEG; keep whichever is lighter (Supabase only).
  if (jpeg && (jpeg.size < file.size || !hasSupabase || !/^image\/(png|jpeg|webp)$/.test(file.type))) return { blob: jpeg, type: 'image/jpeg', ext: 'jpg' }
  return { blob: file, type: file.type, ext: file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg' }
}

/**
 * Gets a picked / pasted / dropped file ready to store.
 * @returns {Promise<{ blob: Blob, name: string, type: string, ext: string }>}
 */
export async function prepareProofFile(file) {
  if (isImage(file.type)) {
    const out = await shrinkImage(file)
    const base = (file.name || '').replace(/\.[^.]+$/, '') || `screenshot-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}`
    return { ...out, name: `${base}.${out.ext}` }
  }
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) throw new Error(`"${file.name}" is larger than 10 MB.`)
    return { blob: file, name: file.name || 'proof.pdf', type: 'application/pdf', ext: 'pdf' }
  }
  throw new Error(`"${file.name || 'This file'}" is not a picture or a PDF.`)
}

/** Stores one prepared file for a payment and returns the entry to keep in `payment.proof`. */
export async function uploadProof(paymentId, prepared) {
  const entry = { name: prepared.name, type: prepared.type, size: prepared.blob.size, added_at: new Date().toISOString() }
  if (!hasSupabase) return { ...entry, data: await readDataUrl(prepared.blob) }
  const path = `${paymentId}/${newId()}.${prepared.ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, prepared.blob, { contentType: prepared.type, upsert: false })
  if (error) throw proofError(error)
  return { ...entry, path }
}

/** A link the browser can show: signed for an hour (Supabase), or a data URL (offline, or a file not uploaded yet). */
export async function proofUrl(entry) {
  if (entry?.blob) return readDataUrl(entry.blob)
  if (entry?.data) return entry.data
  if (!entry?.path || !hasSupabase) return ''
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(entry.path, 3600)
  if (error) throw proofError(error)
  return data.signedUrl
}

/** The file itself, for the folder export. */
export async function proofBlob(entry) {
  if (entry?.data) return (await fetch(entry.data)).blob()
  const { data, error } = await supabase.storage.from(BUCKET).download(entry.path)
  if (error) throw proofError(error)
  return data
}

/** Removes stored files (when a proof, its payment or its invoice is deleted). */
export async function removeProofs(entries) {
  const paths = (entries || []).map((e) => e?.path).filter(Boolean)
  if (!paths.length || !hasSupabase) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw proofError(error)
}
