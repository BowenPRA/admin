// Visitor numbers for pra.edu.vn on the Website page. The website counts visits with
// Cloudflare Web Analytics; the web-stats Edge Function (supabase/functions/web-stats)
// holds the Cloudflare key and asks for them. This side turns the answer into days,
// readable names for pages and where visitors came from, and the comparison.

import { supabase, hasSupabase } from './supabaseClient.js'

const FN = 'web-stats'
const deployHint = 'Website numbers are not set up yet: the web-stats function has not been deployed to Supabase. See supabase/functions/web-stats/README.md.'
export const PERIODS = [7, 30, 90]
/** The counter went on the website on this day; nothing is counted before it. */
export const COUNTING_SINCE = '2026-10-24'
const DAY = 86400000
const VN = 7 * 3600000

/**
 * The last `days` days of visitors (Vietnam time, today so far included) and the same
 * stretch just before, for comparing. Offline testing gets made-up numbers.
 * @returns {Promise<{ days, since, until, totals, before, hours, pages, from, countries, devices, sampled, sample? }>}
 */
export async function fetchWebStats(days) {
  if (!hasSupabase) return sampleStats(days)
  const { data, error } = await supabase.functions.invoke(FN, { body: { days } })
  if (!error) return data
  let msg = error.message
  try {
    const j = await error.context?.json()
    if (j?.error) msg = j.error
    else if (error.context?.status === 404) msg = deployHint
  } catch { if (error.name === 'FunctionsFetchError' || error.context?.status === 404) msg = deployHint }
  throw new Error(msg)
}

/** The Vietnam date (YYYY-MM-DD) of a moment. */
export const vnDate = (t) => new Date(new Date(t).getTime() + VN).toISOString().slice(0, 10)

/** One row per day of the stretch, with nothing-counted days as 0. */
export function byDay(stats) {
  const out = new Map()
  for (let t = Date.parse(stats.since); t < Date.parse(stats.until); t += DAY) out.set(vnDate(t), { date: vnDate(t), views: 0, visits: 0 })
  for (const h of stats.hours) {
    const d = out.get(vnDate(h.t))
    if (d) { d.views += h.views; d.visits += h.visits }
  }
  return [...out.values()]
}

/** Up or down on the stretch before, as a whole percent; null when there is nothing to compare with. */
export const change = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : null)

/** A page's name from its address: "/learning/early-years/" is "Learning › Early years". */
export function pageName(path, home) {
  const vi = path === '/vi' || path.startsWith('/vi/')
  const parts = (vi ? path.slice(3) : path).split('/').filter(Boolean)
  const words = (s) => decodeURIComponent(s).replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase())
  return { name: parts.length ? parts.map(words).join(' › ') : home, vi }
}

// Where a visit came from, by the address of the page the visitor clicked through from.
const SOURCES = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'Facebook'],
  [/(^|\.)messenger\.com$/, 'Messenger'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)zalo\.(me|vn)$/, 'Zalo'],
  [/^mail\.google\.com$/, 'Gmail'],
  [/(^|\.)google\.[a-z.]+$/, 'Google'],
  [/(^|\.)coccoc\.com$/, 'Cốc Cốc'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)yahoo\.[a-z.]+$/, 'Yahoo'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)youtube\.com$/, 'YouTube'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, 'ChatGPT'],
  [/^current\.pra\.edu\.vn$/, 'The Current'],
  [/(^|\.)palmriveracademy\.edu\.vn$/, 'palmriveracademy.edu.vn'],
]

/**
 * Visits by where they came from, biggest first. Moving between our own pages is not a
 * visit, so those rows drop out. `direct` names visits with no address to go by.
 */
export function sources(from, host, direct) {
  const out = new Map()
  for (const r of from) {
    if (!r.visits || r.key === host || r.key === `www.${host}`) continue
    const name = r.key ? (SOURCES.find(([re]) => re.test(r.key))?.[1] || r.key.replace(/^www\./, '')) : direct
    out.set(name, (out.get(name) || 0) + r.visits)
  }
  return [...out].map(([name, visits]) => ({ name, visits })).sort((a, b) => b.visits - a.visits)
}

/** A country's name from Cloudflare's two-letter code. */
export function countryName(code, lang) {
  if (!code || code === 'XX' || code === 'T1') return null
  try { return new Intl.DisplayNames([lang === 'vi' ? 'vi' : 'en'], { type: 'region' }).of(code) || code } catch { return code }
}

/** Page views on the Vietnamese pages, as a whole percent of all page views. */
export function vietnameseShare(pages) {
  const all = pages.reduce((s, p) => s + p.views, 0)
  const vi = pages.filter((p) => pageName(p.key).vi).reduce((s, p) => s + p.views, 0)
  return all ? Math.round((vi / all) * 100) : null
}

// ---------------- made-up numbers for offline testing ----------------

function sampleStats(days) {
  let seed = days * 7919
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const until = Date.now()
  const since = Math.floor((until + VN) / DAY) * DAY - VN - (days - 1) * DAY
  const hours = []
  for (let t = since; t < until; t += 3600000) {
    const hourVN = new Date(t + VN).getUTCHours()
    const weekday = new Date(t + VN).getUTCDay() % 6 !== 0
    const busy = hourVN >= 7 && hourVN <= 22 ? (weekday ? 1.4 : 0.9) : 0.15
    const visits = Math.floor(rnd() * 2.2 * busy)
    if (visits) hours.push({ t: new Date(t).toISOString().slice(0, 13) + ':00:00Z', visits, views: visits + Math.floor(rnd() * 3 * visits) })
  }
  const totals = hours.reduce((s, h) => ({ views: s.views + h.views, visits: s.visits + h.visits }), { views: 0, visits: 0 })
  const split = (list) => {
    const w = list.map(() => rnd() ** 2)
    const sum = w.reduce((a, b) => a + b, 0)
    return list.map((key, i) => ({ key, views: Math.round((totals.views * w[i]) / sum), visits: Math.round((totals.visits * w[i]) / sum) }))
      .sort((a, b) => b.views - a.views)
  }
  return {
    host: 'pra.edu.vn',
    days,
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
    totals,
    before: { views: Math.round(totals.views * 0.8), visits: Math.round(totals.visits * 0.85) },
    hours,
    pages: split(['/', '/vi/', '/admissions/', '/vi/admissions/', '/learning/early-years/', '/families/fees/', '/vi/families/fees/', '/about/', '/contact/', '/events/q1-showcase-2026/', '/newsletter/', '/learning/lower-secondary/', '/admissions/enroll/']),
    from: split(['', 'm.facebook.com', 'l.facebook.com', 'www.google.com', 'www.google.com.vn', 'coccoc.com', 'pra.edu.vn', 'zalo.me', 'mail.google.com', 'palmriveracademy.edu.vn']),
    countries: split(['VN', 'AU', 'US', 'KR', 'GB', 'SG']),
    devices: split(['mobile', 'desktop', 'tablet']),
    sampled: false,
    sample: true,
  }
}
