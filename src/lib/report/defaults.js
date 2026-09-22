// Default progress-report configuration. Everything here is editable under
// Progress reports > Settings and stored in adm_settings (key 'reports'); these
// values are only used until the head teacher changes them.

// The progress scale, from first steps to the top, in the order it prints.
// Confident is the middle level and the goal for the stage, with two levels
// on each side. `value` is how a level is saved on reports, so it is an ID,
// not a rank: Accomplished was added in September 2026 (the scale had four
// levels) and saved as 5, so levels already entered as 1 to 4 keep their
// meaning. `short` is the few words printed under the name in the level key.
export const LEVELS = [
  { value: 1, code: 'E', name: 'Emerging', name_vi: 'Làm quen', color: '#d97706',
    short: 'With a lot of support', short_vi: 'Cần nhiều hỗ trợ',
    desc: 'Just beginning to develop the skills and knowledge in this area. Needs a lot of support and guidance.',
    desc_vi: 'Mới bắt đầu phát triển kỹ năng và kiến thức trong lĩnh vực này, cần nhiều hỗ trợ và hướng dẫn.' },
  { value: 2, code: 'P', name: 'Practicing', name_vi: 'Luyện tập', color: '#0284c7',
    short: 'With some help', short_vi: 'Cần một chút hỗ trợ',
    desc: 'Building understanding through regular practice. Understands the basics and needs some guidance.',
    desc_vi: 'Đang xây dựng hiểu biết qua luyện tập thường xuyên, nắm được kiến thức cơ bản và cần được hướng dẫn thêm.' },
  { value: 3, code: 'C', name: 'Confident', name_vi: 'Tự tin', color: '#5f8f24',
    short: 'Independently: the goal', short_vi: 'Tự lập, đạt mục tiêu',
    desc: 'Secure in this area and works independently. This is the goal for the stage.',
    desc_vi: 'Nắm vững nội dung và tự làm được một cách độc lập. Đây là mục tiêu của giai đoạn này.' },
  { value: 5, code: 'A', name: 'Accomplished', name_vi: 'Thành thạo', color: '#0e7a74',
    short: 'Consistently and skilfully', short_vi: 'Ổn định và thành thạo',
    desc: 'Consistently strong. Applies skills accurately and flexibly, including in new situations.',
    desc_vi: 'Luôn thể hiện tốt, vận dụng kỹ năng chính xác và linh hoạt, kể cả trong tình huống mới.' },
  { value: 4, code: 'M', name: 'Moving Beyond', name_vi: 'Nổi trội', color: '#1f4e9c',
    short: 'Beyond what is expected', short_vi: 'Vượt mức mong đợi',
    desc: 'Goes beyond the expectations for this stage. Applies ideas creatively and is ready for extension.',
    desc_vi: 'Vượt mức mong đợi của giai đoạn này, vận dụng ý tưởng sáng tạo và sẵn sàng cho thử thách mở rộng.' },
]

// The three tiers of learning areas. A subject's `kind` is its tier, and the
// tier decides what teachers write and how it prints:
//   academic    level, progress review score, comment and next focus, plus an
//               optional "topics covered" line shared by the year group
//   specialist  level and a comment
//   vocational  level, plus one "topics covered" description shared by the
//               whole year group (no comment on the individual student)
export const TIERS = [
  { key: 'academic', name: 'Academic Learning', name_vi: 'Học thuật', short: 'Academic',
    hint: 'Level, progress review score, comment and next focus for each student. Topics covered is optional and shared by the year group.' },
  { key: 'specialist', name: 'Specialist Learning', name_vi: 'Môn chuyên biệt', short: 'Specialist',
    hint: 'Level and a comment for each student.' },
  { key: 'vocational', name: 'Vocational Learning', name_vi: 'Hướng nghiệp', short: 'Vocational',
    hint: 'Level for each student. Instead of a comment, one description of the topics covered is shared by the whole year group.' },
]

// `yearGroups` limits an area to some year groups (empty = every year group
// its template covers).
const EARLY_YEARS = ['Nursery', 'Kindergarten']
const PRIMARY_YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6']
const YEARS_2_TO_6 = PRIMARY_YEARS.slice(1)
const LOWER_SECONDARY_YEARS = ['Year 7', 'Year 8', 'Year 9']

// Early Years areas follow the Early Years Foundation Stage, as last year's
// Nursery and Kindergarten reports did: Communication & Language, Mathematics
// and Understanding the World get a comment each, Applied English is the
// English teacher's comment, and Physical Development and Expressive Arts &
// Design get a level plus the class's shared description. Personal, social
// and emotional development is in the Early Years learner skills.
export const SUBJECTS = [
  { key: 'communication', kind: 'academic', name: 'Communication & Language', name_vi: 'Giao tiếp & Ngôn ngữ', icon: 'chat', scored: false, yearGroups: EARLY_YEARS },
  { key: 'math', kind: 'academic', name: 'Mathematics', name_vi: 'Toán học', icon: 'calculator', scored: true },
  { key: 'science', kind: 'academic', name: 'Science', name_vi: 'Khoa học', icon: 'flask', scored: true },
  { key: 'english', kind: 'academic', name: 'English', name_vi: 'Tiếng Anh', icon: 'book', scored: true },
  { key: 'understanding_world', kind: 'academic', name: 'Understanding the World', name_vi: 'Hiểu biết về thế giới', icon: 'sprout', scored: false, yearGroups: EARLY_YEARS },
  { key: 'applied_english', kind: 'specialist', name: 'Applied English', name_vi: 'Tiếng Anh ứng dụng', icon: 'languages', scored: false, yearGroups: EARLY_YEARS },
  { key: 'art_of_science', kind: 'specialist', name: 'Art of Science', name_vi: 'Nghệ thuật Khoa học', icon: 'palette', scored: false },
  { key: 'history', kind: 'specialist', name: 'History', name_vi: 'Lịch sử', icon: 'landmark', scored: false },
  { key: 'art_craft', kind: 'specialist', name: 'Art & Crafts', name_vi: 'Mỹ thuật & Thủ công', icon: 'brush', scored: false, yearGroups: PRIMARY_YEARS },
  { key: 'cooking', kind: 'specialist', name: 'Cooking', name_vi: 'Nấu ăn', icon: 'chef', scored: false, yearGroups: PRIMARY_YEARS },
  { key: 'movement', kind: 'specialist', name: 'Movement', name_vi: 'Vận động', icon: 'movement', scored: false, yearGroups: [...PRIMARY_YEARS, 'Year 7'] },
  { key: 'executive_function', kind: 'vocational', name: 'Executive Function', name_vi: 'Kỹ năng điều hành', icon: 'brain', scored: false },
  { key: 'technology', kind: 'vocational', name: 'Technology', name_vi: 'Công nghệ', icon: 'monitor', scored: false },
  { key: 'wellbeing', kind: 'vocational', name: 'Wellbeing', name_vi: 'Sức khỏe tinh thần', icon: 'heart', scored: false, yearGroups: [...YEARS_2_TO_6, ...LOWER_SECONDARY_YEARS] },
  { key: 'everyday_experts', kind: 'vocational', name: 'Everyday Experts', name_vi: 'Chuyên gia thường ngày', icon: 'lightbulb', scored: false, yearGroups: YEARS_2_TO_6 },
  { key: 'presentation_play', kind: 'vocational', name: 'Presentation & Play', name_vi: 'Thuyết trình & Vui chơi', icon: 'drama', scored: false, yearGroups: ['Year 1'] },
  { key: 'physical', kind: 'vocational', name: 'Physical Development', name_vi: 'Phát triển thể chất', icon: 'footprints', scored: false, yearGroups: EARLY_YEARS },
  { key: 'expressive_arts', kind: 'vocational', name: 'Expressive Arts & Design', name_vi: 'Nghệ thuật & Sáng tạo', icon: 'music', scored: false, yearGroups: EARLY_YEARS },
]

// Character limits for the printed boxes. The report is one A4 page, printed
// in English or in Vietnamese (never both on one page), so the same limit
// applies to each language. With every box at its limit, the PDF
// (reportPdfLayout.js) still fits without cutting anything: comments print at
// 8pt in English and at the usual 8.25pt in Vietnamese (checked
// with 3 academic, 3 specialist and 3 vocational areas). Longer text is set
// smaller, then cut. Bowen does not want these limits lowered. A template can
// raise a limit with its own `limits` (and `minimums`): Early Years has one
// full-width Applied English card, which holds a longer comment.
export const TEXT_LIMITS = {
  homeroom_note: 490,
  academic_topics: 115,
  academic_comment: 600,
  next_focus: 110,
  specialist_comment: 360,
  vocational_topics: 260,
  student_voice: 190,
  experience: 50,
  experience_lines: 5,
}

// Suggested minimums, shown beside each counter so teachers know roughly how
// much to write. Advice only: nothing is blocked below them. Academic topics
// are optional, so they have none.
export const TEXT_MINIMUMS = {
  homeroom_note: 300,
  academic_comment: 360,
  next_focus: 50,
  specialist_comment: 220,
  vocational_topics: 150,
  student_voice: 60,
  experience_lines: 3,
}

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

// Nursery and Kindergarten rate their own skills, drawn from last year's Early
// Years checklists (foundational learning and social-emotional skills).
export const EARLY_YEARS_SKILL_GROUPS = [
  { key: 'ey_learning', name: 'Learning & Independence', name_vi: 'Học tập & Tự lập', items: [
    { key: 'ey_attention', name: 'Listens and pays attention', name_vi: 'Lắng nghe và chú ý', icon: 'ear' },
    { key: 'ey_instructions', name: 'Understands and follows instructions', name_vi: 'Hiểu và làm theo hướng dẫn', icon: 'list' },
    { key: 'ey_curious', name: 'Curious and eager to explore', name_vi: 'Tò mò, ham khám phá', icon: 'sparkles' },
    { key: 'ey_persists', name: 'Keeps trying when things are hard', name_vi: 'Kiên trì khi gặp khó khăn', icon: 'flag' },
    { key: 'ey_selfcare', name: 'Self-care: eating, toileting, tidying up', name_vi: 'Tự phục vụ: ăn uống, vệ sinh, dọn dẹp', icon: 'hand' },
    { key: 'ey_tools', name: 'Uses tools and materials safely', name_vi: 'Sử dụng đồ dùng an toàn', icon: 'scissors' },
  ] },
  { key: 'ey_social', name: 'Personal, Social & Emotional', name_vi: 'Cá nhân, Xã hội & Cảm xúc', items: [
    { key: 'ey_friends', name: 'Makes friends and plays with others', name_vi: 'Kết bạn và chơi cùng bạn', icon: 'users' },
    { key: 'ey_sharing', name: 'Shares and takes turns', name_vi: 'Chia sẻ và biết chờ đến lượt', icon: 'handshake' },
    { key: 'ey_feelings', name: 'Names and talks about feelings', name_vi: 'Gọi tên và nói về cảm xúc', icon: 'smile' },
    { key: 'ey_needs', name: 'Asks for help and says what they need', name_vi: 'Biết nhờ giúp đỡ và nói nhu cầu', icon: 'chat' },
    { key: 'ey_confident', name: 'Confident to try new activities', name_vi: 'Tự tin thử hoạt động mới', icon: 'rocket' },
    { key: 'ey_routines', name: 'Follows class routines and rules', name_vi: 'Theo nề nếp và quy tắc lớp học', icon: 'sun' },
  ] },
]

// `areas` lists the learning areas a template contains; each prints under its
// tier. (Templates saved before tiers had `academic` / `vocational` lists.)
// `scoreYearGroups` limits progress review scores to some year groups; without
// it every year group of the template has them. In Primary, Years 1 to 3 have
// no review scores, so their reports print the learner skills at full width.
// A template may also have its own `skillGroups` (instead of the shared learner
// skills) and `titles` for its printed headings (see TEMPLATE_TITLES).
export const TEMPLATES = {
  early_years: {
    key: 'early_years', name: 'Early Years', program: 'Early Years Program', program_vi: 'Chương trình Mầm non',
    yearGroups: EARLY_YEARS, scoreYearGroups: [],
    areas: ['communication', 'math', 'understanding_world', 'applied_english', 'physical', 'expressive_arts'],
    skillGroups: EARLY_YEARS_SKILL_GROUPS,
    limits: { specialist_comment: 600 }, minimums: { specialist_comment: 300 },
    titles: {
      academic: 'Areas of Learning', academic_vi: 'Các lĩnh vực học tập',
      vocational: 'Physical & Creative Development', vocational_vi: 'Phát triển thể chất & Sáng tạo',
      vocationalNote: 'What the {yearGroup} class explored together this quarter', vocationalNote_vi: 'Những gì lớp {yearGroup} đã cùng khám phá trong quý này',
      voice: 'What {nickname} loves', voice_vi: 'Điều {nickname} yêu thích',
    },
  },
  primary: {
    key: 'primary', name: 'Primary', program: 'Primary Program', program_vi: 'Chương trình Tiểu học',
    yearGroups: PRIMARY_YEARS, scoreYearGroups: ['Year 4', 'Year 5', 'Year 6'],
    areas: ['math', 'science', 'english', 'art_craft', 'cooking', 'movement', 'technology', 'wellbeing', 'everyday_experts', 'presentation_play'],
  },
  lower_secondary: {
    key: 'lower_secondary', name: 'Lower Secondary', program: 'Lower Secondary Program', program_vi: 'Chương trình Trung học cơ sở',
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

const SETTINGS_VERSION = 6

export const DEFAULT_REPORT_SETTINGS = {
  version: SETTINGS_VERSION,
  org: {
    name: 'Palm River Academy',
    tagline: 'Learning for Life. Growing Together.',
    legalLine: 'Palm River Academy English Center | Trung tâm Anh ngữ Palm River Academy',
    docTitle: 'Learning Progress Report',
    docTitle_vi: 'Báo cáo Tiến bộ Học tập',
    closing: "We celebrate learning in all its forms. Thank you for your partnership in {nickname}'s learning journey.",
    closing_vi: 'Chúng tôi trân trọng mọi hình thức học tập. Cảm ơn quý phụ huynh đã đồng hành cùng {nickname}.',
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
 * are combined. Before version 3, "Maths" becomes "Mathematics". Before
 * version 4 the Primary template and its learning areas are added (unless a
 * template already covers Years 1 to 6), and Movement opens to Primary. Before
 * version 5 the Early Years template and its areas are added the same way
 * (unless a template already covers Nursery or Kindergarten). Before version 6
 * the four-level scale (E, P, C, M) becomes the five-level one: Accomplished is
 * added between Confident and Moving Beyond. Saving in Report settings then
 * stores the upgraded version.
 */
export function normalizeReportSettings(stored) {
  const v = stored || {}
  const s = { ...DEFAULT_REPORT_SETTINGS, ...v, org: { ...DEFAULT_REPORT_SETTINGS.org, ...(v.org || {}) } }
  const tierKeys = TIERS.map((t) => t.key)
  let subjects = (s.subjects || []).map((sub) => ({ ...sub }))
  let templates = Object.fromEntries(Object.entries(s.templates || {}).map(([k, t]) => [k, { ...t }]))

  if ((Number(v.version) || 1) < 2 && v.subjects) {
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
  if ((Number(v.version) || 1) < 3) for (const sub of subjects) if (sub.key === 'math' && sub.name === 'Maths') sub.name = 'Mathematics'
  if ((Number(v.version) || 1) < 4 && v.subjects) {
    const covered = Object.values(templates).some((t) => (t.yearGroups || []).some((g) => PRIMARY_YEARS.includes(g)))
    if (!covered) {
      for (const key of TEMPLATES.primary.areas) {
        if (subjects.some((sub) => sub.key === key)) continue
        const fresh = { ...SUBJECTS.find((sub) => sub.key === key) }
        // New specialist areas sit with the other specialists, vocational ones at the end.
        const last = subjects.map((sub) => sub.kind).lastIndexOf(fresh.kind)
        subjects.splice(last < 0 ? subjects.length : last + 1, 0, fresh)
      }
      const same = (a, b) => JSON.stringify(a || []) === JSON.stringify(b)
      for (const sub of subjects) {
        if (sub.key === 'movement' && same(sub.yearGroups, ['Year 7'])) sub.yearGroups = [...PRIMARY_YEARS, 'Year 7']
        if (sub.key === 'wellbeing' && same(sub.yearGroups, [])) sub.yearGroups = [...YEARS_2_TO_6, ...LOWER_SECONDARY_YEARS]
      }
      templates = { primary: { ...TEMPLATES.primary, areas: [...TEMPLATES.primary.areas], yearGroups: [...PRIMARY_YEARS], scoreYearGroups: [...TEMPLATES.primary.scoreYearGroups] }, ...templates }
    }
  }
  if ((Number(v.version) || 1) < 5 && v.subjects) {
    const covered = Object.values(templates).some((t) => (t.yearGroups || []).some((g) => EARLY_YEARS.includes(g)))
    if (!covered) {
      for (const key of TEMPLATES.early_years.areas) {
        if (subjects.some((sub) => sub.key === key)) continue
        const fresh = { ...SUBJECTS.find((sub) => sub.key === key) }
        // Communication & Language leads the academic areas; the rest go after their tier.
        const math = subjects.findIndex((sub) => sub.key === 'math')
        const last = subjects.map((sub) => sub.kind).lastIndexOf(fresh.kind)
        const at = key === 'communication' && math >= 0 ? math : last < 0 ? subjects.length : last + 1
        subjects.splice(at, 0, fresh)
      }
      templates = { early_years: JSON.parse(JSON.stringify(TEMPLATES.early_years)), ...templates }
    }
  }
  let levels = s.levels
  if ((Number(v.version) || 1) < 6 && (v.levels || []).map((l) => l.code).join('') === 'EPCM') levels = LEVELS.map((l) => ({ ...l }))
  for (const sub of subjects) if (!tierKeys.includes(sub.kind)) sub.kind = 'vocational'
  for (const [k, t] of Object.entries(templates)) {
    if (!t.areas) templates[k] = { ...t, areas: [...(t.academic || []), ...(t.specialist || []), ...(t.vocational || [])] }
    if (templates[k].program_vi == null && TEMPLATES[k]?.program_vi) templates[k].program_vi = TEMPLATES[k].program_vi
    delete templates[k].academic; delete templates[k].specialist; delete templates[k].vocational
  }
  return { ...s, levels, subjects, templates, version: SETTINGS_VERSION }
}
