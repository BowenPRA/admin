import { supabase, hasSupabase } from '../supabaseClient.js'
import { PHOTO_BUCKET, photoKey } from '../photoKey.js'

// Student photos are children's pictures, so they are never part of the public
// site. With Supabase they sit in the private `adm-photos` bucket (see
// supabase/updates-2026-09-22-private-photos.sql) and each signed-in browser gets
// signed links for them; offline development reads them from the git-ignored
// private/photos folder. Photos added in the student form are data URLs saved
// on the student row, which is already behind the login.

const LINK_SECONDS = 24 * 60 * 60
const RENEW_MS = 2 * 60 * 60 * 1000 // re-sign links with less than this left
const links = new Map() // storage key -> { url, expires }
let warned = false

/** The image URL for a student's `photo`, or null while its link is not ready (the Avatar shows initials). */
export function photoSrc(photo) {
  if (!photo) return null
  if (photo.startsWith('data:') || photo.startsWith('http')) return photo
  if (!hasSupabase) return import.meta.env.DEV ? `${import.meta.env.BASE_URL}private/${photo}` : null
  return links.get(photoKey(photo))?.url || null
}

/**
 * Makes sure photoSrc() can answer for these photos: asks Storage for signed
 * links to any that are missing or about to expire, in one request.
 * @returns {Promise<boolean>} true when a link was added or renewed
 */
export async function preparePhotos(photos) {
  if (!hasSupabase) return false
  const soon = Date.now() + RENEW_MS
  const keys = [...new Set((photos || [])
    .filter((p) => p && !p.startsWith('data:') && !p.startsWith('http'))
    .map(photoKey))]
    .filter((k) => !(links.get(k)?.expires > soon))
  if (!keys.length) return false
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(keys, LINK_SECONDS)
  if (error) {
    // Most likely the bucket is not set up yet: the app still works, with initials instead of photos.
    if (!warned) { console.warn(`Student photos unavailable (${error.message}). Run supabase/updates-2026-09-22-private-photos.sql, then scripts/upload-student-photos.mjs.`); warned = true }
    return false
  }
  const expires = Date.now() + LINK_SECONDS * 1000
  let changed = false
  for (const row of data || []) {
    if (row.signedUrl && !row.error) { links.set(row.path, { url: row.signedUrl, expires }); changed = true }
  }
  return changed
}

export function resizeImage(file, max = 360) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')) }
    img.src = url
  })
}
