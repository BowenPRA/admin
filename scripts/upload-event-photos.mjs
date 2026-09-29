// Sends one event's curated photos, description and draft Facebook posts to
// The Current, where the Photos tab shows them to office accounts.
//
// Usually not needed: the Photos tab's "Upload event" button does the same from
// the browser with an office account's own sign-in (src/lib/eventUpload.js). This
// script is the fallback, and it needs the Supabase secret key.
//
//   node scripts/upload-event-photos.mjs "C:\Users\bowen\PRA Photos\<event>\current"
//   node scripts/upload-event-photos.mjs "<folder>" --dry-run       (lists what would be sent)
//   node scripts/upload-event-photos.mjs "<folder>" --replace-text  (see below)
//   node scripts/upload-event-photos.mjs "<folder>" --delist-missing (see below)
//
// The folder is made by `python package.py <event>` in the photo library. Run
// supabase/updates-2026-09-28-event-photos.sql first. The secret key is in
// Supabase > Project Settings > API Keys > Secret key; it is only used for this
// run and never saved.
//
// Safe to run again. A second run replaces the pictures and the scores, and adds
// any new photos and posts. It leaves alone what the office may have changed in
// the tab: titles, captions, the chosen look, delisting, the no-photo sign-off,
// and the text of posts. --replace-text overwrites titles, captions and post
// text as well; it never undoes a sign-off or a delisting.
//
// --delist-missing is for an album that has been redone: every photo of this
// event that The Current still lists but the new album does not contain is
// delisted (kept, with its sign-off, but out of the album, the cover and the
// posts, and no longer the hero). The dry run lists the ones the last package
// knows were sent before; the real run asks The Current itself and prints what
// it delisted. A delisted photo can be listed again from its card in the tab.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'

const BUCKET = 'adm-event-photos'
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const replaceText = args.includes('--replace-text')
const delistMissing = args.includes('--delist-missing')
const folder = args.find((a) => !a.startsWith('--'))
if (!folder || !existsSync(join(folder, 'event.json'))) {
  console.error('Give the folder that holds event.json, e.g. "C:\\Users\\bowen\\PRA Photos\\2026-09-25 Mid-Autumn Festival\\current"')
  process.exit(1)
}

const bundle = JSON.parse(readFileSync(join(folder, 'event.json'), 'utf8'))
const { event, photos, posts } = bundle
const uploads = photos.flatMap((p) => Object.values(p.files).map((key) => ({ key, file: join(folder, 'files', key.split('/').pop()) })))
const lost = uploads.filter((u) => !existsSync(u.file))
if (lost.length) { console.error(`${lost.length} picture files are missing, e.g. ${lost[0].file}. Run package.py again.`); process.exit(1) }

// A last check that nothing unexpected is about to leave the laptop.
const bad = uploads.filter((u) => !/^[a-z0-9-]+\/p\d{4}-(original|A|B|C)(_thumb)?\.jpg$/.test(u.key))
if (bad.length) { console.error(`Unexpected file names, nothing sent: ${bad.slice(0, 3).map((b) => b.key).join(', ')}`); process.exit(1) }

console.log(`${event.name} (${event.event_date}): ${photos.length} photos, ${uploads.length} picture files, ${posts.length} draft posts`)
if (dryRun) {
  photos.forEach((p) => console.log(`  ${String(p.seq).padStart(2)}  ${p.code}  ${String(p.score).padStart(4)}  ${p.title}`))
  posts.forEach((p) => console.log(`  post: ${p.kind}, ${p.photo_codes.length} photos, leads with ${p.photo_codes[0]}`))
  const gone = bundle.delist || []
  if (delistMissing) {
    console.log(gone.length
      ? `Would delist ${gone.length} photos sent up before and not in this album: ${gone.join(' ')}`
      : 'Would delist nothing that earlier packages sent up.')
    console.log('  (The real run asks The Current and delists any listed photo of this event not in this album, including ones added there by hand.)')
  } else if (gone.length) {
    console.log(`${gone.length} photos sent up before are not in this album and would stay listed: ${gone.join(' ')}. Add --delist-missing to delist them.`)
  }
  if (replaceText && Object.keys(bundle.delist_text || {}).length) {
    console.log(`Would also correct the title and caption of ${Object.keys(bundle.delist_text).length} photos no longer in the album.`)
  }
  console.log('Dry run: nothing was sent.')
  process.exit(0)
}

function envValue(name) {
  if (process.env[name]) return process.env[name]
  try {
    const line = readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`))
    return line ? line.slice(name.length + 1).trim() : ''
  } catch { return '' }
}
const url = envValue('VITE_SUPABASE_URL')
if (!url) { console.error('VITE_SUPABASE_URL is missing from .env'); process.exit(1) }
let key = process.env.SUPABASE_SECRET_KEY || ''
if (!key) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  key = (await rl.question(`Secret key for ${url}: `)).trim()
  rl.close()
}
if (!key) { console.error('No key given.'); process.exit(1) }

const auth = { apikey: key, Authorization: `Bearer ${key}` }
const hint = 'If it says a table or the bucket was not found, run supabase/updates-2026-09-28-event-photos.sql first.'
async function rest(method, path, body, prefer) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { ...auth, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(`${method} ${path.split('?')[0]}: ${data?.message || res.statusText}. ${hint}`)
  return data
}
const upsert = (table, rows, conflict) => rest('POST', `${table}?on_conflict=${conflict}`, rows, 'resolution=merge-duplicates,return=representation')

try {
  // 1. The event. Its description is only written the first time unless --replace-text.
  const was = (await rest('GET', `adm_photo_events?slug=eq.${encodeURIComponent(event.slug)}&select=id,description`))[0]
  const evRow = { ...event, updated_at: new Date().toISOString() }
  if (was && !replaceText) delete evRow.description
  const [ev] = await upsert('adm_photo_events', [evRow], 'slug')

  // A photo that has moved to the public website keeps living there: its pictures are
  // not sent to Storage again and its record keeps pointing at the website.
  let moved = new Set()
  try {
    const rows = await rest('GET', `adm_event_photos?event_id=eq.${ev.id}&select=code,files,website`)
    moved = new Set(rows.filter((r) => r.files?.web && r.website?.want).map((r) => r.code))
  } catch { /* the website column is not there yet, so nothing has moved */ }
  const sending = uploads.filter((u) => !moved.has(u.key.split('/').pop().split('-')[0]))
  if (moved.size) console.log(`  ${moved.size} photos are on the website already; their pictures are not sent again`)

  // 2. The pictures.
  let failed = 0
  for (const [i, u] of sending.entries()) {
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${u.key}`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' }, body: readFileSync(u.file),
    })
    if (!res.ok) {
      failed++
      const data = await res.json().catch(() => ({}))
      console.error(`  FAILED ${u.key}: ${data.message || data.error || res.statusText}`)
      if (failed >= 3) throw new Error(`Stopped after three failed uploads. ${hint}`)
    }
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1} of ${sending.length} pictures sent`)
  }
  if (failed) throw new Error(`${failed} pictures were not sent, so the records were left as they were.`)

  // 3. The photo records. What the office may have changed is only sent for new photos.
  const known = new Set((await rest('GET', `adm_event_photos?event_id=eq.${ev.id}&select=code`)).map((r) => r.code))
  const now = new Date().toISOString()
  const machine = (p) => ({
    event_id: ev.id, code: p.code, seq: p.seq, hero: p.hero, score: p.score, score_parts: p.score_parts, judge_note: p.judge_note,
    tags: p.tags, privacy_flags: p.privacy_flags, privacy_note: p.privacy_note, files: p.files, focus: p.focus, width: p.width, height: p.height,
    original_name: p.original_name, taken_at: p.taken_at, updated_at: now,
  })
  const text = (p) => ({ title: p.title, caption: p.caption })
  const fresh = photos.filter((p) => !known.has(p.code)).map((p) => ({
    ...machine(p), ...text(p), look: p.look, listed: true, cleared: !!p.cleared, cleared_by: p.cleared_by || null,
  }))
  const row = (p) => (replaceText ? { ...machine(p), ...text(p) } : machine(p))
  const again = photos.filter((p) => known.has(p.code) && !moved.has(p.code)).map(row)
  // Rows sent together must carry the same columns, so the moved ones go on their own.
  const onSite = photos.filter((p) => moved.has(p.code)).map((p) => { const r = row(p); delete r.files; delete r.width; delete r.height; return r })
  if (fresh.length) await upsert('adm_event_photos', fresh, 'event_id,code')
  if (again.length) await upsert('adm_event_photos', again, 'event_id,code')
  if (onSite.length) await upsert('adm_event_photos', onSite, 'event_id,code')

  // 3b. With --delist-missing: photos still listed for this event that the new album leaves out.
  let delisted = []
  if (delistMissing) {
    const inAlbum = new Set(photos.map((p) => p.code))
    const rows = await rest('GET', `adm_event_photos?event_id=eq.${ev.id}&select=code,listed,hero`)
    delisted = rows.filter((r) => !inAlbum.has(r.code) && (r.listed !== false || r.hero)).map((r) => r.code).sort()
    if (delisted.length) {
      const list = delisted.map((c) => `"${c}"`).join(',')
      await rest('PATCH', `adm_event_photos?event_id=eq.${ev.id}&code=in.(${list})`, { listed: false, hero: false, updated_at: now }, 'return=minimal')
      console.log(`Delisted ${delisted.length} photos that are not in the new album: ${delisted.join(' ')}`)
    } else {
      console.log('Nothing to delist: every listed photo of this event is in the new album.')
    }
  }
  // With --replace-text, photos that have left the album get their corrected title and caption too.
  const oldText = replaceText ? Object.entries(bundle.delist_text || {}) : []
  for (const [code, t] of oldText) {
    await rest('PATCH', `adm_event_photos?event_id=eq.${ev.id}&code=eq.${encodeURIComponent(code)}`, { title: t.title, caption: t.caption, updated_at: now }, 'return=minimal')
  }
  if (oldText.length) console.log(`Titles and captions corrected on ${oldText.length} photos that are no longer in the album.`)

  // 4. Draft posts. One that is already there keeps its text, and one that has
  //    been posted is never touched.
  const there = await rest('GET', `adm_event_posts?event_id=eq.${ev.id}&select=kind,seq,status`)
  const state = new Map(there.map((r) => [`${r.kind}/${r.seq}`, r.status]))
  const send = posts.filter((p) => {
    const s = state.get(`${p.kind}/${p.seq || 1}`)
    return !s || (replaceText && s === 'draft')
  }).map((p) => ({ ...p, seq: p.seq || 1, event_id: ev.id, updated_at: now }))
  if (send.length) await upsert('adm_event_posts', send, 'event_id,kind,seq')

  console.log(`Done. ${fresh.length} new photos, ${again.length} refreshed, ${delisted.length} delisted, ${send.length} posts written, ${posts.length - send.length} posts left as they were.`)
  console.log('Open The Current > Photos to review them.')
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
