// An issue as the editor keeps it (one row in adm_newsletters, its parts in
// adm_newsletter_parts) and as everything else reads it: the "payload" that the
// website shows, and the PDF and the email are made from (README.md). Also the
// checks the editor and Publish share: what still needs Vietnamese, which
// photos are not cleared, wording notes, lengths, and where an issue stands.
// Pure functions, no browser.

import { EDITIONS, PART_TYPES, CLASS_TONES, STORY_TONES, SITE, portraitUrl } from './constants.js'
import { cleanHtml, plain, safeUrl, readingMinutes, wordingNotes, firstSentence } from './text.js'
import { dateRange, timeSpan, longDay, issueLabel, calendarLink } from './dates.js'

export const PAYLOAD_VERSION = 1
const str = (s) => String(s ?? '').trim()
const bi = (en, vi) => ({ en: str(en), vi: str(vi) })
const byPos = (a, b) => (a.pos ?? 0) - (b.pos ?? 0) || String(a.id).localeCompare(String(b.id))
/** The short id a part has on the page (#s-1a2b3c4d). */
export const anchorId = (partId) => String(partId || '').replace(/-/g, '').slice(-8)

/** A part's list entries ({ id: entry }) as an array in their order. */
export const itemsOf = (part) => Object.entries(part?.data?.items || {}).map(([id, it]) => ({ ...it, id })).sort(byPos)
/** A class corner's words of the week, in order. */
export const wordsOf = (part) => Object.entries(part?.data?.words || {}).map(([id, w]) => ({ ...w, id })).sort(byPos)
/** Parts in their order on the page. */
export const sortParts = (parts) => [...(parts || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

/** Whether a class corner is left out this week. */
const skipped = (part) => part.type === 'class' && !!part.data?.skip
/** Parts that go to families only: never on the public page. */
export const familiesOnly = (part) => part.public === false || !!PART_TYPES[part.type]?.familiesOnly

/** [english, vietnamese] pairs a part is made of, for "what still needs Vietnamese". */
function pairs(part) {
  const d = part.data || {}, e = d.en || {}, v = d.vi || {}
  const out = []
  const add = (a, b) => out.push([str(a), str(b)])
  switch (part.type) {
    case 'opening': add(e.heading, v.heading); add(plain(e.body), plain(v.body)); break
    case 'story': add(e.heading, v.heading); add(e.when, v.when); add(plain(e.body), plain(v.body)); add(e.button_label, v.button_label); break
    case 'class': add(plain(e.body), plain(v.body)); add(e.ask, v.ask); wordsOf(part).forEach((w) => add(w.en, w.vi)); break
    case 'photos': add(e.heading, v.heading); break
    case 'quote': add(e.text, v.text); add(e.who, v.who); break
    case 'press': add(e.blurb, v.blurb); break
    case 'welcome': add(e.heading, v.heading); add(plain(e.body), plain(v.body)); break
    case 'closing': add(plain(e.body), plain(v.body)); break
    default: break
  }
  ;(d.photos || []).forEach((p) => add(p.en, p.vi))
  return out
}

/** The English a part's Vietnamese was made from, as one string: when it changes, the Vietnamese is flagged. */
export const enSnapshot = (part) => pairs(part).map(([en]) => en).filter(Boolean).join('\n')

/**
 * Where a part's Vietnamese stands: 'ok', 'missing', 'changed' (the English has
 * changed since), 'empty' (nothing written yet) or 'none' (nothing to translate).
 * `n` counts lines, for the lists.
 */
export function viState(part) {
  if (!part || part.type === 'class' && skipped(part)) return { kind: 'none' }
  if (part.type === 'dates' || part.type === 'reminders') {
    const its = itemsOf(part).filter((it) => (part.type === 'reminders' || (it.on !== false && !it.cal)) && str(it.en))
    if (!its.length) return { kind: part.type === 'dates' ? 'ok' : 'empty' }
    const miss = its.filter((it) => !str(it.vi)).length
    if (miss) return { kind: 'missing', n: miss }
    const ch = its.filter((it) => str(it.vi_from) !== str(it.en)).length
    return ch ? { kind: 'changed', n: ch } : { kind: 'ok' }
  }
  const ps = pairs(part)
  if (!ps.some(([en]) => en)) return { kind: part.type === 'press' ? 'none' : 'empty' }
  const miss = ps.filter(([en, vi]) => en && !vi).length
  if (miss) return { kind: 'missing', n: miss }
  if ((part.data?.vi_from ?? null) !== enSnapshot(part)) return { kind: 'changed' }
  return { kind: 'ok' }
}

/** All the English, and all the Vietnamese, a part shows (for the wording checks and reading time). */
export function partTexts(part) {
  const en = [], vi = []
  if (part.type === 'dates' || part.type === 'reminders') {
    itemsOf(part).filter((it) => !it.cal).forEach((it) => { en.push(it.en); vi.push(it.vi) })
  } else pairs(part).forEach(([a, b]) => { en.push(a); vi.push(b) })
  return { en: en.filter(Boolean).join('\n'), vi: vi.filter(Boolean).join('\n') }
}
export const notesFor = (part) => { const t = partTexts(part); return wordingNotes(t.en, t.vi) }

/** Fields over their soft length: [{ field, lang, n, limit }]. */
export function lengthIssues(part) {
  const lim = PART_TYPES[part.type]?.limits || {}
  const d = part.data || {}
  const out = []
  for (const lang of ['en', 'vi']) {
    const t = d[lang] || {}
    for (const [field, limit] of Object.entries(lim)) {
      if (!(field in t)) continue
      const n = plain(t[field]).length
      // Vietnamese runs about a fifth longer than the same English.
      const max = lang === 'vi' ? Math.round(limit * 1.2) : limit
      if (n > max) out.push({ field, lang, n, limit: max })
    }
  }
  return out
}

const photosIn = (parts, issue) => [
  ...(issue?.settings?.cover ? [issue.settings.cover] : []),
  ...parts.filter((p) => !skipped(p)).flatMap((p) => p.data?.photos || []),
]
/** A photo may go out once someone has checked it against the no-photo list. */
export const photoCleared = (p) => !!p?.cleared

/**
 * Everything Publish and the editor's summary need to know about an issue.
 */
export function issueChecks(issue, parts) {
  const live = parts.filter((p) => !skipped(p))
  const counted = live.filter((p) => !['none', 'empty'].includes(viState(p).kind))
  const needVi = counted.filter((p) => ['missing', 'changed'].includes(viState(p).kind))
  const photos = photosIn(live, issue)
  const unchecked = photos.filter((p) => !photoCleared(p))
  const notes = live.flatMap((p) => notesFor(p).map((n) => ({ ...n, part: p.id })))
  const long = live.flatMap((p) => lengthIssues(p).map((x) => ({ ...x, part: p.id })))
  const opening = live.find((p) => p.type === 'opening')
  const minutes = readingMinutes(live.map((p) => partTexts(p).en))
  return {
    counted, needVi, photos, unchecked, notes, long, minutes,
    noOpening: !str(opening?.data?.en?.heading),
    noCover: !issue?.settings?.cover,
    noSubject: !str(issue?.settings?.subject),
  }
}

/** A short fingerprint of what an issue says, to tell whether it has changed since it was published. */
/**
 * JSON with every object's keys in order, so the same content always gives the
 * same string (the database hands objects back with their keys in its own order).
 */
export function stable(x) {
  if (x === undefined) return 'null'
  if (x === null || typeof x !== 'object') return JSON.stringify(x)
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`
  return `{${Object.keys(x).filter((k) => x[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(x[k])}`).join(',')}}`
}

export function fingerprint(issue, parts) {
  const s = stable([issue.edition, issue.issue_date, issue.settings?.subject || '', issue.settings?.cover || null,
    sortParts(parts).map((p) => [p.id, p.type, p.public !== false, p.data])])
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(36)
}

/**
 * Where an issue stands: 'draft' (being written), 'vi' (English done, Vietnamese
 * to do), 'ready', 'published', or 'changed' (published, then changed).
 */
export function statusOf(issue, parts) {
  if (issue.status === 'published') return issue.settings?.published_print === fingerprint(issue, parts) ? 'published' : 'changed'
  if (issue.status !== 'english_done') return 'draft'
  return issueChecks(issue, parts).needVi.length ? 'vi' : 'ready'
}

/** A subject line from what the issue says: "The Palm River Post: Showcase moved to Thursday · Quarter Two tuition". */
export function suggestSubject(issue, parts) {
  const ed = EDITIONS[issue.edition] || EDITIONS.post
  const heads = sortParts(parts).filter((p) => p.type === 'story' && str(p.data?.en?.heading)).map((p) => str(p.data.en.heading).replace(/[.!:—-]+$/, '').replace(/\s+[—-]\s+.*$/, ''))
  const open = str(sortParts(parts).find((p) => p.type === 'opening')?.data?.en?.heading).replace(/[.!]+$/, '')
  const bits = heads.length ? heads : open ? [open] : []
  let line = `${ed.name.en}: ${bits[0] || issueLabel(issue, 'en')}`
  for (const b of bits.slice(1)) { if ((`${line} · ${b}`).length > 80) break; line += ` · ${b}` }
  return line
}

/** The issue's pages on the website. */
export const pageUrls = (slug) => ({ en: `${SITE}/newsletter/${slug}/`, vi: `${SITE}/vi/newsletter/${slug}/` })

/**
 * The issue in the form the website, the PDF and the email read (README.md).
 * @param {object} issue  the adm_newsletters row
 * @param {Array} parts   its adm_newsletter_parts rows
 * @param {object} opts
 * @param {'public'|'families'} [opts.audience]  'public' leaves out families-only parts (the website)
 * @param {(photo:object) => ({ src:string, small?:string } | null)} opts.photo  where each photo can be loaded from
 * @param {{ en?:string, vi?:string }} [opts.pdf]  the PDFs' public addresses, once published
 */
export function buildPayload(issue, parts, { audience = 'public', photo = () => null, pdf = {}, publishedAt = null } = {}) {
  const ed = EDITIONS[issue.edition] || EDITIONS.post
  const ordered = sortParts(parts)
  const photoOut = (p) => {
    if (!p) return null
    const u = photo(p) || {}
    return { src: u.src || '', small: u.small || u.src || '', w: p.w || null, h: p.h || null, alt: bi(p.en, p.vi), focus: p.focus || null }
  }
  const opening = ordered.find((p) => p.type === 'opening')
  const dates = ordered.filter((p) => p.type === 'dates').flatMap(itemsOf)
    .filter((it) => it.on !== false && it.iso && str(it.en))
    .sort((a, b) => a.iso.localeCompare(b.iso) || byPos(a, b))
    .map((it) => ({
      id: it.id, iso: it.iso, end: it.end || null,
      date: { en: dateRange(it.iso, it.end, 'en'), vi: dateRange(it.iso, it.end, 'vi') },
      time: it.t1 ? { en: timeSpan(it.t1, it.t2, 'en'), vi: timeSpan(it.t1, it.t2, 'vi') } : null,
      what: bi(it.en, it.vi), tag: it.tag || '',
      gcal: calendarLink({ iso: it.iso, end: it.end, t1: it.t1, t2: it.t2, title: `${str(it.en)} (Palm River Academy)` }),
    }))
  const reminders = ordered.filter((p) => p.type === 'reminders').flatMap(itemsOf).filter((it) => str(it.en)).map((it) => bi(it.en, it.vi))

  const out = []
  let tone = 0
  for (const p of ordered) {
    if (['opening', 'dates', 'reminders'].includes(p.type) || skipped(p)) continue
    if (audience === 'public' && familiesOnly(p)) continue
    const d = p.data || {}, e = d.en || {}, v = d.vi || {}
    const id = anchorId(p.id)
    const photos = (d.photos || []).map(photoOut)
    const html = (k) => ({ en: cleanHtml(e[k]), vi: cleanHtml(v[k]) })
    if (p.type === 'story') {
      if (!str(e.heading) && !plain(e.body)) continue
      const url = safeUrl(d.button_url)
      out.push({ type: 'story', id, icon: d.icon || 'book-open', tone: STORY_TONES[tone++ % STORY_TONES.length], heading: bi(e.heading, v.heading), when: bi(e.when, v.when), body: html('body'), photos,
        button: url && str(e.button_label) ? { label: bi(e.button_label, v.button_label), url } : null })
    } else if (p.type === 'class') {
      if (!plain(e.body) && !photos.length) continue
      out.push({ type: 'class', id, class: str(d.class), class_key: d.class_key || '', tone: CLASS_TONES[d.class_key] || 'blue',
        teacher: str(d.teacher) ? { name: str(d.teacher), photo: portraitUrl(d.teacher) } : null,
        body: html('body'), photos, words: wordsOf(p).filter((w) => str(w.en)).map((w) => bi(w.en, w.vi)), ask: str(e.ask) ? bi(e.ask, v.ask) : null })
    } else if (p.type === 'photos') {
      if (!photos.length) continue
      out.push({ type: 'photos', id, icon: d.icon || 'images', tone: STORY_TONES[tone++ % STORY_TONES.length], heading: bi(e.heading, v.heading), photos })
    } else if (p.type === 'quote') {
      if (!str(e.text)) continue
      out.push({ type: 'quote', id, text: bi(e.text, v.text), who: bi(e.who, v.who), photo: photos[0] || null })
    } else if (p.type === 'press') {
      const url = safeUrl(d.url)
      if (!url || !str(d.title)) continue
      out.push({ type: 'press', id, title: str(d.title), author: str(d.author), url, blurb: bi(e.blurb, v.blurb) })
    } else if (p.type === 'welcome') {
      if (!plain(e.body) && !(d.names || []).length) continue
      out.push({ type: 'welcome', id, heading: bi(e.heading, v.heading), body: html('body'), names: (d.names || []).filter((x) => str(x?.name)).map((x) => ({ name: str(x.name), class: str(x.class) })) })
    } else if (p.type === 'closing') {
      if (!plain(e.body)) continue
      out.push({ type: 'closing', id, body: html('body') })
    }
  }

  const included = ordered.filter((p) => !skipped(p) && !(audience === 'public' && familiesOnly(p)))
  const slug = issue.slug
  const lead = bi(opening?.data?.en?.heading, opening?.data?.vi?.heading)
  return {
    v: PAYLOAD_VERSION,
    audience,
    slug,
    edition: ed.id,
    edition_name: ed.name,
    tone: ed.tone,
    date: issue.issue_date,
    school_year: issue.school_year,
    quarter: issue.quarter,
    week: issue.week,
    label: { en: issueLabel(issue, 'en'), vi: issueLabel(issue, 'vi') },
    day: { en: longDay(issue.issue_date, 'en'), vi: longDay(issue.issue_date, 'vi') },
    subject: str(issue.settings?.subject) || suggestSubject(issue, parts),
    preheader: { en: lead.en || firstSentence(opening?.data?.en?.body), vi: lead.vi || firstSentence(opening?.data?.vi?.body) },
    url: pageUrls(slug),
    cover: photoOut(issue.settings?.cover || null),
    opening: { lead, body: { en: cleanHtml(opening?.data?.en?.body), vi: cleanHtml(opening?.data?.vi?.body) } },
    need: { dates, reminders },
    parts: out,
    pdf: { en: pdf.en || null, vi: pdf.vi || null },
    vi_complete: !included.some((p) => ['missing', 'changed'].includes(viState(p).kind)),
    reading_minutes: readingMinutes(included.map((p) => partTexts(p).en)),
    published_at: publishedAt,
  }
}

/** A field in one language, or the English when the Vietnamese is not there yet: { text, english }. */
export const pick = (obj, lang) => {
  if (!obj) return { text: '', english: false }
  if (lang === 'vi' && !str(typeof obj.vi === 'string' && obj.vi.startsWith('<') ? plain(obj.vi) : obj.vi)) return { text: obj.en || '', english: !!str(obj.en) }
  return { text: obj[lang] || '', english: false }
}
