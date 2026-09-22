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
