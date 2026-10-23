// Staff signatures (Setup > Signatures, supabase/updates-2026-10-23-signatures.sql).
//
// A drawn signature is kept twice: as its pen strokes, each point [x, y, width] in screen
// pixels, and as a PNG cropped to the ink with a see-through background. A photo or scan
// becomes the same kind of PNG: the paper is taken out, shadows and all, and the ink kept.
// The progress reports print them beside the names on the signature lines (reportPdf.js).

export const INK = '#1B2A41'
const MAX_OUT = 1600 // the widest a saved picture gets, in pixels

// Line widths in screen pixels. A pen gives its pressure; a finger or a mouse does not,
// so there the line gets thinner the faster it moves, as ink does.
const MIN_W = 1.1
const MAX_W = 4.2
const penWidth = (pressure) => 0.9 + 3.6 * (pressure > 0 ? pressure : 0.5)
const speedWidth = (speed) => Math.max(MIN_W, MAX_W / (speed + 1))

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

// Each piece of a stroke is a curve through the middle of two points, bent towards the
// point between them, so the line comes out smooth rather than as straight bits.
function drawPiece(ctx, pts, i) {
  const p0 = pts[i - 1]
  const s = i === 1 ? p0 : mid(pts[i - 2], p0)
  const e = mid(p0, pts[i])
  ctx.lineWidth = p0[2]
  ctx.beginPath()
  ctx.moveTo(s[0], s[1])
  ctx.quadraticCurveTo(p0[0], p0[1], e[0], e[1])
  ctx.stroke()
}
// The last bit of a stroke, from the middle of its last two points to the end; or a dot for a tap.
function drawTail(ctx, pts) {
  const n = pts.length
  if (n === 1) {
    ctx.beginPath()
    ctx.arc(pts[0][0], pts[0][1], pts[0][2] * 0.6, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  const s = mid(pts[n - 2], pts[n - 1])
  ctx.lineWidth = pts[n - 1][2]
  ctx.beginPath()
  ctx.moveTo(s[0], s[1])
  ctx.lineTo(pts[n - 1][0], pts[n - 1][1])
  ctx.stroke()
}
const inkStyle = (ctx, ink) => { ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round' }

/** Draws whole strokes onto a canvas context (already scaled and moved as wanted). */
export function drawStrokes(ctx, strokes, ink = INK) {
  inkStyle(ctx, ink)
  for (const pts of strokes) {
    for (let i = 1; i < pts.length; i++) drawPiece(ctx, pts, i)
    if (pts.length) drawTail(ctx, pts)
  }
}

function strokeBounds(strokes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const pts of strokes) for (const [x, y, w] of pts) {
    x0 = Math.min(x0, x - w); y0 = Math.min(y0, y - w); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + w)
  }
  return { x0, y0, w: x1 - x0, h: y1 - y0 }
}

/** Whether what was drawn is too small or too short to be a signature (a stray tap, a dot). */
export function tooSmall(strokes) {
  const points = strokes.reduce((n, s) => n + s.length, 0)
  if (points < 8) return true
  const b = strokeBounds(strokes)
  return b.w < 40 && b.h < 24
}

/**
 * The strokes as a PNG cropped to the ink, up to 1600 pixels wide, and the strokes
 * themselves moved to start at 0,0 and rounded, for keeping.
 */
export function strokesToPng(strokes, ink = INK) {
  const b = strokeBounds(strokes)
  const pad = 6
  const w = b.w + pad * 2
  const h = b.h + pad * 2
  const scale = Math.min(4, MAX_OUT / w)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.translate(pad - b.x0, pad - b.y0)
  drawStrokes(ctx, strokes, ink)
  const r1 = (v) => Math.round(v * 10) / 10
  return {
    image: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    strokes: strokes.map((pts) => pts.map(([x, y, sw]) => [r1(x - b.x0 + pad), r1(y - b.y0 + pad), r1(sw)])),
  }
}

/**
 * Drawing on a canvas with a finger, a pen or a mouse. One pointer at a time; once a pen
 * has touched the pad, touches are ignored, so a hand resting on the screen leaves no mark.
 * `onChange({ empty, pen })` runs when a stroke starts or ends, and after undo or clear.
 */
export class SignaturePad {
  constructor(canvas, { ink = INK, onChange } = {}) {
    this.canvas = canvas
    this.ink = ink
    this.onChange = onChange || (() => {})
    this.strokes = []
    this.active = null
    this.pen = false
    this.dpr = 1
    this.down = this.down.bind(this)
    this.move = this.move.bind(this)
    this.up = this.up.bind(this)
    canvas.addEventListener('pointerdown', this.down)
    canvas.addEventListener('pointermove', this.move)
    canvas.addEventListener('pointerup', this.up)
    canvas.addEventListener('pointercancel', this.up)
    this.resize()
  }

  destroy() {
    const c = this.canvas
    c.removeEventListener('pointerdown', this.down)
    c.removeEventListener('pointermove', this.move)
    c.removeEventListener('pointerup', this.up)
    c.removeEventListener('pointercancel', this.up)
  }

  get empty() { return this.strokes.length === 0 }

  /** Fits the drawing surface to the canvas's size on screen, sharp on high-density screens. */
  resize() {
    const r = this.canvas.getBoundingClientRect()
    this.dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr))
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr))
    this.redraw()
  }

  redraw() {
    const ctx = this.canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    drawStrokes(ctx, this.strokes, this.ink)
  }

  undo() { this.strokes.pop(); this.redraw(); this.changed() }
  clear() { this.strokes = []; this.redraw(); this.changed() }
  changed() { this.onChange({ empty: this.empty, pen: this.pen }) }

  down(e) {
    if (this.active != null) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.pointerType === 'pen') this.pen = true
    else if (e.pointerType === 'touch' && this.pen) return
    e.preventDefault()
    try { this.canvas.setPointerCapture(e.pointerId) } catch { /* the pointer is already gone */ }
    this.active = e.pointerId
    this.rect = this.canvas.getBoundingClientRect()
    this.speed = 0
    this.cur = []
    this.strokes.push(this.cur)
    this.add(e)
    this.changed()
  }

  move(e) {
    if (e.pointerId !== this.active) return
    e.preventDefault()
    // A pen reports many more points than the screen draws; they are all used.
    const evs = e.getCoalescedEvents?.() || []
    for (const ev of evs.length ? evs : [e]) this.add(ev)
  }

  up(e) {
    if (e.pointerId !== this.active) return
    this.active = null
    const ctx = this.canvas.getContext('2d')
    inkStyle(ctx, this.ink)
    drawTail(ctx, this.cur)
    this.changed()
  }

  add(e) {
    const x = e.clientX - this.rect.left
    const y = e.clientY - this.rect.top
    const pts = this.cur
    const last = pts[pts.length - 1]
    let w
    if (last) {
      const d = Math.hypot(x - last[0], y - last[1])
      if (d < 1.2) return
      const speed = d / Math.max(1, e.timeStamp - this.lastT)
      this.speed = 0.7 * speed + 0.3 * this.speed
      const target = e.pointerType === 'pen' ? penWidth(e.pressure) : speedWidth(this.speed)
      w = 0.6 * last[2] + 0.4 * target
    } else {
      w = e.pointerType === 'pen' ? penWidth(e.pressure) : MAX_W * 0.65
    }
    this.lastT = e.timeStamp
    pts.push([x, y, w])
    if (pts.length > 1) {
      const ctx = this.canvas.getContext('2d')
      inkStyle(ctx, this.ink)
      drawPiece(ctx, pts, pts.length - 1)
    }
  }
}

// ---------------- Photos and scans ----------------

/** Opens a chosen picture the right way up. Throws when the browser cannot read it (HEIC, a PDF). */
export async function openPicture(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('unreadable')
  }
}

/** The picture turned by quarter turns (0 to 3, clockwise), at most 3200 pixels on its long side. */
export function turnPicture(bitmap, quarter) {
  const q = ((quarter % 4) + 4) % 4
  const k = Math.min(1, 3200 / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * k)
  const h = Math.round(bitmap.height * k)
  const canvas = document.createElement('canvas')
  canvas.width = q % 2 ? h : w
  canvas.height = q % 2 ? w : h
  const ctx = canvas.getContext('2d')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((q * Math.PI) / 2)
  ctx.drawImage(bitmap, -w / 2, -h / 2, w, h)
  return canvas
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (lo, hi, v) => { const t = clamp01((v - lo) / (hi - lo)); return t * t * (3 - 2 * t) }
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// How bright the paper is around each point, from a coarse grid of the brightest values
// in each cell, widened and blurred so the ink itself does not count. Dividing by it takes
// out shadows and uneven light from a phone photo.
function paperLight(L, w, h) {
  const cell = Math.max(8, Math.round(Math.max(w, h) / 96))
  const gw = Math.ceil(w / cell)
  const gh = Math.ceil(h / cell)
  let g = new Float32Array(gw * gh)
  const sample = []
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    sample.length = 0
    const xa = gx * cell, ya = gy * cell
    const xb = Math.min(w, xa + cell), yb = Math.min(h, ya + cell)
    const step = Math.max(1, Math.floor(cell / 8))
    for (let y = ya; y < yb; y += step) for (let x = xa; x < xb; x += step) sample.push(L[y * w + x])
    sample.sort((a, b) => a - b)
    g[gy * gw + gx] = sample[Math.floor(sample.length * 0.85)] || 255
  }
  const pass = (src, pick) => {
    const out = new Float32Array(gw * gh)
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const vals = []
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy
        if (xx >= 0 && yy >= 0 && xx < gw && yy < gh) vals.push(src[yy * gw + xx])
      }
      out[y * gw + x] = pick(vals)
    }
    return out
  }
  g = pass(g, (v) => Math.max(...v))
  const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length
  g = pass(pass(g, mean), mean)
  return (x, y) => {
    const fx = Math.min(gw - 1, Math.max(0, x / cell - 0.5))
    const fy = Math.min(gh - 1, Math.max(0, y / cell - 0.5))
    const x0 = Math.floor(fx), y0 = Math.floor(fy)
    const x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1)
    const tx = fx - x0, ty = fy - y0
    const top = g[y0 * gw + x0] * (1 - tx) + g[y0 * gw + x1] * tx
    const bottom = g[y1 * gw + x0] * (1 - tx) + g[y1 * gw + x1] * tx
    return top * (1 - ty) + bottom * ty
  }
}

// Drops specks: groups of ink pixels too small to be part of the signature.
// Returns the mask of ink that stays, or null when nothing does.
function keepInk(alpha, w, h) {
  const n = w * h
  const on = new Uint8Array(n)
  for (let i = 0; i < n; i++) on[i] = alpha[i] > 0.25 ? 1 : 0
  const keep = new Uint8Array(n)
  const seen = new Uint8Array(n)
  const minArea = Math.max(6, Math.round(n * 0.000006))
  const stack = []
  const group = []
  let any = false
  for (let i = 0; i < n; i++) {
    if (!on[i] || seen[i]) continue
    group.length = 0
    stack.push(i)
    seen[i] = 1
    while (stack.length) {
      const p = stack.pop()
      group.push(p)
      const x = p % w, y = (p - x) / w
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
        const q = yy * w + xx
        if (on[q] && !seen[q]) { seen[q] = 1; stack.push(q) }
      }
    }
    if (group.length >= minArea) { any = true; for (const p of group) keep[p] = 1 }
  }
  return any ? keep : null
}

// The sheet of paper in a photo taken on a table: the largest bright area, with the ink
// inside it, a little in from its edge. Without it, the paper's edge against a darker table
// comes out as a thick frame of "ink". Null when there is no darker surround (a scan, or a
// photo of the paper alone).
function paperMask(L, w, h) {
  const s = Math.min(1, 300 / Math.max(w, h))
  const mw = Math.max(1, Math.round(w * s)), mh = Math.max(1, Math.round(h * s))
  const n = mw * mh
  // A small copy, each point the average of the pixels it covers, so thin ink strokes fade out.
  const small = new Float32Array(n)
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const xa = Math.floor(x / s), xb = Math.max(xa + 1, Math.min(w, Math.floor((x + 1) / s)))
    const ya = Math.floor(y / s), yb = Math.max(ya + 1, Math.min(h, Math.floor((y + 1) / s)))
    let sum = 0, c = 0
    for (let yy = ya; yy < yb; yy += 2) for (let xx = xa; xx < xb; xx += 2) { sum += L[yy * w + xx]; c++ }
    small[y * mw + x] = c ? sum / c : 255
  }
  // Bright and dark split where the two groups are most apart (Otsu's method).
  const hist = new Float64Array(256)
  for (let i = 0; i < n; i++) hist[Math.min(255, Math.max(0, Math.round(small[i])))]++
  let total = 0
  for (let v = 0; v < 256; v++) total += v * hist[v]
  let wB = 0, sumB = 0, best = -1, cut = 128
  for (let v = 0; v < 256; v++) {
    wB += hist[v]
    if (!wB || wB === n) continue
    sumB += v * hist[v]
    const mB = sumB / wB, mF = (total - sumB) / (n - wB)
    const between = wB * (n - wB) * (mB - mF) ** 2
    if (between > best) { best = between; cut = v }
  }
  // The largest bright group is the paper.
  const label = new Int32Array(n).fill(-1)
  let paper = -1, paperSize = 0
  const stack = []
  for (let i = 0; i < n; i++) {
    if (small[i] <= cut || label[i] >= 0) continue
    let size = 0
    label[i] = i
    stack.push(i)
    while (stack.length) {
      const p = stack.pop()
      size++
      const x = p % mw, y = (p - x) / mw
      for (const [xx, yy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (xx < 0 || yy < 0 || xx >= mw || yy >= mh) continue
        const q = yy * mw + xx
        if (small[q] > cut && label[q] < 0) { label[q] = i; stack.push(q) }
      }
    }
    if (size > paperSize) { paperSize = size; paper = i }
  }
  if (paperSize < n * 0.15) return null
  // Outside the paper: what can be reached from the picture's edge without crossing it.
  // Ink on the paper is enclosed by it, so it stays inside.
  const outside = new Uint8Array(n)
  for (let x = 0; x < mw; x++) for (const y of [0, mh - 1]) stack.push(y * mw + x)
  for (let y = 0; y < mh; y++) for (const x of [0, mw - 1]) stack.push(y * mw + x)
  while (stack.length) {
    const p = stack.pop()
    if (outside[p] || label[p] === paper) continue
    outside[p] = 1
    const x = p % mw, y = (p - x) / mw
    if (x > 0) stack.push(p - 1)
    if (x < mw - 1) stack.push(p + 1)
    if (y > 0) stack.push(p - mw)
    if (y < mh - 1) stack.push(p + mw)
  }
  let out = 0
  for (let i = 0; i < n; i++) out += outside[i]
  if (out < n * 0.03) return null
  // A little in from the paper's edge, where its shadow falls.
  const r = Math.max(2, Math.round(0.015 * Math.max(mw, mh)))
  const rows = new Uint8Array(n)
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    let ok = 1
    for (let d = -r; d <= r && ok; d++) { const xx = x + d; if (xx < 0 || xx >= mw || outside[y * mw + xx]) ok = 0 }
    rows[y * mw + x] = ok
  }
  const inside = new Uint8Array(n)
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    let ok = 1
    for (let d = -r; d <= r && ok; d++) { const yy = y + d; if (yy < 0 || yy >= mh || !rows[yy * mw + x]) ok = 0 }
    inside[y * mw + x] = ok
  }
  return (x, y) => inside[Math.min(mh - 1, Math.floor(y * s)) * mw + Math.min(mw - 1, Math.floor(x * s))] === 1
}

/**
 * A photo or scan of a signature as a clean PNG: the paper made see-through, specks
 * dropped, cropped to the ink with a small margin.
 *   source    a canvas from turnPicture
 *   crop      { x, y, w, h } as parts of the picture (0 to 1); the whole picture by default
 *   strength  0 (lighter: only the darkest ink) to 1 (darker: fainter lines kept)
 *   colour    'pen' keeps the pen's colour, 'dark' uses the same dark ink as a drawn signature
 * Returns null when no ink is found.
 */
export function cleanPicture(source, { crop = { x: 0, y: 0, w: 1, h: 1 }, strength = 0.5, colour = 'pen' } = {}) {
  const first = cleanOnce(source, crop, strength, colour)
  if (!first || first.scale > 0.999) return first && first.result
  // A big picture (a whole scanned page) is made smaller to find the ink. The ink is then
  // cleaned again from the full-size picture, around where it was found, so a small
  // signature on a large page keeps its detail.
  const { box } = first
  const m = 0.04
  const x0 = Math.max(0, box.x - m), y0 = Math.max(0, box.y - m)
  const x1 = Math.min(1, box.x + box.w + m), y1 = Math.min(1, box.y + box.h + m)
  const again = cleanOnce(source, { x: crop.x + x0 * crop.w, y: crop.y + y0 * crop.h, w: (x1 - x0) * crop.w, h: (y1 - y0) * crop.h }, strength, colour)
  return again && again.result.width > first.result.width ? again.result : first.result
}

// The part of the work that the Ink slider and the colour do not change, kept for the last
// few crops of each picture so moving the slider is quick.
const prepared = new WeakMap()
function prepare(source, crop) {
  const key = [crop.x, crop.y, crop.w, crop.h].map((v) => v.toFixed(4)).join(',')
  const cache = prepared.get(source) || new Map()
  prepared.set(source, cache)
  if (cache.has(key)) return cache.get(key)

  const sx = Math.round(crop.x * source.width), sy = Math.round(crop.y * source.height)
  const sw = Math.max(1, Math.round(crop.w * source.width)), sh = Math.max(1, Math.round(crop.h * source.height))
  const k = Math.min(1, 1800 / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k))
  const work = document.createElement('canvas')
  work.width = w
  work.height = h
  const wctx = work.getContext('2d', { willReadFrequently: true })
  wctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h)
  const px = wctx.getImageData(0, 0, w, h).data
  const n = w * h

  // A picture that is already cut out (a PNG with a see-through background) keeps its own edges.
  let clear = 0
  for (let i = 3; i < px.length; i += 4 * 7) if (px[i] < 200) clear++
  const cutOut = clear > (n / 7) * 0.03

  // How dark each pixel is against the paper around it (0 for off the paper), and that paper's light.
  const dark = new Float32Array(n)
  let paper = null
  if (!cutOut) {
    const L = new Float32Array(n)
    for (let i = 0; i < n; i++) L[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]
    const light = paperLight(L, w, h)
    const onPaper = paperMask(L, w, h)
    paper = new Float32Array(n)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      paper[i] = Math.max(1, light(x, y))
      if (onPaper && !onPaper(x, y)) continue
      dark[i] = 1 - L[i] / paper[i]
    }
  }
  const prep = { w, h, k, px, cutOut, dark, paper }
  cache.set(key, prep)
  if (cache.size > 4) cache.delete(cache.keys().next().value)
  return prep
}

function cleanOnce(source, crop, strength, colour) {
  const { w, h, k, px, cutOut, dark, paper } = prepare(source, crop)
  const n = w * h
  const alpha = new Float32Array(n)
  if (cutOut) {
    for (let i = 0; i < n; i++) alpha[i] = px[i * 4 + 3] / 255
  } else {
    const lo = 0.24 - 0.18 * clamp01(strength)
    const hi = lo + 0.22
    for (let i = 0; i < n; i++) alpha[i] = smooth(lo, hi, dark[i])
  }

  const keep = keepInk(alpha, w, h)
  if (!keep) return null
  // Faint edge pixels stay only beside ink that stays, so the dropped specks leave no haze.
  const near = new Uint8Array(n)
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!keep[y * w + x]) continue
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) near[yy * w + xx] = 1
    }
  }

  // The pen's colour: the average of the darkest ink, as if on white paper, kept dark.
  let rgb = hexRgb(INK)
  if (colour === 'pen') {
    let r = 0, g = 0, b = 0, c = 0
    for (let i = 0; i < n; i++) {
      if (!keep[i] || alpha[i] < 0.9) continue
      const lift = cutOut ? 1 : 255 / paper[i]
      r += px[i * 4] * lift; g += px[i * 4 + 1] * lift; b += px[i * 4 + 2] * lift; c++
    }
    if (c) {
      const avg = [r / c, g / c, b / c].map((v) => Math.min(255, v))
      const luma = 0.299 * avg[0] + 0.587 * avg[1] + 0.114 * avg[2]
      const f = luma > 70 ? 70 / luma : 1
      rgb = avg.map((v) => Math.round(v * f))
    }
  }

  const pad = Math.max(4, Math.round(0.04 * Math.max(x1 - x0, y1 - y0)))
  const ox = Math.max(0, x0 - pad), oy = Math.max(0, y0 - pad)
  const ow = Math.min(w, x1 + pad + 1) - ox, oh = Math.min(h, y1 + pad + 1) - oy
  const out = document.createElement('canvas')
  out.width = ow
  out.height = oh
  const octx = out.getContext('2d')
  const img = octx.createImageData(ow, oh)
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const i = (y + oy) * w + (x + ox)
    const o = (y * ow + x) * 4
    img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]
    img.data[o + 3] = near[i] ? Math.round(alpha[i] * 255) : 0
  }
  octx.putImageData(img, 0, 0)

  let final = out
  if (ow > MAX_OUT) {
    final = document.createElement('canvas')
    final.width = MAX_OUT
    final.height = Math.max(1, Math.round((oh * MAX_OUT) / ow))
    final.getContext('2d').drawImage(out, 0, 0, final.width, final.height)
  }
  return {
    result: { image: final.toDataURL('image/png'), width: final.width, height: final.height },
    scale: k,
    // Where the ink is, as parts of the area cleaned.
    box: { x: ox / w, y: oy / h, w: ow / w, h: oh / h },
  }
}
