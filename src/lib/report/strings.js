// Fixed wording on the printed report. A report prints as a complete English
// page or a complete Vietnamese page, never both on one page. Learning area,
// level and skill names come from Report settings (name / name_vi).

const STRINGS = {
  en: {
    homeroom: 'Homeroom',
    partialDay: 'Afternoons from',
    homeroomComment: 'Homeroom Teacher Comment',
    notYet: 'Not yet',
    topicsCovered: 'Topics covered:',
    comment: 'Comment:',
    scores: 'Progress Review Scores',
    learningArea: 'Learning area',
    summative: 'Summative',
    endOfYearTest: 'end-of-year assessment',
    classAvg: 'class',
    // The table marks a score still to come with a light dash (since 23 October 2026, was "TBD").
    scoresKey: '– still to come · N/A not enrolled or not assessed',
    howILearn: 'How I Learn',
    levelsKey: 'Progress levels',
    // Headings a template may reword ({nickname}, {yearGroup} are filled in).
    titles: {
      academic: 'Academic Learning', specialist: 'Specialist Learning', vocational: 'Vocational Learning',
      specialistNote: "Individual comments on {nickname}'s progress",
      vocationalNote: 'Course descriptions: topics the {yearGroup} group covered this quarter',
    },
  },
  vi: {
    homeroom: 'GVCN',
    // 11:35 is not "buổi chiều" in Vietnamese, so the line says when the student comes to class.
    partialDay: 'Đến lớp từ',
    homeroomComment: 'Nhận xét của giáo viên chủ nhiệm',
    notYet: 'Chưa đánh giá',
    topicsCovered: 'Nội dung đã học:',
    comment: 'Nhận xét:',
    scores: 'Điểm đánh giá tiến bộ',
    learningArea: 'Lĩnh vực',
    summative: 'Tổng kết',
    endOfYearTest: 'đánh giá cuối năm',
    classAvg: 'lớp',
    scoresKey: '– chưa đến kỳ · N/A không theo học hoặc không đánh giá',
    howILearn: 'Kỹ năng học tập',
    levelsKey: 'Mức độ tiến bộ',
    // Since 23 October 2026 the specialist and vocational bands follow the website's
    // "các lớp kỹ năng và thực hành"; "Hướng nghiệp" means careers guidance.
    titles: {
      academic: 'Học thuật', specialist: 'Các lớp kỹ năng', vocational: 'Các lớp thực hành',
      specialistNote: 'Nhận xét riêng về sự tiến bộ của {nickname}',
      vocationalNote: 'Mô tả khóa học: nội dung lớp {yearGroup} đã học trong quý này',
    },
  },
}

export const reportStrings = (lang) => STRINGS[lang === 'vi' ? 'vi' : 'en']

/** Headings a template can reword in Report settings (template.titles, plus `_vi` for the Vietnamese page). */
export const TITLE_FIELDS = [
  { key: 'academic', label: 'Academic tier heading' },
  { key: 'specialist', label: 'Specialist tier heading' },
  { key: 'specialistNote', label: 'Specialist subtitle' },
  { key: 'vocational', label: 'Vocational tier heading' },
  { key: 'vocationalNote', label: 'Vocational subtitle' },
]

const fill = (text, vars = {}) => String(text || '').replace(/\{(nickname|yearGroup)\}/g, (_, k) => vars[k] ?? '')

/**
 * A printed heading for this template's reports: the template's own wording
 * when it has one (a Vietnamese page uses only its `_vi` wording), else the
 * standard one. `vars` = { nickname, yearGroup }.
 */
export function reportTitle(template, key, lang, vars) {
  const own = template?.titles?.[lang === 'vi' ? `${key}_vi` : key]
  return fill((own || '').trim() || reportStrings(lang).titles[key], vars)
}

export const LANG_NAMES = { en: 'English', vi: 'Tiếng Việt' }

/** "Quarter 1" -> "Quý 1" on Vietnamese reports. */
export const periodLabel = (label, lang) =>
  lang === 'vi' ? String(label || '').replace(/Quarter/i, 'Quý').replace(/Semester/i, 'Học kỳ').replace(/Term/i, 'Kỳ') : label

/**
 * A year group's name on the report. It stays in English on the Vietnamese page too:
 * Year 7 matches Vietnamese grade 6, so "Lớp 7" would give the wrong grade (website
 * rule, VIETNAMESE.md; "Lớp 7" until 23 October 2026).
 */
export const yearGroupLabel = (yg) => yg

// Seth's title is Head of Academy, "Giám đốc học thuật" in Vietnamese, as on the website
// (Bowen, 29 September 2026). The signature line said "Head Teacher" until 23 October 2026,
// and reports made before then keep that role saved, so it prints under the new title.
const ROLE_EN = { 'head teacher': 'Head of Academy' }
const ROLE_VI = { 'homeroom teacher': 'Giáo viên chủ nhiệm', 'head teacher': 'Giám đốc học thuật', 'head of academy': 'Giám đốc học thuật' }
export const roleLabel = (role, lang) => (lang === 'vi' ? ROLE_VI : ROLE_EN)[String(role || '').toLowerCase()] || role

/** The Vietnamese text when writing a Vietnamese page, falling back to English (flagged as untranslated). */
export function pickText(lang, en, vi) {
  if (lang !== 'vi') return { text: en || '', missing: false }
  if ((vi || '').trim()) return { text: vi, missing: false }
  return { text: en || '', missing: !!(en || '').trim() }
}
