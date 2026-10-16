// Text in the newsletter: the small safe HTML the editor keeps (paragraphs, bold,
// italics, bullet lists, links), plain text from it, reading time, the wording
// checks and the word-by-word "what changed" view. No browser needed.

const ALLOWED = { p: 'p', div: 'p', b: 'b', strong: 'b', i: 'i', em: 'i', ul: 'ul', ol: 'ul', li: 'li', br: 'br', a: 'a' }
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' }

export const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const decodeEntities = (s) => String(s ?? '').replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, (m, e) => {
  if (ENTITIES[e.toLowerCase()] !== undefined) return ENTITIES[e.toLowerCase()]
  if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16))
  if (/^#\d/.test(e)) return String.fromCodePoint(Number(e.slice(1)))
  return m
})

/** A link the newsletter may carry: the web, mail or phone. */
export const safeUrl = (u) => {
  const s = decodeEntities(String(u || '')).trim()
  return /^(https?:\/\/|mailto:|tel:)/i.test(s) ? s : ''
}

// Text between tags: a "<" or ">" that is not one of ours, or an "&" that starts no entity, is written out as a character.
const escText = (t) => t.replace(/&(?!(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&nbsp;|\u00a0/g, ' ')
const INLINE = new Set(['b', 'i', 'a'])

/**
 * Keeps only paragraphs, bold, italics, bullet lists, line breaks and links (http, mail, phone).
 * Every other tag goes, its words stay; attributes go except a link's address.
 * It reads the HTML piece by piece and writes it out again, so nothing it did not
 * write itself can reach the page as a tag: whatever is pasted or saved, the
 * result is safe to put into a page as HTML.
 */
export function cleanHtml(html) {
  const src = String(html || '')
    .replace(/<!--[\s\S]*?(-->|$)/g, '')
    .replace(/<(script|style|head|title|xml|template|iframe|object|svg|math)\b[\s\S]*?(<\/\1\s*>|$)/gi, '')
  let out = ''
  const stack = [] // open tags: p, ul, li, b, i, a, or 'a0' (a link with no address: its words only)
  const has = (t) => stack.includes(t)
  const inBlock = () => has('p') || has('li')
  const close = (t) => { // closes t and everything opened inside it
    if (!has(t)) return
    while (stack.length) { const x = stack.pop(); if (x !== 'a0') out += `</${x}>`; if (x === t) break }
  }
  const openP = () => { if (has('ul')) { if (!has('li')) { stack.push('li'); out += '<li>' } } else { stack.push('p'); out += '<p>' } }
  const text = (t) => {
    if (!t) return
    if (!inBlock()) { if (!t.trim()) return; openP() }
    out += escText(t)
  }
  const re = /<(\/?)([a-z][a-z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi
  let last = 0, m
  while ((m = re.exec(src))) {
    text(src.slice(last, m.index))
    last = re.lastIndex
    const t = ALLOWED[m[2].toLowerCase()]
    if (!t) continue
    if (t === 'br') { if (inBlock()) out += '<br>'; continue }
    if (m[1] === '/') {
      if (t === 'a') {
        if (stack.lastIndexOf('a0') > stack.lastIndexOf('a')) stack.splice(stack.lastIndexOf('a0'), 1)
        else close('a')
      } else if (t !== 'p' || !has('li')) close(t)
      continue
    }
    if (t === 'p') { // a paragraph inside a bullet is a line break; one after another closes the last
      if (has('li')) { if (!out.endsWith('<li>')) out += '<br>' } else { close('p'); if (!has('ul')) { stack.push('p'); out += '<p>' } }
      continue
    }
    if (t === 'ul') { if (!has('ul')) { close('p'); stack.push('ul'); out += '<ul>' } continue }
    if (t === 'li') { close('li'); if (!has('ul')) { close('p'); stack.push('ul'); out += '<ul>' } stack.push('li'); out += '<li>'; continue }
    if (INLINE.has(t)) {
      if (!inBlock()) openP()
      if (t === 'a') {
        const hm = m[3].match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i) || []
        const href = safeUrl(hm[1] ?? hm[2] ?? hm[3] ?? '')
        if (href && !has('a')) { stack.push('a'); out += `<a href="${escHtml(href)}">` } else stack.push('a0')
      } else if (!has(t)) { stack.push(t); out += `<${t}>` }
    }
  }
  text(src.slice(last))
  while (stack.length) { const x = stack.pop(); if (x !== 'a0') out += `</${x}>` }
  // Empty bold, links, paragraphs, bullets and lists go, and line breaks at the start or end of a paragraph.
  let prev
  do {
    prev = out
    out = out.replace(/<(b|i)>\s*<\/\1>/g, '').replace(/<a href="[^"]*">\s*<\/a>/g, '')
      .replace(/<(p|li)>(\s|<br>)*<\/\1>/g, '').replace(/<ul>\s*<\/ul>/g, '')
      .replace(/(<(p|li)>)(\s|<br>)+/g, '$1').replace(/(\s|<br>)+(<\/(p|li)>)/g, '$2')
  } while (out !== prev)
  return out.trim()
}

/** The words of some HTML, on one line. */
export function plain(html) {
  return decodeEntities(String(html || '').replace(/<(br|\/p|\/li|\/ul)\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ').trim()
}

/** Paragraphs of some HTML as plain text, one per line (bullets as "• "). For the email's text part. */
export function plainLines(html) {
  return decodeEntities(String(html || '')
    .replace(/<li>/gi, '• ').replace(/<\/(p|li)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
}

/** The first sentence (or the first ~160 characters) of some HTML. */
export function firstSentence(html, max = 170) {
  const t = plain(html)
  const m = t.match(new RegExp(`^.{15,${max}}?[.!?](\\s|$)`))
  if (m) return m[0].trim()
  return t.length > max ? `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : t
}

export const charCount = (s) => plain(s).length
const wordCount = (s) => (plain(s).match(/\S+/g) || []).length
/** Minutes to read some English at an easy pace (200 words a minute), at least 1. */
export const readingMinutes = (texts) => Math.max(1, Math.round(texts.reduce((n, t) => n + wordCount(t), 0) / 200))

/**
 * Words PRA does not use. English: PRA is a language center, never a school.
 * Vietnamese (the website's VIETNAMESE.md and check-vi): never "trường" for PRA,
 * students are "học viên", and quarters are "quý" ("học kỳ" is a semester).
 * `fix` names a change the editor can make in one click.
 */
const RULES = {
  en: [
    { re: /\b(the|our|a|at|to|from)\s+school\b/gi, msg: 'PRA is a language center: say “PRA” or “the center”, not “school”.' },
    { re: /\bschool (day|year|office|kitchen|community|grounds|gate)\b/gi, msg: 'PRA is a language center: say “day”, “academic year”, “front office”, “our kitchen”, not “school …”.' },
  ],
  vi: [
    { re: /học kỳ/gi, msg: '“Học kỳ” is a semester. If this means a quarter, write “quý”.', fix: 'quy' },
    { re: /(?<!môi |thị |quảng |chiến |lập |hiện |sở |thao |nông |ngư |phi |từ |điện |chuyển |các )trường(?! hợp| cũ| quốc tế)/gi, msg: 'PRA is never a “trường”: write “Palm River Academy” or “trung tâm”.' },
    { re: /hiệu trưởng/gi, msg: 'PRA has no “hiệu trưởng”.' },
    { re: /học sinh/gi, msg: 'Our students are “học viên”, or “con / các con / các bé” when writing to parents.' },
  ],
}
/** Notes on some English and Vietnamese text: [{ lang, msg, n, fix }]. */
export function wordingNotes(enText, viText) {
  const out = []
  for (const [lang, txt] of [['en', enText], ['vi', viText]]) {
    for (const r of RULES[lang]) {
      const n = (String(txt || '').match(r.re) || []).length
      if (n) out.push({ lang, msg: r.msg, n, fix: r.fix || null })
    }
  }
  return out
}
/** "Học kỳ 2" -> "Quý 2", keeping capitals. */
export const fixQuy = (s) => String(s || '').replace(/Học kỳ/g, 'Quý').replace(/học kỳ/g, 'quý').replace(/HỌC KỲ/g, 'QUÝ')

/** Word-by-word changes from `a` to `b`, as HTML with <del> and <ins>. */
export function diffWords(a, b) {
  const A = String(a || '').split(/(\s+)/).filter((x) => x !== '')
  const B = String(b || '').split(/(\s+)/).filter((x) => x !== '')
  if (A.length * B.length > 4e6) return `<ins>${escHtml(b)}</ins>`
  const n = A.length, m = B.length
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  let i = 0, j = 0, out = ''
  const space = (x) => /^\s+$/.test(x)
  while (i < n && j < m) {
    if (A[i] === B[j]) { out += escHtml(A[i]); i++; j++ } else if (dp[i + 1][j] >= dp[i][j + 1]) { out += space(A[i]) ? escHtml(A[i]) : `<del>${escHtml(A[i])}</del>`; i++ } else { out += space(B[j]) ? escHtml(B[j]) : `<ins>${escHtml(B[j])}</ins>`; j++ }
  }
  while (i < n) { out += space(A[i]) ? escHtml(A[i]) : `<del>${escHtml(A[i])}</del>`; i++ }
  while (j < m) { out += space(B[j]) ? escHtml(B[j]) : `<ins>${escHtml(B[j])}</ins>`; j++ }
  return out.replace(/\n/g, '<br>')
}
