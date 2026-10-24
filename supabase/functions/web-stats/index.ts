// Visitor numbers for pra.edu.vn, for The Current's Website page. The website
// counts visits with Cloudflare Web Analytics (a script on every page, no
// cookies); this asks Cloudflare for them. The key that can read them must never
// reach the browser (the app and its repository are public), so this runs here.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   CF_API_TOKEN   a Cloudflare key with "Account > Account Analytics > Read"
//                  and nothing else
//   CF_ACCOUNT_ID  optional, default PRA's account (admin@palmriveracademy.edu.vn)
//   SITE_HOST      optional, default pra.edu.vn
// Setup: supabase/functions/web-stats/README.md
//
// POST { days: 7 | 30 | 90 }  the last `days` days in Vietnam time (today so far
//   and the days before it), and the same stretch just before them to compare.
//
// Who may call it: someone signed in to The Current with an office account. The
// function checks this itself, so it is deployed with Verify JWT off.
//
// Cloudflare answers from a 1-in-10 sample for any stretch longer than about a
// week, which for a site of our size turns 3 views into 0 or 10. So a longer
// stretch is asked for in pieces of 7 days, all at once, and added up here.

const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql'
const ACCOUNT = Deno.env.get('CF_ACCOUNT_ID') || 'd9eb2d6356a9e9931200e497d17954b3'
const HOST = Deno.env.get('SITE_HOST') || 'pra.edu.vn'
const OFFICE = ['super_admin', 'head', 'admin'] // the same rule as facebook-post and adm_is_staff()
const DAY = 86400000
const VN = 7 * 3600000 // Vietnam is UTC+7 all year
const PIECE = 7 * DAY
const MAX_DAYS = 90 // Cloudflare keeps about six months; 90 days and the 90 before them fit

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const problem = (message: string, status: number) => Object.assign(new Error(message), { status })

type Group = { count: number, sum?: { visits: number }, avg?: { sampleInterval: number }, dimensions?: Record<string, string> }
type Row = { key: string, views: number, visits: number }

// One piece of the stretch: the hours, pages, where visitors came from, countries and
// devices, plus the total of the matching piece of the stretch before (to compare).
function pieceQuery(i: number) {
  const f = (a: string, b: string) => `filter: { requestHost: $host, bot: 0, datetime_geq: $${a}${i}, datetime_lt: $${b}${i} }`
  const now = f('a', 'b')
  return `
    hours${i}: rumPageloadEventsAdaptiveGroups(limit: 500, ${now}, orderBy: [datetimeHour_ASC]) { count sum { visits } avg { sampleInterval } dimensions { datetimeHour } }
    pages${i}: rumPageloadEventsAdaptiveGroups(limit: 1000, ${now}, orderBy: [count_DESC]) { count sum { visits } dimensions { requestPath } }
    from${i}: rumPageloadEventsAdaptiveGroups(limit: 200, ${now}, orderBy: [sum_visits_DESC]) { count sum { visits } dimensions { refererHost } }
    countries${i}: rumPageloadEventsAdaptiveGroups(limit: 200, ${now}, orderBy: [count_DESC]) { count sum { visits } dimensions { countryName } }
    devices${i}: rumPageloadEventsAdaptiveGroups(limit: 10, ${now}, orderBy: [count_DESC]) { count sum { visits } dimensions { deviceType } }
    before${i}: rumPageloadEventsAdaptiveGroups(limit: 1, ${f('c', 'd')}) { count sum { visits } avg { sampleInterval } }`
}

async function cloudflare(query: string, variables: Record<string, string>) {
  const token = Deno.env.get('CF_API_TOKEN')
  if (!token) throw problem('Website numbers are not set up yet: the CF_API_TOKEN secret is missing. See supabase/functions/web-stats/README.md.', 503)
  const res = await fetch(GRAPHQL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const data = await res.json().catch(() => ({}))
  const err = data?.errors?.[0]
  if (res.status === 401 || res.status === 403 || /auth/i.test(err?.message || '')) {
    throw problem('Cloudflare did not accept the key: it has been deleted or lacks "Account Analytics: Read". Make a new one and save it as CF_API_TOKEN (supabase/functions/web-stats/README.md).', 502)
  }
  if (err?.extensions?.code === 'quota' || res.status === 429) throw problem('Cloudflare is busy with too many questions. Try again in a few minutes.', 429)
  if (err || !res.ok) throw problem(`Cloudflare: ${err?.message || res.statusText}`, 502)
  return data.data.viewer.accounts[0] as Record<string, Group[]>
}

const add = (into: Map<string, Row>, key: string, g: Group) => {
  const r = into.get(key) || { key, views: 0, visits: 0 }
  r.views += g.count
  r.visits += g.sum?.visits || 0
  into.set(key, r)
}
const rows = (m: Map<string, Row>) => [...m.values()].sort((a, b) => b.views - a.views || b.visits - a.visits)

async function stats(days: number) {
  const until = Date.now()
  const todayVN = Math.floor((until + VN) / DAY) * DAY - VN
  const since = todayVN - (days - 1) * DAY
  const back = days * DAY // the stretch before is the same hours, `days` days earlier

  const pieces: [number, number][] = []
  for (let a = since; a < until; a += PIECE) pieces.push([a, Math.min(a + PIECE, until)])
  const iso = (t: number) => new Date(t).toISOString()
  const answers = await Promise.all(pieces.map(([a, b], i) => {
    const vars = `$a${i}: Time!, $b${i}: Time!, $c${i}: Time!, $d${i}: Time!`
    const query = `query($account: String!, $host: String!, ${vars}) { viewer { accounts(filter: { accountTag: $account }) { ${pieceQuery(i)} } } }`
    return cloudflare(query, { account: ACCOUNT, host: HOST, [`a${i}`]: iso(a), [`b${i}`]: iso(b), [`c${i}`]: iso(a - back), [`d${i}`]: iso(b - back) })
  }))

  const hours = new Map<string, Row>(), pages = new Map<string, Row>(), from = new Map<string, Row>()
  const countries = new Map<string, Row>(), devices = new Map<string, Row>()
  const before = { views: 0, visits: 0 }
  let sampled = false
  answers.forEach((d, i) => {
    for (const g of d[`hours${i}`]) { add(hours, g.dimensions!.datetimeHour, g); if ((g.avg?.sampleInterval || 1) > 1) sampled = true }
    for (const g of d[`pages${i}`]) add(pages, g.dimensions!.requestPath, g)
    for (const g of d[`from${i}`]) add(from, g.dimensions!.refererHost, g)
    for (const g of d[`countries${i}`]) add(countries, g.dimensions!.countryName, g)
    for (const g of d[`devices${i}`]) add(devices, g.dimensions!.deviceType, g)
    for (const g of d[`before${i}`]) { before.views += g.count; before.visits += g.sum?.visits || 0; if ((g.avg?.sampleInterval || 1) > 1) sampled = true }
  })
  const hourRows = [...hours.values()].sort((a, b) => a.key.localeCompare(b.key))
  return {
    host: HOST,
    days,
    since: iso(since),
    until: iso(until),
    totals: hourRows.reduce((t, h) => ({ views: t.views + h.views, visits: t.visits + h.visits }), { views: 0, visits: 0 }),
    before,
    hours: hourRows.map((h) => ({ t: h.key, views: h.views, visits: h.visits })),
    pages: rows(pages),
    from: rows(from),
    countries: rows(countries),
    devices: rows(devices),
    sampled,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (req.method !== 'POST') throw problem('Use POST.', 405)
    // Who is asking: Supabase's own sign-in service reads the caller's key.
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const apiKey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || ''
    const who = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: apiKey, Authorization: `Bearer ${jwt}` } })
    const user = who.ok ? await who.json() : null
    if (!OFFICE.includes(user?.app_metadata?.role)) throw problem('Sign in with an office account to see the website numbers.', 403)

    const body = await req.json().catch(() => ({}))
    const days = Math.min(MAX_DAYS, Math.max(1, Math.round(Number(body?.days) || 7)))
    return reply(await stats(days))
  } catch (e) {
    const status = (e as { status?: number }).status || 500
    return reply({ error: (e as Error).message || String(e) }, status)
  }
})
