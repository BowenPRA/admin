// Learning Progress Report → PDF with real (selectable, sharp) text, one A4
// page per report. The same PDF is shown in the editor preview, opened for
// printing and downloaded, so what teachers check is what parents receive.

import { loadPdfMake, loadBrandFonts, publicDataUrl } from '../pdfmake'
import { reportPdfDefinition, HEAD_FONT } from './reportPdfLayout'
import { photoSrc, preparePhotos } from './photo'
import { LANG_NAMES } from './strings'
import { iconSvgs } from '../../components/report/icons'
import { db } from '../db'

let logoPromise = null
const loadLogo = () => (logoPromise ||= publicDataUrl('logo.png').catch((e) => { logoPromise = null; throw e }))

// Student photos are cropped to a circle with a light ring, on white, as on the
// screen design (a PDF image cannot be clipped to a circle by pdfmake).
const photos = new Map()
function roundPhoto(src) {
  if (!photos.has(src)) {
    photos.set(src, new Promise((resolve) => {
      const img = new Image()
      if (/^https?:/.test(src)) img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const size = 240
          const c = document.createElement('canvas')
          c.width = c.height = size
          const g = c.getContext('2d')
          g.fillStyle = '#ffffff'
          g.fillRect(0, 0, size, size)
          g.save()
          g.beginPath()
          g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
          g.clip()
          g.fillStyle = '#eef2f7'
          g.fillRect(0, 0, size, size)
          const s = Math.max(size / img.naturalWidth, size / img.naturalHeight)
          const w = img.naturalWidth * s
          const h = img.naturalHeight * s
          g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
          g.restore()
          g.lineWidth = 10
          g.strokeStyle = '#d6e7f6'
          g.beginPath()
          g.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2)
          g.stroke()
          resolve(c.toDataURL('image/jpeg', 0.9))
        } catch {
          resolve(null)
        }
      }
      // A photo that did not load is tried again for the next PDF, not remembered as missing.
      img.onerror = () => { photos.delete(src); resolve(null) }
      img.src = src
    }))
  }
  return photos.get(src)
}

// Staff signatures (Setup > Signatures) print beside the names on the signature lines
// (since 23 October 2026). Office accounts and head teachers can read everyone's; a
// teacher only their own, so a teacher's preview shows only theirs. Read again after a
// few minutes, so a new signature soon reaches the PDFs.
let signatures = null
async function loadSignatures() {
  if (!signatures || Date.now() - signatures.at > 5 * 60 * 1000) {
    const rows = await db.signatures.list().catch(() => [])
    signatures = { at: Date.now(), rows: (rows || []).filter((r) => String(r.image || '').startsWith('data:image/png')) }
  }
  return signatures.rows
}

// A signature is saved large (up to 1600 pixels wide) with thin pen lines, which come out
// as hairlines at the size it prints. So it is redrawn at print size with its strokes
// a little thicker and in one dark ink, like a pen signature on paper.
const inked = new Map()
function boldInk(src, w, h) {
  if (!inked.has(src)) {
    inked.set(src, new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        try {
          const H = 180
          const W = Math.max(1, Math.round(((w || img.naturalWidth) * H) / (h || img.naturalHeight)))
          const pad = 2
          const c = document.createElement('canvas')
          c.width = W + 2 * pad
          c.height = H + 2 * pad
          const g = c.getContext('2d')
          for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) g.drawImage(img, pad + dx, pad + dy, W, H)
          g.globalCompositeOperation = 'source-in'
          g.fillStyle = '#1b2a41'
          g.fillRect(0, 0, c.width, c.height)
          resolve({ image: c.toDataURL('image/png'), width: c.width, height: c.height })
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = src
    }))
  }
  return inked.get(src)
}

const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()

/** "Minh Anh Tran – Quarter 1 2026-2027 (English).pdf" */
export const reportFilename = (bundle, lang) =>
  `${safe(bundle.student?.full_name || bundle.report.student_name)} – ${safe(bundle.report.period_label)} ${safe(bundle.report.school_year)} (${LANG_NAMES[lang === 'vi' ? 'vi' : 'en']}).pdf`

/**
 * PDF of one or more reports, one page each.
 * @param {Array<{ bundle: object, lang: 'en'|'vi' }>} reports  bundles from loadReportBundle (or the editor's live copy)
 * @param {object} opts
 * @param {object} opts.settings  report settings
 * @param {Array} opts.teachers   teachers, for the teacher shown on each learning area
 * @param {object} [opts.schedule] the weekly schedule, for the homeroom teacher
 * @param {boolean} [opts.proof]  outline boxes that are too full or untranslated (for on-screen previews)
 * @param {string} [opts.title]   PDF title
 * @returns {Promise<{ blob: Blob, checks: Array<{ overflow: number, shrunk: number, untranslated: number }> }>}
 */
export async function reportPdf(reports, { settings, teachers = [], schedule = null, proof = false, title = '' }) {
  const [pdfMake, logo] = await Promise.all([loadPdfMake(), loadLogo()])
  // Names and headings in Be Vietnam Pro (since 23 October 2026), or Roboto if it did not load.
  const headFont = (await loadBrandFonts(pdfMake)) ? HEAD_FONT : 'Roboto'
  const images = { logo }
  const signed = await Promise.all((await loadSignatures()).map(async (r, i) => {
    const bold = await boldInk(r.image, Number(r.width), Number(r.height))
    images[`sig${i}`] = bold?.image || r.image
    return { key: `sig${i}`, title: r.title || '', name: r.name || '', w: bold?.width || Number(r.width) || 0, h: bold?.height || Number(r.height) || 0 }
  }))
  await preparePhotos(reports.map((r) => r.bundle.student?.photo)).catch(() => {})
  const srcs = [...new Set(reports.map((r) => photoSrc(r.bundle.student?.photo)).filter(Boolean))]
  const made = await Promise.all(srcs.map(roundPhoto))
  srcs.forEach((src, i) => { if (made[i]) images[`photo${i}`] = made[i] })
  const items = reports.map(({ bundle, lang }) => {
    const i = srcs.indexOf(photoSrc(bundle.student?.photo))
    return { bundle, settings, teachers, schedule, lang, photoKey: images[`photo${i}`] ? `photo${i}` : null }
  })
  const pdfTitle = title || (reports.length === 1 ? reportFilename(reports[0].bundle, reports[0].lang).replace(/\.pdf$/, '') : 'Learning Progress Reports')
  const { definition, checks } = await reportPdfDefinition(pdfMake, items, { images, icons: iconSvgs(), proof, headFont, signatures: signed, title: pdfTitle })
  const blob = await pdfMake.createPdf(definition).getBlob()
  return { blob, checks }
}
