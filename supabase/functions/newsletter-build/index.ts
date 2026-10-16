// Asks GitHub to build pra.edu.vn again, so a newsletter just published in The
// Current (or taken off) shows on the website a couple of minutes later. The key
// that can start a build must never reach the browser (the app and its
// repository are public), so this runs here.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   GH_TOKEN     a fine-grained GitHub key for BowenPRA/website with
//                "Actions: Read and write" and nothing else
//   GH_REPO      optional, default BowenPRA/website
//   GH_WORKFLOW  optional, default deploy.yml
// Setup: supabase/functions/newsletter-build/README.md
//
// POST { action: 'build' }   starts a build (office accounts only)
// POST { action: 'status' }  the latest build: { status, conclusion, url, started }

import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const REPO = Deno.env.get('GH_REPO') || 'BowenPRA/website'
const WORKFLOW = Deno.env.get('GH_WORKFLOW') || 'deploy.yml'

async function github(path: string, init: RequestInit = {}) {
  const token = Deno.env.get('GH_TOKEN')
  if (!token) throw Object.assign(new Error('Starting a website build is not set up yet: the GH_TOKEN secret is missing. See supabase/functions/newsletter-build/README.md. The website still picks the issue up at its nightly build.'), { status: 503 })
  const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'the-current', ...(init.headers || {}) },
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.message || res.statusText
    const hint = res.status === 401 ? ' The GitHub key has expired or was revoked: make a new one and save it as GH_TOKEN.'
      : res.status === 403 || res.status === 404 ? ' The GitHub key cannot start builds of this repository: it needs "Actions: Read and write" on BowenPRA/website.' : ''
    throw Object.assign(new Error(`GitHub: ${msg}.${hint}`), { status: 502 })
  }
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: office, error } = await db.rpc('adm_newsletter_office')
    if (error) return reply({ error: `The newsletter is not set up in the database yet (${error.message}).` }, 503)
    if (office !== true) return reply({ error: 'Only office accounts can rebuild the website.' }, 403)

    const { action } = await req.json().catch(() => ({ action: 'build' }))
    if (action === 'status') {
      const runs = await github(`actions/workflows/${WORKFLOW}/runs?per_page=1`)
      const run = runs?.workflow_runs?.[0]
      return reply(run ? { status: run.status, conclusion: run.conclusion, url: run.html_url, started: run.run_started_at || run.created_at } : { status: 'none' })
    }
    await github(`actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main' }) })
    return reply({ ok: true, started: new Date().toISOString() })
  } catch (e) {
    const status = (e as { status?: number }).status || 500
    return reply({ error: (e as Error).message || String(e) }, status)
  }
})
