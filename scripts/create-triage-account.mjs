// Creates (or renews) the login the daily inbox triage uses to keep the Leads
// tab up to date, and saves it where the triage can read it.
//
//   node scripts/create-triage-account.mjs                (asks for the secret key)
//   node scripts/create-triage-account.mjs "<folder>"     (save the login somewhere else)
//
// The account is triage@pra.edu.vn with app_metadata.role = 'triage'. The
// database lets that role read, add and update leads and nothing else
// (supabase/updates-2026-09-30-leads.sql); The Current treats it as view-only.
// A new random password is set on every run and written, with the project's
// address and public key, to `.the-current-triage.json` in the Admin Email
// folder, where the_current_leads.py reads it. The password is never printed.
// Run it again whenever the file is lost or the login should be changed.
//
// The secret key is in Supabase > Project Settings > API Keys > Secret key. It
// is only used for this run and never saved.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { randomBytes } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'

const EMAIL = 'triage@pra.edu.vn'
const folder = process.argv[2] || join(homedir(), 'Desktop', 'Admin Email')
const target = join(folder, '.the-current-triage.json')

function envValue(name) {
  if (process.env[name]) return process.env[name]
  try {
    const line = readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`))
    return line ? line.slice(name.length + 1).trim() : ''
  } catch { return '' }
}

const url = envValue('VITE_SUPABASE_URL')
const publicKey = envValue('VITE_SUPABASE_PUBLISHABLE_KEY')
if (!url || !publicKey) { console.error('VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is missing from .env'); process.exit(1) }
if (!existsSync(folder)) { console.error(`Folder not found: ${folder}`); process.exit(1) }

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

let user = null
for (let page = 1; !user; page++) {
  const { users = [] } = await call('GET', `/admin/users?page=${page}&per_page=200`)
  user = users.find((u) => (u.email || '').toLowerCase() === EMAIL) || null
  if (users.length < 200) break
}

const password = randomBytes(24).toString('base64url')
const fields = { password, email_confirm: true, app_metadata: { ...(user?.app_metadata || {}), role: 'triage' }, user_metadata: { ...(user?.user_metadata || {}), name: 'Inbox triage' } }
if (user) await call('PUT', `/admin/users/${user.id}`, fields)
else await call('POST', '/admin/users', { email: EMAIL, ...fields })

// Check the login works and the leads table answers before saving it.
const token = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: publicKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password }),
}).then((r) => r.json())
if (!token.access_token) { console.error('The account was saved but signing in with it failed:', token.error_description || token.msg || token.error); process.exit(1) }
const probe = await fetch(`${url}/rest/v1/adm_leads?select=id&limit=1`, { headers: { apikey: publicKey, Authorization: `Bearer ${token.access_token}` } })
if (!probe.ok) console.warn(`Signed in, but the leads table did not answer (${probe.status}). Has supabase/updates-2026-09-30-leads.sql been run?`)

writeFileSync(target, `${JSON.stringify({ url, key: publicKey, email: EMAIL, password }, null, 2)}\n`)
console.log(`${user ? 'Renewed' : 'Created'} ${EMAIL} (role triage). Login saved to ${target}`)
