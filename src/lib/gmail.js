// Save emails as drafts in the academy's Gmail account from the browser: invoice
// emails with the PDF attached, and the supply check for a new student (lib/supplyCheck.js).
// Nothing is ever sent from the app.
//
// Uses Google Identity Services: the first use in a session pops up Google's
// sign-in for admin@palmriveracademy.edu.vn and asks permission to manage
// drafts and send mail; the token lives in memory only. Needs
// VITE_GOOGLE_CLIENT_ID (see README).

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
export const SENDER = import.meta.env.VITE_GMAIL_SENDER || 'admin@palmriveracademy.edu.vn'
export const gmailConfigured = Boolean(CLIENT_ID)

// gmail.compose covers creating drafts and sending.
const SCOPE = 'https://www.googleapis.com/auth/gmail.compose'
// One token per permission: Gmail drafts here, reading the Drive folder's list in lib/driveDocs.js.
const tokens = new Map() // scope -> { token, exp }

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = resolve
    s.onerror = () => reject(new Error('Could not load Google sign-in'))
    document.head.appendChild(s)
  })
}

/** Load Google sign-in ahead of time, so the permission popup opens straight from a click and is not blocked. */
export function prepareGmail() { if (gmailConfigured) loadGis().catch(() => {}) }

// Call first thing in a click handler: the sign-in popup needs the click.
export const getToken = () => googleToken(SCOPE)

/** Drops a token Google refused, so the next call signs in again. */
export const forgetGoogleToken = (scope) => { tokens.delete(scope) }

/** True while this tab holds a Google token for `scope` that has not run out. */
export const hasGoogleToken = (scope) => { const t = tokens.get(scope); return !!t && Date.now() < t.exp - 60_000 }

/**
 * A Google token for one permission (scope), from the admin@ account by default. The first
 * call in a session opens Google's sign-in; later ones reuse the token until it runs out.
 */
export async function googleToken(scope, hint = SENDER) {
  if (!gmailConfigured) throw new Error('Google is not connected yet (VITE_GOOGLE_CLIENT_ID is missing). See README → Google setup.')
  if (hasGoogleToken(scope)) return tokens.get(scope).token
  await loadGis()
  const had = tokens.has(scope)
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope,
      hint,
      callback: (resp) => {
        if (resp.error) { reject(new Error(resp.error_description || resp.error)); return }
        tokens.set(scope, { token: resp.access_token, exp: Date.now() + (Number(resp.expires_in) || 3600) * 1000 })
        resolve(resp.access_token)
      },
      error_callback: (e) => reject(new Error(e?.message || 'Google sign-in was closed')),
    })
    client.requestAccessToken({ prompt: had ? '' : 'consent' })
  })
}

// RFC 2047 for non-ASCII header values (Vietnamese names, subjects).
const encHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${btoa(unescape(encodeURIComponent(s)))}?=`)

function b64url(bytes) {
  let bin = ''
  bytes.forEach((b) => { bin += String.fromCharCode(b) })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * MIME message, with one PDF attachment when there is one (an invoice), base64url-encoded
 * for the Gmail API. A message without one (the supply check) is the text parts alone.
 * @param {{to:string, cc?:string, subject:string, text:string, html?:string, attachment?:{filename:string, base64:string}}} m
 */
export function buildRaw(m) {
  return b64url(new TextEncoder().encode(buildMime(m)))
}

/**
 * The message as MIME text. Besides buildRaw's fields it takes `bcc`, several
 * `attachments` ([{ filename, base64, type }]) and an empty `to` (a newsletter
 * goes to its groups in Bcc only).
 */
// Base64 in lines of 76 characters, as mail expects.
const wrap76 = (b64) => b64.replace(/(.{76})/g, '$1\r\n')

export function buildMime(m) {
  const boundary = `pra${Date.now().toString(36)}`
  const alt = `alt${Date.now().toString(36)}`
  const body = [
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(btoa(unescape(encodeURIComponent(m.text)))),
    '',
    ...(m.html ? [`--${alt}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(btoa(unescape(encodeURIComponent(m.html)))), ''] : []),
    `--${alt}--`,
    '',
  ]
  const files = [...(m.attachment ? [m.attachment] : []), ...(m.attachments || [])]
  const lines = [
    `From: Palm River Academy <${SENDER}>`,
    ...(m.to ? [`To: ${m.to}`] : []),
    ...(m.cc ? [`Cc: ${m.cc}`] : []),
    ...(m.bcc ? [`Bcc: ${m.bcc}`] : []),
    `Subject: ${encHeader(m.subject)}`,
    'MIME-Version: 1.0',
    ...(files.length ? [
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      ...body,
      ...files.flatMap((f) => [
        `--${boundary}`,
        `Content-Type: ${f.type || 'application/pdf'}; name="${encHeader(f.filename)}"`,
        `Content-Disposition: attachment; filename="${encHeader(f.filename)}"`,
        'Content-Transfer-Encoding: base64',
        '',
        wrap76(f.base64),
        '',
      ]),
      `--${boundary}--`,
      '',
    ] : body),
  ]
  return lines.join('\r\n')
}

async function gmailPost(path, body) {
  const tok = await getToken()
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try { msg = (await res.json()).error?.message || msg } catch { /* ignore */ }
    if (res.status === 401 || res.status === 403) forgetGoogleToken(SCOPE)
    throw new Error(`Gmail: ${msg}`)
  }
  return res.json()
}

// The app never sends email: it only saves drafts for the office to review and send from Gmail.

/** Saves the message to the Drafts folder. Returns { id, messageId, link }. */
export async function createDraft(m) {
  const d = await gmailPost('drafts', { message: { raw: buildRaw(m) } })
  return { id: d.id, messageId: d.message?.id, link: draftLink(d.message?.id) }
}

/**
 * Saves a large message (a newsletter with its PDFs) to the Drafts folder. The
 * upload address takes messages up to 35 MB; the plain one above stops near 5 MB.
 * With `replaceId` the draft saved before is replaced, so only one stays in Drafts;
 * if it is gone (sent or deleted) a new one is made.
 * Returns { id, messageId, link, replaced }.
 */
export async function createDraftUpload(m, replaceId = '') {
  const tok = await getToken()
  const body = new TextEncoder().encode(buildMime(m))
  const send = (method, url) => fetch(url, { method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'message/rfc822' }, body })
  if (replaceId) {
    const up = await send('PUT', `https://gmail.googleapis.com/upload/gmail/v1/users/me/drafts/${encodeURIComponent(replaceId)}?uploadType=media`)
    if (up.ok) { const d = await up.json(); return { id: d.id, messageId: d.message?.id, link: draftLink(d.message?.id), replaced: true } }
    if (up.status === 401 || up.status === 403) { forgetGoogleToken(SCOPE); throw new Error(`Gmail: ${up.status}`) }
  }
  const res = await send('POST', 'https://gmail.googleapis.com/upload/gmail/v1/users/me/drafts?uploadType=media')
  if (!res.ok) {
    let msg = `${res.status}`
    try { msg = (await res.json()).error?.message || msg } catch { /* ignore */ }
    if (res.status === 401 || res.status === 403) forgetGoogleToken(SCOPE)
    throw new Error(`Gmail: ${msg}`)
  }
  const d = await res.json()
  return { id: d.id, messageId: d.message?.id, link: draftLink(d.message?.id), replaced: false }
}

/** Opens a draft in Gmail, signed in as the sending account. */
export function draftLink(messageId) {
  const base = `https://mail.google.com/mail/?authuser=${encodeURIComponent(SENDER)}`
  return messageId ? `${base}#drafts?compose=${messageId}` : `${base}#drafts`
}

/** Fallback when Gmail is not connected: open a Gmail compose window pre-filled (Gmail saves it as a draft). */
export function openComposeWindow({ to, cc, subject, text }) {
  const u = new URL('https://mail.google.com/mail/')
  u.searchParams.set('view', 'cm')
  u.searchParams.set('fs', '1')
  u.searchParams.set('authuser', SENDER)
  u.searchParams.set('to', to)
  if (cc) u.searchParams.set('cc', cc)
  u.searchParams.set('su', subject)
  u.searchParams.set('body', text)
  window.open(u.toString(), '_blank', 'noopener')
}
