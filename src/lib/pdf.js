// Turn a rendered A4 document node into a PDF (jsPDF + html2canvas).
// Used for emailing invoices and for the Download PDF button; the print route
// still uses the browser's own print-to-PDF, which gives selectable text.

import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'

const A4 = { w: 210, h: 297 }

/** @param {HTMLElement} node an element laid out at 210mm wide */
export async function nodeToPdf(node, { scale = 2 } = {}) {
  const canvas = await html2canvas(node, { scale, useCORS: true, backgroundColor: '#ffffff', logging: false, windowWidth: node.scrollWidth })
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const pageHeightPx = Math.floor((A4.h / A4.w) * canvas.width)
  let y = 0
  let first = true
  while (y < canvas.height) {
    const h = Math.min(pageHeightPx, canvas.height - y)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = h
    slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
    if (!first) pdf.addPage()
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A4.w, (h / canvas.width) * A4.w)
    first = false
    y += h
  }
  return pdf
}

export async function nodeToPdfBlob(node, opts) {
  const pdf = await nodeToPdf(node, opts)
  return pdf.output('blob')
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
