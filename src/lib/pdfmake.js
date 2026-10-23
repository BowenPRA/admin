// pdfmake and its Roboto font (which has Vietnamese accents), loaded on first
// use. Shared by the invoice and progress report PDFs.

let pdfMakePromise = null
export function loadPdfMake() {
  pdfMakePromise ||= Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
    .then(([lib, fonts]) => {
      const pdfMake = lib.default || lib
      pdfMake.addVirtualFileSystem(fonts.default || fonts)
      return pdfMake
    })
    .catch((e) => { pdfMakePromise = null; throw e })
  return pdfMakePromise
}

export const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result))
  r.onerror = reject
  r.readAsDataURL(blob)
})

/** A file from `public/` as a data URL. */
export async function publicDataUrl(file) {
  const res = await fetch(`${import.meta.env.BASE_URL}${file}`)
  if (!res.ok) throw new Error(`Could not load ${file}`)
  return blobToDataUrl(await res.blob())
}

// Be Vietnam Pro (public/fonts), the face of names and headings on the progress
// report since 23 October 2026, registered as 'BeVietnamProStrong' (Medium, Bold).
// The newsletter PDF loads the same files for itself (newsletter/pdf.js).
const BRAND_FONT_FILES = ['BeVietnamPro-Medium.ttf', 'BeVietnamPro-Bold.ttf', 'BeVietnamPro-Italic.ttf', 'BeVietnamPro-SemiBoldItalic.ttf']
let brandFontsPromise = null
/** Registers Be Vietnam Pro with pdfmake once; resolves true, or false when the files did not load. */
export function loadBrandFonts(pdfMake) {
  brandFontsPromise ||= Promise.all(BRAND_FONT_FILES.map(async (f) => [f, (await publicDataUrl(`fonts/${f}`)).split(',')[1]]))
    .then((files) => {
      pdfMake.addVirtualFileSystem(Object.fromEntries(files))
      pdfMake.addFonts({
        BeVietnamProStrong: {
          normal: 'BeVietnamPro-Medium.ttf', bold: 'BeVietnamPro-Bold.ttf',
          italics: 'BeVietnamPro-Italic.ttf', bolditalics: 'BeVietnamPro-SemiBoldItalic.ttf',
        },
      })
      return true
    })
    .catch((e) => {
      brandFontsPromise = null
      console.warn('Be Vietnam Pro did not load; the PDF uses Roboto.', e)
      return false
    })
  return brandFontsPromise
}
