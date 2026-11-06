// Files on a lesson request: photos of book pages, the teacher's own slides and
// worksheets. With Supabase they go in the private `adm-lessons` bucket at
// <request id>/<file name> and the row lists them; offline they are kept as data
// URLs in the row itself. See supabase/updates-2026-11-05-lessons.sql.

import { supabase, hasSupabase } from './supabaseClient.js'
import { prepareProofFile } from './proof.js'
import { lessonsError } from './lessons.js'

const BUCKET = 'adm-lessons'
export const MAX_LESSON_FILES = 12
const MAX_BYTES = 25 * 1024 * 1024
/** What the file picker offers: pictures, PDFs and Office files (the bucket takes nothing else). */
export const LESSON_ACCEPT = 'image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx'

const OFFICE_TYPES = {
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export const isImageFile = (entry) => /^image\//.test(entry?.type || '')

const readDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result))
  r.onerror = reject
  r.readAsDataURL(blob)
})

/**
 * Gets a picked / pasted / dropped file ready to store. Pictures are scaled the way
 * proof-of-payment screenshots are (book text stays sharp at 2200 px); PDFs and Office
 * files are kept as they are, up to 25 MB.
 * @returns {Promise<{ blob: Blob, name: string, type: string, ext: string }>}
 */
export async function prepareLessonFile(file) {
  if (/^image\//.test(file.type)) return prepareProofFile(file)
  const ext = (file.name.match(/\.([A-Za-z0-9]{1,8})$/) || [])[1]?.toLowerCase() || ''
  const type = file.type === 'application/pdf' || ext === 'pdf' ? 'application/pdf' : OFFICE_TYPES[ext]
  if (!type) throw new Error(`"${file.name || 'This file'}" is not a picture, a PDF or an Office file.`)
  if (file.size > MAX_BYTES) throw new Error(`"${file.name}" is larger than 25 MB.`)
  return { blob: file, name: file.name || `file.${ext}`, type, ext: ext || 'pdf' }
}

/** A name safe for a storage path, not already used on the request: "page 40 (1).jpg" -> "page-40-1.jpg". */
export function storageName(name, taken = []) {
  const m = String(name || 'file').match(/^(.*?)(\.[A-Za-z0-9]{1,8})?$/)
  const base = (m[1] || 'file').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file'
  const ext = (m[2] || '').toLowerCase()
  const used = new Set(taken.map((t) => String(t).split('/').pop()))
  let out = `${base}${ext}`
  for (let n = 2; used.has(out); n++) out = `${base}-${n}${ext}`
  return out
}

/** Stores one prepared file for a request and returns the entry to keep in `request.files`. */
export async function uploadLessonFile(requestId, prepared, by, taken = []) {
  const name = storageName(prepared.name, taken)
  const entry = { name: prepared.name, type: prepared.type, size: prepared.blob.size, at: new Date().toISOString(), by: by || '' }
  if (!hasSupabase) return { ...entry, path: `${requestId}/${name}`, data: await readDataUrl(prepared.blob) }
  const path = `${requestId}/${name}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, prepared.blob, { contentType: prepared.type, upsert: false })
  if (error) throw new Error(lessonsError(error))
  return { ...entry, path }
}

/** A link the browser can show: signed for an hour (Supabase), or a data URL (offline, or a file not uploaded yet). */
export async function lessonFileUrl(entry) {
  if (entry?.blob) return readDataUrl(entry.blob)
  if (entry?.data) return entry.data
  if (!entry?.path || !hasSupabase) return ''
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(entry.path, 3600)
  if (error) throw new Error(lessonsError(error))
  return data.signedUrl
}

/** Removes stored files (when one is taken off a request, or the request is deleted). */
export async function removeLessonFiles(entries) {
  const paths = (entries || []).filter((e) => !e?.data).map((e) => e?.path).filter(Boolean)
  if (!paths.length || !hasSupabase) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw new Error(lessonsError(error))
}
