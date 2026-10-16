// The newsletter PDF in the browser. Loads pdfmake, the Be Vietnam Pro fonts
// (public/fonts), the logo, every photo (as JPEG: pdfmake cannot read webp) and
// the icons, then lays the issue out with pdfLayout.js. A photo that does not
// load is left out with a warning; it never stops the PDF.

import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import {
  BookOpen, Pencil, FlaskConical, Microscope, Calculator, Globe, Languages, Palette, Paintbrush, Music, Drama, Mic,
  CookingPot, Apple, Sprout, Leaf, Flower2, TreePalm, Sun, CloudRain, Waves, Bus, MapPin, Ticket,
  Trophy, Medal, Star, PartyPopper, Gift, CakeSlice, Ghost, Moon, Lamp, Heart, HandHeart, Users,
  CalendarDays, Clock, CreditCard, ClipboardList, Megaphone, Camera, Dumbbell, Bike, Puzzle, Lightbulb, Rocket, Smile,
  Images, Check, ArrowRight, MessageCircleQuestion, PenLine, Pin, Quote,
} from 'lucide-react'
import { loadPdfMake, publicDataUrl } from '../pdfmake.js'
import {
  newsletterPdfDefinition, newsletterPdfName, payloadPhotoSrcs, payloadIconNames,
  FONT_FILES, PDF_FONTS, COVER_FRAME,
} from './pdfLayout.js'

export { newsletterPdfName }

/** The icons a story can wear (constants.js STORY_ICONS) and the ones the layout draws, by lucide name. */
const LUCIDE = {
  'book-open': BookOpen, pencil: Pencil, 'flask-conical': FlaskConical, microscope: Microscope, calculator: Calculator,
  globe: Globe, languages: Languages, palette: Palette, paintbrush: Paintbrush, music: Music, drama: Drama, mic: Mic,
  'cooking-pot': CookingPot, apple: Apple, sprout: Sprout, leaf: Leaf, 'flower-2': Flower2, 'tree-palm': TreePalm,
  sun: Sun, 'cloud-rain': CloudRain, waves: Waves, bus: Bus, 'map-pin': MapPin, ticket: Ticket,
  trophy: Trophy, medal: Medal, star: Star, 'party-popper': PartyPopper, gift: Gift, 'cake-slice': CakeSlice,
  ghost: Ghost, moon: Moon, lamp: Lamp, heart: Heart, 'hand-heart': HandHeart, users: Users,
  'calendar-days': CalendarDays, clock: Clock, 'credit-card': CreditCard, 'clipboard-list': ClipboardList,
  megaphone: Megaphone, camera: Camera, dumbbell: Dumbbell, bike: Bike, puzzle: Puzzle, lightbulb: Lightbulb,
  rocket: Rocket, smile: Smile, images: Images, check: Check, 'arrow-right': ArrowRight,
  'message-circle-question': MessageCircleQuestion, 'pen-line': PenLine, pin: Pin, quote: Quote,
}

const svgs = {}
/** Icons as SVG markup (the layout recolours them). */
function iconSvgs(names) {
  const todo = names.filter((n) => LUCIDE[n] && !svgs[n])
  if (todo.length) {
    const el = document.createElement('div')
    const root = createRoot(el)
    for (const n of todo) {
      flushSync(() => root.render(createElement(LUCIDE[n], { size: 24, color: '#000000', strokeWidth: 2 })))
      svgs[n] = el.innerHTML
    }
    root.unmount()
  }
  return Object.fromEntries(names.filter((n) => svgs[n]).map((n) => [n, svgs[n]]))
}

let fontsPromise = null
/** Be Vietnam Pro into pdfmake's virtual files, once. Without it the PDF falls back to Roboto. */
function loadFonts(pdfMake) {
  fontsPromise ||= Promise.all(FONT_FILES.map(async (f) => [f, (await publicDataUrl(`fonts/${f}`)).split(',')[1]]))
    .then((files) => {
      pdfMake.addVirtualFileSystem(Object.fromEntries(files))
      pdfMake.addFonts(PDF_FONTS)
      return PDF_FONTS
    })
    .catch((e) => {
      fontsPromise = null
      console.warn('Newsletter PDF: Be Vietnam Pro did not load, using Roboto.', e)
      return null
    })
  return fontsPromise
}

let logoPromise = null
const loadLogo = () => (logoPromise ||= publicDataUrl('logo.png').catch((e) => {
  logoPromise = null
  console.warn('Newsletter PDF: the logo did not load.', e)
  return null
}))

/** A fetched image, decoded: { source, width, height, close }. */
async function decode(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob)
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() }
    } catch { /* some formats only decode through an <img> */ }
  }
  const url = URL.createObjectURL(blob)
  try {
    const im = new Image()
    im.src = url
    await im.decode()
    return { source: im, width: im.naturalWidth, height: im.naturalHeight, close: () => {} }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Draws a decoded image (or part of it) as a JPEG data URL on white. */
function toJpeg(pic, w, h, crop = null) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, w, h)
  g.imageSmoothingQuality = 'high'
  if (crop) g.drawImage(pic.source, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h)
  else g.drawImage(pic.source, 0, 0, w, h)
  return c.toDataURL('image/jpeg', 0.8)
}

const MAX_SIDE = 1400
const KEEP = 60
const photos = new Map()
/**
 * A photo (signed Supabase link, public address or data URL) as a JPEG data URL,
 * longest side 1400 px: { data, w, h } or null. Kept by src for the next PDF;
 * a photo that fails is tried again next time.
 */
function loadPhoto(src) {
  if (!photos.has(src)) {
    const job = (async () => {
      const res = await fetch(src, { credentials: 'omit' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const pic = await decode(await res.blob())
      try {
        const s = Math.min(1, MAX_SIDE / Math.max(pic.width, pic.height))
        const w = Math.max(1, Math.round(pic.width * s))
        const h = Math.max(1, Math.round(pic.height * s))
        return { data: toJpeg(pic, w, h), w, h }
      } finally {
        pic.close()
      }
    })()
    job.catch(() => photos.delete(src))
    photos.set(src, job)
    if (photos.size > KEEP) photos.delete(photos.keys().next().value)
  }
  return photos.get(src).catch((e) => {
    console.warn('Newsletter PDF: a photo was left out.', src, e)
    return null
  })
}

/**
 * The cover cropped round its focus point ("50% 30%") to the PDF's cover frame.
 * Only when a focus is set; otherwise the layout crops to the middle itself.
 */
async function cropCover(cover, loaded) {
  const m = String(cover?.focus || '').match(/^\s*([\d.]+)%\s+([\d.]+)%\s*$/)
  if (!m || !loaded) return null
  try {
    const res = await fetch(loaded.data)
    const pic = await decode(await res.blob())
    try {
      const frame = COVER_FRAME.maxHeight / COVER_FRAME.width
      if (pic.height / pic.width <= frame) return null // already wide enough: nothing to crop
      const cw = pic.width
      const ch = Math.round(pic.width * frame)
      const cy = Math.round(Math.min(pic.height - ch, Math.max(0, (Number(m[2]) / 100) * pic.height - ch / 2)))
      return { data: toJpeg(pic, cw, ch, { x: 0, y: cy, w: cw, h: ch }), w: cw, h: ch }
    } finally {
      pic.close()
    }
  } catch (e) {
    console.warn('Newsletter PDF: the cover could not be cropped to its focus.', e)
    return null
  }
}

/**
 * The PDF of one issue in one language.
 * @param {object} payload  the families payload (README.md)
 * @param {'en'|'vi'} lang
 * @param {object} [opts]
 * @param {(step: { key: 'start'|'photos'|'layout'|'done', done?: number, total?: number, pages?: number }) => void} [opts.onStep]
 *   progress, e.g. "Loading photos 3 of 7"
 * @returns {Promise<{ blob: Blob, pages: number }>}
 */
export async function newsletterPdf(payload, lang = 'en', { onStep } = {}) {
  const step = (key, more = {}) => { try { onStep?.({ key, ...more }) } catch { /* the caller's problem, not the PDF's */ } }
  step('start')
  const pdfMake = await loadPdfMake()
  const [fonts, logo] = await Promise.all([loadFonts(pdfMake), loadLogo()])

  const srcs = payloadPhotoSrcs(payload)
  let done = 0
  step('photos', { done, total: srcs.length })
  const loaded = await Promise.all(srcs.map((src) => loadPhoto(src).then((r) => {
    step('photos', { done: ++done, total: srcs.length })
    return [src, r]
  })))
  const images = {}
  if (logo) images.logo = logo
  for (const [src, r] of loaded) if (r) images[src] = r
  const coverSrc = payload?.cover?.src || payload?.cover?.small
  const cover = await cropCover(payload?.cover, coverSrc && images[coverSrc])
  if (cover) images.cover = cover

  step('layout')
  const definition = newsletterPdfDefinition(payload, lang, { images, icons: iconSvgs(payloadIconNames(payload)), fonts })
  let pages = 0
  const footer = definition.footer
  definition.footer = (n, total, size) => {
    pages = Math.max(pages, total)
    return footer(n, total, size)
  }
  const blob = await pdfMake.createPdf(definition).getBlob()
  step('done', { pages })
  return { blob, pages }
}
