// Layout of the Learning Progress Report as a pdfmake document: one A4 page
// per report, in English or in Vietnamese. Top to bottom: the masthead (logo,
// title, period, programme and date over a blue-to-green rule), the level key
// as five tiles in the levels' colours, the student (photo, name, nickname,
// year group) beside the homeroom comment, academic rows (the subject's icon,
// then its name, teacher and level on the left; course description above the individual
// comment), review scores and learner skills, specialist cards (individual
// comments), vocational cards (course descriptions, or a comment where the
// area takes one), a slim signature row and the footer (motto and legal line).
// Each section is a pale panel in its own colour under a solid title band, with
// no outline; rows inside it are parted by hairlines.
//
// Text is measured with pdfmake itself before it is placed. All comments share
// one text size: the largest at which every comment fits once the page height
// is shared out between the sections (a section with more to say gets a little
// more room). Course descriptions are set in their own smaller style. Only if
// the smallest size still does not fit is text cut short, and that is reported
// so the editor can say which box is too full. No browser APIs here:
// `reportPdf.js` loads pdfmake, the fonts, the logo, photos and icons.
//
// Names, titles and headings are set in Be Vietnam Pro (the newsletter's face,
// public/fonts), comments and descriptions in Roboto; if Be Vietnam Pro does not
// load, Roboto stands in.
//
// Measured 24 September 2026 with real English and Vietnamese text at every
// TEXT_LIMITS length, for Nursery, Years 1, 3, 4, 7 and 8 and two partial-day
// pages: nothing cut, comments at 8pt (Years 1 to 7) or the usual 8.25pt
// (Nursery, Year 8, partial day), and 8.25pt everywhere with boxes 85% full.
// Measured again 2 October 2026, when Year 1 gained Master Minds (four
// specialist cards, so the level pill moves to the teacher's line): Year 1 at
// every limit 7.75pt in both languages, nothing cut, and 8.25pt with boxes 85%
// full. Every other year group's page came out exactly as before.
// Measured 19 October 2026, when Early Years gained Cooking (two specialist
// comments of 600) and Physical Development took a comment of 600 in the
// vocational band, beside Expressive Arts & Design's description (cards 3:2):
// Nursery and Kindergarten at every limit 8pt in both languages, nothing cut,
// and 8.25pt with boxes 85% full; Year 1 (7.75pt) and Year 7 (8pt) unchanged.
// Measured 22 October 2026, when Movement moved from the specialist cards to
// the vocational ones with its fixed description (about 370 characters; four
// vocational cards in Years 2 to 7): every year group from Nursery to Year 8,
// at every limit and at 85%, in both languages, came out at exactly the
// comment size it had before, nothing cut, Movement's text at the usual 7.2pt.
// Checked again that evening with the eight real Year 1 Q1 reports, after the
// student's name block changed (nickname left out when it is part of the name,
// long names broken before the first name) and text boxes were tidied: every
// page had the same line count as the downloaded copy, nothing cut. Movement's
// description was then cut to 246 characters (under "Topics covered:" like the
// others) and Mr. Chiến named on its card: Year 1 at every limit rose from 7.75pt
// to 8pt (Vietnamese from 7.5pt), Years 3, 6 and 7 unchanged, nothing cut.
// Redesigned 23 October 2026 (Bowen: bolder, more polished, keep the colour):
// the masthead, key tiles, larger name, panels instead of outlined frames and
// subject tiles above. Measured against the layout before it with the same text
// (Nursery, Kindergarten, Years 1, 2, 3, 5 and 7, every box at its limit and at
// 85%, in English and Vietnamese): every page at exactly the size it had,
// nothing cut.

import { levelInfo, subjectByKey, firstName, sectionsByTier, reviewRows, sectionTeacher, reportHomeroom, reportSignatures, templateOf, skillGroupsFor, writingFor, fixedDescription, nameParts, printedTeacher } from './utils'
import { reportStrings, reportTitle, periodLabel, yearGroupLabel, roleLabel, pickText } from './strings'
import { partialFrom } from '../studentRecords'
import { foldName, nicknameInName } from '../names'

// One family of deep, saturated colours, all at a similar depth so no part
// shouts louder than another: brand blue and green, with teal, orange and
// violet between them.
const C = {
  navy: '#15355c', blue: '#1f6fbf', green: '#43922a', ink: '#222d3a', muted: '#5f6b79', line: '#dde4ec', hair: '#e4e9ef',
  empty: '#e5e9ef', emptyText: '#6f7b88', tag: '#9aa5b1', topics: '#4f5a66', faint: '#c3ccd6',
  homeroomFill: '#eef5fc', homeroomInk: '#185a9d',
  photoFill: '#e7f0fa', photoRing: '#b9d3ef', initials: '#5f84ad',
  keyFill: '#f4f7fa', sigLine: '#aebccb',
}

// Each part of the page: accent (title band, subject tiles and icons), deep
// (words), tint (icon badges) and edge (rules), plus the icon in its title band.
// Its panel is the accent mixed almost to white (PANEL).
const THEME = {
  academic: { accent: '#1f6fbf', deep: '#185a9d', tint: '#e7f0fa', edge: '#bcd4ee', icon: 'book' },
  scores: { accent: '#0e858a', deep: '#0b6b6f', tint: '#e0f2f2', edge: '#b0d9da', icon: 'chart' },
  skills: { accent: '#d45f28', deep: '#ab4b19', tint: '#fcebe2', edge: '#f0c4ab', icon: 'sparkles' },
  specialist: { accent: '#7443b9', deep: '#5c339c', tint: '#efe8f9', edge: '#d1c0ee', icon: 'palette' },
  vocational: { accent: '#3f8d29', deep: '#33731f', tint: '#e6f2df', edge: '#bcdaae', icon: 'compass' },
}
const PANEL = 0.935 // how near to white a section's panel is
// The colour icons are stroked in by iconSvgs(); swapped for the colour wanted.
const ICON_INK = '#163a63'
// The heading face, registered by reportPdf.js (Be Vietnam Pro Medium / Bold).
export const HEAD_FONT = 'BeVietnamProStrong'

// Text sizes (pt). Comments start at `body` and may go down to `bodyMin`.
// Course descriptions (the "Topics covered" lines and the vocational cards)
// are set at `topics`, down to `topicsMin`, so course text reads as course
// text and comments about the child stand out.
const F = {
  body: 8.25, bodyMin: 6.75,
  topics: 7.2, topicsMin: 6.8, section: 9.6, sectionSub: 6.8, title: 9, cardTitle: 8.5, teacher: 6.7, pill: 6.6, lead: 6.3,
  skill: 7, score: 8.8, ref: 5.8, head: 6.1, key: 6.1, sig: 9.3, role: 6.1, closing: 7, level: 6.7, levelDesc: 5.9, levelDescMin: 5.4,
  foot: 6.4, name: 15, info: 7.8, docTitle: 15, period: 8.4, hrSign: 7.8,
}

// Page geometry in points (A4 = 595.28 × 841.89).
const PAGE_W = 595.28
const X = 20
const W = PAGE_W - 2 * X
const TOP = 14
const FOOT_Y = 819
const GAP = 4 // between sections
const FOOT_GAP = 5 // above the footer rule
const R = 7
const BAR = 14 // a section's title band
const PAD = 7 // inside a section's panel, left and right
const SIG_H = 24 // the signature row above the footer: closing message left, signature lines right
const KEY_PAD = 3.25 // the level key: padding above and below
const KEY_NAME = 9 // its line of dots and names, above the descriptions
const ICON_MAX = 26 // an academic subject's icon, as large as the rows allow up to this
const ROW_COMFY = 80 // an academic row with room for a large icon, when the page has it to spare
// Room to spare is shared out in proportion to these weights, and the homeroom
// comment, the review scores and skills, and the vocational cards (course
// descriptions at a fixed size) grow by at most GROW points, so spare room goes
// to the individual comments. Specialist cards now carry the longest comments
// after the academic rows, so they take the second-largest share.
const WEIGHT = { homeroom: 74, academic: 260, mid: 100, specialist: 165, vocational: 90 }
const GROW = { homeroom: 14, mid: 16, vocational: 10 }

// Roboto metrics (em): line box, ascender, cap height, x-height; and Be Vietnam Pro's.
const LINE = 1.1718
const ASC = 0.9277
const CAP = 0.711
const XH = 0.528
const HEAD_METRICS = { LINE: 1.265, ASC: 1, CAP: 0.74, XH: 0.53 }

/** Text style. `pitch` is the line spacing as a multiple of the size, like CSS line-height. */
const T = (size, o = {}) => ({
  fontSize: size,
  lineHeight: (o.pitch ?? 1.2) / (o.font === HEAD_FONT ? HEAD_METRICS.LINE : LINE),
  color: o.color ?? C.ink,
  ...(o.font && { font: o.font }),
  ...(o.bold && { bold: true }),
  ...(o.italics && { italics: true }),
  ...(o.spacing && { characterSpacing: o.spacing }),
  ...(o.align && { alignment: o.align }),
})
/**
 * Small typing slips tidied as a comment or description is set, so every box
 * ends alike: one space between words, none before a comma or full stop, and a
 * full stop at the end when the text stops on a letter or number.
 */
const tidy = (text) => {
  const s = curly(String(text || '').replace(/[^\S\n]{2,}/g, ' ').replace(/[^\S\n]+([,.;:!?])/g, '$1').trim())
  return /[\p{L}\p{N}]$/u.test(s) ? `${s}.` : s
}
/**
 * Typewriter quotes made typographic for print (22 October 2026): an apostrophe
 * inside or after a word ’, a quote opening after a space or bracket ‘ or “, any
 * other ’ or ”.
 */
const curly = (text) => String(text || '')
  .replace(/([\p{L}\p{N}])'(?=\p{L})/gu, '$1’')
  .replace(/(^|[\s([{“])'(?=\S)/gu, '$1‘')
  .replace(/'/g, '’')
  .replace(/(^|[\s([{‘])"(?=\S)/gu, '$1“')
  .replace(/"/g, '”')

/** Top of a single line whose letters are centred on `cy` (capitals, or mixed text), in Roboto or the heading face. */
const midTop = (cy, size, caps = false, font) => {
  const m = font === HEAD_FONT ? HEAD_METRICS : { ASC, CAP, XH }
  return cy - (m.ASC - (caps ? m.CAP : (m.CAP + m.XH) / 2) / 2) * size
}
/** A colour mixed with white: `t` 0 keeps it, 1 is white. */
const mix = (hex, t) => {
  const n = parseInt(hex.slice(1), 16)
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * t).toString(16).padStart(2, '0')).join('')}`
}

const K = 0.5523
/** Rectangle path with some corners rounded ({ tl, tr, br, bl } radii). */
function roundedPath(x, y, w, h, { tl = 0, tr = 0, br = 0, bl = 0 }) {
  const c = (r) => r * (1 - K)
  return [
    `M ${x + tl} ${y}`, `L ${x + w - tr} ${y}`, tr ? `C ${x + w - c(tr)} ${y} ${x + w} ${y + c(tr)} ${x + w} ${y + tr}` : '',
    `L ${x + w} ${y + h - br}`, br ? `C ${x + w} ${y + h - c(br)} ${x + w - c(br)} ${y + h} ${x + w - br} ${y + h}` : '',
    `L ${x + bl} ${y + h}`, bl ? `C ${x + c(bl)} ${y + h} ${x} ${y + h - c(bl)} ${x} ${y + h - bl}` : '',
    `L ${x} ${y + tl}`, tl ? `C ${x} ${y + c(tl)} ${x + c(tl)} ${y} ${x + tl} ${y}` : '', 'Z',
  ].filter(Boolean).join(' ')
}

/**
 * Splits `total` between parts that need `needs[i]`, sharing in proportion to
 * `weights`. With room to spare, every part gets at least what it needs, but
 * no more than `caps[i]` unless every part is capped. Without enough room,
 * parts that need less than their share get exactly that, and only the others
 * (whose text will be cut) are short.
 */
function shareHeight(needs, total, weights = needs.map(() => 1), caps = needs.map(() => Infinity)) {
  const roomy = needs.reduce((a, b) => a + b, 0) <= total
  if (roomy) {
    // Each part gets its weight × L, kept between its need and its cap; L is
    // found by bisection so the parts add up to the total.
    const cap = (i) => Math.max(needs[i], caps[i])
    const at = (L) => needs.map((v, i) => Math.min(Math.max(v, weights[i] * L), cap(i)))
    let lo = 0
    let hi = 1
    while (sum(at(hi)) < total && hi < 1e6) hi *= 2
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2
      if (sum(at(mid)) < total) lo = mid
      else hi = mid
    }
    const out = at(hi)
    const spare = total - sum(out)
    if (spare > 0.01) out[weights.indexOf(Math.max(...weights))] += spare
    return out
  }
  const out = needs.map(() => null)
  let left = total
  let wsum = weights.reduce((a, b) => a + b, 0)
  for (let again = true; again;) {
    again = false
    needs.forEach((v, i) => {
      if (out[i] != null) return
      const share = (weights[i] * left) / wsum
      if (v <= share) {
        out[i] = v
        left -= v
        wsum -= weights[i]
        again = true
      }
    })
  }
  return out.map((v, i) => v ?? (wsum > 0 ? (weights[i] * left) / wsum : 0))
}

const plain = (t) => (Array.isArray(t) ? t.map((p) => (typeof p === 'string' ? p : plain(p.text))).join('') : String(t ?? ''))
const sum = (list) => list.reduce((a, b) => a + b, 0)

// ---------------------------------------------------------------------------
// Measuring

const guessWidth = (node) => plain(node.text).length * node.fontSize * 0.52
function guessHeight(node, width) {
  const parts = node.ul || [plain(node.text)]
  const perLine = Math.max(1, width / (node.fontSize * 0.5))
  const lines = parts.reduce((n, p) => n + Math.max(1, Math.ceil(plain(p).length / perLine)), 0)
  return lines * node.fontSize * LINE * node.lineHeight
}

/**
 * Hands out text widths and heights from `cache`. Anything not measured yet is
 * noted in `missing` and a rough guess is returned; the page is then laid out
 * again once pdfmake has measured the missing pieces.
 */
function measurer(cache) {
  const missing = new Map()
  const get = (key, req, guess) => {
    if (cache.has(key)) return cache.get(key)
    missing.set(key, req)
    return guess
  }
  return {
    missing,
    width: (node) => get(`w${JSON.stringify(node)}`, { kind: 'w', node }, guessWidth(node)),
    height: (node, width) => get(`h${width.toFixed(2)}${JSON.stringify(node)}`, { kind: 'h', node, width }, guessHeight(node, width)),
  }
}

/**
 * Measures every request in one pdfmake layout run and stores the results in
 * `cache`. Each request sits between marker lines whose positions pdfmake
 * reports. (Not `unbreakable`: pdfmake reports every position inside such a
 * block as the block's start.) A request split by a page break is left out
 * and measured on the next run.
 */
async function measure(pdfMake, missing, cache) {
  const PAGE_H = 14000
  const list = [...missing]
  const pos = {}
  const mark = (id) => ({ text: ' ', id, fontSize: 1, lineHeight: 1 })
  const content = [mark('c0'), mark('c1')]
  let used = 0
  list.forEach(([, r], i) => {
    const guess = r.kind === 'w' ? 12 : guessHeight(r.node, r.width) * 2 + 12
    const breakBefore = used + guess > PAGE_H * 0.8 && used > 0
    used = breakBefore ? guess : used + guess
    const brk = breakBefore ? { pageBreak: 'before' } : {}
    if (r.kind === 'w') {
      content.push({ ...brk, columns: [{ width: 'auto', ...r.node }, { width: 'auto', ...mark(`m${i}`) }], columnGap: 0 })
    } else {
      content.push({ ...mark(`s${i}`), ...brk }, { columns: [{ width: r.width, stack: [r.node] }] }, mark(`e${i}`))
    }
  })
  await pdfMake.createPdf({
    pageSize: { width: 2000, height: PAGE_H },
    pageMargins: [0, 0, 0, 0],
    defaultStyle: { font: 'Roboto' },
    content,
    pageBreakBefore: (node) => {
      if (node.id && node.startPosition) pos[node.id] = node.startPosition
      return false
    },
  }).getStream()
  const markH = pos.c1 && pos.c0 ? pos.c1.top - pos.c0.top : 1.171875
  if (cache.size > 6000) cache.clear()
  list.forEach(([key, r], i) => {
    if (r.kind === 'w') {
      if (pos[`m${i}`]) cache.set(key, pos[`m${i}`].left)
      return
    }
    const s = pos[`s${i}`]
    const e = pos[`e${i}`]
    if (s && e && s.pageNumber === e.pageNumber) cache.set(key, Math.max(0, e.top - s.top - markH))
  })
}

// ---------------------------------------------------------------------------
// One page

/**
 * Lays out one report page. Returns { fills, strokes, nodes, checks } where
 * checks = { overflow, tooFull, shrunk, smaller, untranslated, bodySize, sizes }:
 * boxes whose text was cut, boxes set smaller than usual, parts printed in
 * English on a Vietnamese page, and the size the comments were set at.
 */
function buildPage(item, M, { proof, icons = {}, headFont = HEAD_FONT }) {
  const { bundle, settings, teachers = [], schedule = null, lang = 'en', photoKey } = item
  const { report, sections = [], student, history = [], cohortAvg = {}, summativeAvg = {}, courseNotes = [] } = bundle
  const vi = lang === 'vi'
  const t = reportStrings(lang)
  const pick = (en, v) => pickText(lang, en, v)
  const nameIn = (x) => (vi && x?.name_vi) || x?.name || ''
  const org = settings.org || {}
  const levels = settings.levels || []
  const tiers = sectionsByTier(settings, sections, report.year_group)
  const nick = firstName(student)
  const template = templateOf(settings, report) || {}
  const yearGroup = yearGroupLabel(report.year_group, lang)
  // Section headings: the template's own wording (Early Years) or the standard one.
  const title = (key) => reportTitle(template, key, lang, { nickname: nick, yearGroup })
  // A helping teacher (Ms. Thắm V on Technology and Art & Crafts) is left off a card she shares.
  const teacherOf = (s) => printedTeacher(sectionTeacher(teachers, s, report.year_group, settings.assistants || []))
  const homeroomTeacher = printedTeacher(reportHomeroom(schedule, report))
  // An area as this report's year group has it (a template's `areaNames`, Movement's `specialistIn`).
  const areaOf = (key) => subjectByKey(settings, key, report.year_group)
  const noteFor = (key) => courseNotes.find((n) => n.subject_key === key)
  // Names and headings in the heading face (Roboto when it did not load).
  const HF = headFont

  const fills = []
  const strokes = []
  const nodes = []
  // Counts, plus the names of the boxes ("Mathematics comment") for the editor.
  const checks = { overflow: 0, shrunk: 0, untranslated: 0, tooFull: [], smaller: [], sizes: {}, bodySize: F.body, usualBodySize: F.body }

  // ---------- drawing helpers ----------
  const rect = (x, y, w, h, o = {}) => (o.over ? strokes : fills).push({
    type: 'rect', x, y, w, h, ...(o.r && { r: o.r }), ...(o.fill && { color: o.fill }), ...(o.gradient && { linearGradient: o.gradient }),
    ...(o.stroke && { lineColor: o.stroke }), lineWidth: o.lw ?? 0.8, ...(o.dash && { dash: o.dash }),
    ...(o.opacity != null && { fillOpacity: o.opacity }),
  })
  const line = (x1, y1, x2, y2, o = {}) => (o.under ? fills : strokes).push({
    type: 'line', x1, y1, x2, y2, lineWidth: o.lw ?? 0.8, lineColor: o.color ?? C.line, ...(o.dash && { dash: o.dash }), ...(o.cap && { lineCap: o.cap }),
  })
  const dotted = (x1, y1, x2, y2, color = C.line) => line(x1, y1, x2, y2, { color, lw: 1.1, dash: { length: 0.01, space: 2.6 }, cap: 'round' })
  const circle = (cx, cy, r, color, o = {}) => fills.push({ type: 'ellipse', x: cx, y: cy, r1: r, r2: r, color, ...(o.opacity != null && { fillOpacity: o.opacity }) })
  const put = (x, y, w, node) => nodes.push({ absolutePosition: { x, y }, columns: [{ width: w, stack: [node] }] })
  const icon = (name, x, y, size, color = C.navy) => {
    const svg = icons[name] || icons.star
    if (svg) nodes.push({ absolutePosition: { x, y }, svg: svg.split(ICON_INK).join(color), width: size, height: size })
  }
  /** An icon in a filled circle of diameter `d`. */
  const badge = (name, cx, cy, d, fill, color) => {
    circle(cx, cy, d / 2, fill)
    icon(name, cx - d * 0.31, cy - d * 0.31, d * 0.62, color)
  }

  /** One line no wider than `w`: set smaller if needed (down to `min` × size), then cut with "…". */
  const oneLine = (text, size, w, style = {}) => {
    const node = (s, c = text) => ({ text: c, ...T(s, { pitch: 1, ...style }) })
    const full = M.width(node(size))
    if (full <= w) return { node: node(size), width: full }
    const s = Math.max(size * (style.min ?? 0.82), Math.floor((size * w / full) * 0.98 * 20) / 20)
    const at = M.width(node(s))
    if (at <= w || typeof text !== 'string') return { node: node(s), width: Math.min(at, w) }
    const chars = [...text]
    const cands = []
    for (let f = 0.95; f > 0.25; f -= 0.05) cands.push(`${chars.slice(0, Math.floor(chars.length * f)).join('').trimEnd()}…`)
    const ok = cands.map((c) => M.width(node(s, c)) <= w)
    return { node: node(s, cands[ok.indexOf(true)] ?? cands.at(-1)), width: w }
  }
  const putLine = (x, y, w, text, size, style = {}) => {
    const l = oneLine(text, size, w, style)
    put(x, y, w, { ...l.node, ...(style.align && { alignment: style.align }) })
    return l.width
  }
  const kicker = (x, y, w, text, color = C.muted, size = 6.2) =>
    putLine(x, y, w, text.toUpperCase(), size, { bold: true, color, spacing: 0.6 })

  // ---------- text boxes ----------
  const STEP = 0.25
  const sizesOf = (b) => {
    const out = []
    for (let s = b.base; s >= b.min - 1e-6; s -= STEP) out.push(Math.round(s * 100) / 100)
    return out
  }
  const boxNode = (b, size, content = b.content) => (b.list
    ? { ul: content.length ? content : ['—'], ...T(size, b.style), markerColor: b.marker ?? C.ink }
    : {
      text: b.label ? [{ text: `${b.label} `, bold: true, color: b.labelColor }, content || '—'] : (content || '—'),
      ...T(size, b.style),
    })
  // The last line's leading is blank space, so it may reach into the box's padding.
  const fits = (b, size, content) => M.height(boxNode(b, size, content), b.w) <= b.h + size * ((b.style?.pitch ?? 1.2) - LINE) + 0.75
  const shorten = (b, size) => {
    if (b.list) {
      const opts = b.content.map((_, n) => b.content.slice(0, b.content.length - 1 - n))
      const ok = opts.map((c) => fits(b, size, c))
      return opts[ok.indexOf(true)] ?? []
    }
    const words = String(b.content).split(/(\s+)/)
    const cands = []
    for (let f = 0.96; f > 0.2; f -= 0.04) {
      cands.push(`${words.slice(0, Math.max(1, Math.floor(words.length * f))).join('').replace(/[\s,;:.–-]+$/, '')}…`)
    }
    const ok = cands.map((c) => fits(b, size, c))
    return cands[ok.indexOf(true)] ?? cands.at(-1)
  }
  /**
   * Places a group of text boxes at one shared size: the largest size at which
   * every box in the group fits. Boxes: { name, x, y, w, h, base, min, style,
   * content, usual?, body?, label?, labelColor?, list?, marker?, missing? }.
   */
  const placeBoxes = (boxes) => {
    if (!boxes.length) return
    const sizes = boxes.map(sizesOf)
    const need = boxes.map((b, k) => sizes[k].map((s) => fits(b, s)).indexOf(true))
    const step = Math.max(...need.map((n, k) => (n < 0 ? sizes[k].length - 1 : n)))
    boxes.forEach((b, k) => {
      const size = sizes[k][Math.min(step, sizes[k].length - 1)]
      const cut = !fits(b, size)
      const content = cut ? shorten(b, size) : b.content
      if (cut) { checks.overflow++; checks.tooFull.push(b.name) } else if (!b.body && size < (b.usual ?? b.base) - 0.01) { checks.shrunk++; checks.smaller.push(b.name) }
      if (b.missing) checks.untranslated++
      checks.sizes[b.name] = size
      if (proof && (cut || b.missing)) {
        rect(b.x - 2.5, b.y - 1.5, b.w + 5, b.h + 3, { r: 3, fill: cut ? '#fef2f2' : '#fffbeb', opacity: 0.9 })
        rect(b.x - 2.5, b.y - 1.5, b.w + 5, b.h + 3, { r: 3, over: true, stroke: cut ? '#dc2626' : '#f59e0b', lw: 1, ...(cut && { dash: { length: 2.5, space: 1.5 } }) })
      }
      put(b.x, b.y, b.w, boxNode(b, size, content))
    })
  }
  const BODY = { min: F.bodyMin, usual: F.body, body: true, style: { pitch: 1.23 } }
  // Course descriptions: the same small muted style on the academic rows and the vocational cards.
  const TOPICS = { base: F.topics, min: F.topicsMin, style: { pitch: 1.22, color: C.topics }, label: t.topicsCovered }
  const picked = (en, v) => {
    const p = pick(en, v)
    return { content: tidy(p.text), missing: p.missing }
  }

  // ---------- small pieces ----------
  const PILL_H = 11.5
  // A level is shown as five bubbles, filled up to it in its colour and white with a soft
  // ring after it, in a pale capsule of the same colour with the level's name ("●●●●○
  // Confident"). Since 23 October 2026 (Seth and Hien chose it over the solid pill with a
  // letter); the key, the cards, the academic rows and How I Learn all use it.
  const BUBBLE = { d: 4.3, gap: 1.15, padL: 4, mid: 3.2, padR: 5.5 }
  const bubblesW = (b = BUBBLE) => levels.length * b.d + Math.max(0, levels.length - 1) * b.gap
  /** Five bubbles in a row from x, centred on cy. */
  const bubbleRow = (value, x, cy, b = BUBBLE) => {
    const l = levelInfo(settings, value)
    const at = levels.findIndex((v) => v.value === Number(value))
    levels.forEach((_, k) => {
      const cx = x + b.d / 2 + k * (b.d + b.gap)
      if (l && k <= at) circle(cx, cy, b.d / 2, l.color)
      else {
        circle(cx, cy, b.d / 2, '#ffffff')
        strokes.push({ type: 'ellipse', x: cx, y: cy, r1: b.d / 2 - 0.3, r2: b.d / 2 - 0.3, lineColor: l ? mix(l.color, 0.45) : C.tag, lineWidth: 0.6 })
      }
    })
  }
  /** The size a level capsule will take in `maxW`: { w, h }, plus its name as one line (set smaller if need be). */
  const pillFit = (value, maxW) => {
    const l = levelInfo(settings, value)
    const fixed = BUBBLE.padL + bubblesW() + BUBBLE.mid + BUBBLE.padR
    const one = oneLine(l ? nameIn(l) : t.notYet, F.pill, maxW - fixed, { bold: true, color: l ? l.color : C.emptyText, min: 0.78 })
    return { l, one, w: fixed + one.width, h: PILL_H }
  }
  /** Level capsule; `align` 'right' or 'center' puts its right edge or middle at x. Returns { w, h }. */
  const pill = (value, x, y, maxW, align = 'left') => {
    const f = pillFit(value, maxW)
    const { l, w, h } = f
    const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x
    rect(left, y, w, h, { r: h / 2, fill: l ? mix(l.color, 0.85) : C.empty })
    bubbleRow(value, left + BUBBLE.padL, y + h / 2)
    put(left + BUBBLE.padL + bubblesW() + BUBBLE.mid, midTop(y + h / 2, f.one.node.fontSize), f.one.width + 1, f.one.node)
    return { w, h }
  }

  /**
   * A section: a pale panel in the section's colour, `h` tall, under a solid
   * title band with a white icon badge and the title (and a subtitle on the right).
   * No outline: the panel's colour holds the section together.
   */
  const section = (x, y, w, h, theme, text, sub) => {
    rect(x, y, w, h, { r: R, fill: mix(theme.accent, PANEL) })
    fills.push({ type: 'path', d: roundedPath(x, y, w, BAR, { tl: R, tr: R }), color: theme.accent })
    badge(theme.icon, x + 11.5, y + BAR / 2, 10.5, '#ffffff', theme.accent)
    const tw = putLine(x + 21, midTop(y + BAR / 2, F.section, false, HF), w - 29, text, F.section, { bold: true, color: '#ffffff', font: HF })
    if (sub) putLine(x + 21 + tw + 10, midTop(y + BAR / 2, F.sectionSub), w - 39 - tw, sub, F.sectionSub, { color: mix(theme.accent, 0.82), italics: true, align: 'right' })
  }

  // =========================================================================
  // Masthead: the logo on the left; the title, and the period, programme and
  // date on one line, on the right; a blue-to-green rule underneath. (The
  // motto is in the footer since 23 October 2026.)
  nodes.push({ absolutePosition: { x: X, y: TOP }, image: 'logo', width: 66 })
  const reportDate = report.report_date
    ? new Date(`${report.report_date}T00:00:00`).toLocaleDateString(vi ? 'vi-VN' : 'en-GB', { day: 'numeric', month: vi ? 'numeric' : 'long', year: 'numeric' })
    : ''
  const RW = 340
  putLine(X + W - RW, TOP - 0.5, RW, (vi && org.docTitle_vi) || org.docTitle || '', F.docTitle, { bold: true, color: C.navy, font: HF, align: 'right' })
  // A year range takes an en dash in print: 2026–2027.
  const schoolYear = String(report.school_year || '').replace(/^(\d{4})-(\d{4})$/, '$1–$2')
  const program = (vi && template.program_vi) || template.program || template.name || ''
  const subline = [
    { text: `${periodLabel(report.period_label, lang)}  ·  ${schoolYear}`, bold: true, color: THEME.academic.deep },
    ...[program, reportDate].filter(Boolean).map((x) => ({ text: `   ·   ${x}`, color: C.muted })),
  ]
  putLine(X + W - RW, TOP + 19.5, RW, subline, F.period, { align: 'right' })
  const ruleY = TOP + 30.5
  rect(X, ruleY, W, 1.3, { gradient: [THEME.academic.accent, THEME.academic.accent, THEME.vocational.accent] })

  // =========================================================================
  // Level key: the whole scale in order, first steps to the top, as five tiles
  // in the levels' own colours under the masthead, each with the level's dot,
  // name and what it means (its description from Report settings). Every pill
  // and dot on the page reads from it. The tiles are as tall as the longest
  // description needs: two lines, set a little smaller before it takes a third.
  const keyY = ruleY + 1.3 + 5.5
  // Tiles 4pt apart, the last one ending at the right margin like the rule above.
  const labelW = 46
  const cellW = levels.length ? (W - labelW + 4) / levels.length : 0
  const descW = cellW - 13
  const DESC_PITCH = 1.16
  const descOf = (l) => ((vi && l.desc_vi) || l.desc || '').trim()
  const descNode = (l, size) => ({ text: descOf(l), ...T(size, { color: C.muted, pitch: DESC_PITCH }) })
  const descLines = (size) => Math.max(0, ...levels.map((l) => (descOf(l) ? Math.round(M.height(descNode(l, size), descW) / (size * DESC_PITCH)) : 0)))
  const descSize = sizesOf({ base: F.levelDesc, min: F.levelDescMin }).find((s) => descLines(s) <= 2) ?? F.levelDesc
  const keyLines = descLines(descSize)
  const keyH = levels.length ? 2 * KEY_PAD + KEY_NAME + keyLines * descSize * DESC_PITCH : 0
  if (levels.length) {
    rect(X, keyY, labelW - 4, keyH, { r: 5, fill: C.keyFill })
    const label = { text: t.levelsKey.toUpperCase(), ...T(5.9, { bold: true, color: C.muted, spacing: 0.5, pitch: 1.12 }) }
    put(X + 7, keyY + (keyH - M.height(label, labelW - 12)) / 2 + 0.5, labelW - 12, label)
    const nameCy = keyY + KEY_PAD + KEY_NAME / 2
    levels.forEach((l, i) => {
      const tx = X + labelW + i * cellW
      rect(tx, keyY, cellW - 4, keyH, { r: 5, fill: mix(l.color, 0.9) })
      // The level's bubbles, then its name: the key to every capsule on the page.
      const KB = { d: 3.9, gap: 1 }
      bubbleRow(l.value, tx + 5, nameCy, KB)
      const nameX = tx + 5 + bubblesW(KB) + 3.5
      putLine(nameX, midTop(nameCy, F.level), cellW - 4 - (nameX - tx) - 5, nameIn(l), F.level, { bold: true, color: l.color, min: 0.85 })
      if (descOf(l)) put(tx + 5, keyY + KEY_PAD + KEY_NAME + 0.5, descW, descNode(l, descSize))
    })
  }

  // =========================================================================
  // Prepare the parts that share the page's height.
  const startY = levels.length ? keyY + keyH + 5.5 : ruleY + 9
  const photoD = 46
  const hrX = X + 146
  const hrW = X + W - hrX
  const infoX = X + photoD + 8
  const infoW = hrX - 8 - infoX
  const HR_TOP = 15
  const HR_PAD = 4.5
  // The homeroom teacher signs the comment ("— Mr. Caleb"), on a line of its own below it,
  // or at the end of its last line where that line leaves room, which costs no height.
  const HR_SIGN = homeroomTeacher ? 10 : 0
  const signature = homeroomTeacher ? `— ${homeroomTeacher}` : ''
  const signOnLast = (s) => !!signature && M.height(boxNode(homeroom, s, `${homeroom.content}\u2003\u2003${signature}`), homeroom.w) <= M.height(boxNode(homeroom, s), homeroom.w) + 0.5
  const signRoom = (s) => (signOnLast(s) ? 0 : HR_SIGN)
  const homeroom = { ...BODY, name: 'Homeroom teacher comment', x: hrX + 10, w: hrW - 15, ...picked(report.homeroom_note, report.homeroom_note_vi) }

  // Academic rows: the name column (subject tile, lead, name, teacher, level) on
  // the left, then the course description and the comment.
  const nameW = 80
  const colW = nameW - 4
  const bx = X + PAD + nameW + 4
  const bw = X + W - PAD - bx
  const PAD_T = 3.75
  const PAD_B = 3
  const RULE = 3 // gap, dotted rule and gap between the course description and the comment
  const ROW_MIN = 46
  // One or two lines, whichever the text needs.
  const lines = (b) => b.base * b.style.pitch * (M.height(boxNode(b, b.base), b.w) <= b.base * b.style.pitch + 0.5 ? 1 : 2)
  // The lead of a name ("Intensive English in") as a small line, on two lines if need be, a
  // little smaller: above the name in the academic name column and on the cards.
  const LEAD_SIZES = [F.lead, 6, 5.6]
  // The Vietnamese lead takes two lines in the academic name column. It breaks before
  // "theo chủ đề", so "tăng cường" stays together (23 October 2026).
  const leadBreak = (text) => text.replace(/ (theo chủ đề)$/u, '\n$1')
  const leadFit = (text, w, color, align) => {
    let lead = null
    for (const size of LEAD_SIZES) {
      const style = T(size, { color, pitch: 1.12, ...(align && { align }) })
      let node = { text, ...style }
      if (M.height(node, w) > size * 1.12 + 0.5) node = { text: leadBreak(text), ...style }
      lead = { node, h: M.height(node, w) }
      if (lead.h <= size * 1.12 * 2 + 0.5) break
    }
    return lead
  }
  const rows = tiers.academic.map((s) => {
    const area = areaOf(s.subject_key).name
    const note = noteFor(s.subject_key)
    // The course description on top (left out of a draft while it is still empty), then the comment.
    const topics = (note?.description || '').trim()
      ? { ...TOPICS, name: `${area} course description`, labelColor: THEME.vocational.deep, x: bx, w: bw, ...picked(note.description, note.description_vi) }
      : null
    if (topics) topics.h = lines(topics)
    const comment = { ...BODY, name: `${area} comment`, x: bx, w: bw, ...picked(s.comment, s.comment_vi) }
    // The name column: a long name ("Communication & Language") wraps onto two lines, a
    // little smaller if need be, rather than being cut.
    const { lead: leadText, head: areaName } = nameParts(nameIn(areaOf(s.subject_key)))
    const lead = leadText ? leadFit(leadText, colW, THEME.academic.deep, 'center') : null
    let wrap = null
    for (const size of [F.title, 8.6, 8, 7.4]) {
      const style = T(size, { bold: true, color: C.navy, pitch: 1.1, font: HF, align: 'center' })
      let node = { text: areaName, ...style }
      // A Vietnamese name that wraps keeps its last two words together ("Hiểu biết về" /
      // "thế giới"): most Vietnamese words have two syllables, so a break between the last
      // two splits a word (23 October 2026).
      if (vi && M.height(node, colW) > size * 1.1 + 0.5) node = { text: areaName.replace(/ (?=\S+ \S+$)/u, '\n'), ...style }
      wrap = { node, h: M.height(node, colW) }
      if (wrap.h <= size * 1.1 * 2 + 0.5) break
    }
    const teacher = teacherOf(s)
    const leadH = lead ? lead.h + 0.6 : 0
    const nameH = leadH + wrap.h
    const textH = nameH + (teacher ? 1.5 + F.teacher * LINE : 0) + 4 + pillFit(s.level, colW).h
    const label = { teacher, lead, leadH, wrap, nameH, textH, min: textH + PAD_T + 3 }
    return { s, topics, comment, label, fixed: PAD_T + PAD_B + (topics ? topics.h + RULE : 0) }
  })

  const cardTiers = ['specialist', 'vocational'].filter((k) => tiers[k].length)
  // A card holds an individual comment (specialist areas, and a vocational area
  // ticked for one, as Early Years Physical Development) or the course description.
  const commentCard = (s) => writingFor(settings, s.subject_key, report.year_group).comment
  // Each tier's cards share the panel's width (two areas make two wide cards, one
  // area one full-width card). Where a tier mixes the two kinds, a comment card
  // is half as wide again as a description card, so the longer comment and the
  // shorter description come out closer in height.
  const GUT = 12
  const cardWs = Object.fromEntries(cardTiers.map((k) => {
    const shares = tiers[k].map((s) => (commentCard(s) ? 1.5 : 1))
    const free = W - 2 * PAD - GUT * (shares.length - 1)
    return [k, shares.map((v) => (free * v) / sum(shares))]
  }))
  // Card header: the icon badge, area name and level pill on one line under the
  // band. The teacher's name joins that line when it fits on every card of the
  // tier ('one'), else each card gives it a line of its own ('two'), so the
  // cards of a tier look alike and their text boxes line up. In narrow cards
  // (four in a tier, as the vocational areas of Years 2 to 7 since Movement
  // joined them) the area name would be cut beside the pill, so the pill moves
  // down to the teacher's line ('stacked'), or below it when a teacher's name
  // would be cut beside the pill ('stacked3': "Mr. Caleb & Ms. Thắm V").
  const CARD_HEAD = 3.5
  const CARD_PAD = 4
  const HEAD_ONE = CARD_HEAD + PILL_H + 4 // text top when the teacher shares the title line
  const TEACHER_Y = CARD_HEAD + PILL_H + 0.5 // the teacher's own line, when needed
  const HEAD_TWO = TEACHER_Y + F.teacher * LINE + 1
  const STACK_PILL_Y = CARD_HEAD + PILL_H // the pill's top when it shares the teacher's line
  const STACK3_PILL_Y = HEAD_TWO + 0.5 // the pill's top on a line of its own, under the teacher
  const TX = 20 // the card title's indent, after the icon badge
  const TITLE_STYLE = { bold: true, color: C.navy, font: HF }
  // The lead of a name ("Intensive English in Technology", since 22 October 2026) prints
  // as a small line above the class name. Every card of the tier leaves the same room for
  // it, so the class names line up.
  const cards = Object.fromEntries(cardTiers.map((tier) => [tier, tiers[tier].map((s, i) => {
    const sub = areaOf(s.subject_key)
    // A fixed description (Movement) is the same on every report; the others are written each quarter.
    const fixed = fixedDescription(sub)
    const note = fixed || noteFor(s.subject_key)
    const desc = !commentCard(s)
    const cw = cardWs[tier][i]
    const teacher = teacherOf(s)
    const { lead, head } = nameParts(nameIn(sub))
    const kick = lead ? leadFit(lead, cw - TX, THEME[tier].deep) : null
    const titleW = M.width({ text: head, ...T(F.cardTitle, { ...TITLE_STYLE, pitch: 1 }) })
    const teacherW = teacher ? M.width({ text: teacher, ...T(F.teacher, { pitch: 1 }) }) : 0
    const pillBox = pillFit(s.level, cw * 0.55)
    const roomForTeacher = cw - TX - pillBox.w - 4 - titleW - 5
    const teacherBeside = !teacher || teacherW <= roomForTeacher
    // Beside the pill the name may be set a little smaller (as putLine does), but not cut.
    const titleBeside = oneLine(head, F.cardTitle, cw - TX - pillBox.w - 5, TITLE_STYLE).node.text === head
    // Likewise the teacher beside the pill, when the pill moves down to the teacher's line.
    const teacherBesidePill = !teacher || oneLine(teacher, F.teacher, cw - TX - pillBox.w - 5, { color: C.muted }).node.text === teacher
    // Or the teacher at the right of the lead's line ('lead'), where the lead takes one line and both fit.
    const leadW = !kick ? 0 : kick.h <= kick.node.fontSize * 1.12 + 0.5 ? M.width({ text: lead, ...T(kick.node.fontSize, { pitch: 1 }) }) : Infinity
    const teacherOnLead = !teacher || leadW + 8 + teacherW <= cw - TX
    // A comment is set at the shared body size; a course description in the smaller topics style.
    return {
      ...(desc ? { ...TOPICS, usual: F.topics } : BODY), s, sub, head, kick, teacher, titleW, teacherBeside, titleBeside, teacherBesidePill, teacherOnLead, pillH: pillBox.h,
      name: `${sub.name} ${desc ? 'course description' : 'comment'}`, w: cw,
      label: desc ? t.topicsCovered : t.comment, labelColor: THEME[tier].deep,
      ...(desc ? picked(note?.description, note?.description_vi) : picked(s.comment, s.comment_vi)),
    }
  })]))
  const tierLayout = Object.fromEntries(cardTiers.map((k) => [k,
    !cards[k].every((c) => c.titleBeside) ? (cards[k].every((c) => c.teacherBesidePill) ? 'stacked' : 'stacked3')
      : cards[k].every((c) => c.teacherBeside) ? 'one'
        // Since the five-bubble capsules (wider than the old pills, 23 October 2026), three cards
        // in a row rarely leave room for the teacher beside the name; the lead's line has it.
        : cards[k].some((c) => c.kick) && cards[k].every((c) => c.teacherOnLead) ? 'lead' : 'two']))
  const pillTop = { stacked: STACK_PILL_Y, stacked3: STACK3_PILL_Y }
  const kickH = Object.fromEntries(cardTiers.map((k) => [k, Math.max(0, ...cards[k].map((c) => c.kick?.h || 0))]))
  const cardTop = Object.fromEntries(cardTiers.map((k) => [k, kickH[k] +
    (tierLayout[k] in pillTop ? pillTop[tierLayout[k]] + Math.max(...cards[k].map((c) => c.pillH)) + 1.5 : tierLayout[k] === 'two' ? HEAD_TWO : HEAD_ONE)]))
  // A card's text height at comment size `s` (vocational cards keep their own size).
  const cardText = (c, s) => M.height(boxNode(c, c.body ? s : c.base), c.w)

  const reviews = reviewRows(settings, { report, sections, history, cohortAvg, summativeAvg })
  const periods = (settings.periods || []).map((p) => ({ ...p, short: p.label.replace(/Quarter\s*/i, 'Q').replace(/Semester\s*/i, 'S').replace(/Term\s*/i, 'T') }))
  const groups = skillGroupsFor(settings, report)
  const maxItems = Math.max(0, ...groups.map((g) => g.items.length))
  const SCORE_HEAD = 13.5
  const SCORE_KEY = 10.5
  const SKILL_TOP = 13
  const midMin = Math.max(reviews.length ? BAR + SCORE_HEAD + reviews.length * 17 + SCORE_KEY : 0, groups.length ? BAR + SKILL_TOP + maxItems * 10.8 + 2 : 0)

  // Every part from the homeroom row down to the last card tier shares the page's
  // height; the signature row above the footer is a fixed height.
  const flexKeys = ['homeroom', ...(rows.length ? ['academic'] : []), ...(midMin ? ['mid'] : []), ...cardTiers]
  const sigY = FOOT_Y - FOOT_GAP - SIG_H
  const flexTotal = sigY - GAP - startY - GAP * (flexKeys.length - 1)

  // The largest comment size at which everything fits.
  const rowNeed = (r, s) => Math.max(ROW_MIN, r.label.min, r.fixed + M.height(boxNode(r.comment, s), bw) + 0.5)
  // A row with room for a 24pt icon above its name (a two-line name, as in the Early Years, needs more).
  const comfyRow = (r) => Math.max(ROW_COMFY, r.label.textH + PAD_T + PAD_B + 6 + 24)
  const needsAt = (s) => flexKeys.map((k) => {
    if (k === 'homeroom') return Math.max(photoD + 8, HR_TOP + M.height(boxNode(homeroom, s), homeroom.w) + signRoom(s) + HR_PAD)
    if (k === 'academic') return BAR + sum(rows.map((r) => rowNeed(r, s)))
    if (k === 'mid') return midMin
    return BAR + cardTop[k] + Math.max(...cards[k].map((c) => cardText(c, s))) + CARD_PAD
  })
  const bodySizes = sizesOf({ base: F.body, min: F.bodyMin })
  const allNeeds = bodySizes.map(needsAt)
  let bi = allNeeds.findIndex((list) => sum(list) <= flexTotal)
  if (bi < 0) bi = bodySizes.length - 1
  const body = bodySizes[bi]
  checks.bodySize = body
  // A tier of one or two cards has less to say than the usual three, so it takes a smaller share of spare room.
  const weightOf = (k) => WEIGHT[k] * (cardTiers.includes(k) ? Math.min(1, tiers[k].length / 3) : 1)
  // Room to spare goes first to the academic rows, up to enough for a large subject icon.
  const spare = Math.max(0, flexTotal - sum(allNeeds[bi]))
  const shareNeeds = allNeeds[bi].map((v, i) => (flexKeys[i] === 'academic'
    ? Math.min(v + spare, BAR + sum(rows.map((r) => Math.max(rowNeed(r, body), comfyRow(r)))))
    : v))
  const caps = flexKeys.map((k, i) => (k in GROW ? shareNeeds[i] + GROW[k] : Infinity))
  // A partial-day page (no academic rows) has far more room than it needs: each part grows
  // a little (the cards by at most 24pt) and the rest is left as white space above the
  // signatures, so no coloured panel stands half empty.
  const roomCaps = rows.length ? caps : caps.map((c, i) => Math.min(c, shareNeeds[i] + 24))
  const shared = shareHeight(shareNeeds, Math.min(flexTotal, sum(roomCaps)), flexKeys.map(weightOf), roomCaps)
  const heights = Object.fromEntries(flexKeys.map((k, i) => [k, shared[i]]))
  const midH = heights.mid || 0

  // =========================================================================
  // Student and homeroom teacher comment
  let y = startY
  const hrH = heights.homeroom
  const photoY = y + (hrH - photoD) / 2
  if (photoKey) {
    nodes.push({ absolutePosition: { x: X, y: photoY }, image: photoKey, width: photoD, height: photoD })
  } else {
    circle(X + photoD / 2, photoY + photoD / 2, photoD / 2, C.photoFill)
    strokes.push({ type: 'ellipse', x: X + photoD / 2, y: photoY + photoD / 2, r1: photoD / 2 - 1.2, r2: photoD / 2 - 1.2, lineColor: C.photoRing, lineWidth: 2.4 })
    const initials = (student?.full_name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(-2).join('').toUpperCase()
    put(X, midTop(photoY + photoD / 2, 14, true, HF), photoD, { text: initials, ...T(14, { bold: true, color: C.initials, align: 'center', pitch: 1, font: HF }) })
  }
  // The full name, the largest words on the page after the title: on one line where it
  // fits (set smaller if need be). A longer one breaks before the first name ("Bùi
  // Nguyễn / Nhã Vy"), or else where the two lines come out most even, so no word is
  // left on a line of its own.
  const fullName = student?.full_name || report.student_name || ''
  const nameStyle = (s) => T(s, { bold: true, color: C.navy, pitch: 1.08, font: HF })
  const fullW = (text, s) => M.width({ text, ...nameStyle(s) })
  const nameBreak = (s) => {
    const words = fullName.split(/\s+/).filter(Boolean)
    const splits = words.slice(1).map((_, i) => [words.slice(0, i + 1).join(' '), words.slice(i + 1).join(' ')])
      .filter((p) => p.every((l) => fullW(l, s) <= infoW))
    const longer = (p) => Math.max(fullW(p[0], s), fullW(p[1], s))
    const best = splits.find((p) => foldName(p[1]) === foldName(nick)) || splits.sort((a, b) => longer(a) - longer(b))[0]
    return best && best.join('\n')
  }
  const nameText = [F.name, 14, 13, 12].map((s) => fullW(fullName, s) <= infoW && { s, text: fullName }).find(Boolean)
    || [14, 13, 12, 11, 10.5, 10].map((s) => nameBreak(s) && { s, text: nameBreak(s) }).find(Boolean)
    || { s: 10, text: fullName }
  const nameNode = { text: nameText.text, ...nameStyle(nameText.s) }
  const fullH = M.height(nameNode, infoW)
  const infoPitch = F.info * 1.3
  const infoLines = [
    student?.nickname && !nicknameInName(student.nickname, fullName, nick) && { text: `“${student.nickname}”`, style: { color: C.muted } },
    { text: yearGroup, style: { bold: true, color: THEME.academic.deep } },
    // A partial-day student joins after the morning (academic) lessons, which is why the page has none.
    partialFrom(student) && { text: [`${t.partialDay} `, { text: partialFrom(student), bold: true }], style: { color: C.muted } },
  ].filter(Boolean)
  let infoY = y + (hrH - (fullH + 3 + infoLines.length * infoPitch)) / 2
  put(infoX, infoY, infoW, nameNode)
  infoY += fullH + 3
  infoLines.forEach((l) => { put(infoX, infoY, infoW, oneLine(l.text, F.info, infoW, l.style).node); infoY += infoPitch })

  // The homeroom comment as a quotation: a pale blue panel with a brand-blue rule on its left.
  rect(hrX, y, hrW, hrH, { fill: C.homeroomFill })
  rect(hrX, y, 2.6, hrH, { fill: THEME.academic.accent })
  kicker(hrX + 10, y + 6, hrW - 15, t.homeroomComment, C.homeroomInk)
  placeBoxes([{ ...homeroom, base: body, y: y + HR_TOP, h: hrH - HR_TOP - signRoom(body) - HR_PAD }])
  // The signature, bottom right (since 22 October 2026; the name was a "Homeroom:" line
  // beside the photo before): below the comment where the box has room for it, else at the
  // end of the comment's last line, on its baseline.
  if (signature) {
    const textH = M.height(boxNode(homeroom, body), homeroom.w)
    const below = hrH - HR_TOP - HR_PAD - textH >= HR_SIGN
    const lastTop = y + HR_TOP + textH - body * BODY.style.pitch
    const signY = below ? y + hrH - HR_PAD - HR_SIGN + 1 : lastTop + (body - F.hrSign) * ASC
    putLine(hrX + 10, signY, hrW - 15, signature, F.hrSign, { italics: true, color: C.homeroomInk, align: 'right' })
  }
  y += hrH + GAP

  // =========================================================================
  // Academic learning
  if (rows.length) {
    const h = heights.academic
    const theme = THEME.academic
    section(X, y, W, h, theme, title('academic'))
    // Each row its need, plus as much of the room for an icon as the section has (all of it,
    // or the same part of it in every row); anything over is shared out.
    const plainRows = rows.map((r) => rowNeed(r, body))
    const extra = plainRows.map((v, i) => Math.max(0, comfyRow(rows[i]) - v))
    const part = sum(extra) ? Math.min(1, Math.max(0, h - BAR - sum(plainRows)) / sum(extra)) : 0
    const rowHeights = shareHeight(plainRows.map((v, i) => v + extra[i] * part), h - BAR)
    // One icon size for every academic row, set by the row with the least room (a two-line
    // name takes some), so the icons match; below 14pt none of them shows.
    const iconD = Math.min(ICON_MAX, ...rows.map((r, i) => rowHeights[i] - PAD_T - PAD_B - 6 - r.label.textH))
    checks.iconSize = iconD >= 14 ? Math.floor(iconD) : 0
    const comments = []
    let ry = y + BAR
    rows.forEach((r, i) => {
      const rowH = rowHeights[i]
      const sub = areaOf(r.s.subject_key)
      if (i > 0) line(X + PAD, ry, X + W - PAD, ry, { color: mix(theme.accent, 0.75), lw: 0.6 })

      // The name column, centred, top down: the subject's icon in a white disc (as large as
      // the rows allow; back above the name by Bowen's wish on 23 October 2026), then the
      // lead, the name, the teacher and the level.
      const nx = X + PAD
      const mid = nx + colW / 2
      let cy = ry + PAD_T + 0.5
      const { teacher, lead, leadH, wrap } = r.label
      if (iconD >= 14) {
        circle(mid, cy + iconD / 2, iconD / 2, '#ffffff')
        strokes.push({ type: 'ellipse', x: mid, y: cy + iconD / 2, r1: iconD / 2 - 0.4, r2: iconD / 2 - 0.4, lineColor: theme.edge, lineWidth: 0.8 })
        icon(sub.icon, mid - iconD * 0.29, cy + iconD * 0.21, iconD * 0.58, theme.accent)
        cy += iconD + 5
      }
      if (lead) put(nx, cy, colW, lead.node)
      put(nx, cy + leadH, colW, wrap.node)
      cy += r.label.nameH
      if (teacher) {
        putLine(nx, cy + 1.5, colW, teacher, F.teacher, { color: C.muted, align: 'center' })
        cy += 1.5 + F.teacher * LINE
      }
      pill(r.s.level, mid, cy + 4, colW, 'center')

      // The course description, a dotted rule, then the comment filling the rest of the row.
      let yTop = ry + PAD_T
      const yBottom = ry + rowH - PAD_B
      if (r.topics) {
        placeBoxes([{ ...r.topics, y: yTop }])
        yTop += r.topics.h + 1.5
        dotted(bx, yTop, bx + bw, yTop, theme.edge)
        yTop += RULE - 1.5
      }
      comments.push({ ...r.comment, base: body, y: yTop, h: yBottom - yTop })
      ry += rowH
    })
    placeBoxes(comments)
    y += h + GAP
  }

  // =========================================================================
  // Progress review scores and How I learn
  if (midH) {
    const splitGap = 6
    const scoresW = reviews.length && groups.length ? Math.round((W - splitGap) * 1.08 / 2.08) : reviews.length ? W : 0
    if (reviews.length) {
      const theme = THEME.scores
      section(X, y, scoresW, midH, theme, t.scores)
      const x = X + PAD
      const w = scoresW - 2 * PAD
      const aw = Math.max(70, w * 0.27)
      const pw = (w - aw) / (periods.length + 1.5)
      const sw = w - aw - pw * periods.length
      const sx = x + aw + periods.length * pw
      const headY = y + BAR + 0.5
      const bodyY = headY + SCORE_HEAD
      const keyRowY = y + midH - SCORE_KEY - 2
      const rh = (keyRowY - bodyY) / reviews.length
      const curIdx = periods.findIndex((p) => Number(p.index) === Number(report.period_index))
      if (curIdx >= 0) rect(x + aw + curIdx * pw + 2, headY + 1.5, pw - 4, keyRowY - headY - 3.5, { r: 4, fill: theme.tint })
      line(x, bodyY, x + w, bodyY, { color: theme.edge, lw: 0.7 })
      dotted(sx, headY + 3, sx, keyRowY - 3, theme.edge)

      const head = (text, cx, cwidth) => putLine(cx + 2, midTop(headY + SCORE_HEAD / 2, F.head, true), cwidth - 4, text.toUpperCase(), F.head, { bold: true, color: theme.deep, spacing: 0.4, align: 'center' })
      putLine(x, midTop(headY + SCORE_HEAD / 2, F.head, true), aw - 6, t.learningArea.toUpperCase(), F.head, { bold: true, color: theme.deep, spacing: 0.4 })
      periods.forEach((p, i) => head(p.short, x + aw + i * pw, pw))
      putLine(sx + 1, headY + 1.5, sw - 2, t.summative.toUpperCase(), F.head, { bold: true, color: theme.deep, spacing: 0.4, align: 'center' })
      putLine(sx + 1, headY + 8.2, sw - 2, t.endOfYearTest, 5.3, { color: theme.deep, align: 'center', min: 0.7 })

      const cell = (c, cx, cwidth, cy) => {
        if (c.state === 'score') {
          // The percentage, with the class reference underneath, centred as one block.
          const ref = c.ref != null ? `${t.classAvg} ${c.ref}%` : ''
          const capTop = cy - (ref ? (CAP * F.score + 1.6 + CAP * F.ref) / 2 : (CAP * F.score) / 2)
          put(cx, capTop - (ASC - CAP) * F.score, cwidth, { text: `${c.pct}%`, ...T(F.score, { bold: true, color: C.navy, align: 'center', pitch: 1 }) })
          if (ref) putLine(cx + 1, capTop + CAP * F.score + 1.6 - (ASC - CAP) * F.ref, cwidth - 2, ref, F.ref, { color: C.muted, align: 'center' })
        } else if (c.state === 'tbd') {
          // Still to come: a light dash (the key under the table says so), not "TBD" in every cell.
          line(cx + cwidth / 2 - 3, cy, cx + cwidth / 2 + 3, cy, { color: C.faint, lw: 1, cap: 'round' })
        } else {
          put(cx, midTop(cy, 6.6, true), cwidth, { text: c.state === 'na' ? 'N/A' : '—', ...T(6.6, { bold: true, color: C.tag, spacing: 0.3, align: 'center', pitch: 1 }) })
        }
      }
      reviews.forEach((r, i) => {
        const ry = bodyY + i * rh
        if (i > 0) line(x, ry, x + w, ry, { color: mix(theme.accent, 0.8), lw: 0.6 })
        const cy = ry + rh / 2
        // The area's short label if it has one ("Math Topics"), else its name. A long one
        // wraps onto two lines, a little smaller (three at 6.6pt if it must), centred on
        // the row, rather than being cut.
        const sub = areaOf(r.key)
        const areaName = (vi ? sub?.short_vi : sub?.short) || nameIn(sub)
        const areaW = aw - 6
        if (M.width({ text: areaName, ...T(7.3, { pitch: 1, bold: true, color: C.navy, font: HF }) }) <= areaW) {
          putLine(x, midTop(cy, 7.3, false, HF), areaW, areaName, 7.3, { bold: true, color: C.navy, font: HF })
        } else {
          let wrap = null
          for (const size of [7.3, 7, 6.6]) {
            const node = { text: areaName, ...T(size, { bold: true, color: C.navy, pitch: 1.1, font: HF }) }
            wrap = { node, size, lines: Math.round(M.height(node, areaW) / (size * 1.1)) }
            if (wrap.lines <= 2) break
          }
          put(x, midTop(cy - ((wrap.lines - 1) * wrap.size * 1.1) / 2, wrap.size, false, HF), areaW, wrap.node)
        }
        r.cells.forEach((c, k) => cell(c, x + aw + k * pw, pw, cy))
        cell(r.summative, sx, sw, cy)
      })
      putLine(x, midTop(keyRowY + SCORE_KEY / 2, F.key), w, t.scoresKey, F.key, { color: C.muted })
    }
    if (groups.length) {
      const theme = THEME.skills
      const px = reviews.length ? X + scoresW + splitGap : X
      section(px, y, X + W - px, midH, theme, t.howILearn)
      const x = px + PAD
      const w = X + W - PAD - x
      const gGap = 16
      const gw = (w - gGap * (groups.length - 1)) / groups.length
      const itemsTop = y + BAR + SKILL_TOP
      const ih = Math.min(13, (y + midH - 2 - itemsTop) / Math.max(1, maxItems))
      groups.forEach((g, gi) => {
        const gx = x + gi * (gw + gGap)
        kicker(gx, y + BAR + 2.5, gw, nameIn(g), theme.deep)
        g.items.forEach((it, k) => {
          const iy = itemsTop + k * ih
          const cy = iy + ih / 2
          if (k > 0) line(gx, iy, gx + gw, iy, { color: mix(theme.accent, 0.82), lw: 0.5 })
          icon(it.icon, gx, cy - 4, 8, theme.accent)
          const SB = { d: 4.6, gap: 1.2 }
          putLine(gx + 11.5, midTop(cy, F.skill), gw - 11.5 - bubblesW(SB) - 6, nameIn(it), F.skill)
          bubbleRow(report.skills?.[it.key], gx + gw - bubblesW(SB), cy, SB)
        })
      })
    }
    y += midH + GAP
  }

  // =========================================================================
  // Specialist and vocational learning
  for (const tier of cardTiers) {
    const theme = THEME[tier]
    const h = heights[tier]
    const ws = cardWs[tier]
    section(X, y, W, h, theme, title(tier), title(tier === 'specialist' ? 'specialistNote' : 'vocationalNote'))
    const top = cardTop[tier]
    const layout = tierLayout[tier]
    const boxes = cards[tier].map((c, i) => {
      const cw = ws[i]
      const cx = X + PAD + sum(ws.slice(0, i)) + GUT * i
      const cy = y + BAR
      // The small first line of a long name, then the header (badge, name, teacher, pill) below it.
      if (c.kick) put(cx + TX, cy + CARD_HEAD, cw - TX, c.kick.node)
      const hy = cy + kickH[tier]
      const p = pill(c.s.level, cx + cw, hy + (pillTop[layout] ?? CARD_HEAD), cw * 0.55, 'right')
      const mid = hy + CARD_HEAD + PILL_H / 2
      badge(c.sub.icon, cx + 7.5, mid, 15, theme.tint, theme.accent)
      const titleMax = cw - TX - (layout in pillTop ? 0 : p.w + 4)
      const tw = putLine(cx + TX, midTop(mid, F.cardTitle, true, HF), titleMax, c.head, F.cardTitle, TITLE_STYLE)
      if (c.teacher && layout === 'lead') putLine(cx + TX, cy + CARD_HEAD - 0.35, cw - TX, c.teacher, F.teacher, { color: C.muted, align: 'right' })
      else if (c.teacher && layout === 'one') putLine(cx + TX + tw + 5, midTop(mid, F.teacher), titleMax - tw - 5, c.teacher, F.teacher, { color: C.muted })
      else if (c.teacher && layout === 'stacked') putLine(cx + TX, midTop(hy + STACK_PILL_Y + PILL_H / 2, F.teacher), cw - TX - p.w - 5, c.teacher, F.teacher, { color: C.muted })
      else if (c.teacher) putLine(cx + TX, hy + TEACHER_Y, cw - TX, c.teacher, F.teacher, { color: C.muted })
      return { ...c, base: c.body ? body : c.base, x: cx, y: cy + top, h: y + h - CARD_PAD - (cy + top) }
    })
    placeBoxes(boxes)
    y += h + GAP
  }

  // =========================================================================
  // Signatures: the closing message on the left, the signature lines side by
  // side on the right, in one slim row above the footer.
  const sigs = reportSignatures(schedule, report)
  const SIG_GAP = 18
  const sigW = sigs.length ? Math.min(140, (W * 0.48 - SIG_GAP * (sigs.length - 1)) / sigs.length) : 0
  const sigX0 = X + W - (sigs.length ? sigs.length * sigW + SIG_GAP * (sigs.length - 1) : 0)
  sigs.forEach((sg, i) => {
    const sx = sigX0 + i * (sigW + SIG_GAP)
    if (sg.name) putLine(sx, sigY + 1, sigW, printedTeacher(sg.name), F.sig, { italics: true, color: C.navy })
    line(sx, sigY + 14.5, sx + sigW, sigY + 14.5, { color: C.sigLine, lw: 0.7, cap: 'round' })
    putLine(sx, sigY + 17.5, sigW, roleLabel(sg.role, lang).toUpperCase(), F.role, { bold: true, color: C.muted, spacing: 0.5 })
  })
  const closing = curly(((vi && org.closing_vi) || org.closing || '').replace('{nickname}', nick).replace('{name}', student?.full_name || ''))
  if (closing) {
    const cw = sigX0 - SIG_GAP - X
    const closingStyle = T(F.closing, { italics: true, color: C.muted, pitch: 1.22 })
    // Two lines break between the sentences, so no word is left on the second line by itself.
    const stop = closing.indexOf('. ')
    const halves = stop > 0 ? [closing.slice(0, stop + 1), closing.slice(stop + 2)] : null
    const wraps = M.width({ text: closing, ...closingStyle }) > cw
    const text = wraps && halves?.every((p) => M.width({ text: p, ...closingStyle }) <= cw) ? halves.join('\n') : closing
    const node = { text, ...closingStyle }
    put(X, sigY + Math.max(0, (SIG_H - M.height(node, cw)) / 2), cw, node)
  }

  // =========================================================================
  // Footer: the motto on the left, the legal line on the right.
  line(X, FOOT_Y, X + W, FOOT_Y, { color: C.line, lw: 0.6 })
  const motto = org.tagline ? putLine(X, FOOT_Y + 3.5, 200, org.tagline, F.foot, { bold: true, color: C.blue }) : 0
  if (org.legalLine) putLine(X + motto + 12, FOOT_Y + 3.5, W - motto - 12, org.legalLine, F.foot, { color: C.muted, align: motto ? 'right' : 'center' })

  return { fills, strokes, nodes, checks }
}

// ---------------------------------------------------------------------------
// Document

const measured = new Map()

/**
 * Builds the pdfmake document for one or more reports (one page each).
 * @param {object} pdfMake  pdfmake instance with Roboto loaded (browser or Node)
 * @param {Array<{ bundle, settings, teachers, schedule, lang, photoKey? }>} items
 * @param {object} opts
 * @param {object} opts.images  { logo, [photoKey]: data URL }
 * @param {object} [opts.icons] icon name -> SVG markup
 * @param {boolean} [opts.proof] outline boxes that are too full or untranslated (on-screen preview only)
 * @param {string} [opts.headFont] the font for names and headings: HEAD_FONT once Be Vietnam Pro is registered, else 'Roboto'
 * @param {string} [opts.title]
 * @returns {Promise<{ definition: object, checks: Array<object> }>}
 */
export async function reportPdfDefinition(pdfMake, items, { images = {}, icons = {}, proof = false, headFont = 'Roboto', title = '' } = {}) {
  let pages = []
  for (let pass = 0; pass < 8; pass++) {
    const M = measurer(measured)
    pages = items.map((item) => buildPage(item, M, { proof, icons, headFont }))
    if (!M.missing.size) break
    await measure(pdfMake, M.missing, measured)
  }
  const content = []
  pages.forEach((p, i) => {
    if (i > 0) content.push({ text: ' ', fontSize: 1, pageBreak: 'before' })
    content.push({ canvas: [...p.fills, ...p.strokes], absolutePosition: { x: 0, y: 0 } }, ...p.nodes)
  })
  return {
    checks: pages.map((p) => p.checks),
    definition: {
      pageSize: 'A4',
      pageMargins: [0, 0, 0, 0],
      info: { title, author: 'Palm River Academy' },
      defaultStyle: { font: 'Roboto', fontSize: 8, color: C.ink },
      images: Object.fromEntries(Object.entries(images).filter(([, v]) => typeof v === 'string' && v.startsWith('data:'))),
      content,
    },
  }
}
