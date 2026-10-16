// The weekly newsletter as an email (HTML for Gmail first, then Apple Mail and
// phones; a plain-text part; the subject) and as a short message for the
// parents' chat groups. Pure functions, made from the families payload
// (README.md). Emoji stay as staff typed them.
//
// EMAIL_STYLE 'full' (now): the whole newsletter is in the email, English then
// Vietnamese, as the Google Doc was. 'short': the first lines of each part with
// "Read more" links to the page.

import { TONES, INK, INK_SOFT, NAVY, SENDER, EMAIL_STYLE, SHOW_CAPTIONS, word } from './constants.js'
import { escHtml, plain, plainLines, firstSentence } from './text.js'
import { pick } from './payload.js'
import { addDays } from './dates.js'

const FONT = 'Arial,Helvetica,sans-serif'
const PAGE_BG = '#EEF2F7'
const LINK = TONES.blue.ink
const RULE = '#E3EAF2'
const HOTLINE = '0968 49 42 45'
const ADDRESS = 'Thanh Nhi Hamlet, Hoi An Dong Ward, Da Nang City'
/** Words the email needs that constants.js WORDS does not have (yet). */
const MORE_WORDS = { en: { event: 'event' }, vi: { event: 'sự kiện' } }

const t = (obj, lang) => pick(obj, lang).text || ''
const esc = escHtml
/** Inline text style. */
const font = (size, line, { bold = false, color = INK, extra = '' } = {}) =>
  `font-family:${FONT};font-size:${size}px;line-height:${line}px;${bold ? 'font-weight:bold;' : ''}color:${color};${extra}`
/** The page address with where the reader came from (and the part, for "Read more"). */
const link = (url, from, id) => `${url}?from=${from}${id ? `#s-${id}` : ''}`

// The editor's preview shows photos from their private links too (they work for the person looking).
let previewing = false
/** A photo address the email can show: public http(s) only (a signed link expires, a data URL is too big). */
function publicSrc(photo, big = false) {
  const s = (big ? photo?.src || photo?.small : photo?.small || photo?.src) || ''
  if (previewing) return s
  return /^https?:\/\//i.test(s) && !/\/object\/sign\//.test(s) ? s : ''
}

/** The small HTML of a body with the inline styles mail needs. A paragraph all in bold is a small heading. */
function bodyHtml(html, { size = 16, line = 25 } = {}) {
  return String(html || '')
    .replace(/<p><b>((?:(?!<\/?(?:p|b)>).)*)<\/b><\/p>/g, (m, inner, at) => `<p style="margin:${at ? 20 : 0}px 0 6px;${font(size + 1, line - 2, { bold: true, color: NAVY })}">${inner}</p>`)
    .replace(/<p>/g, `<p style="margin:0 0 12px;${font(size, line)}">`)
    .replace(/<ul>/g, `<ul style="margin:0 0 12px;padding:0 0 0 22px;${font(size, line)}">`)
    .replace(/<li>/g, '<li style="margin:0 0 4px;">')
    .replace(/<a href="([^"]*)">/g, `<a href="$1" style="color:${LINK};text-decoration:underline;">`)
    .replace(/<b>/g, `<b style="color:${NAVY};">`)
}

const tagWord = (tag, lang) => {
  if (tag === 'off') return { text: word(lang, 'off'), color: TONES.coral.ink }
  if (tag === 'fees') return { text: word(lang, 'fees'), color: TONES.sun.ink }
  if (tag === 'event') return { text: MORE_WORDS[lang === 'vi' ? 'vi' : 'en'].event, color: TONES.violet.ink }
  return null
}

/** What "In this issue" lists: one entry per story, class corner, photo set, quote and Palm Press post. */
function issueEntries(payload, lang) {
  const out = []
  for (const p of payload.parts || []) {
    const href = link(payload.url[lang] || payload.url.en, 'email', p.id)
    if (p.type === 'story') {
      out.push({ heading: t(p.heading, lang), line: firstSentence(t(p.body, lang)), photo: p.photos?.[0], href })
    } else if (p.type === 'class') {
      const who = p.teacher?.name ? word(lang, 'fromTeacher', { name: p.teacher.name }) : ''
      const photo = p.photos?.[0] || (p.teacher?.photo ? { src: p.teacher.photo, small: p.teacher.photo, w: 1, h: 1, alt: { en: p.teacher.name, vi: p.teacher.name }, round: true } : null)
      out.push({ heading: [p.class, who].filter(Boolean).join(' · '), line: firstSentence(t(p.body, lang)), photo, href })
    } else if (p.type === 'photos') {
      out.push({ heading: t(p.heading, lang), line: t(p.photos?.[0]?.alt, lang), photo: p.photos?.[0], href })
    } else if (p.type === 'quote') {
      const q = plain(t(p.text, lang))
      const short = q.length > 150 ? `${q.slice(0, 148).replace(/\s+\S*$/, '')}…` : q
      out.push({ heading: `“${short}”`, line: t(p.who, lang) ? `— ${t(p.who, lang)}` : '', photo: p.photo, href, quote: true })
    } else if (p.type === 'press') {
      const by = p.author ? ` · ${word(lang, 'by', { name: p.author })}` : ''
      out.push({ heading: `${word(lang, 'pressFrom')}: ${p.title}`, line: `${t(p.blurb, lang)}`.trim() || `${p.title}${by}`, href: p.url })
    }
  }
  return out
}

/** Photos for the full email: one across, or two side by side, each with its caption. */
function photoGrid(photos, L) {
  const list = (photos || []).filter((p) => publicSrc(p))
  if (!list.length) return ''
  const one = (p, w) => {
    const r = p.w && p.h ? p.h / p.w : 0.75
    const alt = t(p.alt, L)
    return `<img src="${esc(publicSrc(p))}" width="${w}" height="${Math.round(w * r)}" alt="${esc(alt)}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;border-radius:10px;">`
      + `${alt && SHOW_CAPTIONS ? `<p style="margin:6px 0 0;${font(12, 17, { color: INK_SOFT })}">${esc(alt)}</p>` : ''}`
  }
  if (list.length === 1) return `<div style="margin:6px 0 4px;">${one(list[0], 552)}</div>`
  let out = ''
  for (let i = 0; i < list.length; i += 2) {
    const a = list[i], b = list[i + 1]
    out += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 4px;"><tr>`
      + `<td width="50%" valign="top" style="padding-right:6px;">${one(a, 270)}</td>`
      + `<td width="50%" valign="top" style="padding-left:6px;">${b ? one(b, 270) : ''}</td></tr></table>`
  }
  return out
}

/** One language's whole newsletter, as the Google Doc was: opening, every section in full, the closing and the sign-off. */
function fullSection(payload, lang, tone) {
  const L = lang === 'vi' ? 'vi' : 'en'
  const rows = []
  const pad = (html, p = '0 24px') => rows.push(`<tr><td style="padding:${p};">${html}</td></tr>`)
  const h2 = (text) => `<h2 style="margin:0 0 10px;${font(21, 28, { bold: true, color: NAVY })}">${esc(text)}</h2>`

  const lead = t(payload.opening?.lead, L)
  const body = t(payload.opening?.body, L)
  if (lead || plain(body)) pad(`${lead ? `<p style="margin:0 0 8px;${font(18, 25, { bold: true, color: NAVY })}">${esc(lead)}</p>` : ''}${bodyHtml(body)}`, '24px 24px 4px')

  // Dates and reminders, when they are shown (HIDDEN_PARTS).
  const dates = payload.need?.dates || []
  const reminders = (payload.need?.reminders || []).filter((r) => t(r, L).trim())
  if (dates.length || reminders.length) {
    let inner = ''
    if (dates.length) inner += `<p style="margin:0 0 6px;${font(17, 24, { bold: true, color: NAVY })}">${esc(word(L, 'dates'))}</p><ul style="margin:0 0 8px;padding:0 0 0 22px;${font(15, 22)}">${dates.map((d) => `<li style="margin:0 0 4px;"><b style="color:${NAVY};">${esc(t(d.date, L))}${d.time ? `, ${esc(t(d.time, L))}` : ''}:</b> ${esc(t(d.what, L))}</li>`).join('')}</ul>`
    if (reminders.length) inner += `<p style="margin:0 0 6px;${font(17, 24, { bold: true, color: NAVY })}">${esc(word(L, 'reminders'))}</p><ul style="margin:0;padding:0 0 0 22px;${font(15, 22)}">${reminders.map((r) => `<li style="margin:0 0 4px;">${esc(t(r, L))}</li>`).join('')}</ul>`
    pad(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${tone.pale}" style="background:${tone.pale};border-radius:12px;padding:16px 20px;">${inner}</td></tr></table>`, '18px 24px 4px')
  }

  for (const p of payload.parts || []) {
    if (p.type === 'story') {
      const when = t(p.when, L)
      const button = p.button ? `<p style="margin:4px 0 0;"><a href="${esc(p.button.url)}" style="display:inline-block;padding:10px 20px;border-radius:999px;background:${tone.button};${font(15, 20, { bold: true, color: '#FFFFFF' })}text-decoration:none;">${esc(t(p.button.label, L))}&nbsp;&rarr;</a></p>` : ''
      pad(`${h2(t(p.heading, L))}${when ? `<p style="margin:-4px 0 10px;${font(14, 20, { bold: true, color: tone.ink })}">${esc(when)}</p>` : ''}${bodyHtml(t(p.body, L))}${photoGrid(p.photos, L)}${button}`, '22px 24px 2px')
    } else if (p.type === 'photos') {
      pad(`${t(p.heading, L) ? h2(t(p.heading, L)) : ''}${photoGrid(p.photos, L)}`, '22px 24px 2px')
    } else if (p.type === 'class') {
      const who = p.teacher?.name ? word(L, 'fromTeacher', { name: p.teacher.name }) : ''
      pad(`${h2(p.class)}${who ? `<p style="margin:-4px 0 10px;${font(14, 20, { color: INK_SOFT })}">${esc(who)}</p>` : ''}${bodyHtml(t(p.body, L))}${photoGrid(p.photos, L)}`, '22px 24px 2px')
    } else if (p.type === 'quote') {
      pad(`<p style="margin:0;${font(18, 26, { color: NAVY, extra: 'font-style:italic;' })}">“${esc(plain(t(p.text, L)))}”</p>${t(p.who, L) ? `<p style="margin:4px 0 0;${font(14, 20, { color: INK_SOFT })}">— ${esc(t(p.who, L))}</p>` : ''}`, '22px 24px 2px')
    } else if (p.type === 'press') {
      pad(`${h2(`${word(L, 'pressFrom')}: ${p.title}`)}${t(p.blurb, L) ? `<p style="margin:0 0 8px;${font(16, 24)}">${esc(t(p.blurb, L))}</p>` : ''}<a href="${esc(p.url)}" style="${font(15, 20, { bold: true, color: LINK })}">${esc(word(L, 'readMore'))}&nbsp;&rarr;</a>`, '22px 24px 2px')
    } else if (p.type === 'welcome') {
      const names = (p.names || []).map((n) => `<b style="color:${NAVY};">${esc(n.name)}</b>${n.class ? ` (${esc(n.class)})` : ''}`).join(', ')
      pad(`${h2(t(p.heading, L) || word(L, 'welcome'))}${bodyHtml(t(p.body, L))}${names ? `<p style="margin:0;${font(16, 24)}">${names}</p>` : ''}`, '22px 24px 2px')
    }
  }

  const closing = (payload.parts || []).find((p) => p.type === 'closing')
  pad(`${closing && plain(t(closing.body, L)) ? bodyHtml(t(closing.body, L)) : ''}<p style="margin:4px 0 0;${font(16, 24)}">${esc(word(L, 'signoff'))}<br><b style="color:${NAVY};">${esc(word(L, 'from'))}</b></p>`, '18px 24px 8px')
  // The issue's page on pra.edu.vn, in this language.
  const href = link(payload.url[L] || payload.url.en, 'email')
  pad(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr><td align="center" bgcolor="${tone.button}" style="background:${tone.button};border-radius:999px;">`
    + `<a href="${esc(href)}" style="display:inline-block;padding:13px 26px;${font(16, 21, { bold: true, color: '#FFFFFF' })}text-decoration:none;border-radius:999px;">${esc(L === 'vi' ? 'Xem bản tin trên trang web' : 'Read it on the website')}&nbsp;&rarr;</a></td></tr></table>`, '16px 24px 10px')
  return rows.join('\n')
}

/** One language's part of the email: opening, need to know, welcome, in this issue, closing, button. */
function section(payload, lang, tone) {
  if (EMAIL_STYLE === 'full') return fullSection(payload, lang, tone)
  const L = lang === 'vi' ? 'vi' : 'en'
  const rows = []
  const pad = (html, p = '0 24px') => rows.push(`<tr><td style="padding:${p};">${html}</td></tr>`)

  // Opening.
  const lead = t(payload.opening?.lead, L)
  const body = t(payload.opening?.body, L)
  if (lead || plain(body)) {
    pad(`${lead ? `<h1 style="margin:0 0 12px;${font(22, 29, { bold: true, color: NAVY })}">${esc(lead)}</h1>` : ''}${bodyHtml(body)}`, '26px 24px 4px')
  }

  // Need to know: every date and reminder in full. This is what families act on.
  const dates = payload.need?.dates || []
  const reminders = (payload.need?.reminders || []).filter((r) => t(r, L).trim())
  if (dates.length || reminders.length) {
    let inner = `<p style="margin:0 0 10px;${font(12, 16, { bold: true, color: tone.ink, extra: 'letter-spacing:1.5px;text-transform:uppercase;' })}">${esc(word(L, 'needToKnow'))}</p>`
    if (dates.length) {
      inner += `<p style="margin:0 0 6px;${font(17, 24, { bold: true, color: NAVY })}">${esc(word(L, 'dates'))}</p>`
      inner += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${dates.map((d, i) => {
        const tag = tagWord(d.tag, L)
        const top = i ? `border-top:1px solid ${tone.edge};` : ''
        return `<tr><td width="36%" valign="top" style="${top}padding:9px 10px 9px 0;${font(15, 21, { bold: true, color: tone.ink })}">${esc(t(d.date, L))}${d.time ? `<br><span style="${font(13, 19, { color: INK_SOFT })}font-weight:normal;">${esc(t(d.time, L))}</span>` : ''}</td>`
          + `<td valign="top" style="${top}padding:9px 0;${font(15, 21)}">${esc(t(d.what, L))}`
          + `${tag ? `<br><span style="${font(11, 17, { bold: true, color: tag.color, extra: 'letter-spacing:1px;text-transform:uppercase;' })}">${esc(tag.text)}</span>` : ''}`
          + `${d.gcal ? `<br><a href="${esc(d.gcal)}" style="${font(13, 19, { color: LINK })}text-decoration:none;">+&nbsp;${esc(word(L, 'addToCalendar'))}</a>` : ''}</td></tr>`
      }).join('')}</table>`
    }
    if (reminders.length) {
      inner += `<p style="margin:${dates.length ? 16 : 0}px 0 6px;${font(17, 24, { bold: true, color: NAVY })}">${esc(word(L, 'reminders'))}</p>`
      inner += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${reminders.map((r) => `<tr><td width="22" valign="top" style="padding:5px 0;${font(15, 22, { bold: true, color: TONES.green.ink })}">&#10003;</td><td valign="top" style="padding:5px 0;${font(15, 22)}">${esc(t(r, L))}</td></tr>`).join('')}</table>`
    }
    pad(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${tone.pale}" style="background:${tone.pale};border-radius:12px;padding:18px 20px;">${inner}</td></tr></table>`, '18px 24px 4px')
  }

  // New families this week (families only, so it may be in the email).
  for (const w of (payload.parts || []).filter((p) => p.type === 'welcome')) {
    const names = (w.names || []).map((n) => `<b style="color:${NAVY};">${esc(n.name)}</b>${n.class ? ` (${esc(n.class)})` : ''}`).join(', ')
    const head = t(w.heading, L) || word(L, 'welcome')
    pad(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${TONES.sun.pale}" style="background:${TONES.sun.pale};border-radius:12px;padding:14px 20px;${font(15, 22)}"><b style="color:${NAVY};">${esc(head)}</b>${names ? `: ${names}` : ''}</td></tr></table>`, '14px 24px 4px')
  }

  // In this issue.
  const entries = issueEntries(payload, L)
  if (entries.length) {
    let list = `<p style="margin:0 0 4px;${font(12, 16, { bold: true, color: TONES.green.ink, extra: 'letter-spacing:1.5px;text-transform:uppercase;' })}">${esc(word(L, 'inIssue'))}</p>`
    entries.forEach((e, i) => {
      const src = publicSrc(e.photo)
      let thumb = ''
      if (src) {
        const r = e.photo.w && e.photo.h ? e.photo.h / e.photo.w : 0.75
        const tw = r > 1 ? Math.round(88 / r) : 88
        const th = r > 1 ? 88 : Math.round(88 * r)
        const alt = t(e.photo.alt, L)
        thumb = `<td width="88" valign="top" style="padding:16px 14px 16px 0;"><a href="${esc(e.href)}"><img src="${esc(src)}" width="${tw}" height="${th}" alt="${esc(alt)}" style="display:block;width:${tw}px;height:${th}px;border:0;border-radius:${e.photo.round ? '50%' : '8px'};"></a></td>`
      }
      const top = i ? `border-top:1px solid ${RULE};` : ''
      list += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${top}"><tr>${thumb}<td valign="top" style="padding:16px 0;">`
        + `<a href="${esc(e.href)}" style="${font(17, 23, { bold: true, color: NAVY, extra: e.quote ? 'font-style:italic;' : '' })}text-decoration:none;">${esc(e.heading)}</a>`
        + `${e.line ? `<p style="margin:4px 0 6px;${font(15, 22, { color: INK })}">${esc(e.line)}</p>` : '<div style="height:6px;line-height:6px;font-size:6px;">&nbsp;</div>'}`
        + `<a href="${esc(e.href)}" style="${font(14, 20, { bold: true, color: LINK })}text-decoration:none;">${esc(word(L, 'readMore'))}&nbsp;&rarr;</a></td></tr></table>`
    })
    pad(list, '26px 24px 0')
  }

  // Closing words, if any.
  const closing = (payload.parts || []).find((p) => p.type === 'closing')
  if (closing && plain(t(closing.body, L))) pad(bodyHtml(t(closing.body, L)), '18px 24px 0')

  // The button.
  const href = link(payload.url[L] || payload.url.en, 'email')
  pad(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr><td align="center" bgcolor="${tone.button}" style="background:${tone.button};border-radius:999px;">`
    + `<a href="${esc(href)}" style="display:inline-block;padding:15px 30px;${font(17, 22, { bold: true, color: '#FFFFFF' })}text-decoration:none;border-radius:999px;">${esc(word(L, 'readAll'))}&nbsp;&rarr;</a></td></tr></table>`, '22px 24px 8px')
  return rows.join('\n')
}

/**
 * The email for an issue.
 * @param {object} payload  the families payload (README.md)
 * @param {object} [opts]
 * @param {string} [opts.logoUrl]  the logo, at a public address
 * @param {boolean} [opts.preview]  for the editor's preview: show photos from private links too
 * @returns {{ subject: string, html: string, text: string }}
 */
export function newsletterEmail(payload, opts = {}) {
  previewing = !!opts.preview
  try { return buildEmail(payload, opts) } finally { previewing = false }
}

function buildEmail(payload, { logoUrl = 'https://pra.edu.vn/assets/img/logo.png' } = {}) {
  const ed = payload.edition === 'ey' ? 'ey' : 'post'
  const base = TONES[payload.tone] || TONES[ed === 'ey' ? 'green' : 'blue']
  // The band and the button in the edition's colour, deep enough for white words.
  const band = ed === 'ey' ? TONES.green.ink : TONES.blue.main
  const tone = { ...base, button: band }
  const subject = payload.subject || `${t(payload.edition_name, 'en')}: ${t(payload.label, 'en')}`
  const pre = [t(payload.preheader, 'en'), t(payload.preheader, 'vi')].filter(Boolean)
  const preheader = [...new Set(pre)].join(' · ')
  const viHref = link(payload.url.vi, 'email')
  const cover = publicSrc(payload.cover, true)
  const coverAlt = t(payload.cover?.alt, 'en')

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};" bgcolor="${PAGE_BG}">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE_BG};">${esc(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE_BG}" style="background:${PAGE_BG};">
<tr><td align="center" style="padding:20px 8px 28px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;">
<tr><td style="padding:18px 24px 14px;background-color:#FFFFFF;background-image:linear-gradient(#FFFFFF,#FFFFFF);">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle"><img src="${esc(logoUrl)}" width="134" height="54" alt="Palm River Academy" style="display:block;width:134px;height:54px;border:0;"></td>
<td valign="middle" align="right" style="${font(13, 18, { color: EMAIL_STYLE === 'full' ? INK_SOFT : LINK })}">${EMAIL_STYLE === 'full' ? `Tiếng Việt bên dưới 🇻🇳<br><a href="${esc(viHref)}" style="color:${LINK};text-decoration:underline;">${esc(word('en', 'readVi'))}</a>` : `<a href="${esc(viHref)}" style="color:${LINK};text-decoration:underline;">${esc(word('en', 'readVi'))}</a>`}</td>
</tr></table>
</td></tr>
<tr><td bgcolor="${band}" style="background:${band};padding:22px 24px 20px;">
<p style="margin:0;${font(26, 32, { bold: true, color: '#FFFFFF' })}">${esc(t(payload.edition_name, 'en'))}</p>
<p style="margin:6px 0 0;${font(14, 20, { color: '#FFFFFF', extra: 'opacity:.92;' })}">${esc(t(payload.label, 'en'))} &middot; ${esc(t(payload.day, 'en'))}</p>
</td></tr>
${cover ? `<tr><td style="padding:0;"><img src="${esc(cover)}" width="600" alt="${esc(coverAlt)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>
${coverAlt ? `<tr><td style="padding:8px 24px 0;${font(12, 17, { color: INK_SOFT })}">${esc(coverAlt)}</td></tr>` : ''}` : ''}
${section(payload, 'en', tone)}
<tr><td style="padding:30px 24px 6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="44%" valign="middle"><div style="border-top:2px dotted #C9D4E6;height:0;line-height:0;font-size:0;">&nbsp;</div></td>
<td valign="middle" align="center" style="padding:0 12px;white-space:nowrap;${font(12, 16, { bold: true, color: INK_SOFT, extra: 'letter-spacing:2px;' })}">TIẾNG VIỆT</td>
<td width="44%" valign="middle"><div style="border-top:2px dotted #C9D4E6;height:0;line-height:0;font-size:0;">&nbsp;</div></td>
</tr></table>
</td></tr>
<tr><td style="padding:14px 24px 0;"><p style="margin:0;${font(16, 22, { bold: true, color: NAVY })}">${esc(t(payload.edition_name, 'vi'))} &middot; ${esc(t(payload.label, 'vi'))}</p><p style="margin:2px 0 0;${font(13, 19, { color: INK_SOFT })}">${esc(t(payload.day, 'vi'))}</p></td></tr>
${section(payload, 'vi', tone)}
<tr><td style="padding:26px 24px 22px;border-top:1px solid ${RULE};${font(13, 20, { color: INK_SOFT })}">
<p style="margin:0 0 4px;${font(13, 20, { bold: true, color: NAVY, extra: 'letter-spacing:1px;' })}">PALM RIVER ACADEMY</p>
Hotline: <a href="tel:+84968494245" style="color:${NAVY};font-weight:bold;text-decoration:none;">${HOTLINE}</a><br>
${ADDRESS}<br>
<a href="mailto:${SENDER}" style="color:${LINK};text-decoration:underline;">${SENDER}</a> &middot; <a href="https://pra.edu.vn/" style="color:${LINK};text-decoration:underline;">pra.edu.vn</a>
</td></tr>
</table>
<p style="margin:14px 0 0;max-width:560px;${font(12, 18, { color: INK_SOFT })}">${esc(word('en', 'attached'))}<br>${esc(word('vi', 'attached'))}</p>
</td></tr>
</table>
</body>
</html>`

  return { subject, html, text: emailText(payload) }
}

/** The plain-text part: the same order, links written out. */
function emailText(payload) {
  const out = []
  const line = (s = '') => out.push(s)
  const half = (lang) => {
    const L = lang
    const lead = t(payload.opening?.lead, L)
    const body = plainLines(t(payload.opening?.body, L))
    if (lead) line(lead)
    if (body) line(body)
    const dates = payload.need?.dates || []
    const reminders = (payload.need?.reminders || []).filter((r) => t(r, L).trim())
    if (dates.length || reminders.length) {
      line()
      line(word(L, 'needToKnow').toLocaleUpperCase(L))
      if (dates.length) {
        line(word(L, 'dates'))
        for (const d of dates) {
          const tag = tagWord(d.tag, L)
          line(`- ${t(d.date, L)}${d.time ? `, ${t(d.time, L)}` : ''}: ${t(d.what, L)}${tag ? ` (${tag.text})` : ''}`)
        }
      }
      if (reminders.length) {
        line(word(L, 'reminders'))
        for (const r of reminders) line(`- ${t(r, L)}`)
      }
    }
    if (EMAIL_STYLE === 'full') {
      for (const p of payload.parts || []) {
        if (p.type === 'closing') continue
        const head = p.type === 'class' ? p.class : p.type === 'press' ? `${word(L, 'pressFrom')}: ${p.title}` : t(p.heading, L) || (p.type === 'welcome' ? word(L, 'welcome') : '')
        line()
        if (head) line(head)
        if (p.type === 'story' && t(p.when, L)) line(t(p.when, L))
        if (p.body) line(plainLines(t(p.body, L)))
        if (p.type === 'quote') line(`"${plain(t(p.text, L))}"${t(p.who, L) ? ` (${t(p.who, L)})` : ''}`)
        if (p.type === 'press') line(p.url)
        if (p.type === 'welcome' && (p.names || []).length) line(p.names.map((n) => `${n.name}${n.class ? ` (${n.class})` : ''}`).join(', '))
        if (p.button) line(`${t(p.button.label, L)}: ${p.button.url}`)
      }
      const closing = (payload.parts || []).find((p) => p.type === 'closing')
      line()
      if (closing && plain(t(closing.body, L))) line(plainLines(t(closing.body, L)))
      line(word(L, 'signoff'))
      line(word(L, 'from'))
      line()
      line(`${L === 'vi' ? 'Xem bản tin trên trang web' : 'Read it on the website'}: ${link(payload.url[L] || payload.url.en, 'email')}`)
      return
    }
    for (const w of (payload.parts || []).filter((p) => p.type === 'welcome')) {
      const names = (w.names || []).map((n) => `${n.name}${n.class ? ` (${n.class})` : ''}`).join(', ')
      line()
      line(`${t(w.heading, L) || word(L, 'welcome')}${names ? `: ${names}` : ''}`)
    }
    const entries = issueEntries(payload, L)
    if (entries.length) {
      line()
      line(word(L, 'inIssue').toLocaleUpperCase(L))
      for (const e of entries) {
        line()
        line(e.heading)
        if (e.line) line(e.line)
        line(`${word(L, 'readMore')}: ${e.href}`)
      }
    }
    const closing = (payload.parts || []).find((p) => p.type === 'closing')
    if (closing && plain(t(closing.body, L))) { line(); line(plainLines(t(closing.body, L))) }
    line()
    line(`${word(L, 'readAll')}: ${link(payload.url[L] || payload.url.en, 'email')}`)
  }

  line(t(payload.edition_name, 'en'))
  line(`${t(payload.label, 'en')} · ${t(payload.day, 'en')}`)
  line(EMAIL_STYLE === 'full' ? 'Tiếng Việt bên dưới' : `${word('en', 'readVi')}: ${link(payload.url.vi, 'email')}`)
  line()
  half('en')
  line()
  line('========== TIẾNG VIỆT ==========')
  line()
  line(`${t(payload.edition_name, 'vi')} · ${t(payload.label, 'vi')}`)
  line(t(payload.day, 'vi'))
  line()
  half('vi')
  line()
  line('-- ')
  line('PALM RIVER ACADEMY')
  line(`Hotline: ${HOTLINE}`)
  line(ADDRESS)
  line(SENDER)
  line('https://pra.edu.vn/')
  line()
  line(word('en', 'attached'))
  line(word('vi', 'attached'))
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

/**
 * A short message for the parents' Zalo / WhatsApp groups, in both languages:
 * Vietnamese first (most families in the groups read Vietnamese, and a chat
 * shows only the first lines before "Read more"), then English. Plain text:
 * the edition, the issue, the opening line, the two or three things to act on,
 * and the page's address. Kept under about 700 characters.
 */
export function chatMessage(payload) {
  const today = payload.date || ''
  const soon = today ? addDays(today, 21) : '9999-12-31'
  // The most pressing first: dates not yet over, those marked (no classes, fees, event) and
  // within three weeks before the rest, then by date. Then the reminders.
  const dates = (payload.need?.dates || [])
    .filter((d) => !today || (d.end || d.iso) >= today)
    .map((d) => ({ d, rank: (d.tag ? 0 : 1) + (d.iso <= soon ? 0 : 2) }))
    .sort((a, b) => a.rank - b.rank || a.d.iso.localeCompare(b.d.iso))
    .map((x) => x.d)
  const reminders = (payload.need?.reminders || []).filter((r) => (r.en || '').trim())
  const picks = (n) => {
    const ds = dates.slice(0, n <= 1 || !reminders.length ? n : n - 1)
    const rs = reminders.slice(0, n - ds.length)
    return [...ds.map((d) => ({ d })), ...rs.map((r) => ({ r }))]
  }
  const reminderText = (r, L, short) => { const s = plain(t(r, L)); return short || s.length > 110 ? firstSentence(s) : s }
  const half = (L, items, short) => {
    const lead = plain(t(payload.opening?.lead, L)) || firstSentence(t(payload.opening?.body, L))
    const lines = [`${t(payload.edition_name, L)} · ${t(payload.label, L)}`]
    if (lead) lines.push(lead)
    for (const it of items) {
      if (it.d) {
        const tag = tagWord(it.d.tag, L)
        lines.push(`• ${t(it.d.date, L)}${it.d.time ? `, ${t(it.d.time, L)}` : ''}: ${t(it.d.what, L)}${tag && it.d.tag !== 'event' ? ` (${tag.text})` : ''}`)
      } else lines.push(`• ${reminderText(it.r, L, short)}`)
    }
    lines.push(link(payload.url[L] || payload.url.en, 'chat'))
    return lines.join('\n')
  }
  // Three lines if they fit; reminders cut to their first sentence before a line is dropped.
  for (let n = 3; n >= 0; n--) {
    for (const short of [false, true]) {
      const items = picks(n)
      const msg = `${half('vi', items, short)}\n\n${half('en', items, short)}`
      if (msg.length <= 700 || n === 0) return msg
    }
  }
  return ''
}
