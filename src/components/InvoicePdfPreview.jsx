import { useEffect, useRef, useState } from 'react'
import { invoicePdfBlob } from '../lib/invoicePdf'
import { renderPdfPage } from '../lib/pdfRender'
import { useT } from '../lib/i18n'

/**
 * Shows the invoice's actual PDF (the one that is downloaded and emailed),
 * drawn onto a canvas. Rebuilt shortly after each edit; the previous page stays
 * on screen until the new one is drawn, so typing does not make it flash.
 */
export default function InvoicePdfPreview({ inv, fees, className = '' }) {
  const { t } = useT()
  const box = useRef(null)
  const canvas = useRef(null)
  const [blob, setBlob] = useState(null)
  const [width, setWidth] = useState(0)
  const [pages, setPages] = useState(1)
  const [drawn, setDrawn] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      invoicePdfBlob(inv, fees)
        .then((b) => { if (alive) { setBlob(b); setError('') } })
        .catch((e) => { if (alive) setError(e.message || String(e)) })
    }, 350)
    return () => { alive = false; clearTimeout(timer) }
  }, [inv.doc, inv.number, inv.issue_date, inv.due_date, inv.lang, inv.student_names, fees]) // eslint-disable-line react-hooks/exhaustive-deps

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
      .then(({ canvas: page, pages: n }) => {
        const c = canvas.current
        if (!alive || !c) return
        c.width = page.width
        c.height = page.height
        c.getContext('2d').drawImage(page, 0, 0)
        setPages(n)
        setDrawn(true)
        setError('')
      })
      .catch((e) => { if (alive) setError(e.message || String(e)) })
    return () => { alive = false }
  }, [blob, width])

  return (
    <div ref={box} className={`relative ${className}`}>
      <canvas ref={canvas} className="block h-auto w-full bg-white" style={{ aspectRatio: drawn ? undefined : '210 / 297' }} />
      {!drawn && !error && <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">{t('loading')}</div>}
      {pages > 1 && <div className="absolute right-2 top-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{pages} pages</div>}
      {error && <div className="absolute inset-x-0 bottom-0 bg-red-50 p-2 text-xs text-red-700">{error}</div>}
    </div>
  )
}
