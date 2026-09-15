// Default progress-report configuration. Everything here is editable under
// Progress reports > Settings and stored in adm_settings (key 'reports'); these
// values are only used until the head teacher changes them.

export const LEVELS = [
  { value: 1, code: 'E', name: 'Emerging', name_vi: 'Làm quen kỹ năng mới', color: '#d97706',
    desc: 'Beginning to develop the skills and knowledge in this area. Needs significant support and guidance to apply ideas independently.',
    desc_vi: 'Học sinh mới bắt đầu phát triển kỹ năng và kiến thức trong lĩnh vực này, cần nhiều hỗ trợ và hướng dẫn để áp dụng độc lập.' },
  { value: 2, code: 'P', name: 'Practicing', name_vi: 'Luyện tập', color: '#0284c7',
    desc: 'Actively practising and refining skills. Shows a basic understanding of key concepts and needs occasional guidance.',
    desc_vi: 'Học sinh đang tích cực thực hành và cải thiện kỹ năng, hiểu các khái niệm chính và thỉnh thoảng cần hướng dẫn.' },
  { value: 3, code: 'C', name: 'Confident', name_vi: 'Tự tin', color: '#5f8f24',
    desc: 'Strong understanding of the area and applies concepts independently with confidence. Consistently produces quality work.',
    desc_vi: 'Học sinh hiểu vững nội dung, áp dụng các khái niệm một cách độc lập và tự tin, duy trì chất lượng học tập cao.' },
  { value: 4, code: 'M', name: 'Moving Beyond', name_vi: 'Nổi trội', color: '#1f4e9c',
    desc: 'Exceeds the expectations for this level. Applies complex ideas creatively and benefits from extension and enrichment.',
    desc_vi: 'Học sinh vượt qua các tiêu chuẩn mong đợi, áp dụng các khái niệm phức tạp một cách sáng tạo và cần cơ hội mở rộng.' },
]

// The three tiers of learning areas. A subject's `kind` is its tier, and the
// tier decides what teachers write and how it prints:
//   academic    level, progress review score, comment and next focus
//   specialist  level and a comment
//   vocational  level, plus one "topics covered" description shared by the
//               whole year group (no comment on the individual student)
export const TIERS = [
  { key: 'academic', name: 'Academic Learning', name_vi: 'Học thuật', short: 'Academic',
    hint: 'Level, progress review score, comment and next focus for each student.' },
  { key: 'specialist', name: 'Specialist Learning', name_vi: 'Môn chuyên biệt', short: 'Specialist',
    hint: 'Level and a comment for each student.' },
  { key: 'vocational', name: 'Vocational Learning', name_vi: 'Hướng nghiệp', short: 'Vocational',
    hint: 'Level for each student. Instead of a comment, one description of the topics covered is shared by the whole year group.' },
]

// `yearGroups` limits an area to some year groups (empty = every year group
// its template covers).
export const SUBJECTS = [
  { key: 'math', kind: 'academic', name: 'Maths', name_vi: 'Toán học', icon: 'calculator', scored: true },
  { key: 'science', kind: 'academic', name: 'Science', name_vi: 'Khoa học', icon: 'flask', scored: true },
  { key: 'english', kind: 'academic', name: 'English', name_vi: 'Tiếng Anh', icon: 'book', scored: true },
  { key: 'art_of_science', kind: 'specialist', name: 'Art of Science', name_vi: 'Nghệ thuật Khoa học', icon: 'palette', scored: false },
  { key: 'history', kind: 'specialist', name: 'History', name_vi: 'Lịch sử', icon: 'landmark', scored: false },
  { key: 'movement', kind: 'specialist', name: 'Movement', name_vi: 'Vận động', icon: 'movement', scored: false, yearGroups: ['Year 7'] },
  { key: 'executive_function', kind: 'vocational', name: 'Executive Function', name_vi: 'Kỹ năng điều hành', icon: 'brain', scored: false },
  { key: 'technology', kind: 'vocational', name: 'Technology', name_vi: 'Công nghệ', icon: 'monitor', scored: false },
  { key: 'wellbeing', kind: 'vocational', name: 'Wellbeing', name_vi: 'Sức khỏe tinh thần', icon: 'heart', scored: false },
]

// Character limits for the printed boxes. The report is one A4 page; each limit
// is sized so realistic English at the limit fits its box in ReportDocument
// (checked with 3 academic, 3 specialist and 3 vocational areas). Change them
// only together with that layout.
export const TEXT_LIMITS = {
  homeroom_note: 380,
  academic_comment: 540,
  next_focus: 100,
  specialist_comment: 340,
  vocational_topics: 240,
  student_voice: 180,
  experience: 50,
}

// A bilingual report prints English and Vietnamese in the same box in smaller
// type, so each language gets a shorter limit (next focus, student voice and
// experiences print in English only).
const BILINGUAL = ['homeroom_note', 'academic_comment', 'specialist_comment', 'vocational_topics']
export const textLimit = (key, bi) => (bi && BILINGUAL.includes(key) ? Math.floor((TEXT_LIMITS[key] * 0.57) / 10) * 10 : TEXT_LIMITS[key])

export const SKILL_GROUPS = [
  { key: 'foundational', name: 'Foundational Learning Skills', name_vi: 'Kỹ năng học tập cơ bản', items: [
    { key: 'ready', name: 'Ready to Learn', name_vi: 'Sẵn sàng học tập', icon: 'sun' },
    { key: 'instructions', name: 'Follows Instructions', name_vi: 'Tuân theo hướng dẫn', icon: 'list' },
    { key: 'creativity', name: 'Creativity', name_vi: 'Sáng tạo', icon: 'sparkles' },
    { key: 'grasps', name: 'Grasps New Ideas', name_vi: 'Nắm bắt ý tưởng mới', icon: 'lightbulb' },
    { key: 'persists', name: 'Continues to Try', name_vi: 'Tiếp tục cố gắng', icon: 'flag' },
  ] },
  { key: 'sel', name: 'Social & Emotional Learning', name_vi: 'Kỹ năng cảm xúc xã hội', items: [
    { key: 'emotions', name: 'Manages Emotions', name_vi: 'Quản lý cảm xúc', icon: 'smile' },
    { key: 'relationships', name: 'Positive Relationships', name_vi: 'Mối quan hệ tích cực', icon: 'users' },
    { key: 'identity', name: 'Strong Sense of Identity', name_vi: 'Ý thức về bản thân', icon: 'user' },
    { key: 'motivation', name: 'Motivation to Learn', name_vi: 'Động lực học tập', icon: 'rocket' },
    { key: 'adaptability', name: 'Adaptability', name_vi: 'Khả năng thích ứng', icon: 'shuffle' },
  ] },
]

// `areas` lists the learning areas a template contains; each prints under its
// tier. (Templates saved before tiers had `academic` / `vocational` lists.)
export const TEMPLATES = {
  lower_secondary: {
    key: 'lower_secondary', name: 'Lower Secondary', program: 'Lower Secondary Program',
    yearGroups: ['Year 7', 'Year 8', 'Year 9'],
    areas: ['math', 'science', 'english', 'art_of_science', 'history', 'movement', 'executive_function', 'technology', 'wellbeing'],
  },
}

export const PERIODS = [
  { index: 1, label: 'Quarter 1', start: '2026-08-04', end: '2026-10-08' },
  { index: 2, label: 'Quarter 2', start: '2026-10-15', end: '2026-12-17' },
  { index: 3, label: 'Quarter 3', start: '2027-01-05', end: '2027-03-24' },
  { index: 4, label: 'Quarter 4', start: '2027-03-29', end: '2027-06-04' },
]

const SETTINGS_VERSION = 2

export const DEFAULT_REPORT_SETTINGS = {
  version: SETTINGS_VERSION,
  org: {
    name: 'Palm River Academy',
    tagline: 'Learning for Life. Growing Together.',
    legalLine: 'Palm River Academy English Center | Trung tâm Anh ngữ Palm River Academy',
    docTitle: 'Learning Progress Report',
    docTitle_vi: 'Báo cáo Tiến bộ Học tập',
    closing: "We celebrate learning in all its forms. Thank you for your partnership in {nickname}'s learning journey.",
  },
  schoolYear: '2026-2027',
  periods: PERIODS,
  levels: LEVELS,
  subjects: SUBJECTS,
  skillGroups: SKILL_GROUPS,
  templates: TEMPLATES,
  signatures: [
    { role: 'Homeroom Teacher', name: '' },
    { role: 'Head Teacher', name: 'Mr. Seth' },
  ],
}

/**
 * Stored settings merged over the defaults. Settings saved before version 2
 * (two kinds, no Movement) are upgraded once: Art of Science and History move
 * to the specialist tier, Movement is added for Year 7, and template area lists
 * are combined. Saving in Report settings then stores the upgraded version.
 */
export function normalizeReportSettings(stored) {
  const v = stored || {}
  const s = { ...DEFAULT_REPORT_SETTINGS, ...v, org: { ...DEFAULT_REPORT_SETTINGS.org, ...(v.org || {}) } }
  const tierKeys = TIERS.map((t) => t.key)
  let subjects = (s.subjects || []).map((sub) => ({ ...sub }))
  let templates = Object.fromEntries(Object.entries(s.templates || {}).map(([k, t]) => [k, { ...t }]))

  if ((Number(v.version) || 1) < SETTINGS_VERSION && v.subjects) {
    for (const sub of subjects) if (['art_of_science', 'history'].includes(sub.key) && sub.kind === 'vocational') sub.kind = 'specialist'
    if (!subjects.some((sub) => sub.key === 'movement')) {
      const at = subjects.findIndex((sub) => sub.key === 'history')
      subjects.splice(at < 0 ? subjects.length : at + 1, 0, SUBJECTS.find((sub) => sub.key === 'movement'))
    }
    const ls = templates.lower_secondary
    if (ls) {
      const areas = ls.areas || [...(ls.academic || []), ...(ls.vocational || [])]
      if (!areas.includes('movement')) areas.splice(areas.includes('history') ? areas.indexOf('history') + 1 : areas.length, 0, 'movement')
      templates.lower_secondary = { ...ls, areas }
    }
  }
  for (const sub of subjects) if (!tierKeys.includes(sub.kind)) sub.kind = 'vocational'
  for (const [k, t] of Object.entries(templates)) {
    if (!t.areas) templates[k] = { ...t, areas: [...(t.academic || []), ...(t.specialist || []), ...(t.vocational || [])] }
    delete templates[k].academic; delete templates[k].specialist; delete templates[k].vocational
  }
  return { ...s, subjects, templates, version: SETTINGS_VERSION }
}
