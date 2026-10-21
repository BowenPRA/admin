// Students' documents on Google Drive (supabase/updates-2026-10-19-drive-docs.sql).
//
// The office files each student's enrollment form, passport or birth certificate and
// photo in "Students' enrollment forms" on the Palm River Administration shared drive,
// by year, class and student (or family). "Check Drive" copies the list of what is in
// that folder (names and Drive ids, never the files themselves) into adm_drive_files.
// This file works out, from a file's name and the folders it sits in, which student it
// belongs to and what kind of document it is. The office puts a wrong guess right on
// the student window (adm_drive_doc_links). The files open in Google's own viewer, so
// only people who can open the shared drive see them.
//
// No React and no database here, so it can be tried in Node against a folder listing.

import { foldName, guessFirstName } from './names.js'
import { VN_SURNAMES } from './families.js'

export const FOLDER = 'application/vnd.google-apps.folder'
const SHORTCUT = 'application/vnd.google-apps.shortcut'

/** The folders "Check Drive" reads, with everything inside them. */
export const DRIVE_ROOTS = [{ id: '1p6geOYezVE9h4t2uzrbIL0bbltadcdhS', name: "Students' enrollment forms" }]

// What a document can be filed as (the office's corrections keep one of these).
export const DOC_KINDS = ['form', 'student_id', 'parent_id', 'photo', 'other']
// A file whose name does not say what it is (a phone's IMG_1234.jpg) waits as 'unsorted' until
// the office looks at it (Bowen, 20 October 2026: a new student's passport pictures were under
// Other files and the summary said there were none). The order they are listed in on the student window.
export const LIST_KINDS = ['form', 'unsorted', 'student_id', 'parent_id', 'photo', 'other']
// What every current student should have; the summary marks the gaps.
export const NEEDED_KINDS = ['form', 'student_id', 'photo']

/** Drive's viewer for a file, in a page of its own or framed inside The Current. */
export const driveUrl = (id) => `https://drive.google.com/file/d/${id}/view`
export const drivePreviewUrl = (id) => `https://drive.google.com/file/d/${id}/preview`
export const driveFolderUrl = (id) => `https://drive.google.com/drive/folders/${id}`

// ---------------- names ----------------

const words = (s) => foldName(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
// The words of a name, and each two written together ("Bơ Bơ" is Bobo).
const withPairs = (w) => [...w, ...w.slice(1).map((x, i) => w[i] + x)]
// With their accents, to tell Mơ from Mo.
const rawWords = (s) => String(s || '').normalize('NFC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
const SURNAMES = new Set(VN_SURNAMES.map(foldName))
const baseName = (n) => String(n || '').replace(/\.[a-z0-9]{2,5}$/i, '')

// Words in file and folder names that are never anyone's name.
const STOP = new Set(('enrollment enrolment enroll enrol form forms pra student students passport passports passprot pasport photo photos '
  + 'profile portrait family families and va of the a mom mum mother dad father parent parents grandmother grandfather guardian '
  + 'cccd giay khai sinh birth certificate academic year report program summer new copy scan img image dsc final packet id card '
  + 'dinh danh ca nhan can cuoc ho chieu anh the chan dung israeli application registration contract withdrawal unenroll '
  + 'from regular global long term kindy nursery secondary palm river academy fillable signed document documents file files '
  + 'info information hs pdf jpg jpeg png').split(' '))
const noise = (w) => STOP.has(w) || /\d/.test(w) || w.length < 2

// One letter changed, added or left out.
function nearlySame(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let diff = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++diff > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return diff + (a.length - i) + (b.length - j) <= 1
}
// `t` from a file or folder name, `w` from a student's name. Long names may carry a typo
// (Hendrikson for Hendriksen) or lose their last letter or two (Rober for Robert).
const sameWord = (t, w) => t === w || (w.length >= 5 && t.length >= 4 && (nearlySame(t, w) || (w.startsWith(t) && w.length - t.length <= 2)))

function nameKeys(s) {
  const full = String(s.full_name || '')
  const main = words(full.replace(/\(.*?\)/g, ' '))
  // "Trần Bảo Ngọc (Emma Laine)": the name in brackets is a second full name.
  const alt = [...full.matchAll(/\(([^)]*)\)/g)].map((m) => words(m[1])).filter((w) => w.length)
  const givenText = String(s.first_name || '').trim() || guessFirstName(full, s.nickname)
  const given = words(givenText)
  const nick = words(s.nickname)
  // A first name or a nickname on its own; never a lone Vietnamese family name.
  const weak = [given, nick].filter((w) => w.length && !(w.length === 1 && SURNAMES.has(w[0])))
  return { main, alt, given, weak, accented: [...rawWords(givenText), ...rawWords(s.nickname)], all: new Set([...main, ...alt.flat(), ...given, ...nick]) }
}

// 3: the whole name (a typo allowed). 2: two or more of its words, spelled exactly, taking in the
// whole first name ("Grant Leo", "Minh Khoa and Thu Hà"; never "Nguyễn Thu Trang" for Nguyễn
// Thu Hà), or a two-word first name or nickname. 1: a one-word first name or nickname only.
function nameScore(k, T) {
  const has = (w) => T.some((t) => sameWord(t, w))
  const exact = (w) => T.includes(w)
  let best = 0
  for (const set of [k.main, ...k.alt]) {
    if (set.length < 2) continue
    if (set.every(has)) { best = 3; break }
    if (set.filter(exact).length >= 2 && k.given.every(exact)) best = 2
  }
  if (best >= 2) return best
  // A two-word first name must be spelled exactly: "Huy Hoàn" is not Hoàng Huy.
  for (const set of k.weak) if (set.length >= 2 ? set.every(exact) : set.every(has)) best = Math.max(best, set.length >= 2 ? 2 : 1)
  return best
}

// Words of a name that none of these students' names explains (a parent, a sibling).
function strangers(W, people) {
  const known = (t) => people.some((p) => [...p.keys.all].some((w) => sameWord(t, w)))
  const together = new Set()
  W.forEach((t, i) => { if (i > 0 && known(W[i - 1] + t)) { together.add(i - 1); together.add(i) } })
  return W.filter((t, i) => !together.has(i) && !noise(t) && !known(t))
}

// ---------------- what kind of document ----------------

const RE = {
  withdraw: /\b(withdraw\w*|unenrol\w*|thoi hoc|rut ho so)\b/,
  passport: /\b(passports?|passprot|pasport|ho chieu)\b/,
  birth: /\b(khai sinh|birth)\b/,
  idcard: /\b(cccd|can cuoc|dinh danh|identity|id card|id)\b/,
  parent: /\b(mom|mum|mommy|mother|dad|daddy|father|parents?|grand ?mother|grand ?father|grandma|grandpa|guardian)\b/,
  photo: /\b(photos?|portrait|profile|headshot|anh the|chan dung)\b/,
  // "Ảnh Mơ.JPG": a picture whose name starts with ảnh (Anh is also a first name, so only at the start).
  picture: /^ (anh|hinh) /,
  report: /\b(reports?|transcript|hoc ba|bang diem)\b/,
  // Jotform names a signed form "Mia-Hart-Academic-Year-26-27" or "Leo-Grant-2025-2026".
  form: /\b(enrol\w*|forms?|application|registration|dang ky|contract)\b|\b20\d\d 20\d\d\b|\bacademic year\b|\bsummer program\b|\b\d\d \d\d 20\d\d\b/,
}
const isPdf = (f) => f.mime === 'application/pdf' || /\.pdf$/i.test(f.name || '')
const isImage = (f) => /^image\//.test(f.mime || '') || /\.(jpe?g|png|gif|heic|webp)$/i.test(f.name || '')

/** { kind, label } from the name alone; kind is null when only the owner can tell (a PDF named after the student is their form). */
export function kindFromName(name) {
  const n = ` ${words(baseName(name)).join(' ')} `
  if (RE.withdraw.test(n)) return { kind: 'other', label: 'withdrawal' }
  const id = RE.passport.test(n) ? 'passport' : RE.birth.test(n) ? 'birth' : RE.idcard.test(n) ? 'idcard' : null
  if (id) return { kind: RE.parent.test(n) ? 'parent_id' : 'student_id', label: id }
  if (RE.photo.test(n) || (RE.picture.test(n) && isImage({ name }))) return { kind: 'photo', label: 'photo' }
  if (RE.report.test(n)) return { kind: 'other', label: 'report' }
  if (RE.form.test(n)) return { kind: 'form', label: 'form' }
  return { kind: null, label: null }
}

// ---------------- folders ----------------

// Year, programme and class folders hold many students: they say nothing about whose a file is.
const GENERIC = /^(\d{4} \d{4}|.*\bprogram\b.*|(nursery|kindy|kinder\w*|pre ?k|preschool|reception|year|grade|primary|secondary|upper|lower|high ?school|sacondary)\b.*)$/
const FAMILY = /\b(family|gia dinh)\b/

/** "2026-2027" from the folders above a file, or ''. */
const yearOf = (chain) => { for (const f of chain) { const m = String(f.name).match(/\b(20\d\d)\s*-\s*(20\d\d)\b/); if (m) return `${m[1]}-${m[2]}` } return '' }

/**
 * Works out every student's documents.
 * items: adm_drive_files rows ({ id, parent_id, name, mime, is_folder, size, md5, modified_at, link_id }).
 * students: all students, past ones too (a past sibling's papers then go to them, not to a namesake).
 * links: adm_drive_doc_links rows ({ file_id, student_id, kind, hidden }), the office's corrections.
 * Returns { byStudent: Map(student id -> docs), unplaced: [{ file, year, path, group }] }.
 * A doc is { id, file, kind (LIST_KINDS), label, year, path, folderId, how: 'name'|'folder'|'office', copies }.
 */
export function matchDocuments(items, students, links = []) {
  const byId = new Map(items.map((i) => [i.id, i]))
  const kids = new Map()
  for (const i of items) { const p = i.parent_id || ''; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(i) }
  const people = students.map((s) => ({ id: s.id, keys: nameKeys(s) }))
  const personOf = new Map(people.map((p) => [p.id, p]))
  // Worked out once per item; an item met again while it is being worked out (a loop) counts as `empty`.
  const memo = (fn, empty = null) => { const m = new Map(); return (x) => { if (!m.has(x.id)) { m.set(x.id, empty); m.set(x.id, fn(x)) } return m.get(x.id) } }

  const tokensOf = memo((x) => words(x.is_folder ? x.name : baseName(x.name)), [])
  const rankOf = memo((x) => {
    const T = withPairs(tokensOf(x))
    let max = 0
    let ids = []
    if (T.length) for (const p of people) { const s = nameScore(p.keys, T); if (!s) continue; if (s > max) { max = s; ids = [p.id] } else if (s === max) ids.push(p.id) }
    // Two nicknames that differ only in their accents (Mơ, Mo): the one spelled as in the name wins.
    if (max === 1 && ids.length > 1) {
      const raw = new Set(rawWords(x.is_folder ? x.name : baseName(x.name)))
      const keep = ids.filter((id) => personOf.get(id).keys.accented.some((w) => raw.has(w)))
      if (keep.length) ids = keep
    }
    return { max, ids }
  })
  const parentOf = (x) => byId.get(x.parent_id) || null
  const generic = (f) => !f || !parentOf(f) || GENERIC.test(tokensOf(f).join(' '))
  const explainedBy = (x, id) => strangers(tokensOf(x), [personOf.get(id)]).length === 0
  // A lone first name or nickname is believed when nothing else in the name points elsewhere
  // and the item sits straight in a class or year folder.
  const weakOne = (x, r) => (r.ids.length === 1 && generic(parentOf(x)) && explainedBy(x, r.ids[0]) ? r.ids : [])

  // Everyone a file or folder anywhere inside names in full (or nearly).
  const strongInside = memo((f) => {
    const out = new Set()
    for (const c of kids.get(f.id) || []) {
      const r = rankOf(c)
      if (r.max >= 2) r.ids.forEach((id) => out.add(id))
      if (c.is_folder) strongInside(c).forEach((id) => out.add(id))
    }
    return [...out]
  }, [])

  const ownersOf = memo((f) => {
    if (generic(f)) return []
    const r = rankOf(f)
    const inside = strongInside(f)
    let own
    if (r.max >= 2) own = r.ids
    else if (FAMILY.test(tokensOf(f).join(' '))) {
      own = inside
      if (!own.length) {
        // "Hart Family" with only "Passport Mia.jpg" inside: whoever carries the family name.
        const surname = tokensOf(f).filter((t) => !noise(t))
        const hit = surname.length ? people.filter((p) => surname.every((t) => p.keys.main.some((w) => sameWord(t, w)))) : []
        own = hit.length && hit.length <= 4 ? hit.map((p) => p.id) : []
      }
    } else if (r.max === 1) {
      const both = r.ids.filter((id) => inside.includes(id))
      own = both.length ? both : weakOne(f, r).length ? r.ids : inside
    } else own = inside
    if (own.length) return own
    // "Documents" inside a student's folder belongs to them; "Grant Lily" inside "Grant Family" does not belong to Leo.
    return strangers(tokensOf(f), []).length ? [] : ownersOf(parentOf(f) || {})
  }, [])

  const chainOf = (x) => { const out = []; let p = parentOf(x); while (p) { out.unshift(p); p = parentOf(p) } return out }

  // The automatic guess for each file.
  const placed = new Map() // file id -> [{ id: student id, how }]
  for (const f of items) {
    if (f.is_folder) continue
    const r = rankOf(f)
    const folder = parentOf(f)
    const fo = folder ? ownersOf(folder) : []
    let ids
    let how
    if (r.max >= 2) { ids = r.ids; how = 'name' } else if (r.max === 1 && fo.length) {
      const both = r.ids.filter((id) => fo.includes(id))
      ids = both.length ? both : fo
      how = both.length ? 'name' : 'folder'
    } else if (r.max === 1) { ids = weakOne(f, r); how = 'name' } else { ids = fo; how = 'folder' }
    if (ids.length) placed.set(f.id, ids.map((id) => ({ id, how })))
  }

  // The office's corrections.
  for (const l of links) {
    if (!byId.has(l.file_id) || byId.get(l.file_id).is_folder) continue
    const cur = (placed.get(l.file_id) || []).filter((o) => o.id !== l.student_id)
    const was = (placed.get(l.file_id) || []).find((o) => o.id === l.student_id)
    if (!l.hidden) cur.push({ id: l.student_id, how: was ? was.how : 'office', kind: l.kind || null })
    placed.set(l.file_id, cur)
  }

  const byStudent = new Map()
  const unplaced = []
  for (const f of items) {
    if (f.is_folder) continue
    const chain = chainOf(f)
    const year = yearOf(chain)
    const path = chain.slice(1).map((c) => c.name)
    const owners = placed.get(f.id) || []
    // Who an unplaced file seems to be about: its family or student folder, or the file itself.
    if (!owners.length) { unplaced.push({ file: f, year, path, group: chain.find((c) => !generic(c))?.name || baseName(f.name) }); continue }
    const named = kindFromName(f.name)
    for (const o of owners) {
      let { kind, label } = named
      const others = o.how === 'folder' ? strangers(tokensOf(f), [personOf.get(o.id)].filter(Boolean)) : []
      if (kind === 'parent_id' && o.how === 'name' && rankOf(f).max >= 2) kind = 'student_id' // "Mia Hart & Parents Passports"
      // A passport that names someone else, in a student's folder, is a parent's.
      if (kind === 'student_id' && others.length) kind = 'parent_id'
      if (!kind) {
        kind = isPdf(f) && o.how === 'name' ? 'form' : 'unsorted'
        label = kind === 'form' ? 'form' : isImage(f) ? 'image' : 'file'
      } else if (kind === 'form' && others.length) { kind = 'other'; label = 'file' } // a sibling's form in the family folder
      if (o.kind) { kind = o.kind; if (kind === 'form') label = 'form'; else if (kind === 'photo') label = 'photo'; else if (!['passport', 'birth', 'idcard'].includes(label) && kind !== 'other') label = 'idpapers' }
      const list = byStudent.get(o.id) || []
      list.push({ id: f.id, file: f, kind, label, year, path, folderId: f.parent_id, how: o.kind ? 'office' : o.how, copies: 1 })
      byStudent.set(o.id, list)
    }
  }

  // A second look at passports reached through a folder: in a folder where one passport names
  // the student, the others are the parents' ("Hart David Passport.jpg").
  for (const list of byStudent.values()) {
    const namedIdIn = new Set(list.filter((d) => d.kind === 'student_id' && d.how === 'name').map((d) => d.folderId))
    for (const d of list) if (d.kind === 'student_id' && d.how === 'folder' && namedIdIn.has(d.folderId)) d.kind = 'parent_id'
  }

  // The same picture copied into two children's folders is their parents' ID papers: the
  // brothers and sisters share the parents, not their own passports ("IMG_7095.JPG" in both).
  const sameFile = (d) => d.file.md5 || `${foldName(d.file.name)}|${d.file.size ?? ''}`
  const copies = new Map() // contents -> [{ student, file id }]
  for (const [id, list] of byStudent) for (const d of list) { const k = sameFile(d); if (!copies.has(k)) copies.set(k, []); copies.get(k).push({ id, fileId: d.file.id }) }
  for (const [id, list] of byStudent) {
    for (const d of list) {
      if (d.kind !== 'unsorted' || !isImage(d.file)) continue
      if (copies.get(sameFile(d)).some((c) => c.id !== id && c.fileId !== d.file.id)) { d.kind = 'parent_id'; d.label = 'shared' }
    }
  }

  // One entry for a file filed twice. The copy shown is the one the office labelled, else one whose
  // name says what it is ("CCCD Hart.jpg" over the phone's "1787195360276_…jpg"), else the newest year's.
  for (const [id, list] of byStudent) {
    const keep = new Map()
    const keyOf = (d) => d.file.md5 || `${foldName(d.file.name)}|${d.file.size ?? ''}`
    const rank = (d) => [d.how === 'office' ? 1 : 0, d.kind !== 'other' && d.kind !== 'unsorted' ? 1 : 0, d.how === 'name' ? 1 : 0, d.year, String(d.file.modified_at || '')]
    const better = (a, b) => { const x = rank(a); const y = rank(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false }
    for (const d of list) {
      const k = keyOf(d)
      const had = keep.get(k)
      if (!had) keep.set(k, d)
      else { const win = better(d, had) ? d : had; win.copies = had.copies + 1; keep.set(k, win) }
    }
    const order = (d) => LIST_KINDS.indexOf(d.kind)
    byStudent.set(id, [...keep.values()].sort((a, b) => order(a) - order(b) || b.year.localeCompare(a.year) || String(a.file.name).localeCompare(String(b.file.name))))
  }
  unplaced.sort((a, b) => b.year.localeCompare(a.year) || a.path.join('/').localeCompare(b.path.join('/')) || String(a.file.name).localeCompare(String(b.file.name)))
  return { byStudent, unplaced }
}

// The website form's document questions (lib/enrollment.js DOC_KINDS) as kinds here.
const WEB_KIND = { photo: 'photo', student_id: 'student_id', parent_id: 'parent_id' }

/**
 * What families sent with the enrollment form on pra.edu.vn, by student: the form itself
 * (it opens on the Enrollments page) and each uploaded file (kept in The Current's storage).
 * forms: adm_enrollments rows; privates: adm_enrollment_private rows.
 */
export function websiteDocs(forms, privates) {
  const priv = new Map((privates || []).map((p) => [p.enrollment_id, p]))
  const out = new Map()
  for (const e of forms || []) {
    if (!e.student_id) continue
    const list = out.get(e.student_id) || []
    const when = e.submitted_at || e.created_at || ''
    list.push({ id: `form-${e.id}`, source: 'webform', kind: 'form', label: 'form', formId: e.id, when })
    for (const f of priv.get(e.id)?.files || []) {
      if (!f?.path) continue
      const kind = WEB_KIND[f.kind] || 'other'
      const label = f.kind === 'report' ? 'report' : kind === 'photo' ? 'photo' : kind === 'other' ? 'file' : 'idpapers'
      list.push({ id: `web-${f.path}`, source: 'web', kind, label, name: f.name || f.path.split('/').pop(), path: f.path, formId: e.id, when })
    }
    out.set(e.student_id, list)
  }
  return out
}

/** Which of NEEDED_KINDS a student's documents (Drive and website) lack. The photo on their record in The Current counts as a photo. */
export const missingKinds = (docs, student) => NEEDED_KINDS.filter((k) => !docs.some((d) => d.kind === k) && !(k === 'photo' && student?.photo))

/** The Drive files still waiting for the office to say what they are. */
export const toSort = (docs) => docs.filter((d) => d.kind === 'unsorted' && d.source !== 'web' && d.file)

// ---------------- reading Drive ----------------

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly'
const API = 'https://www.googleapis.com/drive/v3/files'
const FIELDS = 'id,name,mimeType,parents,size,md5Checksum,modifiedTime,shortcutDetails(targetId,targetMimeType)'

/** What Drive's answer means, in words the office can act on. */
export class DriveError extends Error {
  constructor(message, code) { super(message); this.code = code }
}
function driveError(status, body) {
  const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || ''
  const text = body?.error?.message || ''
  if (status === 403 && /accessNotConfigured|SERVICE_DISABLED|has not been used|is disabled/i.test(`${reason} ${text}`)) return new DriveError('drive_off', 'drive_off')
  if (status === 404) return new DriveError('drive_no_access', 'drive_no_access')
  if (status === 401) return new DriveError('drive_signin', 'drive_signin')
  if (status === 403 && /insufficient|scope/i.test(`${reason} ${text}`)) return new DriveError('drive_signin', 'drive_signin')
  return new DriveError(text || `Google Drive answered ${status}`, 'drive_other')
}

/**
 * Every file and folder inside DRIVE_ROOTS, as adm_drive_files rows. Reads a level of folders
 * at a time. `fetchFn` is window.fetch (a test passes its own).
 */
export async function listDriveTree(token, { roots = DRIVE_ROOTS, fetchFn = (...a) => fetch(...a) } = {}) {
  const call = async (url) => {
    const r = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw driveError(r.status, body)
    return body
  }
  const rows = []
  const seen = new Set()
  for (const root of roots) {
    const meta = await call(`${API}/${encodeURIComponent(root.id)}?${new URLSearchParams({ fields: 'id,name,mimeType,modifiedTime', supportsAllDrives: 'true' })}`)
    seen.add(meta.id)
    rows.push({ id: meta.id, parent_id: null, name: meta.name, mime: FOLDER, is_folder: true, size: null, md5: null, modified_at: meta.modifiedTime || null, link_id: null })
    let level = [meta.id]
    while (level.length) {
      const next = []
      for (let i = 0; i < level.length; i += 40) {
        const chunk = level.slice(i, i + 40)
        const q = `(${chunk.map((id) => `'${id}' in parents`).join(' or ')}) and trashed = false`
        let pageToken = ''
        do {
          const params = new URLSearchParams({ q, fields: `nextPageToken,files(${FIELDS})`, pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', corpora: 'allDrives' })
          if (pageToken) params.set('pageToken', pageToken)
          const body = await call(`${API}?${params}`)
          for (const f of body.files || []) {
            if (seen.has(f.id)) continue
            seen.add(f.id)
            // A shortcut opens what it points to; a shortcut to a folder is read like the folder.
            const target = f.mimeType === SHORTCUT ? f.shortcutDetails || {} : null
            const mime = target ? target.targetMimeType || '' : f.mimeType
            const isFolder = mime === FOLDER
            rows.push({
              id: f.id,
              parent_id: (f.parents || []).find((p) => chunk.includes(p)) || (f.parents || [])[0] || null,
              name: f.name,
              mime,
              is_folder: isFolder,
              size: f.size != null ? Number(f.size) : null,
              md5: f.md5Checksum || null,
              modified_at: f.modifiedTime || null,
              link_id: target?.targetId || null,
            })
            if (isFolder) next.push(target?.targetId || f.id)
          }
          pageToken = body.nextPageToken || ''
        } while (pageToken)
      }
      // A shortcut's folder is listed under the shortcut's own id, so its files land in the right place.
      level = next
    }
  }
  // Files found through a folder shortcut name the target as their folder: point them at the shortcut.
  const viaShortcut = new Map(rows.filter((r) => r.is_folder && r.link_id).map((r) => [r.link_id, r.id]))
  for (const r of rows) if (viaShortcut.has(r.parent_id)) r.parent_id = viaShortcut.get(r.parent_id)
  return rows
}

/** The Drive id that opens a file (a shortcut opens its target). */
export const openId = (file) => file.link_id || file.id
