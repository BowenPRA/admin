// Translation by file: the head teacher downloads the reports' English text as
// one JSON file, has Claude (desktop app) fill in the Vietnamese, then uploads
// the file Claude returns. Nothing is sent anywhere by the app itself.

import { subjectByKey, sectionsByTier, studentSections, TIER_KEYS, templateOf, templateForYearGroup, textLimits } from './utils'
import { reportTitle, voiceQuoted } from './strings'
import { legalFirstName } from '../names'
import { wordingIssues } from './wording'

export const FILE_TYPE = 'pra-report-translation'

const INSTRUCTIONS = [
  'You are translating Learning Progress Reports from Palm River Academy, an English language center in Hoi An, from English into Vietnamese. Vietnamese parents read the translation as its own printed page, so write natural, warm, professional Vietnamese, as a thoughtful Vietnamese teacher would, not word for word.',
  'Fill in every empty "vietnamese" value in "shared_topics" and in every report\'s "parts". Do not change ids, "english" or anything else. Leave a "vietnamese" value that is already filled exactly as it is.',
  'Call the student by the name in "call_the_student" (with its Vietnamese accents), never by "nickname_do_not_use". Use "em" when a pronoun is needed.',
  'Palm River Academy is never a "trường" (school): write "Palm River Academy" or "trung tâm". The document is a "Báo cáo tiến bộ học tập", never a "học bạ" or report card.',
  'Scores are "điểm" and assessments are "bài đánh giá". Never write "bài kiểm tra", "bài thi" or "thi".',
  'Use the Vietnamese in "glossary" for learning areas, levels and skills. Keep people\'s names and titles (e.g. Mr. Caleb), program names, numbers, percentages and scores exactly as written.',
  'Each part has "max_chars", the most characters its box on the one-page report can hold. Stay within it; if Vietnamese runs long, say the same thing more concisely rather than dropping meaning.',
  '"In the student\'s words" parts are the student\'s own voice: keep them first person and simple. Experience lines are short bullet points.',
  'Plain text only, no markdown. Translate only what is there: no greetings, additions or notes.',
  'When done, give back the complete file as a downloadable JSON file with exactly the same structure, named like the original with "-vi" added.',
]

/** Suggested message to type in the Claude desktop app with the file attached. */
export const CLAUDE_PROMPT = 'Please translate this Palm River Academy progress report file into Vietnamese. Follow the instructions inside the file, fill in every empty "vietnamese" value, and give me back the complete JSON file to download.'

const filled = (v) => !!(v || '').trim()

function glossary(settings) {
  const pairs = [
    ...(settings?.subjects || []),
    ...(settings?.levels || []),
    ...[settings?.skillGroups || [], ...Object.values(settings?.templates || {}).map((t) => t.skillGroups || [])]
      .flat().flatMap((g) => [g, ...(g.items || [])]),
  ].filter((x) => x?.name && x?.name_vi)
  return Object.fromEntries([['Learning Progress Report', 'Báo cáo tiến bộ học tập'], ...pairs.map((x) => [x.name, x.name_vi])])
}

const topicsLimit = (settings, key, yearGroup) =>
  textLimits(settings, { year_group: yearGroup, template: templateForYearGroup(settings, yearGroup)?.key })[subjectByKey(settings, key).kind === 'academic' ? 'academic_topics' : 'vocational_topics']

/** Every translatable part of one report: [{ id, where, english, vietnamese, max_chars }]. */
function reportParts(report, sections, settings) {
  const parts = []
  const limits = textLimits(settings, report)
  const add = (id, where, english, vietnamese, max) => { if (filled(english)) parts.push({ id, where, max_chars: max, english: english.trim(), vietnamese: vietnamese || '' }) }
  add(`report:${report.id}:homeroom_note`, 'Homeroom teacher comment', report.homeroom_note, report.homeroom_note_vi, limits.homeroom_note)
  const tiers = sectionsByTier(settings, sections)
  for (const tier of TIER_KEYS) {
    for (const s of tiers[tier] || []) {
      const name = subjectByKey(settings, s.subject_key).name
      if (tier !== 'vocational') add(`section:${s.id}:comment`, `${name}: teacher comment`, s.comment, s.comment_vi, limits[tier === 'academic' ? 'academic_comment' : 'specialist_comment'])
      if (tier === 'academic') add(`section:${s.id}:next_focus`, `${name}: next focus (one short sentence)`, s.next_focus, s.next_focus_vi, limits.next_focus)
    }
  }
  ;(report.experiences || []).forEach((e, i) => add(`report:${report.id}:exp:${i}`, 'Experiences & growth this quarter (one short bullet line)', e, report.experiences_vi?.[i], limits.experience))
  const template = templateOf(settings, report)
  const voiceWhere = voiceQuoted(template)
    ? "In the student's words: what they enjoyed most (the student's own voice)"
    : `${reportTitle(template, 'voice', 'en', { nickname: 'the student' })}: favourite activities, written by the teacher (anything in quotation marks is the child's own words)`
  add(`report:${report.id}:student_voice`, voiceWhere, report.student_voice, report.student_voice_vi, limits.student_voice)
  return parts
}

/**
 * The file to download. Only reports set to English and Vietnamese are included.
 * `onlyMissing` leaves out parts that already have Vietnamese.
 * Returns { data, filename, count, total } (count = parts still to translate, total = parts in the file).
 */
export function buildTranslationFile({ reports, sections, notes, students, settings, period, yearGroup, onlyMissing = true }) {
  const bi = reports.filter((r) => r.lang === 'bi' && (!yearGroup || r.year_group === yearGroup))
    .sort((a, b) => String(a.year_group).localeCompare(String(b.year_group), undefined, { numeric: true }) || String(a.student_name).localeCompare(String(b.student_name)))
  const keep = (p) => !onlyMissing || !filled(p.vietnamese)
  const groups = new Set(bi.map((r) => r.year_group))
  const shared_topics = notes
    .filter((n) => groups.has(n.year_group) && filled(n.description))
    // Only areas that are topics on the page (academic topics and vocational descriptions).
    .filter((n) => subjectByKey(settings, n.subject_key).kind !== 'specialist')
    .map((n) => ({ id: `note:${n.id}:description`, year_group: n.year_group, where: `${subjectByKey(settings, n.subject_key).name}: topics covered this quarter, shared by every ${n.year_group} report`, max_chars: topicsLimit(settings, n.subject_key, n.year_group), english: n.description.trim(), vietnamese: n.description_vi || '' }))
    .filter(keep)
  const out = bi.map((r) => {
    const student = students.find((s) => s.id === r.student_id)
    const legal = legalFirstName(student || { full_name: r.student_name })
    return {
      report_id: r.id,
      student: student?.full_name || r.student_name,
      year_group: r.year_group,
      call_the_student: legal.name,
      nickname_do_not_use: student?.nickname && student.nickname.toLowerCase() !== legal.name.toLowerCase() ? student.nickname : '',
      parts: reportParts(r, studentSections(settings, sections.filter((s) => s.report_id === r.id), student), settings).filter(keep),
    }
  }).filter((r) => r.parts.length)
  const count = shared_topics.filter((p) => !filled(p.vietnamese)).length + out.reduce((n, r) => n + r.parts.filter((p) => !filled(p.vietnamese)).length, 0)
  const data = {
    file_type: FILE_TYPE,
    version: 1,
    instructions_for_claude: INSTRUCTIONS,
    academic_year: settings.schoolYear,
    period,
    year_group: yearGroup || 'All year groups',
    downloaded_at: new Date().toISOString(),
    glossary: glossary(settings),
    shared_topics,
    reports: out,
  }
  const slug = (s) => String(s || '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
  const filename = `PRA-reports-${slug(period)}-${slug(yearGroup || 'all')}-${settings.schoolYear}.json`
  const total = shared_topics.length + out.reduce((n, r) => n + r.parts.length, 0)
  return { data, filename, count, total, reports: out.length }
}

/** Parse the uploaded text: plain JSON, or JSON inside a ``` block if pasted from a chat. */
export function parseTranslationFile(text) {
  let t = String(text || '').trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  let data
  try { data = JSON.parse(t) } catch { throw new Error('This file is not valid JSON. Upload the .json file Claude gave back.') }
  if (data?.file_type !== FILE_TYPE) throw new Error('This is not a Palm River Academy translation file.')
  return data
}

/** Every { id, english, vietnamese } in the file, wherever Claude put it. */
function collectParts(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => collectParts(n, out))
  else if (node && typeof node === 'object') {
    if (typeof node.id === 'string' && 'vietnamese' in node) out.push(node)
    else Object.values(node).forEach((n) => collectParts(n, out))
  }
  return out
}

/**
 * Compares the uploaded file with the reports as they are now.
 * Returns { changes, unchanged, emptyParts, notFound } where each change is
 * { kind: 'report'|'section'|'note', rowId, field, index?, vi, current, englishChanged, over, max, issues, where, who, published }.
 */
export function planTranslationImport(data, { reports, sections, notes, students, settings }) {
  const changes = []
  let unchanged = 0, emptyParts = 0, notFound = 0
  const reportById = new Map(reports.map((r) => [r.id, r]))
  const sectionById = new Map(sections.map((s) => [s.id, s]))
  const noteById = new Map(notes.map((n) => [n.id, n]))
  const nameFor = (r) => {
    const student = students.find((s) => s.id === r?.student_id)
    return { who: student?.full_name || r?.student_name || '', legal: legalFirstName(student || { full_name: r?.student_name }).name, nickname: student?.nickname || '' }
  }
  for (const part of collectParts(data)) {
    const vi = String(part.vietnamese || '').normalize('NFC').trim()
    if (!vi) { emptyParts++; continue }
    const [kind, rowId, field, index] = part.id.split(':')
    let row, english, current, max, report, where = part.where || ''
    if (kind === 'report' && (row = reportById.get(rowId))) {
      report = row
      const limits = textLimits(settings, row)
      if (field === 'exp') { english = row.experiences?.[Number(index)]; current = row.experiences_vi?.[Number(index)]; max = limits.experience }
      else if (field === 'homeroom_note' || field === 'student_voice') { english = row[field]; current = row[`${field}_vi`]; max = limits[field] }
    } else if (kind === 'section' && (row = sectionById.get(rowId))) {
      report = reportById.get(row.report_id)
      const tier = subjectByKey(settings, row.subject_key).kind
      const limits = textLimits(settings, report)
      if (field === 'comment') { english = row.comment; current = row.comment_vi; max = limits[tier === 'academic' ? 'academic_comment' : 'specialist_comment'] }
      else if (field === 'next_focus') { english = row.next_focus; current = row.next_focus_vi; max = limits.next_focus }
    } else if (kind === 'note' && field === 'description' && (row = noteById.get(rowId))) {
      english = row.description; current = row.description_vi; max = topicsLimit(settings, row.subject_key, row.year_group)
    }
    if (!row || max == null) { notFound++; continue }
    if ((current || '').trim() === vi) { unchanged++; continue }
    const n = kind === 'note' ? { who: `All ${row.year_group} reports`, legal: '', nickname: '' } : nameFor(report)
    changes.push({
      id: part.id, kind, rowId, field, index: index != null ? Number(index) : undefined, vi, current: current || '', where, who: n.who,
      englishChanged: (english || '').trim() !== String(part.english || '').trim(),
      over: vi.length > max, max, published: report?.status === 'published',
      issues: wordingIssues(vi, { lang: 'vi', legalName: n.legal, nickname: n.nickname, messages: 'en' }),
    })
  }
  return { changes, unchanged, emptyParts, notFound }
}

/** Writes the chosen changes. `db` is the app's data layer; rows are re-read so nothing else is overwritten. */
export async function applyTranslationImport(changes, db, { period, schoolYear }) {
  const reports = new Map((await db.reports.list({ school_year: schoolYear, period_label: period })).map((r) => [r.id, r]))
  const sectionIds = [...new Set(changes.filter((c) => c.kind === 'section').map((c) => c.rowId))]
  const sections = new Map((sectionIds.length ? await db.sections.list({ id: sectionIds }) : []).map((s) => [s.id, s]))
  const notes = new Map((await db.courseNotes.list({ school_year: schoolYear, period_label: period })).map((n) => [n.id, n]))
  const touched = { report: new Map(), section: new Map(), note: new Map() }
  const source = { report: reports, section: sections, note: notes }
  for (const c of changes) {
    const base = touched[c.kind].get(c.rowId) || source[c.kind].get(c.rowId)
    if (!base) continue
    const row = { ...base }
    if (c.field === 'exp') {
      const list = [...(row.experiences_vi || [])]
      list[c.index] = c.vi
      row.experiences_vi = (row.experiences || []).map((_, i) => list[i] || '')
    } else {
      row[`${c.field}_vi`] = c.vi
    }
    touched[c.kind].set(c.rowId, row)
  }
  if (touched.report.size) await db.reports.saveMany([...touched.report.values()])
  if (touched.section.size) await db.sections.saveMany([...touched.section.values()])
  if (touched.note.size) await db.courseNotes.saveMany([...touched.note.values()])
  return touched.report.size + touched.section.size + touched.note.size
}
