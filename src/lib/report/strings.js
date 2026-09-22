// Fixed wording on the printed report. A report prints as a complete English
// page or a complete Vietnamese page, never both on one page. Learning area,
// level and skill names come from Report settings (name / name_vi).

const STRINGS = {
  en: {
    homeroom: 'Homeroom',
    homeroomComment: 'Homeroom Teacher Comment',
    notYet: 'Not yet',
    topicsCovered: 'Topics covered:',
    comment: 'Comment:',
    nextFocus: 'Next focus:',
    scores: 'Progress Review Scores',
    learningArea: 'Learning area',
    summative: 'Summative',
    endOfYearTest: 'end-of-year assessment',
    classAvg: 'class',
    scoresKey: 'TBD: still to come · N/A: not enrolled or not assessed',
    howILearn: 'How I Learn',
    levelsKey: 'Progress levels',
    experiences: 'Experiences & growth',
    // Headings a template may reword ({nickname}, {yearGroup} are filled in).
    titles: {
      academic: 'Academic Learning', specialist: 'Specialist Learning', vocational: 'Vocational Learning',
      specialistNote: "Individual comments on {nickname}'s progress",
      vocationalNote: 'Course descriptions: topics the {yearGroup} group covered this quarter',
      voice: "In {nickname}'s words",
    },
  },
  vi: {
    homeroom: 'GVCN',
    homeroomComment: 'Nhận xét của giáo viên chủ nhiệm',
    notYet: 'Chưa đánh giá',
    topicsCovered: 'Nội dung đã học:',
    comment: 'Nhận xét:',
    nextFocus: 'Mục tiêu tới:',
    scores: 'Điểm đánh giá tiến bộ',
    learningArea: 'Lĩnh vực',
    summative: 'Tổng kết',
    endOfYearTest: 'đánh giá cuối năm',
    classAvg: 'lớp',
    scoresKey: 'TBD: chưa đến kỳ · N/A: không theo học hoặc không đánh giá',
    howILearn: 'Kỹ năng học tập',
    levelsKey: 'Mức độ tiến bộ',
    experiences: 'Trải nghiệm & phát triển',
    titles: {
      academic: 'Học thuật', specialist: 'Môn chuyên biệt', vocational: 'Hướng nghiệp',
      specialistNote: 'Nhận xét riêng về sự tiến bộ của {nickname}',
      vocationalNote: 'Mô tả khóa học: nội dung {yearGroup} đã học trong quý này',
      voice: 'Chia sẻ của {nickname}',
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
  { key: 'voice', label: "Student's words heading" },
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

/** Whether the student's words print in quotation marks: only under the standard "In …'s words" heading. */
export const voiceQuoted = (template) => !(template?.titles?.voice || '').trim()

export const LANG_NAMES = { en: 'English', vi: 'Tiếng Việt' }

/** "Quarter 1" -> "Quý 1" on Vietnamese reports. */
export const periodLabel = (label, lang) =>
  lang === 'vi' ? String(label || '').replace(/Quarter/i, 'Quý').replace(/Semester/i, 'Học kỳ').replace(/Term/i, 'Kỳ') : label

/** "Year 7" -> "Lớp 7" on Vietnamese reports; other year groups keep their name. */
export const yearGroupLabel = (yg, lang) => (lang === 'vi' ? String(yg || '').replace(/^Year\s+(\d+)$/i, 'Lớp $1') : yg)

const ROLE_VI = { 'homeroom teacher': 'Giáo viên chủ nhiệm', 'head teacher': 'Trưởng chuyên môn' }
export const roleLabel = (role, lang) => (lang === 'vi' ? ROLE_VI[String(role || '').toLowerCase()] || role : role)

/** The Vietnamese text when writing a Vietnamese page, falling back to English (flagged as untranslated). */
export function pickText(lang, en, vi) {
  if (lang !== 'vi') return { text: en || '', missing: false }
  if ((vi || '').trim()) return { text: vi, missing: false }
  return { text: en || '', missing: !!(en || '').trim() }
}
