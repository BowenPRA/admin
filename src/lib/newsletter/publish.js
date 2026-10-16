// Publish: puts an issue on pra.edu.vn, makes its PDFs and saves its email as a
// Gmail draft in admin@ (the office sends it). Also: take an issue off the
// website, and start a website build. Every step can be run again.

import { supabase, hasSupabase } from '../supabaseClient.js'
import { createDraftUpload, gmailConfigured, getToken } from '../gmail.js'
import { EDITIONS, SITE } from './constants.js'
import { buildPayload, fingerprint, issueChecks, sortParts } from './payload.js'
import { getIssue, listParts, patchIssue, setIssueSetting, newsletterError } from './data.js'
import { photoLink, preparePhotoLinks, publishPhotos, publishedPhotoLink, putPublic, removePublicFolder } from './photos.js'

// The public bucket takes files up to 15 MB; a PDF that size would also make the email too big for Gmail.
const PDF_MAX = 14 * 1024 * 1024

/** Every photo an issue shows, the cover first. */
export const issuePhotos = (issue, parts) => [issue.settings?.cover, ...sortParts(parts).filter((p) => !(p.type === 'class' && p.data?.skip)).flatMap((p) => p.data?.photos || [])].filter((p) => p?.key)

/** The families payload of a published issue, with the photos' public addresses (for the email). */
export function publishedFamilies(issue, parts) {
  const photo = (p) => publishedPhotoLink(issue.slug, issue.publish_count || 1, p)
  return { ...buildPayload(issue, parts, { audience: 'families', photo, pdf: issue.published?.pdf || {}, publishedAt: issue.published_at }) }
}

/** The payloads for the preview, with the photos' signed links (nothing is published). */
export function previewPayloads(issue, parts) {
  const photo = (p) => photoLink(p)
  return {
    pub: buildPayload(issue, parts, { audience: 'public', photo }),
    fam: buildPayload(issue, parts, { audience: 'families', photo }),
  }
}

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1] || '')
  r.onerror = reject
  r.readAsDataURL(blob)
})

/** Asks GitHub (through the newsletter-build function) to build the website again. */
export async function startBuild() {
  if (!hasSupabase) return { skipped: true }
  const { data, error } = await supabase.functions.invoke('newsletter-build', { body: { action: 'build' } })
  if (error) {
    let msg = error.message
    try { msg = (await error.context?.json())?.error || msg } catch { /* keep the first message */ }
    throw new Error(/not found|404|Failed to send/i.test(msg) ? 'Starting a website build is not set up yet (supabase/functions/newsletter-build/README.md). The website picks the issue up at its nightly build.' : msg)
  }
  return data
}
/** The latest website build: { status, conclusion, url, started }. */
export async function buildStatus() {
  if (!hasSupabase) return null
  const { data, error } = await supabase.functions.invoke('newsletter-build', { body: { action: 'status' } })
  if (error) return null
  return data
}
/** Whether the issue's page is on the website now (and, with `mark`, has that text in it, such as this round's PDF address). */
export async function pageIsLive(slug, lang = 'en', mark = '') {
  try {
    const res = await fetch(`${SITE}${lang === 'vi' ? '/vi' : ''}/newsletter/${slug}/?check=${Date.now()}`, { method: 'GET', cache: 'no-store' })
    if (!res.ok) return false
    return mark ? (await res.text()).includes(mark) : true
  } catch { return false }
}

/**
 * Publishes an issue. Steps (onStep(name, detail)): 'photos', 'pdf', 'save', 'build'.
 * Everything is made from the issue as it is in the database at that moment (read
 * again here), so a teacher's last sentence saved a few seconds ago is in it.
 * The PDFs leave out families-only parts: the website links to them, and they are
 * the ones attached to the email (whose text still has the families-only parts).
 * Earlier rounds' photos and PDFs stay where they are, so emails already sent keep their pictures.
 * Returns { issue, parts, pub, fam, pdfs: { en: { blob, name, url }, vi }, build }.
 */
export async function publishIssue(issue0, parts0, { onStep = () => {} } = {}) {
  const [issue, parts] = await Promise.all([getIssue(issue0.id), listParts(issue0.id)])
  if (!issue) throw new Error('This issue no longer exists.')
  const unchecked = issueChecks(issue, parts).unchecked.length
  if (unchecked) throw new Error(`${unchecked} photo${unchecked > 1 ? 's were' : ' was'} added a moment ago and ${unchecked > 1 ? 'are' : 'is'} not checked against the no-photo list yet. The editor shows ${unchecked > 1 ? 'them' : 'it'} now: check, then publish again.`)
  const round = (issue.publish_count || 0) + 1
  const photos = issuePhotos(issue, parts)

  onStep('photos', { done: 0, total: photos.length })
  await preparePhotoLinks(photos)
  const map = await publishPhotos(issue.slug, photos, round, (done, total) => onStep('photos', { done, total }))
  const photo = (p) => map.get(p.key) || photoLink(p)

  onStep('pdf')
  const { newsletterPdf, newsletterPdfName } = await import('./pdf.js')
  const pub0 = buildPayload(issue, parts, { audience: 'public', photo })
  const fam0 = buildPayload(issue, parts, { audience: 'families', photo })
  const pdfs = {}
  for (const lang of ['en', 'vi']) {
    onStep('pdf', { lang })
    const { blob } = await newsletterPdf(pub0, lang)
    if (blob.size > PDF_MAX) throw new Error(`The ${lang === 'vi' ? 'Vietnamese' : 'English'} PDF is ${(blob.size / 1048576).toFixed(0)} MB, too big to attach to an email. Use fewer photos in this issue (the photo parts and class corners), then publish again.`)
    const name = newsletterPdfName(pub0, lang)
    pdfs[lang] = { blob, name, url: await putPublic(`${issue.slug}/r${round}-${name}`, blob, 'application/pdf') }
  }
  const pdf = { en: pdfs.en.url, vi: pdfs.vi.url }

  onStep('save')
  const at = new Date().toISOString()
  const pub = buildPayload(issue, parts, { audience: 'public', photo, pdf, publishedAt: issue.published_at || at })
  const fam = { ...fam0, pdf, published_at: issue.published_at || at }
  await setIssueSetting(issue.id, 'published_print', fingerprint(issue, parts))
  const saved = await patchIssue(issue.id, { status: 'published', published: pub, publish_count: round })

  onStep('build')
  let build
  try { build = await startBuild() } catch (e) { build = { error: e.message } }
  return { issue: saved, parts, pub, fam, pdfs, build }
}

/** Takes an issue off the website: its page, its public photos and PDFs. The issue itself stays. */
export async function unpublishIssue(issue) {
  const saved = await patchIssue(issue.id, { status: 'english_done' })
  await removePublicFolder(issue.slug)
  let build
  try { build = await startBuild() } catch (e) { build = { error: e.message } }
  return { issue: saved, build }
}

/** Gets the Gmail sign-in out of the way: call first thing in a click (the pop-up needs the click). */
export async function readyGmail() {
  if (!gmailConfigured) return false
  await getToken()
  return true
}

/**
 * Saves the email in admin@'s Drafts: Bcc the edition's groups, both PDFs attached.
 * `pdfs` are the blobs just made by Publish; without them the published PDFs are fetched.
 * The draft saved before for this issue is replaced, so Drafts holds one copy only.
 */
export async function saveEmailDraft(issue, fam, pdfs = null) {
  if (!gmailConfigured) throw new Error('Gmail is not connected in this copy of The Current (README → Google setup), so the email cannot be saved as a draft. Use "Copy the email" instead.')
  const { newsletterEmail } = await import('./email.js')
  const { newsletterPdfName } = await import('./pdf.js')
  const { subject, html, text } = newsletterEmail(fam)
  const files = []
  for (const lang of ['en', 'vi']) {
    let blob = pdfs?.[lang]?.blob
    if (!blob && fam.pdf?.[lang]) {
      const res = await fetch(fam.pdf[lang])
      if (res.ok) blob = await res.blob()
    }
    if (!blob) throw new Error(`The ${lang === 'vi' ? 'Vietnamese' : 'English'} PDF could not be fetched from the website's storage. Publish the issue again, then save the email.`)
    files.push({ filename: pdfs?.[lang]?.name || newsletterPdfName(fam, lang), base64: await blobToBase64(blob), type: 'application/pdf' })
  }
  const draft = await createDraftUpload({ to: '', bcc: EDITIONS[issue.edition].groups.join(', '), subject, text, html, attachments: files }, issue.email?.draft_id || '')
  const saved = await patchIssue(issue.id, { email: { draft_id: draft.id, message_id: draft.messageId, link: draft.link, saved_at: new Date().toISOString() } })
  return { draft, issue: saved }
}

export { newsletterError }
