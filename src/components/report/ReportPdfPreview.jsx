import { useEffect, useRef, useState } from 'react'
import { reportPdf } from '../../lib/report/reportPdf'
import { renderPdfPage } from '../../lib/pdfRender'

/**
 * The report's actual PDF page, drawn onto a canvas while it is being edited.
 * Rebuilt shortly after each change; the previous page stays on screen until
 * the new one is drawn. Boxes that are too full (red) or still in English on
 * a Vietnamese page (amber) are outlined here only, never in the saved PDF.
 * `onCheck` receives the layout checks ({ overflow, tooFull, shrunk, smaller, untranslated }).
 */
export default function ReportPdfPreview({ bundle, settings, teachers, schedule, lang = 'en', onCheck, className = '' }) {
  const box = useRef(null)
  const canvas = useRef(null)
  const [blob, setBlob] = useState(null)
  const [width, setWidth] = useState(0)
  const [drawn, setDrawn] = useState(false)
  const [error, setError] = useState('')
  const checkRef = useRef(onCheck)
  useEffect(() => { checkRef.current = onCheck })

  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      reportPdf([{ bundle, lang }], { settings, teachers, schedule, proof: true })
        .then(({ blob: b, checks }) => {
          if (!alive) return
          setBlob(b)
          setError('')
          checkRef.current?.(checks[0])
        })
        .catch((e) => { if (alive) setError(e.message || String(e)) })
    }, 400)
    return () => { alive = false; clearTimeout(timer) }
  }, [bundle, settings, teachers, schedule, lang])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(Math.round(el.clientWidth)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!blob || !width) return
    let alive = true
    renderPdfPage(blob, width * Math.min(3, Math.max(2, window.devicePixelRatio || 1)))
      .then(({ canvas: page }) => {
        const c = canvas.current
        if (!alive || !c) return
        c.width = page.width
        c.height = page.height
        c.getContext('2d').drawImage(page, 0, 0)
        setDrawn(true)
      })
      .catch((e) => { if (alive) setError(e.message || String(e)) })
    return () => { alive = false }
  }, [blob, width])

  return (
    <div ref={box} className={`relative ${className}`}>
      <canvas ref={canvas} className="block h-auto w-full bg-white" style={{ aspectRatio: drawn ? undefined : '210 / 297' }} />
      {!drawn && !error && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Making the PDF…</div>}
      {error && <div className="absolute inset-x-0 bottom-0 bg-red-50 p-2 text-xs text-red-700">{error}</div>}
    </div>
  )
}

/** Short on-screen summary of a report's layout checks, or null when there is nothing to say. */
export function ReportCheckNotes({ check, lang, className = '' }) {
  if (!check) return null
  const list = (names) => [...new Set(names)].join(', ')
  return (
    <div className={`space-y-0.5 text-xs ${className}`}>
      {check.overflow > 0 && <div className="font-semibold text-red-600">Too full, so the end is cut off (outlined in red): {list(check.tooFull)}.</div>}
      {lang === 'vi' && check.untranslated > 0 && <div className="font-semibold text-amber-700">{check.untranslated} part{check.untranslated === 1 ? ' has' : 's have'} no Vietnamese yet and print in English (outlined in amber).</div>}
      {check.overflow === 0 && check.bodySize < check.usualBodySize && <div className="text-slate-500">Comments are set a little smaller than usual ({check.bodySize}pt instead of {check.usualBodySize}pt) to fit on one page.</div>}
      {check.overflow === 0 && check.shrunk > 0 && <div className="text-slate-500">Set in slightly smaller text to fit: {list(check.smaller)}.</div>}
    </div>
  )
}
