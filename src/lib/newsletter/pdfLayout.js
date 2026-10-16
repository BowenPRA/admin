// The weekly newsletter as an A4 PDF: the pdfmake document definition, made
// from the families payload (README.md). Pure: no browser, so it also runs in
// node. pdf.js loads the fonts, the logo, the photos and the icons and passes
// them in; anything missing is left out rather than failing the PDF.

import { EDITIONS, TONES, INK, INK_SOFT, LINE, NAVY, word } from './constants.js'
import { decodeEntities } from './text.js'
import { pick } from './payload.js'

/** The Be Vietnam Pro files (public/fonts) the PDF uses. */
export const FONT_FILES = [
  'BeVietnamPro-Regular.ttf', 'BeVietnamPro-Italic.ttf', 'BeVietnamPro-Medium.ttf',
  'BeVietnamPro-SemiBold.ttf', 'BeVietnamPro-SemiBoldItalic.ttf', 'BeVietnamPro-Bold.ttf',
]
/**
 * The font families the layout asks for, as pdfmake registers them. pdfmake has
 * four styles per family, so there are two: text (400, bold 600) and
 * headings (500, bold 700).
 */
export const PDF_FONTS = {
  BeVietnamPro: {
    normal: 'BeVietnamPro-Regular.ttf', bold: 'BeVietnamPro-SemiBold.ttf',
    italics: 'BeVietnamPro-Italic.ttf', bolditalics: 'BeVietnamPro-SemiBoldItalic.ttf',
  },
  BeVietnamProStrong: {
    normal: 'BeVietnamPro-Medium.ttf', bold: 'BeVietnamPro-Bold.ttf',
    italics: 'BeVietnamPro-Italic.ttf', bolditalics: 'BeVietnamPro-SemiBoldItalic.ttf',
  },
}

/** Icons the layout draws itself, besides each part's own (lucide names). */
export const LAYOUT_ICONS = ['book-open', 'images', 'users', 'check', 'arrow-right', 'message-circle-question', 'pen-line', 'hand-heart']

/** Words the PDF needs that constants.js WORDS does not have (yet). */
const MORE_WORDS = {
  en: { readOnline: 'Read it online', event: 'event' },
  vi: { readOnline: 'Đọc trên website', event: 'sự kiện' },
}
const FOOT = 'Palm River Academy · Thanh Nhi Hamlet, Hoi An Dong Ward, Da Nang City · 0968 49 42 45 · pra.edu.vn'

// A4 in points, and the page margins.
const PAGE_W = 595.28
const ML = 50, MR = 50, MT = 56, MB = 58
const W = PAGE_W - ML - MR
/** The cover photo's frame: full width, at most this tall (pdf.js crops a focused cover to it). */
export const COVER_FRAME = { width: W, maxHeight: 220 }
const GAP = 10 // between photos in a row
const PART_GAP = 20 // above each part

// The website's palm frond (pra-website src/assets/img/frond.svg), drawn faintly on page 1.
const FROND = 'M84 514.2Q61.8 475.2 14.7 486Q36.9 499.5 84 514.2ZM95.9 483.3Q61.5 435.2 3.4 444.8Q37.8 457.8 95.9 483.3ZM109.9 452.2Q83.6 385.6 24 377.8Q50.4 406.3 109.9 452.2ZM128.8 416.5Q108.5 357.2 55.3 354.8Q75.5 376.8 128.8 416.5ZM145.3 389.4Q126 327.1 74.1 318.8Q93.3 344.8 145.3 389.4ZM167.6 357.1Q142.8 292.7 91.1 284.6Q115.8 307.2 167.6 357.1ZM190.5 328Q172.2 252 124 235.1Q142.3 263.5 190.5 328ZM212.1 303.5Q203.8 230.4 163.4 218Q171.7 239.6 212.1 303.5ZM235.1 280Q231.3 202.7 198.7 175Q202.5 208.6 235.1 280ZM256.5 260.3Q249.4 177.1 213.6 145.4Q220.7 183.5 256.5 260.3ZM284.2 237.4Q271.8 149.4 233.1 115.1Q245.5 156.1 284.2 237.4ZM313.1 216.3Q309.4 148.1 281.8 121.5Q285.4 152.9 313.1 216.3ZM344.5 196Q359.7 131 347.6 100.9Q332.4 130.5 344.5 196ZM371.7 180.7Q389.9 115.9 384.9 89.9Q366.7 114 371.7 180.7ZM405.4 164.2Q420 111.1 405.4 94.4Q390.8 111.1 405.4 164.2ZM433.7 152.3Q455.6 108.4 454.5 85.4Q432.6 104.1 433.7 152.3ZM470.7 139.5Q492.6 105.7 487.7 91.7Q465.8 100.6 470.7 139.5ZM507.6 129.5Q525.8 113.9 520 105.6Q501.8 107.5 507.6 129.5ZM537.1 123.5Q558 107.2 557.7 97.5Q536.7 98.6 537.1 123.5ZM76.8 561.8L84.7 533.6L94 505.9L104.6 478.8L116.6 452.3L129.9 426.5L144.3 401.4L159.9 377L176.7 353.5L194.5 330.8L213.4 309L233.3 288.1L254.1 268.2L275.8 249.3L298.3 231.4L321.7 214.7L345.8 199.2L370.6 184.8L396.1 171.7L422.2 159.8L448.8 149.3L476 140.2L503.6 132.5L531.7 126.2L560.2 121.5L559.8 118.5L531.1 122.8L502.7 128.7L474.7 136L447.2 144.8L420.1 154.9L393.6 166.5L367.7 179.3L342.4 193.4L317.7 208.8L293.8 225.3L270.7 243L248.4 261.8L227 281.7L206.5 302.6L187 324.4L168.5 347.2L151.1 370.9L134.7 395.5L119.6 420.8L105.7 446.9L93.1 473.8L81.7 501.3L71.8 529.5L63.2 558.2ZM84.1 514.1Q161.2 504.4 219.7 499.6Q142.6 471.7 84.1 514.1ZM95.7 483.7Q169.3 488.7 230.7 494.5Q157 454.2 95.7 483.7ZM111.2 449.6Q194.9 462.2 271.1 482.1Q187.3 428.4 111.2 449.6ZM126.5 420.5Q221.2 429.6 308.1 458Q213.4 398.7 126.5 420.5ZM148.3 384.7Q248.9 398.2 342.8 425.6Q242.2 364.4 148.3 384.7ZM163.4 362.7Q273.7 372.7 375.9 405.7Q265.6 339.2 163.4 362.7ZM189.7 328.9Q305.8 351.5 419.4 396.6Q303.2 321.5 189.7 328.9ZM213.7 301.8Q344.8 350.1 478.3 433.8Q347.1 317 213.7 301.8ZM233.9 281.2Q361.2 328.2 490.3 419Q363.1 299.6 233.9 281.2ZM264.3 253.6Q393.7 301.6 525.8 383.8Q396.4 271.5 264.3 253.6ZM284.5 237.2Q402.2 296.5 525.3 393.4Q407.6 266.7 284.5 237.2ZM311.3 217.5Q427.5 274.9 550 355.8Q433.7 244.6 311.3 217.5ZM343.3 196.8Q435.5 245.2 533.6 307.3Q441.5 216.1 343.3 196.8ZM371.2 181Q456.9 236.7 549.5 320.7Q463.7 215.1 371.2 181ZM407.1 163.4Q480.5 215.7 561.2 291.9Q487.8 194.6 407.1 163.4ZM438.7 150.4Q499.1 205.2 570 277.2Q509.6 182.3 438.7 150.4ZM470.4 139.6Q520.5 199.5 583.6 277.8Q533.5 179.6 470.4 139.6ZM507.9 129.4Q530.3 164.9 566 199Q543.6 144.6 507.9 129.4ZM536.6 123.6Q555.1 158.2 587.8 191.3Q569.2 140.6 536.6 123.6Z'

// ---------------------------------------------------------------- text

/**
 * Emoji have no glyphs in Be Vietnam Pro (pdfmake would print blanks), and staff
 * paste them in from Google Docs. They go, with the joiners, variation selectors,
 * skin tones, flags and keycaps around them; © ® ™ stay. The email and the page
 * keep them.
 */
const EMOJI = /(?![\u00A9\u00AE\u2122])\p{Extended_Pictographic}|\u200D|\uFE0E|\uFE0F|\u20E3|[\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u{E0020}-\u{E007F}]/gu
const EMOJI_RUN = new RegExp(`[ \t\u00A0]*(?:${EMOJI.source})+(?:[ \t\u00A0]*(?:${EMOJI.source})+)*[ \t\u00A0]*`, 'gu')
/** Text without emoji. Where one stood between words a single space stays; before punctuation, none. */
export const stripEmoji = (s) => String(s ?? '').replace(EMOJI_RUN, (m, at, all) => {
  const next = all[at + m.length]
  if (next !== undefined && /[.,!?;:)\]}\u201D\u2019\u2026]/u.test(next)) return ''
  return /[ \t\u00A0]/.test(m) ? ' ' : ''
})
/**
 * Other characters Be Vietnam Pro has no glyph for (checked with fontkit), as the
 * nearest it has: arrows, ticks, stars and shapes used as bullets, odd hyphens and spaces.
 */
const NO_GLYPH = [
  [/[\u2192\u21D2\u27F6\u2794\u279C-\u279E]/g, '\u203A'],
  [/[\u2190\u21D0\u27F5]/g, '\u2039'],
  [/(^|\n)[ \t]*[\u2713\u2605\u2606\u25A0-\u25FF\u2023\u2043][ \t]*/g, '$1\u2022 '],
  [/[\u2190-\u21FF\u2713\u2605\u2606\u25A0-\u25FF\u2023\u2043]/g, ''],
  [/[\u2010-\u2012]/g, '-'],
  [/[\u2009\u202F]/g, ' '],
  [/[\u200B\u2060]/g, ''],
]
/** Text the PDF can print: no emoji, and no character the font lacks. */
export const printable = (s) => NO_GLYPH.reduce((out, [re, to]) => out.replace(re, to), stripEmoji(s))
/** One line of plain text for the PDF: printable, single spaces, trimmed. */
const clean = (s) => printable(decodeEntities(s)).replace(/[ \t\u00A0]+/g, ' ').replace(/ *\n */g, '\n').trim()

/** Capitals for the small spaced labels (Vietnamese letters too). */
const upper = (s) => String(s || '').toLocaleUpperCase('vi')

/**
 * The small HTML a body holds (<p> <b> <i> <ul> <li> <br> <a>) as pdfmake blocks:
 * paragraphs of text runs, and bullet lists.
 */
function htmlBlocks(html, { link = TONES.blue.ink, marker = TONES.blue.main, size } = {}) {
  const out = []
  let runs = null
  let list = null
  const st = { b: 0, i: 0, href: '' }
  const finish = () => {
    if (!runs) return
    // Emoji gone, spaces collapse across runs; no space at the start or end of a line.
    const kept = []
    for (const r of runs) {
      if (r.text === '\n') { if (kept.length) { kept[kept.length - 1].text = kept[kept.length - 1].text.replace(/ +$/, ''); kept.push(r) } continue }
      let t = printable(r.text).replace(/\s+/g, ' ')
      const prev = kept[kept.length - 1]
      if (!prev || prev.text === '\n' || /\s$/.test(prev.text)) t = t.replace(/^ /, '')
      if (t) kept.push({ ...r, text: t })
    }
    while (kept.length && kept[kept.length - 1].text === '\n') kept.pop()
    if (kept.length) kept[kept.length - 1].text = kept[kept.length - 1].text.replace(/ +$/, '')
    const live = kept.filter((r) => r.text)
    if (live.length) {
      const node = { text: live, ...(size ? { fontSize: size } : {}) }
      if (list) list.push({ ...node, margin: [0, 0, 0, 2] })
      // A paragraph all in bold is a small heading, as in the Google Doc.
      else if (live.every((r) => r.bold || r.text === '\n')) out.push({ ...node, fontSize: (size || 10) + 1.2, color: NAVY, margin: [0, out.length ? 5 : 0, 0, 3] })
      else out.push({ ...node, margin: [0, 0, 0, 6] })
    }
    runs = null
  }
  const re = /<(\/?)([a-z]+)\b([^>]*)>|([^<]+)/gi
  for (const m of String(html || '').matchAll(re)) {
    const [, close, rawTag, attrs, txt] = m
    if (txt !== undefined) {
      const text = decodeEntities(txt)
      if (!runs && !text.trim()) continue
      runs ||= []
      const r = { text }
      if (st.b > 0) r.bold = true
      if (st.i > 0) r.italics = true
      if (st.href) { r.link = st.href; r.color = link; r.decoration = 'underline' }
      runs.push(r)
      continue
    }
    const tag = rawTag.toLowerCase()
    if (tag === 'b' || tag === 'strong') st.b = Math.max(0, st.b + (close ? -1 : 1))
    else if (tag === 'i' || tag === 'em') st.i = Math.max(0, st.i + (close ? -1 : 1))
    else if (tag === 'a') st.href = close ? '' : decodeEntities((attrs.match(/href\s*=\s*"([^"]*)"/i) || [])[1] || '')
    else if (tag === 'br') { runs ||= []; runs.push({ text: '\n' }) }
    else if (tag === 'p' || tag === 'div' || tag === 'li') finish()
    else if (tag === 'ul' || tag === 'ol') {
      finish()
      if (!close) list = []
      else { if (list?.length) out.push({ ul: list, markerColor: marker, margin: [4, 0, 0, 6] }); list = null }
    }
  }
  finish()
  if (list?.length) out.push({ ul: list, markerColor: marker, margin: [4, 0, 0, 6] })
  // The last block of a body has no space under it; the part's own spacing takes over.
  if (out.length) out[out.length - 1] = { ...out[out.length - 1], margin: [...out[out.length - 1].margin.slice(0, 3), 0] }
  return out
}

/** About how many characters a body has, for deciding what can stay on one page. */
const lengthOf = (html) => clean(String(html || '').replace(/<[^>]+>/g, ' ')).length

// ---------------------------------------------------------------- pictures

/** Width and height of a JPEG or PNG data URL, read from its first bytes. */
function dataUrlSize(url) {
  const m = /^data:image\/(png|jpe?g);base64,/i.exec(String(url || ''))
  if (!m || typeof atob !== 'function') return null
  let bin
  try {
    const b64 = url.slice(m[0].length, m[0].length + 65536)
    bin = atob(b64.slice(0, b64.length - (b64.length % 4)))
  } catch {
    return null
  }
  const at = (i) => bin.charCodeAt(i)
  if (m[1].toLowerCase() === 'png') return bin.length > 24 ? { w: ((at(16) << 24) | (at(17) << 16) | (at(18) << 8) | at(19)) >>> 0, h: ((at(20) << 24) | (at(21) << 16) | (at(22) << 8) | at(23)) >>> 0 } : null
  let i = 2
  while (i + 9 < bin.length) {
    if (at(i) !== 0xff) { i++; continue }
    const mk = at(i + 1)
    if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) return { h: (at(i + 5) << 8) | at(i + 6), w: (at(i + 7) << 8) | at(i + 8) }
    if (mk === 0xd8 || mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7)) { i += 2; continue }
    i += 2 + ((at(i + 2) << 8) | at(i + 3))
  }
  return null
}

/** Every photo address a payload holds (cover, parts, quote, teachers), for pdf.js to load. */
export function payloadPhotoSrcs(payload) {
  const out = new Set()
  const add = (p) => { const s = typeof p === 'string' ? p : p?.src || p?.small; if (s) out.add(s) }
  add(payload?.cover)
  for (const part of payload?.parts || []) {
    ;(part.photos || []).forEach(add)
    add(part.photo)
    add(part.teacher?.photo)
  }
  return [...out]
}

/** Every icon a payload's PDF draws (lucide names). */
export function payloadIconNames(payload) {
  return [...new Set([...LAYOUT_ICONS, ...(payload?.parts || []).map((p) => p.icon).filter(Boolean)])]
}

/** "the-palm-river-post-2026-27-q1-week-10-en.pdf" / "early-years-2026-27-q1-week-10-vi.pdf". */
export function newsletterPdfName(payload, lang) {
  const ed = EDITIONS[payload?.edition] || EDITIONS.post
  const base = String(payload?.slug || 'newsletter').replace(ed.slugSuffix ? new RegExp(`${ed.slugSuffix}$`) : /$^/, '')
  const name = ed.id === 'ey' ? 'early-years' : String(ed.name.en).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${name}-${base}-${lang === 'vi' ? 'vi' : 'en'}.pdf`
}

// ---------------------------------------------------------------- the layout

/**
 * The PDF of one issue in one language.
 * @param {object} payload  the families payload (README.md)
 * @param {'en'|'vi'} lang
 * @param {object} opts
 * @param {Object<string, string|{data:string,w:number,h:number}>} [opts.images]  photo src (and 'logo') -> JPEG/PNG data URL
 * @param {Object<string, string>} [opts.icons]  lucide name -> SVG markup
 * @param {object|null} [opts.fonts]  the font table registered with pdfmake (PDF_FONTS); without it, pdfmake's Roboto
 * @returns {object} a pdfmake document definition
 */
export function newsletterPdfDefinition(payload, lang = 'en', { images = {}, icons = {}, fonts = null } = {}) {
  const L = lang === 'vi' ? 'vi' : 'en'
  const w = (key, vars) => (MORE_WORDS[L][key] !== undefined ? MORE_WORDS[L][key] : word(L, key, vars))
  const F = fonts?.BeVietnamPro && fonts?.BeVietnamProStrong
    ? { body: 'BeVietnamPro', strong: 'BeVietnamProStrong' }
    : { body: 'Roboto', strong: 'Roboto' }
  const ed = EDITIONS[payload.edition] || EDITIONS.post
  const tone = TONES[payload.tone] || TONES[ed.tone] || TONES.blue
  const green = TONES.green

  /** A field in this language (falling back to English): { text, english }. */
  const tx = (obj) => { const p = pick(obj, L); return { text: p.text || '', english: p.english } }
  const plainOf = (obj) => clean(tx(obj).text)
  /** A small "English" tag after a heading, when the Vietnamese is not written yet. */
  const enTag = (on) => (on && L === 'vi' ? [{ text: `   ${upper(word('vi', 'english')).replace(/ /g, '\u00A0')}`, fontSize: 6.5, bold: true, color: INK_SOFT, characterSpacing: 0.6 }] : [])

  // Pictures: each src gets one key, so a photo used twice is stored once.
  const defImages = {}
  const keys = new Map()
  const img = (src) => {
    if (!src) return null
    const v = images[src]
    if (!v) return null
    const data = typeof v === 'string' ? v : v.data || v.url
    if (!data) return null
    if (!keys.has(src)) {
      const key = src === 'logo' ? 'logo' : `img${keys.size}`
      const size = (typeof v === 'object' && v.w && v.h) ? { w: v.w, h: v.h } : dataUrlSize(data)
      keys.set(src, { key, size })
      defImages[key] = data
    }
    return keys.get(src)
  }
  /** A payload Photo's picture, with its shape: { key, ratio } (height / width). */
  const photoOf = (p) => {
    const src = p?.src || p?.small
    const got = img(src)
    if (!got) return null
    const size = got.size || (p.w && p.h ? { w: p.w, h: p.h } : null)
    return { key: got.key, ratio: size && size.w ? size.h / size.w : 0.75, photo: p }
  }
  /** Where a crop keeps its focus ('50% 30%' -> centre, top). */
  const align = (focus) => {
    const [x, y] = String(focus || '').split(/\s+/).map((v) => parseFloat(v))
    const a = (v, lo, mid, hi) => (Number.isFinite(v) ? (v <= 33 ? lo : v >= 67 ? hi : mid) : mid)
    return { align: a(x, 'left', 'center', 'right'), valign: a(y, 'top', 'center', 'bottom') }
  }

  /** Four corner pieces in the background colour, which round off a rectangle drawn under them. */
  const corners = (width, height, r, color, which = 'all') => {
    const o = 0.8
    // One corner: the square corner, just outside the arc's start, the arc, just outside its end.
    const piece = (cx, cy, a0, cornerX, cornerY) => {
      const arc = Array.from({ length: 9 }, (_, i) => {
        const a = ((a0 + (90 * i) / 8) * Math.PI) / 180
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
      })
      const past = (pt) => ({ x: pt.x + Math.sign(Math.round(pt.x - cx)) * o, y: pt.y + Math.sign(Math.round(pt.y - cy)) * o })
      return { type: 'polyline', closePath: true, color, lineWidth: 0, points: [{ x: cornerX, y: cornerY }, past(arc[0]), ...arc, past(arc[8])] }
    }
    const top = [piece(r, r, 180, -o, -o), piece(width - r, r, 270, width + o, -o)]
    const bottom = [piece(width - r, height - r, 0, width + o, height + o), piece(r, height - r, 90, -o, height + o)]
    return which === 'top' ? top : which === 'bottom' ? bottom : [...top, ...bottom]
  }

  /** A photo cropped to width x height, with rounded corners, on `bg`. */
  const picture = (ph, width, height, { bg = '#FFFFFF', r = 5 } = {}) => ({
    stack: [
      { image: ph.key, cover: { width, height, ...align(ph.photo?.focus) } },
      { canvas: corners(width, height, r, bg), relativePosition: { x: 0, y: -height } },
    ],
    width,
    unbreakable: true,
  })
  const caption = (ph) => {
    const c = clean(tx(ph.photo?.alt).text)
    return c ? { text: c, fontSize: 7.6, lineHeight: 1.05, color: INK_SOFT, margin: [0, 4, 0, 0] } : null
  }
  const figure = (ph, width, height, opts) => ({ stack: [picture(ph, width, height, opts), caption(ph)].filter(Boolean), width, unbreakable: true })

  /** Photos in rows of equal 4:3 frames, each row kept on one page. */
  const photoRows = (list, { cols, bg, margin = [0, 10, 0, 0] } = {}) => {
    const ps = list.map(photoOf).filter(Boolean)
    if (!ps.length) return []
    const n = Math.min(cols || (ps.length <= 3 ? ps.length : ps.length === 4 ? 2 : ps.length <= 6 ? 3 : 4), ps.length)
    const cw = (W - GAP * (n - 1)) / n
    const ch = Math.round(cw * (n === 1 ? Math.min(0.62, ps[0].ratio) : 0.75))
    const rows = []
    for (let i = 0; i < ps.length; i += n) {
      const row = ps.slice(i, i + n).map((ph) => figure(ph, cw, ch, { bg }))
      while (row.length < n) row.push({ text: '', width: cw })
      rows.push({ columns: row, columnGap: GAP, margin: i ? [0, 8, 0, 0] : margin, unbreakable: true })
    }
    return rows
  }

  /** A lucide icon, recoloured; on a round badge when `bg` is given. */
  const iconSvg = (name, stroke, bg) => {
    const raw = icons[name] || icons['book-open']
    const inner = raw && (String(raw).match(/<svg[^>]*>([\s\S]*)<\/svg>/) || [])[1]
    if (!inner) return null
    const body = inner.replace(/currentColor/g, stroke)
    const g = bg
      ? `<circle cx="12" cy="12" r="12" fill="${bg}"/><g transform="translate(5.6 5.6) scale(0.5333)" fill="none" stroke="${stroke}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
      : `<g fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${g}</svg>`
  }
  const badge = (name, t, size = 22, bg) => {
    const svg = iconSvg(name, t.main, bg || t.pale)
    return svg ? { svg, width: size, height: size } : null
  }

  /** A part's heading, with its icon on a round badge. */
  const heading = (text, { icon, t = tone, english = false, size = 14.5 } = {}) => {
    const words = { text: [{ text: clean(text) }, ...enTag(english)], font: F.strong, bold: true, fontSize: size, lineHeight: 1.05, color: NAVY }
    const b = icon ? badge(icon, t, 22) : null
    if (!b) return { ...words, margin: [0, 0, 0, 4] }
    return { columns: [{ ...b, width: 22 }, { ...words, width: '*', margin: [0, 2, 0, 0] }], columnGap: 9, margin: [0, 0, 0, 4] }
  }
  /** Small spaced capitals, for labels. */
  const label = (text, color, extra = {}) => ({ text: upper(text), font: F.strong, bold: true, fontSize: 7.4, characterSpacing: 1.1, color, ...extra })

  /** A tinted box with rounded corners. `width` is its full width (for the corners). */
  const box = (content, { fill, width = W, padX = 14, padY = 12, r = 8, bg = '#FFFFFF', margin = [0, 0, 0, 0], keep = false } = {}) => ({
    table: {
      widths: [width - 2 * padX],
      dontBreakRows: keep,
      body: [[{
        fillColor: fill,
        stack: [
          { canvas: corners(width, 0, r, bg, 'top'), relativePosition: { x: -padX, y: -padY } },
          ...content,
          { canvas: corners(width, 0, r, bg, 'bottom'), relativePosition: { x: -padX, y: padY } },
        ],
      }]],
    },
    layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => padX, paddingRight: () => padX, paddingTop: () => padY, paddingBottom: () => padY },
    margin,
    ...(keep ? { unbreakable: true } : {}),
  })

  /** Text with a photo beside it (one photo), or under it (two or more). */
  const textWithPhotos = (blocks, photos, { bg = '#FFFFFF', photoShare = 0.38, cols } = {}) => {
    const ps = (photos || []).map(photoOf).filter(Boolean)
    if (ps.length === 1) {
      const pw = Math.round(W * photoShare)
      const ph = Math.round(Math.max(110, Math.min(250, pw * ps[0].ratio)))
      return [{ columns: [{ width: '*', stack: blocks.length ? blocks : [{ text: '' }] }, figure(ps[0], pw, ph, { bg })], columnGap: 18 }]
    }
    return [...blocks, ...photoRows(photos, { bg, cols })]
  }

  /** An arrow (Be Vietnam Pro has no "→"), drawn from the lucide icon. */
  const arrow = (color, size = 9, margin = [0, 1.6, 0, 0]) => {
    const svg = iconSvg('arrow-right', color)
    return svg ? { svg, width: size, height: size, margin } : { text: '›', color, bold: true, width: 'auto' }
  }
  /** A web address as it reads in print: host and short path, no "https://"; just the host when the path is long. */
  const shortUrl = (url) => {
    const s = String(url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/$/, '')
    return s.length > 34 ? s.replace(/\/.*$/, '') : s
  }
  /** A part's button: "Add it to your calendar  ›  calendar.google.com", one clickable line. */
  const buttonLine = (button, t) => {
    if (!button?.url) return null
    const shown = shortUrl(button.url)
    return {
      text: [
        { text: clean(tx(button.label).text) || shown, font: F.strong, bold: true, color: t.ink },
        { text: '  \u203A  ', font: F.strong, bold: true, fontSize: 12, color: t.main },
        { text: shown, fontSize: 9, color: INK_SOFT, decoration: 'underline', decorationColor: '#B8C4D4' },
      ],
      link: button.url,
      fontSize: 9.8,
      margin: [0, 8, 0, 0],
    }
  }

  /**
   * Keep a part on one page only when it is small; otherwise keep its heading with its
   * first lines and let the rest run on (each row of photos still stays whole). Keeping
   * bigger parts whole pushed them to the next page and left half a page empty.
   */
  const keepTogether = (head, blocks, estimate) => {
    if (estimate < 170) return [{ stack: [...head, ...blocks], unbreakable: true }]
    const [first, ...rest] = blocks
    return [{ stack: [...head, ...(first ? [first] : [])], unbreakable: true }, ...rest]
  }
  const estimateText = (chars, width = W, size = 10) => Math.ceil((chars * size * 0.52) / width) * size * 1.5

  // ------------------------------------------------------------ page 1: nameplate

  const content = []
  const logo = img('logo')
  const name = clean(tx(payload.edition_name).text) || ed.name[L]
  const big = ed.id === 'ey' && name.includes('Early Years') ? 'Early Years' : null
  const pre = big ? name.slice(0, name.indexOf(big)).trim() : ''
  const post = big ? name.slice(name.indexOf(big) + big.length).trim() : ''
  const issueLine = [clean(tx(payload.label).text), clean(tx(payload.day).text)].filter(Boolean).join('  ·  ')

  content.push({
    stack: [
      logo ? { image: logo.key, height: 34, width: logo.size ? (34 * logo.size.w) / logo.size.h : 84 } : { text: 'PALM RIVER ACADEMY', font: F.strong, bold: true, fontSize: 13, color: NAVY, characterSpacing: 1.5 },
      {
        text: [
          ...(pre ? [{ text: `${pre} `, fontSize: 17, font: F.strong, bold: false, color: tone.ink }] : []),
          { text: big || name, fontSize: 31, characterSpacing: -0.6 },
          ...(post ? [{ text: `  ${post}`, fontSize: 17, font: F.strong, bold: false, color: tone.ink, characterSpacing: 0 }] : []),
        ],
        font: F.strong,
        bold: true,
        color: NAVY,
        lineHeight: 1,
        margin: [0, 16, 0, 0],
      },
      { text: upper(issueLine), font: F.strong, bold: true, fontSize: 8.4, characterSpacing: 1.5, color: green.ink, margin: [0, 7, 0, 0] },
      {
        canvas: [
          { type: 'line', x1: 0, y1: 0.5, x2: W, y2: 0.5, lineWidth: 0.8, lineColor: tone.edge },
          { type: 'rect', x: 0, y: -0.9, w: 64, h: 3.6, color: tone.main },
        ],
        margin: [0, 10, 0, 0],
      },
    ],
  })

  // Cover photo, full width, cropped to fit. pdf.js may pass it already cropped
  // round its focus point as images.cover (pdfmake can only crop to a side or the middle).
  const cropped = payload.cover && img('cover')
  const cover = cropped ? { key: cropped.key, ratio: cropped.size ? cropped.size.h / cropped.size.w : 0.44, photo: { alt: payload.cover.alt } } : photoOf(payload.cover)
  if (cover) {
    const ch = Math.round(Math.min(COVER_FRAME.maxHeight, W * cover.ratio))
    content.push({ ...figure(cover, W, ch, { r: 8 }), margin: [0, 16, 0, 0] })
  }

  // Opening.
  const lead = tx(payload.opening?.lead)
  const openBody = tx(payload.opening?.body)
  const openBlocks = htmlBlocks(openBody.text, { link: tone.ink, marker: tone.main, size: 10.8 })
  if (clean(lead.text) || openBlocks.length) {
    content.push({
      stack: [
        ...(clean(lead.text) ? [{ text: [{ text: clean(lead.text) }, ...enTag(lead.english)], font: F.strong, bold: true, fontSize: 15.5, lineHeight: 1.08, color: NAVY, margin: [0, 0, 0, 6] }] : []),
        ...openBlocks,
      ],
      margin: [0, cover ? 16 : 18, 0, 0],
    })
  }

  // ------------------------------------------------------------ need to know

  const dates = payload.need?.dates || []
  const reminders = (payload.need?.reminders || []).filter((r) => plainOf(r))
  if (dates.length || reminders.length) {
    const tagWord = (tag) => {
      if (tag === 'off') return { text: upper(word(L, 'off')), color: TONES.coral.ink }
      if (tag === 'fees') return { text: upper(word(L, 'fees')), color: TONES.sun.ink }
      if (tag === 'event') return { text: upper(w('event')), color: TONES.violet.ink }
      return null
    }
    const remChars = reminders.reduce((n, r) => n + plainOf(r).length, 0)
    const side = dates.length && reminders.length && dates.length <= 6 && remChars <= 420
    const innerW = W - 28
    const datesW = side ? Math.round(innerW * 0.57) : innerW
    // The date column fits the longest date (about 5 pt a character at this size), within limits.
    const longest = Math.max(...dates.map((d) => clean(tx(d.date).text).length), 8)
    const dateCol = Math.round(Math.min(side ? 112 : 150, Math.max(70, longest * 5.05)))
    const dateRows = dates.map((d, i) => {
      const tag = tagWord(d.tag)
      return [
        {
          stack: [
            { text: clean(tx(d.date).text), font: F.strong, bold: true, fontSize: 9.3, color: tone.ink, lineHeight: 1.05 },
            ...(d.time ? [{ text: clean(tx(d.time).text), fontSize: 8.3, color: INK_SOFT, margin: [0, 1, 0, 0] }] : []),
          ],
          margin: [0, i ? 5 : 0, 0, 5],
        },
        {
          stack: [
            { text: clean(tx(d.what).text), fontSize: 9.6, color: INK, lineHeight: 1.08 },
            ...(tag ? [{ text: tag.text, font: F.strong, bold: true, fontSize: 6.6, characterSpacing: 0.8, color: tag.color, margin: [0, 1.5, 0, 0] }] : []),
          ],
          margin: [0, i ? 5 : 0, 0, 5],
        },
      ]
    })
    const datesBlock = dates.length ? [
      { text: word(L, 'dates'), font: F.strong, bold: true, fontSize: 10.5, color: NAVY, margin: [0, 0, 0, 6] },
      {
        table: { widths: [dateCol, '*'], body: dateRows },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 0 : 0.6),
          vLineWidth: () => 0,
          hLineColor: () => tone.edge,
          paddingLeft: (i) => (i ? 8 : 0), paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
        },
      },
    ] : []
    const remBlock = reminders.length ? [
      { text: word(L, 'reminders'), font: F.strong, bold: true, fontSize: 10.5, color: NAVY, margin: [0, 0, 0, 6] },
      ...reminders.map((r, i) => {
        const tick = iconSvg('check', green.main)
        return {
          columns: [
            tick ? { svg: tick, width: 10, height: 10, margin: [0, 1.5, 0, 0] } : { text: '•', width: 10, color: green.main },
            { text: clean(tx(r).text), fontSize: 9.6, color: INK, lineHeight: 1.08, width: '*' },
          ],
          columnGap: 6,
          margin: [0, i ? 6 : 0, 0, 0],
        }
      }),
    ] : []
    const inner = side
      ? [{ columns: [{ width: datesW, stack: datesBlock }, { width: '*', stack: remBlock }], columnGap: 20 }]
      : [...datesBlock, ...(datesBlock.length && remBlock.length ? [{ text: '', margin: [0, 6, 0, 0] }] : []), ...remBlock]
    content.push(box([label(word(L, 'needToKnow'), tone.ink, { margin: [0, 0, 0, 8] }), ...inner], {
      fill: tone.pale, padX: 14, padY: 13, margin: [0, 16, 0, 0], keep: dates.length + reminders.length <= 10,
    }))
  }

  // ------------------------------------------------------------ parts

  const parts = payload.parts || []
  let closingDone = false
  const qrUrl = `${payload.url?.[L] || payload.url?.en || ''}?from=pdf`
  const qrBlock = () => (payload.url?.[L] || payload.url?.en ? {
    width: 92,
    stack: [
      { qr: qrUrl, fit: 74, foreground: NAVY, eccLevel: 'M', alignment: 'right' },
      { text: w('readOnline'), fontSize: 7.4, bold: true, color: tone.ink, alignment: 'right', margin: [0, 3, 0, 0] },
    ],
  } : null)

  for (const p of parts) {
    const t = TONES[p.tone] || tone
    const block = []

    if (p.type === 'story') {
      const h = tx(p.heading), b = tx(p.body)
      const blocks = htmlBlocks(b.text, { link: t.ink, marker: t.main })
      const btn = buttonLine(p.button, t)
      const head = [heading(h.text, { icon: p.icon || 'book-open', t, english: h.english || b.english })]
      const when = clean(tx(p.when).text)
      if (when) head.push({ text: when, font: F.strong, bold: true, fontSize: 9.4, color: green.ink, margin: [31, -1, 0, 6] })
      else head[0] = { ...head[0], margin: [0, 0, 0, 7] }
      const nPhotos = (p.photos || []).filter((x) => photoOf(x)).length
      const est = 40 + estimateText(lengthOf(b.text), nPhotos === 1 ? W * 0.6 : W) + (nPhotos > 1 ? 150 : 0)
      const body = textWithPhotos([...blocks, ...(btn ? [btn] : [])], p.photos)
      block.push(...keepTogether(head, body, nPhotos === 1 ? Math.max(est, 260) : est))
    } else if (p.type === 'class') {
      const b = tx(p.body)
      const teacher = p.teacher?.name ? clean(p.teacher.name) : ''
      const portrait = p.teacher?.photo ? photoOf({ src: p.teacher.photo }) : null
      const size = 34
      const face = portrait
        ? {
          width: size,
          stack: [
            { image: portrait.key, cover: { width: size, height: size, align: 'center', valign: 'top' } },
            { canvas: [...corners(size, size, size / 2, t.pale), { type: 'ellipse', x: size / 2, y: size / 2, r1: size / 2 - 0.6, r2: size / 2 - 0.6, lineWidth: 1.4, lineColor: '#FFFFFF' }], relativePosition: { x: 0, y: -size } },
          ],
        }
        : { ...badge('users', t, size, '#FFFFFF'), width: size }
      const band = box([{
        columns: [
          face,
          {
            width: '*',
            stack: [
              { text: [{ text: clean(p.class) }, ...enTag(b.english)], font: F.strong, bold: true, fontSize: 14.5, lineHeight: 1, color: t.ink },
              ...(teacher ? [{ text: word(L, 'fromTeacher', { name: teacher }), fontSize: 9, color: INK_SOFT, margin: [0, 2, 0, 0] }] : []),
            ],
            margin: [0, teacher ? 2 : 9, 0, 0],
          },
        ],
        columnGap: 10,
      }], { fill: t.pale, padX: 10, padY: 8, r: 9, margin: [0, 0, 0, 10] })
      const blocks = htmlBlocks(b.text, { link: t.ink, marker: t.main })
      const body = textWithPhotos(blocks, p.photos, { cols: 4 })

      // Words of the week (chips) and "Ask your child", side by side when both are there.
      const words = (p.words || []).filter((x) => clean(x.en))
      const ask = p.ask && plainOf(p.ask) ? tx(p.ask) : null
      const extra = []
      const chipGap = 6
      const chips = (areaW, perRow) => {
        const cw = (areaW - chipGap * (perRow - 1)) / perRow
        const rows = []
        for (let i = 0; i < words.length; i += perRow) {
          const row = words.slice(i, i + perRow).map((x) => ({
            width: cw,
            ...box([
              { text: clean(x.en), font: F.strong, bold: true, fontSize: 9.8, color: t.ink, alignment: 'center', lineHeight: 1.02 },
              ...(clean(x.vi) ? [{ text: clean(x.vi), fontSize: 7.8, color: INK_SOFT, alignment: 'center', margin: [0, 1, 0, 0] }] : []),
            ], { fill: t.pale, width: cw, padX: 6, padY: 6, r: 6 }),
          }))
          while (row.length < perRow) row.push({ width: cw, text: '' })
          rows.push({ columns: row, columnGap: chipGap, margin: [0, i ? chipGap : 0, 0, 0] })
        }
        return rows
      }
      const askBox = (areaW) => box([{
        columns: [
          { ...(badge('message-circle-question', t, 20, '#FFFFFF') || { text: '' }), width: 20 },
          {
            width: '*',
            stack: [
              label(word(L, 'askYourChild'), t.ink, { margin: [0, 0, 0, 3] }),
              { text: clean(ask.text), font: F.strong, fontSize: 10.6, lineHeight: 1.08, color: NAVY },
            ],
          },
        ],
        columnGap: 9,
      }], { fill: t.pale, width: areaW, padX: 11, padY: 10, r: 8 })
      const wordsLabel = label(word(L, 'wordsOfWeek'), t.ink, { margin: [0, 0, 0, 5] })
      if (words.length && ask) {
        const lw = Math.round(W * 0.56)
        extra.push({
          columns: [
            { width: lw, stack: [wordsLabel, ...chips(lw, words.length <= 2 ? words.length : words.length <= 4 ? 2 : 3)] },
            { width: '*', stack: [{ text: ' ', fontSize: 7.4, margin: [0, 0, 0, 5] }, askBox(W - lw - 14)] },
          ],
          columnGap: 14,
          margin: [0, 12, 0, 0],
          unbreakable: true,
        })
      } else if (words.length) {
        extra.push({ stack: [wordsLabel, ...chips(W, 4)], margin: [0, 12, 0, 0], unbreakable: true })
      } else if (ask) {
        extra.push({ ...askBox(W), margin: [0, 12, 0, 0], unbreakable: true })
      }
      const nPhotos = (p.photos || []).filter((x) => photoOf(x)).length
      const est = 70 + estimateText(lengthOf(b.text), nPhotos === 1 ? W * 0.6 : W) + (nPhotos > 1 ? 130 : 0) + (extra.length ? 90 : 0)
      block.push(...keepTogether([band], [...body, ...extra], nPhotos === 1 ? Math.max(est, 300) : est))
    } else if (p.type === 'photos') {
      const h = tx(p.heading)
      const rows = photoRows(p.photos, { margin: [0, 4, 0, 0] })
      if (!rows.length) continue
      const head = heading(h.text, { icon: p.icon || 'images', t, english: h.english })
      block.push({ stack: [head, rows[0]], unbreakable: true }, ...rows.slice(1))
    } else if (p.type === 'quote') {
      const q = tx(p.text)
      const who = clean(tx(p.who).text)
      const ph = photoOf(p.photo)
      const words = {
        width: '*',
        stack: [
          { text: [{ text: clean(q.text) }, ...enTag(q.english)], font: F.body, italics: true, fontSize: 13, lineHeight: 1.18, color: NAVY },
          ...(who ? [{ text: `— ${who}`, font: F.strong, bold: true, fontSize: 9.6, color: green.ink, margin: [0, 6, 0, 0] }] : []),
        ],
        margin: [0, 8, 0, 0],
      }
      block.push({
        columns: [
          { text: '“', font: F.strong, bold: true, fontSize: 64, lineHeight: 0.62, color: green.main, width: 40, margin: [0, 2, 0, 0] },
          words,
          ...(ph ? [{ ...picture(ph, 104, 104, { r: 52 }), width: 104 }] : []),
        ],
        columnGap: 10,
        unbreakable: true,
      })
    } else if (p.type === 'press') {
      const v = TONES.violet
      const blurb = clean(tx(p.blurb).text)
      const shown = String(p.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')
      block.push(box([{
        columns: [
          { ...(badge('pen-line', v, 26, '#FFFFFF') || { text: '' }), width: 26 },
          {
            width: '*',
            stack: [
              label(word(L, 'pressFrom'), v.ink, { margin: [0, 0, 0, 3] }),
              { text: clean(p.title), font: F.strong, bold: true, fontSize: 12.5, lineHeight: 1.05, color: NAVY, link: p.url },
              ...(p.author ? [{ text: word(L, 'by', { name: clean(p.author) }), fontSize: 8.8, color: INK_SOFT, margin: [0, 2, 0, 0] }] : []),
              ...(blurb ? [{ text: blurb, fontSize: 9.8, color: INK, margin: [0, 5, 0, 0] }] : []),
              { columns: [{ ...arrow(v.main, 8.5, [0, 1.4, 0, 0]), width: 8.5 }, { text: shown, decoration: 'underline', fontSize: 8.8, color: v.ink, link: p.url, width: '*' }], columnGap: 5, margin: [0, 6, 0, 0] },
            ],
          },
        ],
        columnGap: 11,
      }], { fill: v.pale, padX: 14, padY: 12, keep: true }))
    } else if (p.type === 'welcome') {
      const s = TONES.sun
      const h = tx(p.heading), b = tx(p.body)
      const names = (p.names || []).filter((x) => clean(x?.name))
      const nameRuns = names.flatMap((x, i) => [
        ...(i ? [{ text: ',  ' }] : []),
        { text: clean(x.name), bold: true, color: NAVY },
        ...(clean(x.class) ? [{ text: ` (${clean(x.class)})`, color: INK_SOFT }] : []),
      ])
      block.push(box([{
        columns: [
          { ...(badge('hand-heart', s, 26, '#FFFFFF') || { text: '' }), width: 26 },
          {
            width: '*',
            stack: [
              { text: [{ text: clean(h.text) || word(L, 'welcome') }, ...enTag(h.english || b.english)], font: F.strong, bold: true, fontSize: 12.5, color: NAVY, margin: [0, 3, 0, 4] },
              ...htmlBlocks(b.text, { link: s.ink, marker: s.main, size: 9.8 }),
              ...(nameRuns.length ? [{ text: nameRuns, fontSize: 10, margin: [0, 5, 0, 0] }] : []),
            ],
          },
        ],
        columnGap: 11,
      }], { fill: s.pale, padX: 14, padY: 12, keep: true }))
    } else if (p.type === 'closing') {
      const b = tx(p.body)
      const qr = qrBlock()
      closingDone = true
      block.push({
        columns: [
          {
            width: '*',
            stack: [
              ...htmlBlocks(b.text, { link: tone.ink, marker: tone.main, size: 10.4 }),
              { text: word(L, 'signoff'), fontSize: 10.4, color: INK, margin: [0, 10, 0, 0] },
              { text: word(L, 'from'), font: F.strong, bold: true, fontSize: 10.4, color: NAVY },
            ],
          },
          ...(qr ? [qr] : []),
        ],
        columnGap: 24,
        unbreakable: true,
      })
    }

    if (block.length) content.push({ stack: block, margin: [0, PART_GAP, 0, 0] })
  }

  // No closing part: the sign-off and the QR code still end the PDF.
  if (!closingDone) {
    const qr = qrBlock()
    content.push({
      columns: [
        { width: '*', stack: [{ text: word(L, 'signoff'), fontSize: 10.4, color: INK }, { text: word(L, 'from'), font: F.strong, bold: true, fontSize: 10.4, color: NAVY }], margin: [0, 30, 0, 0] },
        ...(qr ? [qr] : []),
      ],
      columnGap: 24,
      margin: [0, PART_GAP, 0, 0],
      unbreakable: true,
    })
  }

  const frond = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="${FROND}" fill="${green.main}" fill-opacity="0.17"/></svg>`
  const title = `${name} · ${clean(tx(payload.label).text)}`

  return {
    pageSize: 'A4',
    pageMargins: [ML, MT, MR, MB],
    info: { title, author: 'Palm River Academy', subject: clean(tx(payload.day).text), creator: 'The Current', producer: 'The Current' },
    language: L === 'vi' ? 'vi-VN' : 'en-GB',
    images: defImages,
    // No ligatures: pdfkit's "fi" ligature copies out of the PDF as "f" (search and copy-paste break).
    defaultStyle: { font: F.body, fontSize: 10.2, lineHeight: 1.16, color: INK, fontFeatures: { liga: false, clig: false } },
    background: (page) => (page === 1 ? { svg: frond, width: 178, height: 178, absolutePosition: { x: PAGE_W - MR - 150, y: 6 } } : null),
    header: (page) => (page === 1 ? null : {
      margin: [ML, 24, MR, 0],
      stack: [
        {
          columns: [
            { text: [{ text: name, font: F.strong, bold: true, color: NAVY }, { text: `   ${clean(tx(payload.label).text)}`, color: INK_SOFT }], fontSize: 8 },
            { text: clean(tx(payload.day).text), fontSize: 8, color: INK_SOFT, alignment: 'right', width: 'auto' },
          ],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: W, y2: 5, lineWidth: 0.6, lineColor: LINE }] },
      ],
    }),
    footer: (page, pages) => ({
      margin: [ML, 16, MR, 0],
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: W, y2: 0, lineWidth: 0.6, lineColor: LINE }] },
        {
          columns: [
            { text: FOOT, fontSize: 7.2, color: INK_SOFT, width: '*' },
            { text: word(L, 'page', { n: page, total: pages }), fontSize: 7.2, color: INK_SOFT, alignment: 'right', width: 'auto' },
          ],
          columnGap: 12,
          margin: [0, 7, 0, 0],
        },
      ],
    }),
    content,
  }
}
