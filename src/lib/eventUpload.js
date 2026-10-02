// Sends one event's package to the Photos tab from the browser, as the signed-in
// office account. The package is the `current` folder that package.py writes in
// the photo library on the laptop: event.json and a files/ folder of pictures.
//
// It does what scripts/upload-event-photos.mjs does, without the secret key: the
// office accounts that can open the Photos tab are allowed to write its tables
// and its storage bucket (supabase/updates-2026-09-28-event-photos.sql).
//
// Safe to run again. A second upload replaces the pictures and the scores and
// adds new photos and posts. It keeps what the office has changed in the tab
// (titles, captions, the chosen look, delisting, the no-photo sign-off, the text
// of posts) unless "replace the text" is chosen, and it never touches a post
// that has been posted or undoes a sign-off.

import { supabase, hasSupabase } from './supabaseClient.js'
import { db, dbMode } from './db.js'
import { onWebsite, photoError } from './eventPhotos.js'

const BUCKET = 'adm-event-photos'
const GOOD_KEY = /^[a-z0-9-]+\/p\d{4}-(original|A|B|C)(_thumb)?\.jpg$/
const AT_ONCE = 4

/**
 * Reads a chosen folder (an <input webkitdirectory> file list).
 * @returns {{ bundle: object, uploads: { key: string, file: File }[], bytes: number }}
 */
export async function readPackage(fileList) {
  const all = [...(fileList || [])]
  const path = (f) => (f.webkitRelativePath || f.name).replace(/\\/g, '/')
  // The folder chosen may be `current` itself or the event folder around it.
  const jsons = all.filter((f) => /(^|\/)event\.json$/.test(path(f)))
  const eventFile = jsons.sort((a, b) => path(a).split('/').length - path(b).split('/').length)[0]
  if (!eventFile) throw new Error('There is no event.json in that folder. Choose the event\'s "current" folder, which the laptop makes when it packages an event.')
  let bundle
  try { bundle = JSON.parse(await eventFile.text()) } catch { throw new Error('event.json in that folder cannot be read.') }
  if (!bundle?.event?.slug || !Array.isArray(bundle.photos) || !Array.isArray(bundle.posts)) throw new Error('That event.json was not made by package.py.')

  const base = path(eventFile).replace(/event\.json$/, '')
  const pictures = new Map(all.filter((f) => path(f).startsWith(`${base}files/`)).map((f) => [f.name, f]))
  const uploads = bundle.photos.flatMap((p) => Object.values(p.files || {}).map((key) => ({ key, file: pictures.get(key.split('/').pop()) })))
  const bad = uploads.filter((u) => !GOOD_KEY.test(u.key))
  if (bad.length) throw new Error(`Unexpected picture names, so nothing will be sent: ${bad.slice(0, 3).map((b) => b.key).join(', ')}`)
  const lost = uploads.filter((u) => !u.file)
  if (lost.length) throw new Error(`Pictures missing from the folder: ${lost.length} (for example ${lost[0].key.split('/').pop()}). The packaging may not have finished; wait for it and choose the folder again.`)
  return { bundle, uploads, bytes: uploads.reduce((n, u) => n + u.file.size, 0) }
}

/** What an upload would do, worked out from what the tab already holds. Changes nothing. */
export async function planUpload(bundle) {
  const events = await db.photoEvents.list()
  const was = events.find((e) => e.slug === bundle.event.slug) || null
  const rows = was ? await db.eventPhotos.list(was.id) : []
  const posts = was ? await db.eventPosts.list(was.id) : []
  const byCode = new Map(rows.map((r) => [r.code, r]))
  const inAlbum = new Set(bundle.photos.map((p) => p.code))
  const state = new Map(posts.map((p) => [`${p.kind}/${p.seq || 1}`, p]))
  const postPlan = bundle.posts.map((p) => ({ post: p, had: state.get(`${p.kind}/${p.seq || 1}`) || null }))
  const titleOf = (code) => byCode.get(code)?.title || code
  return {
    was,
    fresh: bundle.photos.filter((p) => !byCode.has(p.code)).length,
    again: bundle.photos.filter((p) => byCode.has(p.code)).length,
    delist: rows.filter((r) => !inAlbum.has(r.code) && (r.listed !== false || r.hero)).map((r) => ({ code: r.code, title: titleOf(r.code) })),
    postsNew: postPlan.filter((x) => !x.had).length,
    postsDraft: postPlan.filter((x) => x.had?.status === 'draft').length,
    postsDone: postPlan.filter((x) => x.had && x.had.status !== 'draft').length,
    textFix: Object.keys(bundle.delist_text || {}).filter((c) => byCode.has(c)).length,
  }
}

/**
 * Sends the package. `step` is called with { stage, done, total } as it goes.
 * @returns {Promise<{ event: object, fresh: number, again: number, delisted: string[], postsWritten: number, pictures: number }>}
 */
export async function runUpload({ bundle, uploads, replaceText = false, delistMissing = false, step = () => {} }) {
  const { event } = bundle
  const now = new Date().toISOString()

  // 1. The event. Its description is only written the first time, unless the text is being replaced.
  const was = (await db.photoEvents.list()).find((e) => e.slug === event.slug)
  const evRow = { ...event, id: was?.id }
  if (was && !replaceText) evRow.description = was.description
  if (dbMode === 'local' && was) Object.assign(evRow, { ...was, ...evRow })
  const ev = await db.photoEvents.save(evRow)

  // A photo that has moved to the website keeps living there: its pictures are not sent
  // to Storage again and its record keeps pointing at the website.
  const before = was ? await db.eventPhotos.list(was.id) : []
  const moved = new Set(before.filter((r) => onWebsite(r) && r.website?.want).map((r) => r.code))
  const codeOf = (key) => key.split('/').pop().split('-')[0]
  uploads = uploads.filter((u) => !moved.has(codeOf(u.key)))

  // 2. The pictures, a few at a time. Offline there is no storage: the pictures are read from private/event-photos.
  let sent = 0
  if (hasSupabase) {
    let failed = 0
    const queue = [...uploads]
    step({ stage: 'pictures', done: 0, total: uploads.length })
    const worker = async () => {
      for (let u = queue.shift(); u; u = queue.shift()) {
        const { error } = await supabase.storage.from(BUCKET).upload(u.key, u.file, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
        if (error) {
          failed++
          if (failed >= 3) { queue.length = 0; throw photoError(error) }
        } else {
          sent++
          step({ stage: 'pictures', done: sent, total: uploads.length })
        }
      }
    }
    await Promise.all(Array.from({ length: AT_ONCE }, worker))
    if (failed) throw new Error(`${failed} pictures were not sent, so the photo records were left as they were. Try the upload again.`)
  }

  // 3. The photo records. What the office may have changed is only written for new photos.
  step({ stage: 'records', done: 0, total: 1 })
  const rows = await db.eventPhotos.list(ev.id)
  const byCode = new Map(rows.map((r) => [r.code, r]))
  const machine = (p) => ({
    event_id: ev.id, code: p.code, seq: p.seq, hero: !!p.hero, score: p.score, score_parts: p.score_parts || {}, judge_note: p.judge_note || '',
    tags: p.tags || {}, privacy_flags: p.privacy_flags || [], privacy_note: p.privacy_note || '', files: p.files, focus: p.focus || null,
    width: p.width, height: p.height, original_name: p.original_name || '', taken_at: p.taken_at || null,
  })
  // Supabase changes only the columns sent; the offline store replaces the whole row, so it is given the rest.
  const onto = (had, fields) => (dbMode === 'local' ? { ...had, ...fields } : { id: had.id, ...fields })
  const fresh = bundle.photos.filter((p) => !byCode.has(p.code)).map((p) => ({
    ...machine(p), title: p.title, caption: p.caption, look: p.look || 'B', listed: true, cleared: !!p.cleared, cleared_by: p.cleared_by || null,
  }))
  const kept = (p) => {
    const m = machine(p)
    if (moved.has(p.code)) { delete m.files; delete m.width; delete m.height }
    return m
  }
  const row = (p) => onto(byCode.get(p.code), replaceText ? { ...kept(p), title: p.title, caption: p.caption } : kept(p))
  const known = bundle.photos.filter((p) => byCode.has(p.code))
  // Rows saved together must carry the same columns (one that is missing is written as empty),
  // so the photos on the website, which leave their pictures out, are saved on their own.
  const again = known.filter((p) => !moved.has(p.code)).map(row)
  const onSite = known.filter((p) => moved.has(p.code)).map(row)
  if (fresh.length) await db.eventPhotos.saveMany(fresh)
  if (again.length) await db.eventPhotos.saveMany(again)
  if (onSite.length) await db.eventPhotos.saveMany(onSite)

  // 4. Photos that have left the album: delisted (kept, with their sign-off), and their text corrected when replacing it.
  const inAlbum = new Set(bundle.photos.map((p) => p.code))
  const delisted = []
  if (delistMissing) {
    for (const r of rows.filter((r) => !inAlbum.has(r.code) && (r.listed !== false || r.hero))) {
      await db.eventPhotos.patch(r.id, { listed: false, hero: false })
      delisted.push(r.code)
    }
  }
  if (replaceText) {
    for (const [code, text] of Object.entries(bundle.delist_text || {})) {
      const r = byCode.get(code)
      if (r && !inAlbum.has(code)) await db.eventPhotos.patch(r.id, { title: text.title, caption: text.caption })
    }
  }

  // 5. Draft posts. One already there keeps its text unless replacing it; one that has been posted is never touched.
  const had = new Map((await db.eventPosts.list(ev.id)).map((p) => [`${p.kind}/${p.seq || 1}`, p]))
  const send = bundle.posts.map((p) => ({ p, h: had.get(`${p.kind}/${p.seq || 1}`) }))
    .filter(({ h }) => !h || (replaceText && h.status === 'draft'))
    .map(({ p, h }) => ({ ...(dbMode === 'local' && h ? h : {}), ...p, id: h?.id, seq: p.seq || 1, event_id: ev.id, status: 'draft', updated_at: now }))
  if (send.length) await db.eventPosts.saveMany(send)

  step({ stage: 'done', done: 1, total: 1 })
  return { event: ev, fresh: fresh.length, again: again.length + onSite.length, delisted, postsWritten: send.length, pictures: sent }
}
