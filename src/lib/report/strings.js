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
    endOfYearTest: 'end-of-year test',
    classAvg: 'class',
    scoresKey: 'TBD: still to come · N/A: not enrolled or not assessed',
    howILearn: 'How I Learn',
    specialistNote: (nick) => `Individual comments on ${nick}'s progress`,
    vocationalNote: (yg) => `Course descriptions: topics the ${yg} group covered this quarter`,
    experiences: 'Experiences & growth',
    inWords: (nick) => `In ${nick}'s words`,
    tiers: { academic: 'Academic Learning', specialist: 'Specialist Learning', vocational: 'Vocational Learning' },
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
    endOfYearTest: 'kiểm tra cuối năm',
    classAvg: 'lớp',
    scoresKey: 'TBD: chưa đến kỳ · N/A: không theo học hoặc không đánh giá',
    howILearn: 'Kỹ năng học tập',
    specialistNote: (nick) => `Nhận xét riêng về sự tiến bộ của ${nick}`,
    vocationalNote: (yg) => `Mô tả khóa học: nội dung ${yg} đã học trong quý này`,
    experiences: 'Trải nghiệm & phát triển',
    inWords: (nick) => `Chia sẻ của ${nick}`,
    tiers: { academic: 'Học thuật', specialist: 'Môn chuyên biệt', vocational: 'Hướng nghiệp' },
  },
}

export const reportStrings = (lang) => STRINGS[lang === 'vi' ? 'vi' : 'en']

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
