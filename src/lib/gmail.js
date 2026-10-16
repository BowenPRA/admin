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
let token = null
let tokenExp = 0

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
export async function getToken() {
  if (!gmailConfigured) throw new Error('Gmail is not connected yet (VITE_GOOGLE_CLIENT_ID is missing). See README → Google setup.')
  if (token && Date.now() < tokenExp - 60_000) return token
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      hint: SENDER,
      callback: (resp) => {
        if (resp.error) { reject(new Error(resp.error_description || resp.error)); return }
        token = resp.access_token
        tokenExp = Date.now() + (Number(resp.expires_in) || 3600) * 1000
        resolve(token)
      },
      error_callback: (e) => reject(new Error(e?.message || 'Google sign-in was closed')),
    })
    client.requestAccessToken({ prompt: token ? '' : 'consent' })
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
    btoa(unescape(encodeURIComponent(m.text))),
    '',
    ...(m.html ? [`--${alt}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', btoa(unescape(encodeURIComponent(m.html))), ''] : []),
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
        f.base64.replace(/(.{76})/g, '$1\r\n'),
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
    if (res.status === 401 || res.status === 403) token = null
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
 * Returns { id, messageId, link }.
 */
export async function createDraftUpload(m) {
  const tok = await getToken()
  const res = await fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/drafts?uploadType=media', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'message/rfc822' },
    body: new TextEncoder().encode(buildMime(m)),
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try { msg = (await res.json()).error?.message || msg } catch { /* ignore */ }
    if (res.status === 401 || res.status === 403) token = null
    throw new Error(`Gmail: ${msg}`)
  }
  const d = await res.json()
  return { id: d.id, messageId: d.message?.id, link: draftLink(d.message?.id) }
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
