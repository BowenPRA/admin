// Event photos: the curated pictures, internal description and draft Facebook
// posts for each event. The choosing, editing and writing are done on Bowen's
// laptop and sent up with the tab's "Upload event" button (eventUpload.js) or
// scripts/upload-event-photos.mjs; this tab is where the office reviews them.
// See supabase/updates-2026-09-28-event-photos.sql.
//
// These are children's pictures. With Supabase they sit in the private
// `adm-event-photos` bucket, which only office accounts can read, and the
// browser gets signed links. Offline development reads them from the
// git-ignored private/event-photos folder.
//
// Storage only holds photos that are still under review. "Finish event" keeps
// one look of each photo and deletes the rest. A photo that has been checked
// against the no-photo list can be chosen for the public website; once the
// website has it, the tab shows it from there and its Storage copy is deleted.
// See supabase/updates-2026-09-28-event-photos-website.sql.

import { supabase, hasSupabase } from './supabaseClient.js'
import { db } from './db.js'
import { todayISO } from './money.js'

const BUCKET = 'adm-event-photos'
const LINK_SECONDS = 24 * 60 * 60
const RENEW_MS = 2 * 60 * 60 * 1000
const links = new Map() // storage key -> { url, expires }

export const LOOKS = ['original', 'A', 'B', 'C']
export const FACEBOOK_PAGE = 'https://www.facebook.com/palmriveracademy'
// Where the public website is served. Its photos are at <this>/assets/img/photos/<slug>-<width>.webp
export const WEBSITE_URL = (import.meta.env.VITE_WEBSITE_URL || 'https://pra.edu.vn').replace(/\/$/, '')
export const SHAPES = { '4:5': [1440, 1800], '1:1': [1440, 1440], '3:2': [2048, 1365], '16:9': [2048, 1152] }

const setupHint = 'Event photos are not set up in the database yet. Run supabase/updates-2026-09-28-event-photos.sql in Supabase, then try again.'
const websiteHint = 'Choosing photos for the website is not set up in the database yet. Run supabase/updates-2026-09-28-event-photos-website.sql in Supabase, then try again.'
export const photoError = (e) => {
  const msg = e?.message || String(e)
  if (/'website' column|column .*website.* does not exist/i.test(msg)) return new Error(`${websiteHint} (${msg})`)
  return new Error(/bucket not found|adm_photo_events|adm_event_photos|adm_event_posts|schema cache|does not exist/i.test(msg) ? `${setupHint} (${msg})` : msg)
}

/** True once the photo is shown from the public website and has no copy in Storage. */
export const onWebsite = (photo) => !!photo?.files?.web

/** The widths the website builds for a picture this wide (the rule in the website's scripts/images.mjs). */
export function webSizes(width) {
  const out = []
  for (const w of [480, 960, 1600]) {
    const x = Math.min(w, width)
    if (out.length && x - out[out.length - 1] < 120) break
    out.push(x)
    if (x < w) break
  }
  return out
}
export const webUrl = (slug, width) => `${WEBSITE_URL}/assets/img/photos/${slug}-${width}.webp`

/** The key in Storage for one look of a photo, full size or thumbnail; or its address on the website. */
export const fileKey = (photo, look = photo?.look, thumb = false) => {
  const f = photo?.files || {}
  if (f.web) {
    const sizes = f.sizes?.length ? f.sizes : [480]
    return webUrl(f.web, thumb ? (sizes.find((s) => s >= 640) || sizes[sizes.length - 1]) : sizes[sizes.length - 1])
  }
  return f[thumb ? `${look}_thumb` : look] || f[look] || ''
}

/** The looks that can still be shown for this photo. */
export const looksOf = (photo) => (onWebsite(photo) ? [photo.look] : LOOKS.filter((l) => photo?.files?.[l]))

/** The keys a photo has in Storage (none once it is on the website). */
export const storageKeys = (photo) => Object.values(photo?.files || {}).filter((v) => typeof v === 'string' && /\.jpg$/.test(v) && !/^https?:/.test(v))

/** A link the browser can show, or '' while it is not ready. */
export function fileUrl(key) {
  if (!key) return ''
  if (/^https?:/.test(key)) return key
  if (!hasSupabase) return import.meta.env.DEV ? `${import.meta.env.BASE_URL}private/event-photos/${key}` : ''
  return links.get(key)?.url || ''
}

/** Asks Storage for signed links to any of these keys that are missing or about to expire. */
export async function prepareFiles(keys) {
  if (!hasSupabase) return false
  const soon = Date.now() + RENEW_MS
  const want = [...new Set((keys || []).filter((k) => k && !/^https?:/.test(k)))].filter((k) => !(links.get(k)?.expires > soon))
  if (!want.length) return false
  let changed = false
  for (let i = 0; i < want.length; i += 200) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(want.slice(i, i + 200), LINK_SECONDS)
    if (error) throw photoError(error)
    const expires = Date.now() + LINK_SECONDS * 1000
    for (const row of data || []) if (row.signedUrl && !row.error) { links.set(row.path, { url: row.signedUrl, expires }); changed = true }
  }
  return changed
}

export const allKeys = (photos) => photos.flatMap(storageKeys)
export const thumbKeys = (photos) => photos.flatMap((p) => LOOKS.map((l) => fileKey(p, l, true)))

/**
 * Removes a photo for good: its pictures first, then its record. The original on the shared drive is not touched.
 * Ask stillPublic() first: a photo on the website must keep its record until the website has dropped it.
 */
export async function removePhoto(photo) {
  if (hasSupabase) {
    const keys = storageKeys(photo)
    const { error } = keys.length ? await supabase.storage.from(BUCKET).remove(keys) : {}
    if (error) throw photoError(error)
  }
  await db.eventPhotos.remove(photo.id)
}

/** Removes an event with its photos and posts. Ask stillPublic() first, as for one photo. */
export async function removeEvent(event, photos) {
  if (hasSupabase && allKeys(photos).length) {
    const { error } = await supabase.storage.from(BUCKET).remove(allKeys(photos))
    if (error) throw photoError(error)
  }
  await db.photoEvents.remove(event.id)
}

/** Offline only: takes in an event.json made by package.py. The pictures are read from private/event-photos. */
export async function importBundle(bundle) {
  if (!bundle?.event?.slug || !Array.isArray(bundle.photos)) throw new Error('This is not an event file made by package.py.')
  const events = await db.photoEvents.list()
  const was = events.find((e) => e.slug === bundle.event.slug)
  const ev = await db.photoEvents.save({ ...(was || {}), ...bundle.event })
  const old = await db.eventPhotos.list(ev.id)
  const byCode = new Map(old.map((p) => [p.code, p]))
  // As with the upload script: what the office changed in the tab is kept.
  await db.eventPhotos.saveMany(bundle.photos.map((p) => {
    const had = byCode.get(p.code)
    const kept = had ? { title: had.title, caption: had.caption, look: had.look, listed: had.listed, cleared: had.cleared, cleared_by: had.cleared_by, cleared_on: had.cleared_on } : { listed: true }
    return { ...p, ...kept, id: had?.id, event_id: ev.id }
  }))
  const posts = await db.eventPosts.list(ev.id)
  const have = new Set(posts.map((p) => `${p.kind}/${p.seq}`))
  await db.eventPosts.saveMany((bundle.posts || []).filter((p) => !have.has(`${p.kind}/${p.seq || 1}`)).map((p) => ({ ...p, seq: p.seq || 1, status: 'draft', event_id: ev.id })))
  return ev
}

// ---------------- Pictures for a post ----------------

const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => resolve(img)
  img.onerror = () => reject(new Error('A picture could not be loaded. Reload the page and try again.'))
  img.src = url
})

/** Where a crop of this shape sits in a picture so that the focus point stays in it. */
export function cropBox(w, h, shape, focus) {
  if (!SHAPES[shape]) return { x: 0, y: 0, w, h }
  const [rw, rh] = shape.split(':').map(Number)
  const target = rw / rh
  const cw = w / h > target ? Math.round(h * target) : w
  const ch = w / h > target ? h : Math.round(w / target)
  const [fx, fy] = Array.isArray(focus) && focus.length === 2 ? focus : [0.5, 0.45]
  return {
    x: Math.min(Math.max(0, Math.round(fx * w - cw / 2)), w - cw),
    y: Math.min(Math.max(0, Math.round(fy * h - ch * 0.45)), h - ch), // a little more room above the subject than below
    w: cw, h: ch,
  }
}

/** One photo cut to the post's shape, as a JPEG. */
export async function croppedBlob(photo, shape) {
  const key = fileKey(photo)
  await prepareFiles([key])
  const img = await loadImage(fileUrl(key))
  const box = cropBox(img.naturalWidth, img.naturalHeight, shape, photo.focus)
  const max = SHAPES[shape]?.[0] || 2048
  const scale = Math.min(1, max / box.w)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(box.w * scale)
  canvas.height = Math.round(box.h * scale)
  canvas.getContext('2d').drawImage(img, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) throw new Error('A picture could not be prepared.')
  return blob
}

// A zip with the files stored as they are (JPEGs do not compress). Small enough
// to write here, so the app needs no zip library.
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
const crc32 = (bytes) => { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }

/** @param {{ name: string, bytes: Uint8Array }[]} files */
export function zipStore(files) {
  const enc = new TextEncoder()
  const parts = []
  const central = []
  let offset = 0
  const d = new Date()
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  for (const f of files) {
    const name = enc.encode(f.name)
    const crc = crc32(f.bytes)
    const head = new DataView(new ArrayBuffer(30))
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true); head.setUint16(8, 0, true)
    head.setUint16(10, time, true); head.setUint16(12, date, true); head.setUint32(14, crc, true)
    head.setUint32(18, f.bytes.length, true); head.setUint32(22, f.bytes.length, true); head.setUint16(26, name.length, true); head.setUint16(28, 0, true)
    parts.push(new Uint8Array(head.buffer), name, f.bytes)
    const cen = new DataView(new ArrayBuffer(46))
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true)
    cen.setUint16(12, time, true); cen.setUint16(14, date, true); cen.setUint32(16, crc, true)
    cen.setUint32(20, f.bytes.length, true); cen.setUint32(24, f.bytes.length, true); cen.setUint16(28, name.length, true)
    cen.setUint32(42, offset, true)
    central.push(new Uint8Array(cen.buffer), name)
    offset += 30 + name.length + f.bytes.length
  }
  const size = central.reduce((n, p) => n + p.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true)
  end.setUint32(12, size, true); end.setUint32(16, offset, true)
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' })
}

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'photo'

/**
 * The photos of a post, cut to its shape and numbered in posting order, as one zip.
 * @returns {Promise<{ blob: Blob, name: string }>}
 */
export async function postZip(event, post, photos) {
  const files = []
  for (const [i, p] of photos.entries()) {
    const blob = await croppedBlob(p, post.shape)
    files.push({ name: `${String(i + 1).padStart(2, '0')}-${slug(p.title)}.jpg`, bytes: new Uint8Array(await blob.arrayBuffer()) })
  }
  files.push({ name: 'caption.txt', bytes: new TextEncoder().encode(`${post.caption}\n`) })
  return { blob: zipStore(files), name: `${event.slug}-${post.kind}.zip` }
}

export function saveBlob(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/** Tag groups in the order they are shown, with their labels. */
export const TAG_GROUPS = [
  ['stage', 'phTagStage'], ['class', 'phTagClass'], ['activity', 'phTagActivity'], ['shot', 'phTagShot'],
  ['setting', 'phTagSetting'], ['people', 'phTagPeople'], ['use', 'phTagUse'],
]
export const tagValues = (photo, group) => {
  const v = photo?.tags?.[group]
  return Array.isArray(v) ? v : v ? [v] : []
}
export const SINGLE_TAGS = new Set(['shot', 'setting', 'light', 'kind'])

// ---------------- Finishing an event, and the website ----------------

async function removeKeys(keys) {
  if (!hasSupabase) return
  for (let i = 0; i < keys.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(keys.slice(i, i + 100))
    if (error) throw photoError(error)
  }
}

/** What finishing would keep and delete. Changes nothing. */
export function finishPlan(photos) {
  const rows = photos.filter((p) => !onWebsite(p)).map((p) => {
    const look = p.files?.[p.look] ? p.look : LOOKS.find((l) => p.files?.[l]) || p.look
    const keep = Object.fromEntries([look, `${look}_thumb`].filter((k) => p.files?.[k]).map((k) => [k, p.files[k]]))
    const kept = new Set(Object.values(keep))
    return { photo: p, look, keep, drop: storageKeys(p).filter((k) => !kept.has(k)) }
  })
  return { rows, drop: rows.reduce((n, r) => n + r.drop.length, 0), keep: rows.reduce((n, r) => n + Object.keys(r.keep).length, 0) }
}

/**
 * Keeps the chosen look of every photo and deletes the other looks from Storage.
 * Uploading the event again from the laptop brings every look back.
 * @returns {Promise<{ photos: object[], removed: number }>} the photos as they are now
 */
export async function finishEvent(photos) {
  const plan = finishPlan(photos)
  const out = new Map()
  for (const r of plan.rows) {
    if (!r.drop.length) continue
    // The record first: a photo must never point at a picture that has gone.
    const row = await db.eventPhotos.patch(r.photo.id, { files: r.keep, look: r.look })
    out.set(r.photo.id, row)
    await removeKeys(r.drop)
  }
  return { photos: photos.map((p) => out.get(p.id) || p), removed: plan.drop }
}

const plainSlug = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** The name a photo gets on the website: the event, its year, and the photo's title. */
export function websiteSlug(event, photo, taken = []) {
  const year = String(event.event_date || '').slice(0, 4)
  const base = [plainSlug(event.name), year, plainSlug(photo.title) || photo.code].filter(Boolean).join('-').slice(0, 80).replace(/-$/, '')
  const used = new Set(taken)
  let slug = base
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`
  return slug
}

/** May this photo go on the public website? Only when it is in the album and has been checked. */
export const canPublish = (photo) => photo.listed !== false && !!photo.cleared

/** The file the laptop needs to put the chosen photos on the website. */
export function websiteList(event, photos) {
  const chosen = photos.filter((p) => p.website?.want && p.website?.slug && canPublish(p)).sort((a, b) => (a.seq || 999) - (b.seq || 999))
  const was = photos.filter((p) => p.website?.slug && !(p.website?.want && canPublish(p)))
  const publicTags = (p) => ['stage', 'activity', 'setting'].flatMap((g) => tagValues(p, g))
  return {
    made: new Date().toISOString(),
    event: { slug: event.slug, name: event.name, event_date: event.event_date, school_year: event.school_year },
    photos: chosen.map((p) => ({
      code: p.code, look: p.look, slug: p.website.slug, title: p.title, alt: p.caption, taken: event.event_date,
      tags: [...new Set(publicTags(p))], focus: p.focus || null, width: p.width, height: p.height, already: onWebsite(p),
    })),
    // Chosen once and since unticked, delisted or no longer checked: the website must drop them.
    take_down: was.map((p) => p.website.slug),
  }
}

const loads = (url) => new Promise((resolve) => {
  const img = new Image()
  img.onload = () => resolve(img.naturalWidth > 0)
  img.onerror = () => resolve(false)
  img.src = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
})

/**
 * The photos that are public or about to be: chosen for the website, or still served by it.
 * Their records must stay. The list made from them is the only thing that tells the website
 * to take a picture down, so a photo removed here too early would stay public.
 */
export async function stillPublic(photos) {
  const sent = photos.filter((p) => p.website?.slug)
  const live = await Promise.all(sent.map((p) => !!p.website.want || loads(webUrl(p.website.slug, (p.files?.sizes || webSizes(p.width || 480))[0]))))
  return sent.filter((p, i) => live[i])
}

/**
 * For each chosen photo the website now serves: point the record at the website
 * and delete the Storage copy. A photo the website does not have yet is left alone.
 * @returns {Promise<{ photos: object[], moved: number, waiting: string[] }>}
 */
export async function moveToWebsite(photos, step = () => {}) {
  const todo = photos.filter((p) => p.website?.want && p.website?.slug && canPublish(p) && !onWebsite(p))
  const out = new Map()
  const waiting = []
  let moved = 0
  for (const [i, p] of todo.entries()) {
    step({ done: i, total: todo.length })
    const sizes = webSizes(p.width)
    const there = (await Promise.all(sizes.map((s) => loads(webUrl(p.website.slug, s))))).every(Boolean)
    if (!there) { waiting.push(p.title || p.code); continue }
    const keys = storageKeys(p)
    const row = await db.eventPhotos.patch(p.id, { files: { web: p.website.slug, sizes }, website: { ...p.website, moved_on: todayISO() } })
    out.set(p.id, row)
    await removeKeys(keys)
    moved++
  }
  step({ done: todo.length, total: todo.length })
  return { photos: photos.map((p) => out.get(p.id) || p), moved, waiting }
}

/** The chip colour for a score out of 10. */
export const scoreTone = (s) => (s >= 9 ? 'navy' : s >= 7 ? 'green' : s >= 5 ? 'sky' : 'slate')
