// Email addresses typed by hand. A slip in the part after the @ ("gmai.com") goes onto
// invoices and mailing lists and nobody notices until mail bounces, so the forms warn as
// it is typed: "gmai.com: did you mean gmail.com?". Only a warning: the address is saved
// as typed. The website has the same list (pra-website, src/assets/js/main.js); keep the two alike.

// Domains PRA families and staff use. A typed domain one slip away from one of these
// (and not itself on the list) is flagged.
export const KNOWN_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.com.vn', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.it', 'outlook.com', 'outlook.fr', 'outlook.de',
  'live.com', 'live.co.uk', 'live.fr', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com',
  'protonmail.com', 'proton.me', 'gmx.de', 'gmx.net', 'gmx.at', 'web.de', 't-online.de', 'orange.fr', 'free.fr', 'wanadoo.fr',
  'mail.ru', 'yandex.ru', 'bk.ru', 'inbox.ru', 'list.ru', 'qq.com', '163.com', '126.com', 'naver.com', 'daum.net',
  'bigpond.com', 'bigpond.net.au', 'optusnet.com.au', 'xtra.co.nz', 'comcast.net', 'verizon.net',
  'fpt.vn', 'vnn.vn', 'pra.edu.vn', 'palmriveracademy.edu.vn',
]
// These names use one domain only, so "gmail.co" or "gmail.vn" is a slip whatever the ending.
const ONE_DOMAIN = { gmail: 'gmail.com', googlemail: 'googlemail.com', icloud: 'icloud.com' }

/** Edits between two words, a swap of two letters counting as one ("gmial" / "gmail"). */
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** The domain a typed one was probably meant to be, or null when it looks right (or is unknown and not close to anything). */
export function domainSlip(domain) {
  const d = String(domain || '').trim().toLowerCase().replace(/\.+$/, '')
  if (!d || KNOWN_DOMAINS.includes(d)) return null
  const name = d.split('.')[0]
  if (ONE_DOMAIN[name]) return ONE_DOMAIN[name]
  let best = null
  let bestD = 9
  for (const k of KNOWN_DOMAINS) {
    const n = distance(d, k)
    if (n < bestD) { best = k; bestD = n }
  }
  // Short domains are left alone: a company's own "ma.com" is one letter from "me.com".
  if (bestD === 1 && best.length >= 8) return best
  if (bestD === 2 && best.length >= 9 && d.length >= 7) return best
  return null
}

const LOOKS_RIGHT = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[a-z]{2,}$/i

/** Whether one address has the shape of an email address (one @, a dot in the part after it). */
export const looksLikeEmail = (e) => LOOKS_RIGHT.test(String(e || '').trim())

/** The addresses in a box that may hold several ("a@x.com, b@y.com"). */
export const addressesIn = (text) => String(text ?? '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean)

/**
 * What looks wrong in a box of addresses: `slips` are addresses whose domain looks
 * mistyped ({ email, domain, suggestion, fixed }), `bad` are words that are not an
 * address at all. Both empty when everything looks right.
 */
export function emailIssues(text) {
  const slips = []
  const bad = []
  for (const email of addressesIn(text)) {
    if (!looksLikeEmail(email)) { bad.push(email); continue }
    const at = email.lastIndexOf('@')
    const domain = email.slice(at + 1)
    const suggestion = domainSlip(domain)
    if (suggestion) slips.push({ email, domain: domain.toLowerCase(), suggestion, fixed: `${email.slice(0, at + 1)}${suggestion}` })
  }
  return { slips, bad }
}

/** The box with one mistyped address put right. */
export const fixSlip = (text, slip) => String(text ?? '').split(slip.email).join(slip.fixed)
