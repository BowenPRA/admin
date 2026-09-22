// Invoice → one-page A4 PDF with real (selectable, sharp) text. The same PDF is
// shown in the editor preview, opened for printing, downloaded and attached to
// Gmail drafts, so what the office checks is exactly what parents receive.
// pdfmake and its Roboto font (which has Vietnamese accents) load on first use.

import { fmtDate } from './money'
import { fitInvoicePdf } from './invoicePdfLayout'
import { loadPdfMake, publicDataUrl } from './pdfmake'

const IMAGES = { logo: 'logo.png', vietqr: 'vietqr-logo.png', brands: 'pay-brands.png' }

let imagesPromise = null
function loadImages() {
  imagesPromise ||= Promise.all(Object.entries(IMAGES).map(async ([key, file]) => [key, await publicDataUrl(file)]))
    .then(Object.fromEntries)
    .catch((e) => { imagesPromise = null; throw e })
  return imagesPromise
}

/** PDF of a saved invoice. */
export async function invoicePdfBlob(inv, fees) {
  const [pdfMake, images] = await Promise.all([loadPdfMake(), loadImages()])
  const out = await fitInvoicePdf(pdfMake, {
    doc: inv.doc, fees, images,
    number: inv.number, issueDate: fmtDate(inv.issue_date, inv.lang),
    dueDate: inv.due_date ? fmtDate(inv.due_date, inv.lang) : '',
    students: inv.student_names,
  })
  return out.getBlob()
}
