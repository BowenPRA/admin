// Uploads the student photos in private/photos to the private `adm-photos`
// bucket, where the app reads them once someone has signed in.
//
//   node scripts/upload-student-photos.mjs            (asks for the secret key)
//   node scripts/upload-student-photos.mjs --dry-run  (lists what would be uploaded)
//
// Run supabase/updates-2026-09-22-private-photos.sql first. The secret key is in
// Supabase > Project Settings > API Keys > Secret key; it is only used for this
// run and never saved. Existing photos with the same name are replaced, so it is
// safe to run again after adding or changing photos.

import { readFileSync, readdirSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { PHOTO_BUCKET, photoKey } from '../src/lib/photoKey.js'

const dryRun = process.argv.includes('--dry-run')
const dir = new URL('../private/photos/', import.meta.url)
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

function envValue(name) {
  if (process.env[name]) return process.env[name]
  try {
    const line = readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`))
    return line ? line.slice(name.length + 1).trim() : ''
  } catch { return '' }
}

let files
try { files = readdirSync(dir).filter((f) => TYPES[f.split('.').pop().toLowerCase()]) } catch { files = [] }
if (!files.length) { console.error('No photos found in private/photos.'); process.exit(1) }

// Student rows say "photos/<file name>"; the key is that path made Storage-safe.
const plan = files.map((f) => ({ file: f, key: photoKey(`photos/${f}`) }))
if (dryRun) {
  plan.forEach((p) => console.log(`  ${p.file.padEnd(22)} -> ${PHOTO_BUCKET}/${p.key}`))
  console.log(`${plan.length} photos (dry run, nothing uploaded)`)
  process.exit(0)
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

let failed = 0
for (const p of plan) {
  const res = await fetch(`${url}/storage/v1/object/${PHOTO_BUCKET}/${p.key}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': TYPES[p.file.split('.').pop().toLowerCase()], 'x-upsert': 'true' },
    body: readFileSync(new URL(p.file, dir)),
  })
  if (res.ok) { console.log(`  uploaded ${p.file}`); continue }
  failed++
  const data = await res.json().catch(() => ({}))
  console.error(`  FAILED   ${p.file}: ${data.message || data.error || `${res.status} ${res.statusText}`}`)
}
console.log(`${plan.length - failed} of ${plan.length} photos uploaded to ${PHOTO_BUCKET}.`)
if (failed) {
  console.error('If it says the bucket was not found, run supabase/updates-2026-09-22-private-photos.sql first.')
  process.exit(1)
}
