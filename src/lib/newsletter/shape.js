// What a section written as in the office's Google Doc is, from its text: a list of
// dates, a short checklist, a class with small headings, or a story. The PDF uses it
// to give each section its look. The same rules as the website's lib/nl-page.js
// (pra-website repo), which draws the web page: keep the two in step.

import { cleanHtml, decodeEntities } from './text.js'

const strip = (html) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
const addDays = (iso, n) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10)

export const EMOJI = /^((?:[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}]️?(?:‍[\p{Extended_Pictographic}]️?)*)+)\s*/u

/** A heading split into its leading emoji, its title, and what follows " | ": { emoji, title, sub }. */
export function splitHeading(text) {
  let t = String(text || '').trim()
  const m = t.match(EMOJI)
  const emoji = m ? m[1] : ''
  if (m) t = t.slice(m[0].length)
  const [title, ...rest] = t.split(/\s+\|\s+/)
  return { emoji, title: title.trim(), sub: rest.join(' | ').trim() }
}

/** Cleaned HTML as top-level blocks: { kind: 'sub' | 'p' | 'ul', html, items }. */
export function blocks(html) {
  const out = []
  for (const m of String(html || '').matchAll(/<(p|ul)>([\s\S]*?)<\/\1>/g)) {
    if (m[1] === 'ul') out.push({ kind: 'ul', items: [...m[2].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => x[1]) })
    else if (/^<b>((?:(?!<\/?(?:p|b)>).)*)<\/b>$/.test(m[2].trim())) out.push({ kind: 'sub', html: m[2].trim().slice(3, -4) })
    else out.push({ kind: 'p', html: m[2] })
  }
  return out
}

/** A list item as "<emoji> <b>Label:</b> the rest": { emoji, label, rest } (label '' when there is none). */
export function splitItem(html) {
  let s = String(html || '').trim()
  const e = decodeEntities(s.replace(/<[^>]+>/g, '')).match(EMOJI)
  let emoji = ''
  if (e && s.startsWith(e[1])) { emoji = e[1]; s = s.slice(e[1].length).trim() }
  const m = s.match(/^<b>([\s\S]*?)<\/b>\s*:?\s*([\s\S]*)$/)
  if (!m) return { emoji, label: '', rest: s }
  return { emoji, label: m[1].replace(/\s*:\s*$/, '').trim(), rest: m[2].replace(/^[:–—-]\s*/, '').trim() }
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
/** The day a label such as "Friday, October 30", "30 October" or "30/10" means, near the issue: { iso, end } or null. */
export function readDay(label, issueDate) {
  const s = decodeEntities(String(label || '')).replace(/\u00a0/g, ' ').trim()
  let mo = 0, d1 = 0, d2 = 0, m
  if ((m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\b/i))) { mo = MONTHS[m[1].toLowerCase()]; d1 = +m[2]; d2 = +(m[3] || 0) }
  else if ((m = s.match(/\b(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i))) { d1 = +m[1]; d2 = +(m[2] || 0); mo = MONTHS[m[3].toLowerCase()] }
  else if ((m = s.match(/\b(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\/(\d{1,2})\b/))) { d1 = +m[1]; d2 = +(m[2] || 0); mo = +m[3] }
  else if ((m = s.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})/i))) { d1 = +m[1]; mo = +m[2] }
  if (!mo || mo > 12 || !d1 || d1 > 31) return null
  const base = /^\d{4}-\d{2}-\d{2}$/.test(issueDate || '') ? issueDate : new Date().toISOString().slice(0, 10)
  let y = +base.slice(0, 4)
  const iso = (yy, dd) => `${yy}-${String(mo).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  if (iso(y, d1) < addDays(base, -90)) y += 1
  return { iso: iso(y, d1), end: d2 > d1 ? iso(y, d2) : null }
}

/** What a section is, from its English (so both languages look the same): 'dates', 'checklist', 'class' or 'story'. */
export function sectionKind(part, issueDate) {
  const en = blocks(cleanHtml(part.body?.en))
  const lists = en.filter((b) => b.kind === 'ul')
  const items = lists.flatMap((b) => b.items)
  const days = items.filter((it) => readDay(splitItem(it).label, issueDate)).length
  if (items.length >= 2 && days >= Math.ceil(items.length * 0.6)) return 'dates'
  const subs = en.filter((b) => b.kind === 'sub').length
  const head = splitHeading(part.heading?.en)
  if (head.sub && subs >= 2) return 'class'
  const words = en.filter((b) => b.kind === 'p').reduce((n, b) => n + strip(b.html).length, 0)
  if (lists.length === 1 && !subs && items.length <= 8 && words <= 220) return 'checklist'
  return 'story'
}
