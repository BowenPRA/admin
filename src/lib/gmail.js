// Send email through the school's Gmail account from the browser.
//
// Uses Google Identity Services: the first send in a session pops up Google's
// sign-in for admin@palmriveracademy.edu.vn and asks permission to send mail;
// the token lives in memory only. Needs VITE_GOOGLE_CLIENT_ID (see README).

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
export const SENDER = import.meta.env.VITE_GMAIL_SENDER || 'admin@palmriveracademy.edu.vn'
export const gmailConfigured = Boolean(CLIENT_ID)

const SCOPE = 'https://www.googleapis.com/auth/gmail.send'
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

export async function getToken() {
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
 * Build and send a MIME message with one PDF attachment.
 * @param {{to:string, cc?:string, subject:string, text:string, html?:string, attachment:{filename:string, base64:string}}} m
 */
export async function sendMail(m) {
  const tok = await getToken()
  const boundary = `pra${Date.now().toString(36)}`
  const alt = `alt${Date.now().toString(36)}`
  const enc = new TextEncoder()
  const lines = [
    `From: Palm River Academy <${SENDER}>`,
    `To: ${m.to}`,
    ...(m.cc ? [`Cc: ${m.cc}`] : []),
    `Subject: ${encHeader(m.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
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
    `--${boundary}`,
    `Content-Type: application/pdf; name="${m.attachment.filename}"`,
    `Content-Disposition: attachment; filename="${m.attachment.filename}"`,
    'Content-Transfer-Encoding: base64',
    '',
    m.attachment.base64.replace(/(.{76})/g, '$1\r\n'),
    '',
    `--${boundary}--`,
    '',
  ]
  const raw = b64url(enc.encode(lines.join('\r\n')))
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  if (!res.ok) {
    let msg = `${res.status}`
    try { msg = (await res.json()).error?.message || msg } catch { /* ignore */ }
    if (res.status === 401) { token = null }
    throw new Error(msg)
  }
  return res.json()
}

/** Fallback when Gmail is not configured: open a Gmail compose window pre-filled. */
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
