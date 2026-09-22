// Learning Progress Report → PDF with real (selectable, sharp) text, one A4
// page per report. The same PDF is shown in the editor preview, opened for
// printing and downloaded, so what teachers check is what parents receive.

import { loadPdfMake, publicDataUrl } from '../pdfmake'
import { reportPdfDefinition } from './reportPdfLayout'
import { photoSrc, preparePhotos } from './photo'
import { LANG_NAMES } from './strings'
import { iconSvgs } from '../../components/report/icons'

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
      img.onerror = () => resolve(null)
      img.src = src
    }))
  }
  return photos.get(src)
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
  const images = { logo }
  await preparePhotos(reports.map((r) => r.bundle.student?.photo)).catch(() => {})
  const srcs = [...new Set(reports.map((r) => photoSrc(r.bundle.student?.photo)).filter(Boolean))]
  const made = await Promise.all(srcs.map(roundPhoto))
  srcs.forEach((src, i) => { if (made[i]) images[`photo${i}`] = made[i] })
  const items = reports.map(({ bundle, lang }) => {
    const i = srcs.indexOf(photoSrc(bundle.student?.photo))
    return { bundle, settings, teachers, schedule, lang, photoKey: images[`photo${i}`] ? `photo${i}` : null }
  })
  const pdfTitle = title || (reports.length === 1 ? reportFilename(reports[0].bundle, reports[0].lang).replace(/\.pdf$/, '') : 'Learning Progress Reports')
  const { definition, checks } = await reportPdfDefinition(pdfMake, items, { images, icons: iconSvgs(), proof, title: pdfTitle })
  const blob = await pdfMake.createPdf(definition).getBlob()
  return { blob, checks }
}
