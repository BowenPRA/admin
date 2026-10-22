// Newsletter photos. While an issue is written they sit in the private bucket
// `adm-newsletter` (office and teachers can read them through signed links). At
// Publish each one is copied, in two sizes, to the public bucket `newsletter`
// under the issue's slug, which is what the website, the email and the PDF use.
//
// Every photo is redrawn in the browser before it is stored: at most 2000 px on
// its longest side, as a JPEG. Redrawing drops the camera's hidden data,
// including where the photo was taken.
//
// Offline (no Supabase) photos are kept small in this browser, for trying the
// editor out only.

import { supabase, hasSupabase } from '../supabaseClient.js'
import { genId } from '../db.js'
import { BUCKET, PUBLIC_BUCKET } from './constants.js'
import { newsletterError } from './data.js'

const LINK_SECONDS = 6 * 60 * 60
const RENEW_MS = 60 * 60 * 1000
const links = new Map() // key -> { url, expires }
const LS = 'pra-admin-newsletter-photos-v1'
const local = new Map() // offline: key -> data URL

function lsPhotos() { try { return JSON.parse(localStorage.getItem(LS) || '{}') } catch { return {} } }
if (!hasSupabase) for (const [k, v] of Object.entries(lsPhotos())) local.set(k, v)

/** Loads a picture from a File, a Blob or an address. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    let url = src
    if (typeof src !== 'string') url = URL.createObjectURL(src)
    else if (/^https?:/.test(src)) img.crossOrigin = 'anonymous'
    img.onload = () => { if (typeof src !== 'string') URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { if (typeof src !== 'string') URL.revokeObjectURL(url); reject(new Error('That picture could not be read. Try a JPEG or PNG photo.')) }
    img.src = url
  })
}

/** Redraws a picture at most `max` px on its longest side, as a JPEG Blob: { blob, w, h }. */
export async function redraw(src, max = 2000, quality = 0.85) {
  const img = await loadImage(src)
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k))
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, w, h)
  g.drawImage(img, 0, 0, w, h)
  const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('That picture could not be made smaller.')
  return { blob, w, h }
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(blob) })

async function store(key, blob) {
  if (!hasSupabase) {
    // Offline the browser keeps a smaller copy.
    const small = await redraw(blob, 1000, 0.7)
    const url = await blobToDataUrl(small.blob)
    local.set(key, url)
    try { localStorage.setItem(LS, JSON.stringify({ ...lsPhotos(), [key]: url })) } catch { /* full: kept until reload */ }
    return
  }
  const { error } = await supabase.storage.from(BUCKET).upload(key, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw newsletterError(error)
}

/**
 * Stores a photo for an issue and returns it as a part holds it:
 * { id, key, w, h, en, vi, cleared, source, added_by, added_on }.
 * `extra` adds or overrides fields (an album photo arrives already cleared, with its caption).
 */
export async function addPhoto(issueId, source, { by = '', extra = {} } = {}) {
  const id = genId().replace(/-/g, '').slice(0, 12)
  const { blob, w, h } = await redraw(source)
  const key = `${issueId}/${id}.jpg`
  await store(key, blob)
  // Its link straight away, so it shows at once (the cover too), not only after the page is loaded again.
  if (hasSupabase) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(key, LINK_SECONDS)
    if (data?.signedUrl) links.set(key, { url: data.signedUrl, expires: Date.now() + LINK_SECONDS * 1000 })
  }
  return { id, key, w, h, en: '', vi: '', cleared: false, source: 'upload', added_by: by, added_on: new Date().toISOString().slice(0, 10), ...extra }
}

/** Removes a photo's file. A file that will not go is only logged: the part no longer shows it. */
export async function dropPhotoFile(photo) {
  if (!photo?.key) return
  if (!hasSupabase) { local.delete(photo.key); try { const all = lsPhotos(); delete all[photo.key]; localStorage.setItem(LS, JSON.stringify(all)) } catch { /* ignore */ } return }
  const { error } = await supabase.storage.from(BUCKET).remove([photo.key])
  if (error) console.warn('Newsletter photo not removed:', error.message)
}

/** Gets signed links for any of these photos that do not have a fresh one. Returns true when something new came. */
export async function preparePhotoLinks(photos) {
  if (!hasSupabase) return false
  const soon = Date.now() + RENEW_MS
  const want = [...new Set((photos || []).map((p) => p?.key).filter((k) => k && !/^(https?:|web:)/.test(k)))].filter((k) => !(links.get(k)?.expires > soon))
  if (!want.length) return false
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(want, LINK_SECONDS)
  if (error) throw newsletterError(error)
  const expires = Date.now() + LINK_SECONDS * 1000
  let changed = false
  for (const row of data || []) if (row.signedUrl && !row.error) { links.set(row.path, { url: row.signedUrl, expires }); changed = true }
  return changed
}

/**
 * Links that last `seconds` (a week by default), for a test email someone opens
 * days later. Returns a Map photo.key -> { src, small }.
 */
export async function lastingPhotoLinks(photos, seconds = 7 * 24 * 60 * 60) {
  const out = new Map()
  const keys = [...new Set((photos || []).map((p) => p?.key).filter(Boolean))]
  const stored = hasSupabase ? keys.filter((k) => !/^(https?:|web:)/.test(k)) : []
  for (const k of keys) if (!stored.includes(k)) { const l = photoLink({ key: k }); if (l) out.set(k, l) }
  if (!stored.length) return out
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(stored, seconds)
  if (error) throw newsletterError(error)
  for (const row of data || []) if (row.signedUrl && !row.error) out.set(row.path, { src: row.signedUrl, small: row.signedUrl })
  return out
}

/** Where the browser can show a photo from now: { src, small }, or null while its link is not ready. */
export function photoLink(photo) {
  const key = photo?.key
  if (!key) return null
  if (/^https?:/.test(key)) return { src: key, small: key }
  if (key.startsWith('web:')) { const s = key.slice(4); return { src: `https://pra.edu.vn/assets/img/photos/${s}-960.webp`, small: `https://pra.edu.vn/assets/img/photos/${s}-480.webp` } }
  if (!hasSupabase) { const u = local.get(key); return u ? { src: u, small: u } : null }
  const u = links.get(key)?.url
  return u ? { src: u, small: u } : null
}

// ---------------- publishing ----------------
const publicUrl = (path) => supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl

/** Puts a file in the issue's public folder and returns its address. */
export async function putPublic(path, blob, contentType) {
  if (!hasSupabase) return URL.createObjectURL(blob)
  const { error } = await supabase.storage.from(PUBLIC_BUCKET).upload(path, blob, { contentType, upsert: true, cacheControl: '3600' })
  if (error) throw newsletterError(error)
  return publicUrl(path)
}

/**
 * Copies photos to the issue's public folder, 1600 px and 800 px wide.
 * The file names carry a count of how often the issue has been published, so a
 * photo changed and published again is never shown from an old cached copy.
 * Returns a Map photo.key -> { src, small }.
 */
export async function publishPhotos(slug, photos, round, onEach = () => {}) {
  const out = new Map()
  const todo = [...new Map((photos || []).filter((p) => p?.key).map((p) => [p.key, p])).values()]
  await preparePhotoLinks(todo).catch(() => {})
  let done = 0
  for (const p of todo) {
    const from = photoLink(p)?.src
    if (!from) throw new Error(`A photo could not be read from storage (${p.en || p.key}). Reload the page and publish again.`)
    const big = await redraw(from, 1600, 0.84)
    const small = await redraw(big.blob, 800, 0.8)
    const base = `${slug}/r${round}-${p.id || p.key.split('/').pop().replace(/\.jpg$/, '')}`
    const [src, sm] = await Promise.all([putPublic(`${base}-1600.jpg`, big.blob, 'image/jpeg'), putPublic(`${base}-800.jpg`, small.blob, 'image/jpeg')])
    out.set(p.key, { src, small: sm })
    onEach(++done, todo.length)
  }
  return out
}

/** A published photo's public addresses, worked out the way publishPhotos names them. */
export function publishedPhotoLink(slug, round, photo) {
  if (!hasSupabase || !photo?.key) return photoLink(photo)
  const base = `${slug}/r${round}-${photo.id || photo.key.split('/').pop().replace(/\.jpg$/, '')}`
  return { src: publicUrl(`${base}-1600.jpg`), small: publicUrl(`${base}-800.jpg`) }
}

/** Removes an issue's public folder (Take off the website). */
export async function removePublicFolder(slug) {
  if (!hasSupabase) return
  for (;;) {
    const { data, error } = await supabase.storage.from(PUBLIC_BUCKET).list(slug, { limit: 1000 })
    if (error) throw newsletterError(error)
    const paths = (data || []).map((f) => `${slug}/${f.name}`)
    if (!paths.length) return
    const { error: e2 } = await supabase.storage.from(PUBLIC_BUCKET).remove(paths)
    if (e2) throw newsletterError(e2)
    if (paths.length < 1000) return
  }
}

/** Removes an issue's older public files (an earlier round of publishing), keeping round `keep`. */
export async function removeOldRounds(slug, keep) {
  if (!hasSupabase) return
  const { data, error } = await supabase.storage.from(PUBLIC_BUCKET).list(slug, { limit: 1000 })
  if (error) return
  const old = (data || []).map((f) => f.name).filter((n) => !n.startsWith(`r${keep}-`)).map((n) => `${slug}/${n}`)
  if (old.length) await supabase.storage.from(PUBLIC_BUCKET).remove(old)
}
