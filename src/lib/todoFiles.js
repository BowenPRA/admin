// Files on a To-Do task: screenshots, PDFs, documents. With Supabase they go in
// the private `adm-todo` bucket and the task row lists them; offline they are
// kept as data URLs in the row itself. See supabase/updates-2026-10-01-todos.sql.

import { supabase, hasSupabase } from './supabaseClient.js'
import { prepareProofFile } from './proof.js'
import { todosError } from './todos.js'

const BUCKET = 'adm-todo'
export const MAX_TODO_FILES = 10
const MAX_BYTES = 10 * 1024 * 1024

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
export const isImageFile = (entry) => /^image\//.test(entry?.type || '')

const readDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result))
  r.onerror = reject
  r.readAsDataURL(blob)
})

/**
 * Gets a picked / pasted / dropped file ready to store. Pictures are scaled
 * down the same way proof-of-payment screenshots are; anything else is kept
 * as it is, up to 10 MB.
 * @returns {Promise<{ blob: Blob, name: string, type: string, ext: string }>}
 */
export async function prepareTodoFile(file) {
  if (/^image\//.test(file.type) || file.type === 'application/pdf') return prepareProofFile(file)
  if (file.size > MAX_BYTES) throw new Error(`"${file.name}" is larger than 10 MB.`)
  const ext = (file.name.match(/\.([A-Za-z0-9]{1,8})$/) || [])[1]?.toLowerCase() || 'bin'
  return { blob: file, name: file.name || `file.${ext}`, type: file.type || 'application/octet-stream', ext }
}

/** Stores one prepared file for a task and returns the entry to keep in `todo.files`. */
export async function uploadTodoFile(todoId, prepared) {
  const entry = { name: prepared.name, type: prepared.type, size: prepared.blob.size, added_at: new Date().toISOString() }
  if (!hasSupabase) return { ...entry, data: await readDataUrl(prepared.blob) }
  const path = `${todoId}/${newId()}.${prepared.ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, prepared.blob, { contentType: prepared.type, upsert: false })
  if (error) throw new Error(todosError(error))
  return { ...entry, path }
}

/** A link the browser can show: signed for an hour (Supabase), or a data URL (offline, or a file not uploaded yet). */
export async function todoFileUrl(entry) {
  if (entry?.blob) return readDataUrl(entry.blob)
  if (entry?.data) return entry.data
  if (!entry?.path || !hasSupabase) return ''
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(entry.path, 3600)
  if (error) throw new Error(todosError(error))
  return data.signedUrl
}

/** Removes stored files (when one is taken off a task, or the task is deleted). */
export async function removeTodoFiles(entries) {
  const paths = (entries || []).map((e) => e?.path).filter(Boolean)
  if (!paths.length || !hasSupabase) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw new Error(todosError(error))
}
