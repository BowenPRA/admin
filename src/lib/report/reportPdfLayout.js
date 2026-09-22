// Layout of the Learning Progress Report as a pdfmake document: one A4 page
// per report, in English or in Vietnamese. Header, homeroom comment, academic
// rows, review scores and learner skills, specialist and vocational cards,
// experiences and signatures, each part with its own colour.
//
// Text is measured with pdfmake itself before it is placed. All comments share
// one text size: the largest at which every comment fits once the page height
// is shared out between the sections (a section with more to say gets a little
// more room). Only if the smallest size still does not fit is text cut short,
// and that is reported so the editor can say which box is too full. No browser
// APIs here: `reportPdf.js` loads pdfmake, the logo, photos and icons.

import { levelInfo, subjectByKey, firstName, sectionsByTier, reviewRows, sectionTeacher, reportHomeroom, reportSignatures, templateOf, skillGroupsFor } from './utils'
import { reportStrings, reportTitle, voiceQuoted, periodLabel, yearGroupLabel, roleLabel, pickText } from './strings'

// One family of deep, saturated colours, all at a similar depth so no part
// shouts louder than another: brand blue and green, with teal, orange and
// violet between them. Each has a deep shade for words, a pale tint for fills
// and a soft edge for borders.
const C = {
  navy: '#15355c', blue: '#1f6fbf', green: '#43922a', ink: '#222d3a', muted: '#5f6b79', line: '#dde4ec',
  empty: '#e5e9ef', emptyText: '#6f7b88', tag: '#9aa5b1', topics: '#4f5a66', nameCol: '#f2f7fd',
  homeroomFill: '#e9f2fc', homeroomLine: '#b9d3ef', homeroomInk: '#185a9d',
  voiceFill: '#fff3d4', voiceLine: '#efc55a', voiceInk: '#9a5700', quote: '#2f3f55', quoteMark: '#e8a317',
  photoFill: '#e7f0fa', photoRing: '#b9d3ef', initials: '#5f84ad', periodFill: '#e3eefa', periodDot: '#7fa8d6',
  keyFill: '#f5f8fc',
}

// Each part of the page: accent (title band and icons), deep (words), tint
// (fills) and edge (borders), plus the icon in its title badge.
const THEME = {
  academic: { accent: '#1f6fbf', deep: '#185a9d', tint: '#e7f0fa', edge: '#bcd4ee', icon: 'book' },
  scores: { accent: '#0e858a', deep: '#0b6b6f', tint: '#e0f2f2', edge: '#b0d9da', icon: 'chart' },
  skills: { accent: '#d45f28', deep: '#ab4b19', tint: '#fcebe2', edge: '#f0c4ab', icon: 'sparkles' },
  specialist: { accent: '#7443b9', deep: '#5c339c', tint: '#efe8f9', edge: '#d1c0ee', icon: 'palette' },
  vocational: { accent: '#3f8d29', deep: '#33731f', tint: '#e6f2df', edge: '#bcdaae', icon: 'compass' },
}
// The colour icons are stroked in by iconSvgs(); swapped for the colour wanted.
const ICON_INK = '#163a63'

// Text sizes (pt). Comments start at `body` and may go down to `bodyMin`.
const F = {
  body: 8.25, bodyMin: 6.75,
  topics: 7.2, next: 7.5, title: 9, cardTitle: 8.8, teacher: 6.8, pill: 6.6, bar: 8.7, barSub: 6.9, kicker: 6.6,
  skill: 7, score: 8.8, ref: 5.8, head: 6.3, key: 6.1, exp: 7.5, quote: 8.2, sig: 9.3, role: 6.9, level: 6.8, levelShort: 5.7,
  foot: 6.6, name: 10.2, info: 7.5, docTitle: 17.5, period: 8.8, tagline: 6.5,
}

// Page geometry in points (A4 = 595.28 × 841.89).
const PAGE_W = 595.28
const X = 20
const W = PAGE_W - 2 * X
const TOP = 13
const FOOT_Y = 819
const GAP = 3
const FOOT_GAP = 5.5 // above the footer rule
const R = 7
const BAR = 14
const BOTTOM_H = 60
const KEY_H = 18 // the level key under the header
// Room to spare is shared out in proportion to these weights, and the review
// scores, skills and bottom row grow by at most GROW points. Academic learning
// has the most text but a lower weight, so the rest of the page breathes.
const WEIGHT = { homeroom: 74, academic: 205, mid: 100, specialist: 150, vocational: 126, bottom: 70 }
const GROW = { homeroom: 14, mid: 16, bottom: 10 }

// Roboto metrics (em): line box, ascender, cap height, x-height.
const LINE = 1.1718
const ASC = 0.9277
const CAP = 0.711
const XH = 0.528

/** Text style. `pitch` is the line spacing as a multiple of the size, like CSS line-height. */
const T = (size, o = {}) => ({
  fontSize: size,
  lineHeight: (o.pitch ?? 1.2) / LINE,
  color: o.color ?? C.ink,
  ...(o.bold && { bold: true }),
  ...(o.italics && { italics: true }),
  ...(o.spacing && { characterSpacing: o.spacing }),
  ...(o.align && { alignment: o.align }),
})
/** Top of a single line whose letters are centred on `cy` (capitals, or mixed text). */
const midTop = (cy, size, caps = false) => cy - (ASC - (caps ? CAP : (CAP + XH) / 2) / 2) * size

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
const clean = (list) => (list || []).map((e) => (e || '').trim()).filter(Boolean)
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
  const mark = (id) => ({ text: ' ', id, fontSize: 1, lineHeight: 1 })
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
function buildPage(item, M, { proof, icons = {} }) {
  const { bundle, settings, teachers = [], schedule = null, lang = 'en', photoKey } = item
  const { report, sections = [], student, history = [], cohortAvg = {}, summativeAvg = {}, courseNotes = [] } = bundle
  const vi = lang === 'vi'
  const t = reportStrings(lang)
  const pick = (en, v) => pickText(lang, en, v)
  const nameIn = (x) => (vi && x?.name_vi) || x?.name || ''
  const org = settings.org || {}
  const levels = settings.levels || []
  const tiers = sectionsByTier(settings, sections)
  const nick = firstName(student)
  const template = templateOf(settings, report) || {}
  const yearGroup = yearGroupLabel(report.year_group, lang)
  // Section headings: the template's own wording (Early Years) or the standard one.
  const title = (key) => reportTitle(template, key, lang, { nickname: nick, yearGroup })
  const teacherOf = (s) => sectionTeacher(teachers, s, report.year_group)
  const homeroomTeacher = reportHomeroom(schedule, report)
  const noteFor = (key) => courseNotes.find((n) => n.subject_key === key)

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
  const kicker = (x, y, w, text, color = C.muted, size = F.kicker) =>
    putLine(x, y, w, text.toUpperCase(), size, { bold: true, color, spacing: 0.5 })

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
  const picked = (en, v) => {
    const p = pick(en, v)
    return { content: (p.text || '').trim(), missing: p.missing }
  }

  // ---------- small pieces ----------
  const PILL_H = 11.5
  /** The size a level pill will take in `maxW`: { w, h }, plus what drawing it needs. */
  const pillFit = (value, maxW) => {
    const l = levelInfo(settings, value)
    if (!l) return { l, w: Math.min(maxW, M.width({ text: t.notYet, ...T(F.pill, { bold: true, pitch: 1 }) }) + 13), h: PILL_H }
    const label = nameIn(l)
    const avail = maxW - 19.5
    const style = { bold: true, color: 'white', pitch: 1 }
    const full = M.width({ text: label, ...T(F.pill, style) })
    // A long name ("Làm quen kỹ năng mới") in a narrow column: a little smaller, or on two lines.
    let size = F.pill
    let textW = full
    let twoLines = false
    if (full > avail) {
      size = Math.floor(((F.pill * avail) / full) * 0.98 * 20) / 20
      if (size >= 6) textW = M.width({ text: label, ...T(size, style) })
      else { size = 6.2; twoLines = true; textW = Math.min(avail, M.width({ text: label, ...T(6.2, style) })) }
    }
    return { l, label, style, size, textW, twoLines, w: 14 + textW + 5.5, h: twoLines ? 19.5 : PILL_H }
  }
  /** Level pill; `align` 'right' or 'center' puts its right edge or middle at x. Returns { w, h }. */
  const pill = (value, x, y, maxW, align = 'left') => {
    const f = pillFit(value, maxW)
    const { l, w, h } = f
    const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x
    if (!l) {
      rect(left, y, w, h, { r: h / 2, fill: C.empty })
      putLine(left + 6.5, midTop(y + h / 2, F.pill), w - 13, t.notYet, F.pill, { bold: true, color: C.emptyText })
      return { w, h }
    }
    rect(left, y, w, h, { r: PILL_H / 2, fill: l.color })
    const cx = left + PILL_H / 2 + 0.5
    circle(cx, y + PILL_H / 2, 4.4, '#ffffff', { opacity: 0.28 })
    put(cx - 4.5, midTop(y + PILL_H / 2, 6.1, true), 9, { text: l.code, ...T(6.1, { bold: true, color: 'white', align: 'center', pitch: 1 }) })
    if (f.twoLines) put(left + 14, y + 2.2, f.textW + 1, { text: f.label, ...T(6.2, { ...f.style, pitch: 1.18 }) })
    else put(left + 14, midTop(y + PILL_H / 2, f.size), f.textW + 1, { text: f.label, ...T(f.size, f.style) })
    return { w, h }
  }
  const dot = (value, cx, cy, d = 11) => {
    const l = levelInfo(settings, value)
    circle(cx, cy, d / 2, l ? l.color : C.empty)
    const s = d * 0.56
    put(cx - d / 2, midTop(cy, s, true), d, { text: l ? l.code : '–', ...T(s, { bold: true, color: l ? 'white' : C.tag, align: 'center', pitch: 1 }) })
  }
  /** A section: rounded frame with a solid colour title band, a white icon badge and the title. */
  const frame = (x, y, w, h, theme, title, sub) => {
    fills.push({ type: 'path', d: roundedPath(x, y, w, BAR, { tl: R, tr: R }), color: theme.accent })
    rect(x, y, w, h, { r: R, stroke: theme.edge, lw: 1, over: true })
    // Outline the band in its own colour, so the light border does not leave a pale rim around it.
    strokes.push({ type: 'path', d: roundedPath(x, y, w, BAR, { tl: R, tr: R }), lineColor: theme.accent, lineWidth: 1 })
    badge(theme.icon, x + 11.5, y + BAR / 2, 10.5, '#ffffff', theme.accent)
    const tw = putLine(x + 21, midTop(y + BAR / 2, F.bar), w - 29, title, F.bar, { bold: true, color: '#ffffff' })
    if (typeof sub === 'string' && sub) putLine(x + 21 + tw + 10, midTop(y + BAR / 2, F.barSub), w - 39 - tw, sub, F.barSub, { color: theme.tint, italics: true, align: 'right' })
    if (typeof sub === 'function') sub(x + 21 + tw + 10, x + w - 4)
  }

  // =========================================================================
  // Header
  nodes.push({ absolutePosition: { x: X, y: TOP }, image: 'logo', width: 68 })
  putLine(X, TOP + 30, 170, org.tagline || '', F.tagline, { bold: true, color: C.blue })

  const reportDate = report.report_date
    ? new Date(`${report.report_date}T00:00:00`).toLocaleDateString(vi ? 'vi-VN' : 'en-GB', { day: 'numeric', month: vi ? 'numeric' : 'short', year: 'numeric' })
    : ''
  const badgeLines = [
    { text: yearGroup, size: 12, style: { bold: true, color: 'white' } },
    { text: (vi && template.program_vi) || template.program || template.name || '', size: 7.2, style: { bold: true, color: 'white' } },
    reportDate && { text: reportDate, size: 6.6, style: { color: '#eef5fc' } },
  ].filter(Boolean)
  const badgeW = Math.min(160, Math.max(100, ...badgeLines.map((l) => M.width({ text: l.text, ...T(l.size, { pitch: 1, ...l.style }) }) + 20)))
  const badgeX = X + W - badgeW
  rect(badgeX, TOP, badgeW, 38, { r: 9, gradient: [THEME.academic.accent, THEME.vocational.accent] })
  const offsets = reportDate ? [4.5, 19, 28] : [7.5, 22.5]
  badgeLines.forEach((l, i) => putLine(badgeX + 10, TOP + offsets[i], badgeW - 20, l.text, l.size, { ...l.style, align: 'right' }))

  const titleW = 2 * Math.min(PAGE_W / 2 - (X + 150), badgeX - 10 - PAGE_W / 2)
  const titleX = PAGE_W / 2 - titleW / 2
  putLine(titleX, TOP + 1.5, titleW, (vi && org.docTitle_vi) || org.docTitle || '', F.docTitle, { bold: true, color: C.navy, align: 'center' })
  const period = { text: [periodLabel(report.period_label, lang), { text: '  •  ', color: C.periodDot }, report.school_year || ''], ...T(F.period, { bold: true, color: THEME.academic.deep, pitch: 1 }) }
  const periodW = M.width(period) + 22
  rect(PAGE_W / 2 - periodW / 2, TOP + 24, periodW, 14.5, { r: 7.25, fill: C.periodFill })
  put(PAGE_W / 2 - periodW / 2, midTop(TOP + 31.25, F.period, true), periodW, { ...period, alignment: 'center' })
  // =========================================================================
  // Level key: the whole scale in order, first steps to the top, as one track
  // under the header. Every pill and dot on the page reads from it, so it sits
  // outside the sections, with a few words on what each level means. Its
  // outline is the header's accent: one continuous blue-to-green gradient.
  const accent = [THEME.academic.accent, THEME.academic.accent, THEME.vocational.accent]
  const keyY = TOP + 42.5
  if (!levels.length) rect(X, TOP + 42, W, 2.6, { r: 1.3, gradient: accent })
  else {
    rect(X, keyY, W, KEY_H, { r: KEY_H / 2, gradient: accent })
    rect(X + 1.2, keyY + 1.2, W - 2.4, KEY_H - 2.4, { r: KEY_H / 2 - 1.2, fill: C.keyFill })
    const labelW = 66
    const label = { text: t.levelsKey.toUpperCase(), ...T(6, { bold: true, color: C.muted, spacing: 0.4, pitch: 1.1 }) }
    put(X + 11, keyY + (KEY_H - M.height(label, labelW - 14)) / 2 + 0.6, labelW - 14, label)
    const cellW = (W - labelW - 4) / levels.length
    const nameCy = keyY + KEY_H / 2 - 3.1
    const shortCy = keyY + KEY_H / 2 + 4.1
    levels.forEach((l, i) => {
      const cx = X + labelW + i * cellW
      dot(l.value, cx + 6.5, keyY + KEY_H / 2, 11)
      const tw = cellW - 14 - 9
      putLine(cx + 14, midTop(nameCy, F.level), tw, nameIn(l), F.level, { bold: true, color: l.color, min: 0.85 })
      const short = ((vi && l.short_vi) || l.short || '').trim()
      if (short) putLine(cx + 14, midTop(shortCy, F.levelShort), tw, short, F.levelShort, { color: C.muted, min: 0.85 })
      // A small chevron leads on to the next level.
      if (i < levels.length - 1) {
        const ax = cx + cellW - 3.5
        const ay = keyY + KEY_H / 2
        line(ax - 1.8, ay - 2.6, ax + 0.8, ay, { color: C.tag, lw: 0.9, cap: 'round' })
        line(ax + 0.8, ay, ax - 1.8, ay + 2.6, { color: C.tag, lw: 0.9, cap: 'round' })
      }
    })
  }

  // =========================================================================
  // Prepare the parts that share the page's height.
  const startY = levels.length ? keyY + KEY_H + GAP : TOP + 49.5
  const photoD = 58
  const infoW = 150 - photoD - 8
  const hrX = X + 156
  const hrW = X + W - hrX
  const HR_TOP = 15
  const HR_PAD = 4
  const homeroom = { ...BODY, name: 'Homeroom teacher comment', x: hrX + 9, w: hrW - 18, ...picked(report.homeroom_note, report.homeroom_note_vi) }

  const nameW = 80
  const bx = X + nameW + 9
  const bw = W - nameW - 18
  const PAD_T = 3.5
  const PAD_B = 3.25
  const RULE = 3 // gap, dotted rule and gap between the parts of an academic row
  const ROW_MIN = 50
  const ROW_COMFY = 80 // room for the name, teacher, level and a large icon
  // One or two lines, whichever the text needs.
  const lines = (b) => b.base * b.style.pitch * (M.height(boxNode(b, b.base), b.w) <= b.base * b.style.pitch + 0.5 ? 1 : 2)
  const rows = tiers.academic.map((s) => {
    const area = subjectByKey(settings, s.subject_key).name
    const note = noteFor(s.subject_key)
    const topics = (note?.description || '').trim()
      ? { name: `${area} topics covered`, base: F.topics, min: 6.8, style: { pitch: 1.22, color: C.topics }, label: t.topicsCovered, labelColor: THEME.vocational.deep, x: bx, w: bw, ...picked(note.description, note.description_vi) }
      : null
    if (topics) topics.h = lines(topics)
    const nextText = picked(s.next_focus, s.next_focus_vi)
    const next = nextText.content ? { name: `${area} next focus`, base: F.next, min: 7, style: { pitch: 1.22 }, label: t.nextFocus, labelColor: THEME.academic.accent, x: bx, w: bw, ...nextText } : null
    if (next) next.h = lines(next)
    const comment = { ...BODY, name: `${area} comment`, x: bx, w: bw, ...picked(s.comment, s.comment_vi) }
    // The name column: name, teacher and level. A long name ("Communication & Language")
    // wraps onto two lines, a little smaller, rather than being cut.
    const areaName = nameIn(subjectByKey(settings, s.subject_key))
    let wrap = null
    if (M.width({ text: areaName, ...T(F.title, { bold: true, pitch: 1 }) }) * 0.9 > nameW - 10) {
      for (const size of [8.4, 7.8, 7.2]) {
        const node = { text: areaName, ...T(size, { bold: true, color: C.navy, align: 'center', pitch: 1.1 }) }
        wrap = { node, h: M.height(node, nameW - 10) }
        if (wrap.h <= size * 1.1 * 2 + 0.5) break
      }
    }
    const teacher = teacherOf(s)
    const nameH = wrap ? wrap.h + 1 : F.title * LINE
    const textH = nameH + (teacher ? 2 + F.teacher * LINE : 0) + 4.5 + pillFit(s.level, nameW - 12).h
    const label = { teacher, wrap, nameH, textH, min: textH + 11.5 }
    return { s, topics, next, comment, label, fixed: PAD_T + PAD_B + (topics ? topics.h + RULE : 0) + (next ? next.h + RULE : 0) }
  })

  const cardTiers = ['specialist', 'vocational'].filter((k) => tiers[k].length)
  // Each tier's cards share the full width (two areas make two wide cards, one area one full-width card).
  const cardW = Object.fromEntries(cardTiers.map((k) => [k, W / tiers[k].length]))
  const CARD_TOP = 25
  const CARD_PAD = 4
  const cards = Object.fromEntries(cardTiers.map((tier) => [tier, tiers[tier].map((s) => {
    const sub = subjectByKey(settings, s.subject_key)
    const note = noteFor(s.subject_key)
    const voc = tier === 'vocational'
    return {
      ...BODY, s, sub, name: `${sub.name} ${voc ? 'topics covered' : 'comment'}`, w: cardW[tier] - 16,
      label: voc ? t.topicsCovered : t.comment, labelColor: THEME[tier].deep,
      ...(voc ? picked(note?.description, note?.description_vi) : picked(s.comment, s.comment_vi)),
    }
  })]))

  const reviews = reviewRows(settings, { report, sections, history, cohortAvg, summativeAvg })
  const periods = (settings.periods || []).map((p) => ({ ...p, short: p.label.replace(/Quarter\s*/i, 'Q').replace(/Semester\s*/i, 'S').replace(/Term\s*/i, 'T') }))
  const groups = skillGroupsFor(settings, report)
  const maxItems = Math.max(0, ...groups.map((g) => g.items.length))
  const SCORE_HEAD = 13.5
  const SCORE_KEY = 10.5
  const midMin = Math.max(reviews.length ? BAR + SCORE_HEAD + reviews.length * 17 + SCORE_KEY : 0, groups.length ? BAR + 13.5 + maxItems * 10.8 + 3 : 0)

  // Every part from the homeroom row down to the bottom row shares the page's height.
  const flexKeys = ['homeroom', ...(rows.length ? ['academic'] : []), ...(midMin ? ['mid'] : []), ...cardTiers, 'bottom']
  const flexTotal = FOOT_Y - FOOT_GAP - startY - GAP * (flexKeys.length - 1)

  // The largest comment size at which everything fits.
  const rowNeed = (r, s) => Math.max(ROW_MIN, r.label.min, r.fixed + M.height(boxNode(r.comment, s), bw) + 0.5)
  const needsAt = (s) => flexKeys.map((k) => {
    if (k === 'homeroom') return Math.max(photoD + 10, HR_TOP + M.height(boxNode(homeroom, s), homeroom.w) + HR_PAD)
    if (k === 'academic') return BAR + sum(rows.map((r) => rowNeed(r, s)))
    if (k === 'mid') return midMin
    if (k === 'bottom') return BOTTOM_H
    return BAR + CARD_TOP + Math.max(...cards[k].map((c) => M.height(boxNode(c, s), c.w))) + CARD_PAD
  })
  const bodySizes = sizesOf({ base: F.body, min: F.bodyMin })
  const allNeeds = bodySizes.map(needsAt)
  let bi = allNeeds.findIndex((list) => sum(list) <= flexTotal)
  if (bi < 0) bi = bodySizes.length - 1
  const body = bodySizes[bi]
  checks.bodySize = body
  // With room to spare, academic rows are first given enough height for a big subject icon.
  const comfy = allNeeds[bi].map((v, i) => (flexKeys[i] === 'academic' ? Math.max(v, BAR + rows.length * ROW_COMFY) : v))
  const shareNeeds = sum(comfy) <= flexTotal ? comfy : allNeeds[bi]
  // A tier of one or two cards has less to say than the usual three, so it takes a smaller share of spare room.
  const weightOf = (k) => WEIGHT[k] * (cardTiers.includes(k) ? Math.min(1, tiers[k].length / 3) : 1)
  const shared = shareHeight(shareNeeds, flexTotal, flexKeys.map(weightOf), flexKeys.map((k, i) => (k in GROW ? shareNeeds[i] + GROW[k] : Infinity)))
  const heights = Object.fromEntries(flexKeys.map((k, i) => [k, shared[i]]))
  const midH = heights.mid || 0
  const bottomH = heights.bottom
  const bottomY = FOOT_Y - FOOT_GAP - bottomH

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
    put(X, midTop(photoY + photoD / 2, 14, true), photoD, { text: initials, ...T(14, { bold: true, color: C.initials, align: 'center', pitch: 1 }) })
  }
  const infoX = X + photoD + 8
  const nameSizes = [F.name, 10, 9.5, 9]
  const nameNode = (s) => ({ text: student?.full_name || report.student_name || '', ...T(s, { bold: true, color: C.navy, pitch: 1.12 }) })
  const nameFit = nameSizes.map((s) => M.height(nameNode(s), infoW))
  const nameI = Math.max(0, nameFit.findIndex((h, i) => h <= nameSizes[i] * 1.12 * 2 + 0.5))
  const infoPitch = F.info * 1.24
  const infoLines = [
    student?.nickname && { text: `"${student.nickname}"`, style: { color: C.muted } },
    { text: yearGroup, style: { bold: true } },
    homeroomTeacher && { text: [`${t.homeroom}: `, { text: homeroomTeacher, bold: true }], style: {} },
  ].filter(Boolean)
  let infoY = y + (hrH - (nameFit[nameI] + 2 + infoLines.length * infoPitch)) / 2
  put(infoX, infoY, infoW, nameNode(nameSizes[nameI]))
  infoY += nameFit[nameI] + 2
  infoLines.forEach((l) => { put(infoX, infoY, infoW, oneLine(l.text, F.info, infoW, l.style).node); infoY += infoPitch })

  rect(hrX, y, hrW, hrH, { r: 9, fill: C.homeroomFill, stroke: C.homeroomLine })
  kicker(hrX + 9, y + 6, hrW - 18, t.homeroomComment, C.homeroomInk)
  placeBoxes([{ ...homeroom, base: body, y: y + HR_TOP, h: hrH - HR_TOP - HR_PAD }])
  y += hrH + GAP

  // =========================================================================
  // Academic learning
  if (rows.length) {
    const h = heights.academic
    const theme = THEME.academic
    frame(X, y, W, h, theme, title('academic'))
    const plainRows = rows.map((r) => rowNeed(r, body))
    const comfyRows = plainRows.map((v) => Math.max(v, ROW_COMFY))
    const rowHeights = shareHeight(sum(comfyRows) <= h - BAR ? comfyRows : plainRows, h - BAR)
    const comments = []
    let ry = y + BAR
    rows.forEach((r, i) => {
      const rowH = rowHeights[i]
      const sub = subjectByKey(settings, r.s.subject_key)
      const last = i === rows.length - 1
      fills.push({ type: 'path', d: roundedPath(X + 0.45, ry + 0.4, nameW - 0.45, rowH - (last ? 0.85 : 0.4), { bl: last ? R - 0.5 : 0 }), color: C.nameCol })
      line(X + nameW, ry, X + nameW, ry + rowH, { color: theme.edge })
      if (i > 0) line(X, ry, X + W, ry, { color: theme.edge })

      // Subject column, centred: the icon on top, then the name, teacher and level.
      const colMid = X + nameW / 2
      const { teacher, wrap, nameH, textH } = r.label
      const iconD = Math.min(26, rowH - 12 - 4 - textH)
      let cy = ry + 6.5
      if (iconD >= 16) {
        badge(sub.icon, colMid, cy + iconD / 2, iconD, theme.tint, theme.accent)
        cy += iconD + 4
      } else {
        cy = ry + Math.max(5, (rowH - textH) / 2)
      }
      if (wrap) put(X + 5, cy, nameW - 10, wrap.node)
      else putLine(X + 5, cy, nameW - 10, nameIn(sub), F.title, { bold: true, color: C.navy, align: 'center' })
      cy += nameH
      if (teacher) {
        putLine(X + 5, cy + 2, nameW - 10, teacher, F.teacher, { color: C.muted, align: 'center' })
        cy += 2 + F.teacher * LINE
      }
      pill(r.s.level, colMid, cy + 4.5, nameW - 12, 'center')

      let yTop = ry + PAD_T
      let yBottom = ry + rowH - PAD_B
      if (r.topics) {
        placeBoxes([{ ...r.topics, y: yTop }])
        yTop += r.topics.h + 1.5
        dotted(bx, yTop, bx + bw, yTop, theme.edge)
        yTop += RULE - 1.5
      }
      if (r.next) {
        placeBoxes([{ ...r.next, y: yBottom - r.next.h }])
        yBottom -= r.next.h + 1.5
        dotted(bx, yBottom, bx + bw, yBottom, theme.edge)
        yBottom -= RULE - 1.5
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
      const x = X
      const w = scoresW
      frame(x, y, w, midH, theme, t.scores)
      const aw = Math.max(64, w * 0.25)
      const pw = (w - aw) / (periods.length + 1.5)
      const sw = w - aw - pw * periods.length
      const sx = x + aw + periods.length * pw
      const headY = y + BAR
      const bodyY = headY + SCORE_HEAD
      const keyY = y + midH - SCORE_KEY
      const rh = (keyY - bodyY) / reviews.length
      const curIdx = periods.findIndex((p) => Number(p.index) === Number(report.period_index))
      if (curIdx >= 0) rect(x + aw + curIdx * pw + 2, headY + 2, pw - 4, keyY - headY - 4, { r: 5, fill: theme.tint })
      line(x + 6, bodyY, x + w - 6, bodyY, { color: theme.edge })
      dotted(sx, headY + 3, sx, keyY - 3, theme.edge)
      dotted(x + 6, keyY, x + w - 6, keyY, theme.edge)

      const head = (text, cx, cwidth) => putLine(cx + 2, midTop(headY + SCORE_HEAD / 2, F.head, true), cwidth - 4, text.toUpperCase(), F.head, { bold: true, color: theme.deep, spacing: 0.3, align: 'center' })
      putLine(x + 8, midTop(headY + SCORE_HEAD / 2, F.head, true), aw - 10, t.learningArea.toUpperCase(), F.head, { bold: true, color: theme.deep, spacing: 0.3 })
      periods.forEach((p, i) => head(p.short, x + aw + i * pw, pw))
      putLine(sx + 2, headY + 1.5, sw - 4, t.summative.toUpperCase(), F.head, { bold: true, color: theme.deep, spacing: 0.3, align: 'center' })
      putLine(sx + 2, headY + 8.2, sw - 4, t.endOfYearTest, 5.4, { color: theme.deep, align: 'center' })

      const cell = (c, cx, cwidth, cy) => {
        if (c.state === 'score') {
          // The percentage, with the class reference underneath, centred as one block.
          const ref = c.ref != null ? `${t.classAvg} ${c.ref}%` : ''
          const capTop = cy - (ref ? (CAP * F.score + 1.6 + CAP * F.ref) / 2 : (CAP * F.score) / 2)
          put(cx, capTop - (ASC - CAP) * F.score, cwidth, { text: `${c.pct}%`, ...T(F.score, { bold: true, color: C.navy, align: 'center', pitch: 1 }) })
          if (ref) putLine(cx + 1, capTop + CAP * F.score + 1.6 - (ASC - CAP) * F.ref, cwidth - 2, ref, F.ref, { color: C.muted, align: 'center' })
        } else {
          put(cx, midTop(cy, 6.8, true), cwidth, { text: c.state === 'na' ? 'N/A' : c.state === 'tbd' ? 'TBD' : '—', ...T(6.8, { bold: true, color: C.tag, spacing: 0.3, align: 'center', pitch: 1 }) })
        }
      }
      reviews.forEach((r, i) => {
        const ry = bodyY + i * rh
        if (i > 0) line(x + 6, ry, x + w - 6, ry, { color: C.line })
        const cy = ry + rh / 2
        putLine(x + 8, midTop(cy, 7.6), aw - 10, nameIn(subjectByKey(settings, r.key)), 7.6, { bold: true, color: C.navy })
        r.cells.forEach((c, k) => cell(c, x + aw + k * pw, pw, cy))
        cell(r.summative, sx, sw, cy)
      })
      putLine(x + 8, midTop(keyY + SCORE_KEY / 2, F.key), w - 16, t.scoresKey, F.key, { color: C.muted })
    }
    if (groups.length) {
      const theme = THEME.skills
      const x = reviews.length ? X + scoresW + splitGap : X
      const w = X + W - x
      frame(x, y, w, midH, theme, t.howILearn)
      const gGap = 12
      const gw = (w - 18 - gGap * (groups.length - 1)) / groups.length
      const itemsTop = y + BAR + 13.5
      const ih = Math.min(13, (y + midH - 3.5 - itemsTop) / Math.max(1, maxItems))
      groups.forEach((g, gi) => {
        const gx = x + 9 + gi * (gw + gGap)
        kicker(gx, y + BAR + 4.5, gw, nameIn(g), theme.deep, 6.4)
        g.items.forEach((it, k) => {
          const iy = itemsTop + k * ih
          const cy = iy + ih / 2
          if (k > 0) dotted(gx, iy, gx + gw, iy, C.line)
          icon(it.icon, gx, cy - 4, 8, theme.accent)
          putLine(gx + 11.5, midTop(cy, F.skill), gw - 11.5 - 14, nameIn(it), F.skill)
          dot(report.skills?.[it.key], gx + gw - 5, cy, 9.8)
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
    const cw = cardW[tier]
    frame(X, y, W, h, theme, title(tier), title(tier === 'specialist' ? 'specialistNote' : 'vocationalNote'))
    const boxes = cards[tier].map((c, i) => {
      const cx = X + i * cw
      const cy = y + BAR
      if (i > 0) dotted(cx, cy + 6, cx, y + h - 6, theme.edge)
      const p = pill(c.s.level, cx + cw - 8, cy + 4.5, cw * 0.55, 'right')
      badge(c.sub.icon, cx + 8 + 7.5, cy + 4.5 + PILL_H / 2, 15, theme.tint, theme.accent)
      putLine(cx + 27, midTop(cy + 4.5 + PILL_H / 2, F.cardTitle, true), cw - 27 - 8 - p.w - 5, nameIn(c.sub), F.cardTitle, { bold: true, color: C.navy })
      const teacher = teacherOf(c.s)
      if (teacher) putLine(cx + 27, cy + 16.25, cw - 35, teacher, F.teacher, { color: C.muted })
      return { ...c, base: body, x: cx + 8, y: cy + CARD_TOP, h: y + h - CARD_PAD - (cy + CARD_TOP) }
    })
    placeBoxes(boxes)
    y += h + GAP
  }

  // =========================================================================
  // Experiences, student voice, signatures
  const colGap = 9
  const unit = (W - 2 * colGap) / (1.15 + 1.3 + 0.7)
  const c1 = unit * 1.15
  const c2 = unit * 1.3
  const c3 = W - 2 * colGap - c1 - c2
  const green = THEME.vocational
  // The three bottom columns share one heading line.
  icon('award', X, bottomY + 5, 8.5, green.accent)
  kicker(X + 11, bottomY + 6, c1 - 11, t.experiences, green.deep)
  const expEn = clean(report.experiences)
  const expVi = clean(report.experiences_vi)
  const exp = pick(expEn.join('\n'), expVi.join('\n'))
  // Fewer Vietnamese lines than English ones: some are still to translate.
  if (vi && expVi.length > 0 && expVi.length < expEn.length) exp.missing = true
  placeBoxes([{
    name: 'Experiences', base: F.exp, min: 6.8, style: { pitch: 1.22 }, list: true, marker: green.accent, x: X, y: bottomY + 15.5, w: c1, h: bottomH - 15.5,
    content: exp.text ? exp.text.split('\n') : [], missing: exp.missing,
  }])

  const vx = X + c1 + colGap
  // The standard heading ("In …'s words") quotes the student; a template's own heading ("What … loves") does not.
  const quoted = voiceQuoted(template)
  rect(vx, bottomY, c2, bottomH, { r: 9, fill: C.voiceFill, stroke: C.voiceLine })
  icon(quoted ? 'quote' : 'star', vx + c2 - 19, bottomY + 3.5, 11, C.quoteMark)
  kicker(vx + 9, bottomY + 6, c2 - 36, title('voice'), C.voiceInk)
  const voice = picked(report.student_voice, report.student_voice_vi)
  placeBoxes([{
    name: "Student's words", base: F.quote, min: 7, style: { pitch: 1.2, italics: quoted, color: C.quote }, x: vx + 9, y: bottomY + 15, w: c2 - 18, h: bottomH - 15 - 4,
    content: voice.content ? (quoted ? `“${voice.content}”` : voice.content) : '', missing: voice.missing,
  }])

  const sigX = vx + c2 + colGap
  const sigs = reportSignatures(schedule, report)
  const slot = bottomH / Math.max(1, sigs.length)
  sigs.forEach((sg, i) => {
    const sy = bottomY + i * slot + (slot - 27) / 2
    if (sg.name) putLine(sigX, sy + 1, c3, sg.name, F.sig, { italics: true, color: C.navy })
    line(sigX, sy + 15, sigX + c3, sy + 15, { color: '#aebccb', lw: 0.8, cap: 'round' })
    putLine(sigX, sy + 17.5, c3, roleLabel(sg.role, lang), F.role, { bold: true })
  })

  // =========================================================================
  // Footer
  line(X, FOOT_Y, X + W, FOOT_Y, { color: C.line })
  const legal = org.legalLine || ''
  const legalW = legal ? Math.min(W * 0.55, M.width({ text: legal, ...T(F.foot, { pitch: 1 }) })) : 0
  if (legal) putLine(X + W - legalW, FOOT_Y + 3.5, legalW, legal, F.foot, { color: C.muted, align: 'right' })
  const closing = ((vi && org.closing_vi) || org.closing || '').replace('{nickname}', nick).replace('{name}', student?.full_name || '')
  if (closing) putLine(X, FOOT_Y + 3.5, W - legalW - 12, closing, F.foot, { italics: true, color: C.muted })

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
 * @param {string} [opts.title]
 * @returns {Promise<{ definition: object, checks: Array<object> }>}
 */
export async function reportPdfDefinition(pdfMake, items, { images = {}, icons = {}, proof = false, title = '' } = {}) {
  let pages = []
  for (let pass = 0; pass < 8; pass++) {
    const M = measurer(measured)
    pages = items.map((item) => buildPage(item, M, { proof, icons }))
    if (!M.missing.size) break
    await measure(pdfMake, M.missing, measured)
  }
  const content = []
  pages.forEach((p, i) => {
    if (i > 0) content.push({ text: ' ', fontSize: 1, pageBreak: 'before' })
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
