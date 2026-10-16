// Reading and saving newsletter issues and their parts. With Supabase, each box
// is saved on its own through adm_newsletter_edit (supabase/updates-2026-10-16-
// newsletter.sql), so Seth, a teacher and the office can work on one issue at
// the same time. Without Supabase (offline development) everything is kept in
// this browser.

import { supabase, hasSupabase } from '../supabaseClient.js'
import { genId } from '../db.js'

const ISSUES = 'adm_newsletters'
const PARTS = 'adm_newsletter_parts'
const VIEWS = 'adm_newsletter_views'
// Everything of an issue except the published payload, which only the website needs.
const ISSUE_COLS = 'id, edition, issue_date, school_year, quarter, week, slug, status, settings, published_at, published_by, publish_count, email, english_done_at, english_done_by, created_by, updated_by, created_at, updated_at'

const setupHint = 'The newsletter is not set up in the database yet. Run supabase/updates-2026-10-16-newsletter.sql in Supabase, then reload.'
/** Turns "no such table / function / bucket" into something the office can act on. */
export function newsletterError(e) {
  const msg = e?.message || String(e)
  if (/adm_newsletter|adm-newsletter|bucket not found|schema cache/i.test(msg) && /does not exist|not found|schema cache|could not find/i.test(msg)) return new Error(`${setupHint} (${msg})`)
  return new Error(msg)
}
const throwIf = (error) => { if (error) throw newsletterError(error) }

// ---------------- offline: this browser ----------------
const LS = 'pra-admin-newsletter-v1'
const lsRead = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}') } catch { return {} } }
const lsWrite = (d) => localStorage.setItem(LS, JSON.stringify(d))
const now = () => new Date().toISOString()
const clone = (x) => JSON.parse(JSON.stringify(x))

function setDeep(obj, path, value) {
  let cur = obj
  for (const k of path.slice(0, -1)) {
    if (!cur[k] || typeof cur[k] !== 'object' || Array.isArray(cur[k])) cur[k] = {}
    cur = cur[k]
  }
  cur[path[path.length - 1]] = value
  return obj
}
function deleteDeep(obj, path) {
  let cur = obj
  for (const k of path.slice(0, -1)) { if (!cur?.[k] || typeof cur[k] !== 'object') return obj; cur = cur[k] }
  if (cur && typeof cur === 'object') delete cur[path[path.length - 1]]
  return obj
}
/** One photo by its id ({photos,@id,…}) or the photos' order ({photos,@order}), as adm_newsletter_photo_edit does it. */
function photoEdit(d, path, value, del) {
  const list = Array.isArray(d.photos) ? d.photos : []
  if (path[1] === '@order') {
    const at = new Map((Array.isArray(value) ? value : []).map((id, i) => [id, i]))
    d.photos = list.map((p, i) => [p, at.has(p.id) ? at.get(p.id) : 100000 + i]).sort((a, b) => a[1] - b[1]).map(([p]) => p)
    return d
  }
  const id = path[1].slice(1)
  const rest = path.slice(2)
  const i = list.findIndex((p) => p.id === id)
  if (del) {
    if (i < 0) return d
    d.photos = rest.length ? list.map((p, k) => (k === i ? deleteDeep(p, rest) : p)) : list.filter((_, k) => k !== i)
    return d
  }
  if (!rest.length) { const el = { ...value, id }; d.photos = i < 0 ? [...list, el] : list.map((p, k) => (k === i ? el : p)); return d }
  if (i < 0) return d
  d.photos = list.map((p, k) => (k === i ? setDeep(p, rest, value) : p))
  return d
}
/**
 * The same change adm_newsletter_edit makes, on a part held in memory. A box of a
 * date, reminder, word or photo that someone removed meanwhile changes nothing.
 */
export function applyEdit(data, path, value, del = false) {
  const d = clone(data || {})
  if (path[0] === 'photos' && String(path[1] || '').startsWith('@')) return photoEdit(d, path, value, del)
  if (!del && path.length >= 3 && ['items', 'words'].includes(path[0]) && d[path[0]]?.[path[1]] == null) return d
  return del ? deleteDeep(d, path) : setDeep(d, path, value)
}

// ---------------- issues ----------------
export async function listIssues() {
  if (!hasSupabase) return (lsRead().issues || []).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'published')))
  const { data, error } = await supabase.from(ISSUES).select(ISSUE_COLS).order('issue_date', { ascending: false }).limit(400)
  throwIf(error)
  return data || []
}

export async function getIssue(id) {
  if (!hasSupabase) return (lsRead().issues || []).find((r) => r.id === id) || null
  const { data, error } = await supabase.from(ISSUES).select(`${ISSUE_COLS}, published`).eq('id', id).maybeSingle()
  throwIf(error)
  return data
}

/** Parts of one issue, or of several (for the list's status chips). */
export async function listParts(issueIds) {
  const ids = Array.isArray(issueIds) ? issueIds : [issueIds]
  if (!ids.length) return []
  if (!hasSupabase) return (lsRead().parts || []).filter((p) => ids.includes(p.newsletter_id))
  const out = []
  for (let i = 0; i < ids.length; i += 50) {
    const { data, error } = await supabase.from(PARTS).select('*').in('newsletter_id', ids.slice(i, i + 50)).order('position')
    throwIf(error)
    out.push(...(data || []))
  }
  return out
}

/** Parts of an issue changed after `since` (an ISO time), to bring an open editor up to date. */
export async function partsChangedSince(issueId, since) {
  if (!hasSupabase) return []
  const { data, error } = await supabase.from(PARTS).select('*').eq('newsletter_id', issueId).gt('updated_at', since)
  throwIf(error)
  return data || []
}
/** The ids of every part an issue has now (to notice parts someone else removed). */
export async function partIds(issueId) {
  if (!hasSupabase) return (lsRead().parts || []).filter((p) => p.newsletter_id === issueId).map((p) => p.id)
  const { data, error } = await supabase.from(PARTS).select('id').eq('newsletter_id', issueId)
  throwIf(error)
  return (data || []).map((r) => r.id)
}

/** Makes an issue with its parts. Returns { issue, parts }. */
export async function createIssue(issue, parts) {
  const id = issue.id || genId()
  const row = { ...issue, id }
  const rows = parts.map((p, i) => ({ id: p.id || genId(), newsletter_id: id, position: p.position ?? (i + 1) * 10, type: p.type, public: p.public !== false, data: p.data || {} }))
  if (!hasSupabase) {
    const d = lsRead()
    if ((d.issues || []).some((x) => x.slug === row.slug || (x.edition === row.edition && x.issue_date === row.issue_date))) throw new Error('There is already an issue of this newsletter for that Friday.')
    const stamp = { created_at: now(), updated_at: now(), created_by: 'offline', updated_by: 'offline' }
    d.issues = [...(d.issues || []), { status: 'draft', settings: {}, email: {}, publish_count: 0, ...row, ...stamp }]
    d.parts = [...(d.parts || []), ...rows.map((r) => ({ ...r, ...stamp }))]
    lsWrite(d)
    return { issue: d.issues[d.issues.length - 1], parts: rows.map((r) => ({ ...r, ...stamp })) }
  }
  const { data, error } = await supabase.from(ISSUES).insert(row).select(ISSUE_COLS).single()
  if (error && /duplicate key|unique/i.test(error.message)) throw new Error('There is already an issue of this newsletter for that Friday.')
  throwIf(error)
  const { data: ps, error: e2 } = await supabase.from(PARTS).insert(rows).select('*')
  if (e2) { await supabase.from(ISSUES).delete().eq('id', id); throwIf(e2) }
  return { issue: data, parts: ps || [] }
}

/** Changes some fields of an issue (office only). */
export async function patchIssue(id, fields) {
  if (!hasSupabase) {
    const d = lsRead()
    const i = (d.issues || []).findIndex((x) => x.id === id)
    if (i < 0) throw new Error('This issue no longer exists.')
    const next = { ...d.issues[i], ...fields, updated_at: now() }
    if (fields.status === 'published' && d.issues[i].status !== 'published') { next.published_at = now(); next.published_by = 'offline' }
    if (fields.status && fields.status !== 'published') next.published = null
    if (fields.status === 'english_done' && d.issues[i].status === 'draft') { next.english_done_at = now(); next.english_done_by = 'offline' }
    d.issues[i] = next
    lsWrite(d)
    return next
  }
  // With the published payload: the PDFs' addresses in it are what "Save the email" attaches.
  const { data, error } = await supabase.from(ISSUES).update(fields).eq('id', id).select(`${ISSUE_COLS}, published`).maybeSingle()
  throwIf(error)
  if (!data) throw new Error('This could not be saved: the issue no longer exists, or your account may not change it.')
  return data
}

/**
 * Changes one key of an issue's settings in the database, leaving the others as
 * they are there (a null value removes it). Returns all the settings as saved.
 */
export async function setIssueSetting(id, key, value) {
  if (!hasSupabase) {
    const d = lsRead()
    const i = (d.issues || []).findIndex((x) => x.id === id)
    if (i < 0) throw new Error('This issue no longer exists.')
    const settings = { ...(d.issues[i].settings || {}) }
    if (value == null) delete settings[key]
    else settings[key] = value
    d.issues[i] = { ...d.issues[i], settings, updated_at: now() }
    lsWrite(d)
    return settings
  }
  const { data, error } = await supabase.rpc('adm_newsletter_setting', { p_issue: id, p_key: key, p_value: value ?? null })
  throwIf(error)
  return data || {}
}

export async function removeIssue(id) {
  if (!hasSupabase) {
    const d = lsRead()
    d.issues = (d.issues || []).filter((x) => x.id !== id)
    d.parts = (d.parts || []).filter((p) => p.newsletter_id !== id)
    lsWrite(d)
    return
  }
  const { data, error } = await supabase.from(ISSUES).delete().eq('id', id).select('id')
  throwIf(error)
  if (!data?.length) throw new Error('This could not be removed: your account is not allowed to, or it was already removed.')
}

// ---------------- parts ----------------
export async function addPart(issueId, part) {
  const row = { id: part.id || genId(), newsletter_id: issueId, position: part.position ?? 0, type: part.type, public: part.public !== false, data: part.data || {} }
  if (!hasSupabase) {
    const d = lsRead()
    const r = { ...row, created_at: now(), updated_at: now(), updated_by: 'offline' }
    d.parts = [...(d.parts || []), r]
    lsWrite(d)
    return r
  }
  const { data, error } = await supabase.from(PARTS).insert(row).select('*').single()
  throwIf(error)
  return data
}

/** Changes a part's row fields (position, public). Office only. */
export async function patchPart(id, fields) {
  if (!hasSupabase) {
    const d = lsRead()
    const i = (d.parts || []).findIndex((p) => p.id === id)
    if (i < 0) throw new Error('This part no longer exists.')
    d.parts[i] = { ...d.parts[i], ...fields, updated_at: now() }
    lsWrite(d)
    return d.parts[i]
  }
  const { data, error } = await supabase.from(PARTS).update(fields).eq('id', id).select('*').maybeSingle()
  throwIf(error)
  if (!data) throw new Error('This could not be saved: the part no longer exists, or your account may not change it.')
  return data
}

export async function removePart(id) {
  if (!hasSupabase) {
    const d = lsRead()
    d.parts = (d.parts || []).filter((p) => p.id !== id)
    lsWrite(d)
    return
  }
  const { data, error } = await supabase.from(PARTS).delete().eq('id', id).select('id')
  throwIf(error)
  if (!data?.length) throw new Error('This could not be removed: your account is not allowed to, or it was already removed.')
}

/**
 * Sets one value inside a part (`path` like ['en', 'body'] or ['items', 'i3', 'vi']),
 * or removes it (`del`). Returns the time it was saved.
 */
export async function editPart(id, path, value, del = false) {
  if (!hasSupabase) {
    const d = lsRead()
    const i = (d.parts || []).findIndex((p) => p.id === id)
    if (i < 0) throw new Error('This part of the newsletter no longer exists. Reload the page.')
    d.parts[i] = { ...d.parts[i], data: applyEdit(d.parts[i].data, path, value, del), updated_at: now() }
    lsWrite(d)
    return d.parts[i].updated_at
  }
  const { data, error } = await supabase.rpc('adm_newsletter_edit', { p_part: id, p_path: path, p_value: del ? null : value, p_delete: !!del })
  throwIf(error)
  return data
}

// ---------------- readers ----------------
/** Page openings counted by the website, for these issues: rows { slug, day, lang, source, anchor, count }. */
export async function listViews(slugs) {
  if (!hasSupabase || !slugs.length) return []
  const out = []
  for (let i = 0; i < slugs.length; i += 100) {
    const { data, error } = await supabase.from(VIEWS).select('*').in('slug', slugs.slice(i, i + 100))
    if (error) return out // counting is not there yet: no numbers rather than an error
    out.push(...(data || []))
  }
  return out
}

/** Totals for one issue: { total, en, vi, sources: { email: n, … }, anchors: { 's-…': n } }. */
export function sumViews(rows, slug) {
  const s = { total: 0, en: 0, vi: 0, sources: {}, anchors: {} }
  for (const r of rows) {
    if (r.slug !== slug) continue
    s.total += r.count
    s[r.lang === 'vi' ? 'vi' : 'en'] += r.count
    s.sources[r.source] = (s.sources[r.source] || 0) + r.count
    if (r.anchor) s.anchors[r.anchor] = (s.anchors[r.anchor] || 0) + r.count
  }
  return s
}
