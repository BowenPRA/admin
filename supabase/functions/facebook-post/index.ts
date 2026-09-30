// Posts a draft from the Photos tab to PRA's Facebook Page. This is the only
// code of The Current that runs on a server: the Page key must never reach the
// browser (the app and its repository are public).
//
// Secrets (Supabase > Edge Functions > Secrets):
//   FB_PAGE_ID      the Page's number
//   FB_TOKEN        a key from Meta with pages_manage_posts on that Page: a Page
//                   key, or a user / system-user key the Page key is read from
//   FB_API_VERSION  optional, e.g. v26.0
// Setup: supabase/functions/facebook-post/README.md
//
// The browser cuts each photo to the post's shape and sends it here one at a
// time ("photo"), then asks for the post ("publish"). Everything is checked
// again here against the database, as the signed-in office account: the post
// must exist, not be on Facebook already, and every photo in it must be listed
// and checked against the no-photo list. The caption posted is the one saved.

import { createClient } from 'npm:@supabase/supabase-js@2'

const GRAPH = `https://graph.facebook.com/${Deno.env.get('FB_API_VERSION') || 'v26.0'}`
const MAX_BYTES = 4 * 1024 * 1024 // Facebook's limit for a JPEG
const SENDING_MS = 5 * 60 * 1000 // a send that has not finished after this long is taken as failed
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

class Problem extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const setupHint = 'Posting to Facebook is not set up yet: the FB_PAGE_ID and FB_TOKEN secrets are missing. See supabase/functions/facebook-post/README.md.'
const columnHint = 'Posting to Facebook is not set up in the database yet. Run supabase/updates-2026-09-29-facebook.sql in Supabase, then try again.'

// ---------------- Facebook ----------------

function fbError(e: { code?: number, error_subcode?: number, message?: string } | undefined) {
  const msg = e?.message || 'Facebook did not accept the request.'
  if (e?.code === 190) return new Problem(`Facebook no longer accepts the key (it has expired or been revoked). Make a new one and save it as FB_TOKEN. (${msg})`, 502)
  if (e?.code === 10 || e?.code === 200 || (e?.code && e.code >= 200 && e.code < 300)) return new Problem(`The key is not allowed to post to the Page. It needs pages_manage_posts, from someone who can create content on the Page. (${msg})`, 502)
  if (e?.code === 368) return new Problem(`Facebook has blocked posting for now. (${msg})`, 502)
  return new Problem(`Facebook: ${msg}`, 502)
}

async function graph(path: string, params: Record<string, string | Blob>, method = 'POST') {
  let res: Response
  if (method === 'GET' || method === 'DELETE') {
    res = await fetch(`${GRAPH}/${path}?${new URLSearchParams(params as Record<string, string>)}`, { method })
  } else {
    const form = new FormData()
    for (const [k, v] of Object.entries(params)) form.append(k, v)
    res = await fetch(`${GRAPH}/${path}`, { method, body: form })
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) throw fbError(data.error)
  return data
}

/** The Page, and the key to post as it. A user or system-user key is swapped for the Page's own key. */
async function page() {
  const id = Deno.env.get('FB_PAGE_ID')
  const token = Deno.env.get('FB_TOKEN')
  if (!id || !token) throw new Problem(setupHint, 503)
  try {
    const d = await graph(id, { fields: 'name,link,access_token', access_token: token }, 'GET')
    return { id, name: d.name as string, link: d.link as string, token: (d.access_token as string) || token }
  } catch (e) {
    // A Page key cannot always read its own access_token field; it is already the right key.
    if (!(e instanceof Problem) || /expired|revoked/.test(e.message)) throw e
    const d = await graph(id, { fields: 'name,link', access_token: token }, 'GET')
    return { id, name: d.name as string, link: d.link as string, token }
  }
}

// ---------------- The database, as the signed-in account ----------------

type Db = ReturnType<typeof createClient>
type Post = { id: string, event_id: string, caption: string | null, photo_codes: string[] | null, status: string, facebook: Record<string, unknown> | null }

async function loadPost(sb: Db, id: string): Promise<Post> {
  if (!id) throw new Problem('Which post? (post_id is missing)')
  const { data, error } = await sb.from('adm_event_posts').select('id, event_id, caption, photo_codes, status, facebook').eq('id', id).maybeSingle()
  if (error) throw new Problem(/facebook/.test(error.message) ? `${columnHint} (${error.message})` : error.message, 500)
  if (!data) throw new Problem('That post was not found. Reload the page.', 404)
  return data as Post
}

const sendingNow = (post: Post) => {
  const at = Date.parse(String(post.facebook?.sending_at || ''))
  return at > Date.now() - SENDING_MS
}

function assertOpen(post: Post) {
  if (post.facebook?.post_id) throw new Problem('This post is already on Facebook.', 409)
  if (post.status === 'dropped') throw new Problem('This post has been deleted. Restore it first.', 409)
  if (sendingNow(post)) throw new Problem('This post is being sent to Facebook already. Wait a few minutes and reload.', 409)
}

/** The post's photos, each in the album and checked against the no-photo list. */
async function checkedPhotos(sb: Db, post: Post) {
  const codes = post.photo_codes || []
  if (!codes.length) throw new Problem('The post has no photos.')
  const { data, error } = await sb.from('adm_event_photos').select('code, caption, listed, cleared').eq('event_id', post.event_id).in('code', codes)
  if (error) throw new Problem(error.message, 500)
  const byCode = new Map((data || []).map((p) => [p.code, p]))
  for (const c of codes) {
    const p = byCode.get(c)
    if (!p || p.listed === false) throw new Problem(`Photo ${c} is no longer in the album. Take it out of the post first.`, 409)
    if (!p.cleared) throw new Problem(`Photo ${c} has not been checked against the no-photo list.`, 409)
  }
  return byCode
}

// ---------------- Actions ----------------

async function status() {
  const p = await page()
  return { ready: true, page: { id: p.id, name: p.name, link: p.link } }
}

async function photo(sb: Db, body: FormData) {
  const post = await loadPost(sb, String(body.get('post_id') || ''))
  assertOpen(post)
  const code = String(body.get('code') || '')
  if (!(post.photo_codes || []).includes(code)) throw new Problem(`Photo ${code} is not in this post.`)
  const byCode = await checkedPhotos(sb, post)
  const file = body.get('file')
  if (!(file instanceof Blob) || !file.size) throw new Problem('The picture did not arrive.')
  if (file.size > MAX_BYTES) throw new Problem('The picture is larger than Facebook takes (4 MB).')
  const pg = await page()
  // Not published: it only appears as part of the post. A scheduled post needs "temporary" photos.
  const d = await graph(`${pg.id}/photos`, {
    source: file,
    published: 'false',
    temporary: body.get('scheduled') ? 'true' : 'false',
    alt_text_custom: String(byCode.get(code)?.caption || ''),
    access_token: pg.token,
  })
  return { code, id: d.id }
}

async function publish(sb: Db, body: { post_id: string, media: { code: string, id: string }[], at?: number | null, by?: string }) {
  const post = await loadPost(sb, body.post_id)
  assertOpen(post)
  await checkedPhotos(sb, post)
  const caption = (post.caption || '').trim()
  if (!caption) throw new Problem('The post has no caption. Write one and try again.')
  const codes = post.photo_codes || []
  const media = body.media || []
  if (media.length !== codes.length || media.some((m, i) => m.code !== codes[i] || !m.id)) throw new Problem('The photos sent do not match the post. Reload the page and try again.', 409)
  const at = body.at ? Number(body.at) : null
  if (at) {
    const secs = at - Date.now() / 1000
    if (!(secs >= 10 * 60 && secs <= 30 * 24 * 3600)) throw new Problem('A scheduled post must be between 10 minutes and 30 days from now.')
  }

  // Claim the post so a second click, or a second person, cannot post it twice.
  const since = new Date(Date.now() - SENDING_MS).toISOString()
  const claim = await sb.from('adm_event_posts').update({ facebook: { sending_at: new Date().toISOString(), by: body.by || '' } })
    .eq('id', post.id).is('facebook->>post_id', null)
    .or(`facebook.is.null,facebook->>sending_at.is.null,facebook->>sending_at.lt."${since}"`).select('id')
  if (claim.error) throw new Problem(claim.error.message, 500)
  if (!claim.data?.length) throw new Problem('This post is being sent to Facebook already. Wait a few minutes and reload.', 409)

  const pg = await page()
  const params: Record<string, string> = { message: caption, access_token: pg.token }
  media.forEach((m, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: m.id }) })
  if (at) { params.published = 'false'; params.scheduled_publish_time = String(at) }
  let d
  try { d = await graph(`${pg.id}/feed`, params) } catch (e) {
    await sb.from('adm_event_posts').update({ facebook: null }).eq('id', post.id)
    throw e
  }

  const now = new Date().toISOString()
  const facebook = {
    post_id: d.id, link: `https://www.facebook.com/${d.id}`, page: pg.name, photo_ids: media.map((m) => m.id),
    scheduled_for: at ? new Date(at * 1000).toISOString() : null, sent_at: now, by: body.by || '',
  }
  const fields = { facebook, status: 'posted', posted_at: facebook.scheduled_for || now, posted_by: body.by || '' }
  const { error } = await sb.from('adm_event_posts').update(fields).eq('id', post.id)
  // The post is out; if the record could not be written the browser writes it.
  return { ...fields, saved: !error, save_error: error?.message }
}

/** Takes a scheduled post off Facebook before it goes out. A post that is already public is left to Facebook. */
async function cancel(sb: Db, body: { post_id: string }) {
  const post = await loadPost(sb, body.post_id)
  const fb = post.facebook || {}
  if (!fb.post_id) throw new Problem('This post is not on Facebook.')
  if (!fb.scheduled_for || Date.parse(String(fb.scheduled_for)) < Date.now() + 60 * 1000) throw new Problem('This post has gone out already. Delete it on Facebook if it should come down.', 409)
  const pg = await page()
  await graph(String(fb.post_id), { access_token: pg.token }, 'DELETE')
  const fields = { facebook: null, status: 'draft', posted_at: null, posted_by: null }
  const { error } = await sb.from('adm_event_posts').update(fields).eq('id', post.id)
  return { ...fields, saved: !error, save_error: error?.message }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (req.method !== 'POST') throw new Problem('Use POST.', 405)
    // The database is read as the person signed in to The Current, so its row rules apply.
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const key = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || ''
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, key, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } })
    const { data: { user } } = await sb.auth.getUser(jwt)
    // The same rule as adm_is_staff() in supabase/schema.sql: office accounts only.
    if (!user || !['teacher', 'admin'].includes(user.app_metadata?.role)) throw new Problem('Sign in with an office account to post to Facebook.', 403)

    const form = (req.headers.get('content-type') || '').includes('multipart/form-data')
    const body = form ? await req.formData() : await req.json()
    const action = form ? (body as FormData).get('action') : (body as { action?: string }).action
    if (action === 'status') return reply(await status())
    if (action === 'photo' && form) return reply(await photo(sb, body as FormData))
    if (action === 'publish') return reply(await publish(sb, body))
    if (action === 'cancel') return reply(await cancel(sb, body))
    throw new Problem(`Unknown action: ${action}`)
  } catch (e) {
    const status = e instanceof Problem ? e.status : 500
    return reply({ error: e instanceof Error ? e.message : String(e) }, status)
  }
})
