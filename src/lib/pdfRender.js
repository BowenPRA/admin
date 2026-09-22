// Draws a PDF page onto a canvas with pdf.js (loaded on first use). Used for
// the invoice preview: unlike the browser's built-in PDF viewer in an iframe,
// a canvas can be swapped without flashing while the invoice is being edited.
// The legacy build carries polyfills for browsers a few versions old.

let pdfjsPromise = null
function loadPdfjs() {
  pdfjsPromise ||= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.min.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ])
    .then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      // One worker for every render, instead of starting a new one each time.
      return { pdfjs, worker: new pdfjs.PDFWorker() }
    })
    .catch((e) => { pdfjsPromise = null; throw e })
  return pdfjsPromise
}

/**
 * Renders page `pageNumber` (default 1) of `blob` `pixelWidth` pixels wide.
 * @returns {Promise<{ canvas: HTMLCanvasElement, pages: number }>}
 */
export async function renderPdfPage(blob, pixelWidth, pageNumber = 1) {
  const { pdfjs, worker } = await loadPdfjs()
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), worker })
  try {
    const doc = await task.promise
    const page = await doc.getPage(Math.min(pageNumber, doc.numPages))
    const viewport = page.getViewport({ scale: pixelWidth / page.getViewport({ scale: 1 }).width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
    return { canvas, pages: doc.numPages }
  } finally {
    task.destroy()
  }
}
