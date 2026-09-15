// Creates or updates the PRA staff logins and sets each one's access role.
//
//   node scripts/create-staff-accounts.mjs            (asks for the secret key)
//   node scripts/create-staff-accounts.mjs --dry-run  (shows what would change)
//
// The secret key is in Supabase > Project Settings > API Keys > Secret key. It
// is only used for this run and never saved. Existing accounts keep their
// password; only their role is updated. New accounts get a temporary password,
// printed once at the end, for each person to change after signing in.

import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { randomInt } from 'node:crypto'

// role: super_admin | head | admin | teacher  (see supabase/updates-2026-09-15.sql)
const STAFF = [
  { email: 'bowen@pra.edu.vn', name: 'Bowen', role: 'super_admin' },
  { email: 'seth@pra.edu.vn', name: 'Seth', role: 'head' },
  { email: 'yvonne@pra.edu.vn', name: 'Yvonne', role: 'admin' },
  { email: 'hien.c@pra.edu.vn', name: 'Hien', role: 'admin' },
  { email: 'duyen.n@pra.edu.vn', name: 'Duyen', role: 'admin' },
  { email: 'david@pra.edu.vn', name: 'David', role: 'teacher' },
  { email: 'kiu@pra.edu.vn', name: 'Kiu', role: 'teacher' },
  { email: 'solo@pra.edu.vn', name: 'Solo', role: 'teacher' },
  { email: 'caleb@pra.edu.vn', name: 'Caleb', role: 'teacher' },
  { email: 'thanh.n@pra.edu.vn', name: 'Thanh', role: 'teacher' },
  { email: 'tham.n@pra.edu.vn', name: 'Tham N', role: 'teacher' },
  { email: 'tham.v@pra.edu.vn', name: 'Thắm V', role: 'teacher' },
  // Thao and Tan: add once their @pra.edu.vn addresses are confirmed.
]

const dryRun = process.argv.includes('--dry-run')

function envValue(name) {
  if (process.env[name]) return process.env[name]
  try {
    const line = readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`))
    return line ? line.slice(name.length + 1).trim() : ''
  } catch { return '' }
}

function tempPassword() {
  const words = ['river', 'palm', 'lotus', 'mango', 'lantern', 'bamboo', 'orchid', 'harbor']
  return `${words[randomInt(words.length)]}-${words[randomInt(words.length)]}-${randomInt(100, 1000)}`
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

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
async function call(method, path, body) {
  const res = await fetch(`${url}/auth/v1${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.msg || data.message || data.error_description || `${res.status} ${res.statusText}`)
  return data
}

const existing = new Map()
for (let page = 1; ; page++) {
  const { users = [] } = await call('GET', `/admin/users?page=${page}&per_page=200`)
  users.forEach((u) => existing.set((u.email || '').toLowerCase(), u))
  if (users.length < 200) break
}

const created = []
for (const s of STAFF) {
  const u = existing.get(s.email)
  const label = `${s.name.padEnd(8)} ${s.email.padEnd(22)} ${s.role.padEnd(12)}`
  try {
    if (u) {
      const current = u.app_metadata?.role
      if (current === s.role) { console.log(`  ok       ${label}`); continue }
      if (!dryRun) await call('PUT', `/admin/users/${u.id}`, { app_metadata: { ...u.app_metadata, role: s.role }, user_metadata: { ...u.user_metadata, name: s.name } })
      console.log(`  updated  ${label} (was ${current || 'no role'})`)
    } else {
      const password = tempPassword()
      if (!dryRun) await call('POST', '/admin/users', { email: s.email, password, email_confirm: true, app_metadata: { role: s.role }, user_metadata: { name: s.name } })
      created.push({ ...s, password })
      console.log(`  created  ${label}`)
    }
  } catch (e) {
    console.log(`  FAILED   ${label} ${e.message}`)
  }
}

if (dryRun) console.log('\nDry run: nothing was changed.')
if (created.length && !dryRun) {
  console.log('\nTemporary passwords (shown once, pass them on privately):')
  created.forEach((c) => console.log(`  ${c.email.padEnd(22)} ${c.password}`))
}
