// Default progress-report configuration. Everything here is editable under
// Progress reports > Settings and stored in adm_settings (key 'reports'); these
// values are only used until the head teacher changes them.

// The progress scale, from first steps to the top, in the order it prints.
// On Target is the middle level and the goal for the stage, with two levels
// on each side. `value` is how a level is saved on reports, so it is an ID,
// not a rank, and each value keeps its place on the scale when names change:
// 3 is the middle (the goal, "Confident" until 22 September 2026, now "On
// Target") and 5 the level above it ("Accomplished", now "Confident"), so levels
// teachers have already entered keep their meaning. `desc` is printed in the
// level key on every report; `short` is the few words teachers see when they
// pick a level.
export const LEVELS = [
  { value: 1, code: 'E', name: 'Emerging', name_vi: 'Làm quen', color: '#d97706',
    short: 'With a lot of support', short_vi: 'Cần nhiều hỗ trợ',
    desc: 'Beginning to develop the skills, with a lot of support.',
    desc_vi: 'Mới bắt đầu phát triển kỹ năng, cần nhiều hỗ trợ.' },
  { value: 2, code: 'P', name: 'Practicing', name_vi: 'Luyện tập', color: '#0284c7',
    short: 'With some help', short_vi: 'Cần một chút hỗ trợ',
    desc: 'Building understanding through practice, with some help.',
    desc_vi: 'Đang hiểu dần qua luyện tập, cần thêm hướng dẫn.' },
  { value: 3, code: 'O', name: 'On Target', name_vi: 'Đạt mục tiêu', color: '#5f8f24',
    short: 'Independently: the goal', short_vi: 'Tự làm được, đúng mục tiêu',
    desc: 'Secure and independent. The goal for this stage.',
    desc_vi: 'Nắm vững và tự làm được. Mục tiêu của giai đoạn này.' },
  { value: 5, code: 'C', name: 'Confident', name_vi: 'Tự tin', color: '#0e7a74',
    short: 'Consistently and skilfully', short_vi: 'Ổn định và thành thạo',
    desc: 'Consistently strong, even in new situations.',
    desc_vi: 'Luôn thể hiện tốt, kể cả trong tình huống mới.' },
  { value: 4, code: 'M', name: 'Moving Beyond', name_vi: 'Nổi trội', color: '#1f4e9c',
    short: 'Beyond what is expected', short_vi: 'Vượt mức mong đợi',
    desc: 'Goes beyond what is expected; ready for extension.',
    desc_vi: 'Vượt mức mong đợi, sẵn sàng cho thử thách mở rộng.' },
]

// The three tiers of learning areas. A subject's `kind` is its tier, and the
// tier decides what teachers write and how it prints:
//   academic    level, progress review score and an individual comment for
//               each student, plus one course description ("topics covered")
//               shared by the year group
//   specialist  level and an individual comment for each student
//   vocational  level for each student, plus one course description shared by
//               the whole year group (no individual comment)
// A vocational area with `comment: true` takes an individual comment for each
// student instead of the course description, and still prints in the
// vocational band (Early Years Physical Development, since 18 October 2026).
// A vocational area with its own `description` (and `description_vi`) prints
// that fixed text on every report, every quarter, so teachers give a level
// only (Movement, since 22 October 2026).
// WRITING and writingFor() in utils.js hold the same split as data, for the
// screens.
export const TIERS = [
  { key: 'academic', name: 'Academic Learning', name_vi: 'Học thuật', short: 'Academic',
    hint: 'Level, progress review score and an individual comment for each student, plus one course description shared by the year group.' },
  { key: 'specialist', name: 'Specialist Learning', name_vi: 'Môn chuyên biệt', short: 'Specialist',
    hint: 'Level and an individual comment for each student.' },
  { key: 'vocational', name: 'Vocational Learning', name_vi: 'Hướng nghiệp', short: 'Vocational',
    hint: 'Level for each student, plus one course description shared by the year group. No individual comment.' },
]

// `yearGroups` limits an area to some year groups (empty = every year group
// its template covers).
const EARLY_YEARS = ['Nursery', 'Kindergarten']
const PRIMARY_YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6']
const YEARS_2_TO_6 = PRIMARY_YEARS.slice(1)
const LOWER_SECONDARY_YEARS = ['Year 7', 'Year 8', 'Year 9']

// Movement's description, from Bowen (22 October 2026), trimmed that evening to
// the length and "Developing ..." style of the other course descriptions.
const MOVEMENT_DESCRIPTION = 'Developing physical coordination, agility, dexterity, and body awareness through warm-ups, stretching, movement activities, and collaborative games. Students practice adapting to changing situations, quick thinking, problem-solving, and teamwork.'
const MOVEMENT_DESCRIPTION_VI = 'Phát triển khả năng phối hợp, sự nhanh nhẹn, khéo léo và cảm nhận về cơ thể qua các bài khởi động, giãn cơ, hoạt động vận động và trò chơi đồng đội. Học viên tập thích ứng khi tình huống thay đổi, rèn khả năng suy nghĩ nhanh, giải quyết vấn đề và làm việc nhóm.'
// The first wording, replaced in saved settings that still hold it (version 12).
const MOVEMENT_DESCRIPTION_OLD = 'Movement and Exercise gives students opportunities to develop physical coordination, agility, dexterity, and body awareness through warm-ups, stretching, movement activities, and collaborative games. Students explore movement, practice adapting to changing situations, and engage in activities that encourage quick thinking, problem-solving, and teamwork.'
const MOVEMENT_DESCRIPTION_VI_OLD = 'Giờ Vận động giúp học viên phát triển khả năng phối hợp, sự nhanh nhẹn, khéo léo và cảm nhận về cơ thể qua các bài khởi động, giãn cơ, hoạt động vận động và trò chơi đồng đội. Học viên khám phá nhiều cách vận động, tập thích ứng khi tình huống thay đổi và tham gia các hoạt động rèn khả năng suy nghĩ nhanh, giải quyết vấn đề và làm việc nhóm.'

// The vocational class names before 22 October 2026, and the "Life Skills" names
// built from them (last year's pattern, as "Intensive English in Life Skills: Technology").
const LIFE_SKILLS_CLASSES = {
  executive_function: ['Executive Function', 'Kỹ năng điều hành'],
  technology: ['Technology', 'Công nghệ'],
  wellbeing: ['Wellbeing', 'Sức khỏe tinh thần'],
  everyday_experts: ['Everyday Experts', 'Chuyên gia thường ngày'],
  presentation_play: ['Presentation & Play', 'Thuyết trình & Vui chơi'],
}
const lifeSkills = (key) => ({
  name: `Intensive English in Life Skills: ${LIFE_SKILLS_CLASSES[key][0]}`,
  name_vi: `Tiếng Anh giao tiếp trong hoạt động hằng ngày: Chủ đề ${LIFE_SKILLS_CLASSES[key][1]}`,
})

// Since the evening of 22 October 2026 the academic areas, the vocational classes and
// Movement share one pattern, "Intensive English in Technology" (Bowen). Reports print
// the lead, "Intensive English in", as a small line above the class name (nameParts in
// utils.js); NAME_LEADS lists the leads it knows, in English and in Vietnamese.
export const NAME_LEADS = ['Intensive English in ', 'Tiếng Anh nâng cao theo chủ đề ']
const englishLed = (en, vi) => ({ name: `${NAME_LEADS[0]}${en}`, name_vi: `${NAME_LEADS[1]}${vi}` })

// Early Years areas follow the Early Years Foundation Stage, as last year's
// Nursery and Kindergarten reports did: Communication & Language, Mathematics
// and Understanding the World get a comment each; Applied English and Cooking
// are specialist cards with an individual comment each; Physical Development
// and Expressive Arts & Design share the vocational band, Physical Development
// with an individual comment (`comment: true`) and Expressive Arts & Design
// with a level plus the class's shared description. Personal, social and
// emotional development is in the Early Years learner skills.
// Since late on 22 October 2026 every area but English Literacy and Applied English
// is "Intensive English in ...", Early Years included, so all reports read alike (Bowen).
export const SUBJECTS = [
  { key: 'communication', kind: 'academic', ...englishLed('Communication & Language', 'Giao tiếp & Ngôn ngữ'), icon: 'chat', scored: false, yearGroups: EARLY_YEARS },
  // The academic areas carry last year's names, which present them as English classes
  // (Ms. Xuan, 20 October 2026; "Topics" with a capital since 22 October). `short` /
  // `short_vi` is the label in the narrow scores table.
  { key: 'math', kind: 'academic', ...englishLed('Math Topics', 'Toán học'), short: 'Math Topics', short_vi: 'Chủ đề Toán học', icon: 'calculator', scored: true },
  { key: 'science', kind: 'academic', ...englishLed('Science Topics', 'Khoa học'), short: 'Science Topics', short_vi: 'Chủ đề Khoa học', icon: 'flask', scored: true },
  { key: 'english', kind: 'academic', name: 'English Literacy', name_vi: 'Tiếng Anh', icon: 'book', scored: true },
  { key: 'understanding_world', kind: 'academic', ...englishLed('Understanding the World', 'Hiểu biết về thế giới'), icon: 'sprout', scored: false, yearGroups: EARLY_YEARS },
  { key: 'applied_english', kind: 'specialist', name: 'Applied English', name_vi: 'Tiếng Anh ứng dụng', icon: 'languages', scored: false, yearGroups: EARLY_YEARS },
  // "Intensive English in the Art of Science": the report prints "Intensive English in the" small, "Art of Science" big.
  { key: 'art_of_science', kind: 'specialist', ...englishLed('the Art of Science', 'Nghệ thuật Khoa học'), icon: 'palette', scored: false },
  // The key stays `history` (saved reports and the Teachers page use it); the class has been Social Studies since 22 October 2026.
  { key: 'history', kind: 'specialist', ...englishLed('Social Studies', 'Khoa học xã hội'), icon: 'landmark', scored: false },
  { key: 'art_craft', kind: 'specialist', ...englishLed('Art & Crafts', 'Mỹ thuật & Thủ công'), icon: 'brush', scored: false, yearGroups: PRIMARY_YEARS },
  { key: 'cooking', kind: 'specialist', ...englishLed('Cooking', 'Nấu ăn'), icon: 'chef', scored: false, yearGroups: [...EARLY_YEARS, ...PRIMARY_YEARS] },
  { key: 'master_minds', kind: 'specialist', ...englishLed('Master Minds', 'Tư duy & Giải đố'), icon: 'puzzle', scored: false, yearGroups: ['Year 1'] },
  // The Primary and Lower Secondary vocational areas and Movement are English classes too
  // (Bowen, 22 October 2026): Executive Function (Year 7) and Everyday Experts (Years 2
  // to 6) both became "Everyday Life".
  { key: 'executive_function', kind: 'vocational', ...englishLed('Everyday Life', 'Cuộc sống hằng ngày'), icon: 'brain', scored: false },
  { key: 'technology', kind: 'vocational', ...englishLed('Technology', 'Công nghệ'), icon: 'monitor', scored: false },
  { key: 'wellbeing', kind: 'vocational', ...englishLed('Wellbeing', 'Sức khỏe tinh thần'), icon: 'heart', scored: false, yearGroups: [...YEARS_2_TO_6, ...LOWER_SECONDARY_YEARS] },
  { key: 'everyday_experts', kind: 'vocational', ...englishLed('Everyday Life', 'Cuộc sống hằng ngày'), icon: 'lightbulb', scored: false, yearGroups: YEARS_2_TO_6 },
  { key: 'presentation_play', kind: 'vocational', ...englishLed('Presentation & Play', 'Thuyết trình & Vui chơi'), icon: 'drama', scored: false, yearGroups: ['Year 1'] },
  // Movement was a specialist area with a comment on each student until 22 October 2026.
  // That evening Year 7 (Mr. Caleb's comments) went back to that; Years 1 to 6 keep the description.
  { key: 'movement', kind: 'vocational', ...englishLed('Movement', 'Vận động'), icon: 'movement', scored: false, yearGroups: [...PRIMARY_YEARS, 'Year 7'],
    description: MOVEMENT_DESCRIPTION, description_vi: MOVEMENT_DESCRIPTION_VI, specialistIn: ['Year 7'] },
  { key: 'physical', kind: 'vocational', comment: true, ...englishLed('Physical Development', 'Phát triển thể chất'), icon: 'footprints', scored: false, yearGroups: EARLY_YEARS },
  { key: 'expressive_arts', kind: 'vocational', ...englishLed('Expressive Arts & Design', 'Nghệ thuật & Sáng tạo'), icon: 'music', scored: false, yearGroups: EARLY_YEARS },
]

// The names the version 15 upgrade replaces: [English, Vietnamese] before "Intensive English in".
const NAMES_BEFORE_15 = {
  communication: ['Communication & Language', 'Giao tiếp & Ngôn ngữ'],
  understanding_world: ['Understanding the World', 'Hiểu biết về thế giới'],
  art_of_science: ['Art of Science', 'Nghệ thuật Khoa học'],
  history: ['Social Studies', 'Khoa học xã hội'],
  art_craft: ['Art & Crafts', 'Mỹ thuật & Thủ công'],
  cooking: ['Cooking', 'Nấu ăn'],
  master_minds: ['Master Minds', 'Tư duy & Giải đố'],
  physical: ['Physical Development', 'Phát triển thể chất'],
  expressive_arts: ['Expressive Arts & Design', 'Nghệ thuật & Sáng tạo'],
}

// Teachers who help in a class another teacher leads: on a card they share, the printed
// report names only the other teacher ("Mr. Caleb", not "Mr. Caleb & Ms. Thắm V", on
// Technology and Art & Crafts in Years 2 to 5; Bowen, 22 October 2026). An entry is an
// email or a name as on the Teachers page. Where she is the only teacher, she prints.
const ASSISTANTS = ['tham.v@pra.edu.vn', 'Thắm V']

// Character limits for the printed boxes. The report is one A4 page, printed
// in English or in Vietnamese (never both on one page), so the same limit
// applies to each language. With every box at its limit, the PDF
// (reportPdfLayout.js) still fits without cutting anything: see the measured
// sizes in the header of reportPdfLayout.js (checked with 3 academic, 3
// specialist and 3 vocational areas, in both languages, and with Year 1's four
// specialist areas). Longer text is set
// smaller, then cut. Bowen does not want these limits lowered. A template can
// raise a limit with its own `limits` (and `minimums`): Early Years comments
// outside the academic rows (Applied English, Cooking, Physical Development)
// may run to 600. Applied English was one full-width card until Cooking joined
// it on 18 October 2026, and its comments were written to that length. A
// vocational area's comment (`comment: true`) uses the specialist limits.
// Since 24 September 2026 there is no next focus, student voice or experiences
// box: those columns stay in the database but no longer print.
export const TEXT_LIMITS = {
  homeroom_note: 500,
  academic_topics: 120,
  academic_comment: 750,
  specialist_comment: 550,
  vocational_topics: 250,
}

// Minimums, shown beside each counter so teachers know how much to write.
// Nothing is blocked below them, but a comment or description shorter than its
// minimum counts as not written yet (sectionDone in utils.js), so it stays on
// the teacher's task list. The core course description has no minimum.
export const TEXT_MINIMUMS = {
  homeroom_note: 400,
  academic_comment: 650,
  specialist_comment: 450,
  vocational_topics: 150,
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
    areas: ['communication', 'math', 'understanding_world', 'applied_english', 'cooking', 'physical', 'expressive_arts'],
    skillGroups: EARLY_YEARS_SKILL_GROUPS,
    // A template may also have `areaNames` ({ math: { name, name_vi } }): names it prints
    // instead of the area's own. Early Years printed "Mathematics" for an hour on 22 October 2026.
    limits: { specialist_comment: 600 }, minimums: { specialist_comment: 300 },
    titles: {
      academic: 'Areas of Learning', academic_vi: 'Các lĩnh vực học tập',
      vocational: 'Physical & Creative Development', vocational_vi: 'Phát triển thể chất & Sáng tạo',
      // Physical Development is a comment on the child, Expressive Arts & Design what the class did.
      vocationalNote: "{nickname}'s physical progress, and what the {yearGroup} class explored in art and design",
      vocationalNote_vi: 'Tiến bộ thể chất của {nickname} và hoạt động nghệ thuật của lớp {yearGroup} trong quý này',
    },
  },
  primary: {
    key: 'primary', name: 'Primary', program: 'Primary Program', program_vi: 'Chương trình Tiểu học',
    yearGroups: PRIMARY_YEARS, scoreYearGroups: ['Year 4', 'Year 5', 'Year 6'],
    areas: ['math', 'science', 'english', 'art_craft', 'cooking', 'movement', 'master_minds', 'technology', 'wellbeing', 'everyday_experts', 'presentation_play'],
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

const SETTINGS_VERSION = 15

// The default names before version 14, which that upgrade replaces with today's.
const NAMES_BEFORE_14 = {
  math: { name: ['Intensive English in Math topics'], short: ['Math topics'] },
  science: { name: ['Intensive English in Science topics'], short: ['Science topics'] },
  movement: { name: ['Movement'], name_vi: ['Vận động'] },
  ...Object.fromEntries(Object.keys(LIFE_SKILLS_CLASSES).map((key) => [key, {
    name: [LIFE_SKILLS_CLASSES[key][0], lifeSkills(key).name],
    name_vi: [LIFE_SKILLS_CLASSES[key][1], lifeSkills(key).name_vi],
  }])),
}

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
  assistants: ASSISTANTS,
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
 * added between Confident and Moving Beyond. Before version 7 the standard
 * scale (four or five levels) becomes Emerging, Practicing, On Target,
 * Confident, Moving Beyond, with a description of each level for the key.
 * Before version 8 Master Minds (Year 1, a specialist area with a comment) is
 * added after Movement, in the area list and in the template that covers
 * Year 1; nothing else in the saved settings changes. Before version 9 Physical
 * Development (still vocational) takes an individual comment instead of the
 * course description, Cooking opens to Nursery and Kindergarten and joins the
 * Early Years template after Applied English, and that template's vocational
 * subtitle, if still "What the {yearGroup} class explored together this
 * quarter", now names both kinds of card. Before version 10 Movement moves
 * from the specialist tier (a comment) to the vocational one, after the other
 * vocational areas, with its fixed description (unless it already has one), and
 * History, if still so named, becomes Social Studies. Before version 11 the
 * Primary and Lower Secondary vocational areas still under their old names
 * take the "Life Skills" names (Technology becomes "Intensive English in Life
 * Skills: Technology"). Before version 14 the names still at an earlier default
 * take the "Intensive English in ..." ones (Math Topics with a capital,
 * Technology, Everyday Life, Movement ...). Before version 15 the Early Years
 * and specialist areas still under their plain names take "Intensive English in
 * ..." too (Cooking, Social Studies, the Art of Science ...), and an Early Years
 * "Mathematics" (an hour's `areaNames`) is dropped.
 * Saving in Report settings then stores the upgraded version.
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
  if ((Number(v.version) || 1) < 8 && (v.subjects || v.templates)) {
    const afterMovement = (keys, isSpecialist) => {
      const at = keys.indexOf('movement')
      if (at >= 0) return at + 1
      const last = keys.map(isSpecialist).lastIndexOf(true)
      return last < 0 ? keys.length : last + 1
    }
    if (!subjects.some((sub) => sub.key === 'master_minds')) {
      const keys = subjects.map((sub) => sub.key)
      subjects.splice(afterMovement(keys, (k) => subjects.find((sub) => sub.key === k)?.kind === 'specialist'), 0, { ...SUBJECTS.find((sub) => sub.key === 'master_minds') })
    }
    const key = Object.keys(templates).find((k) => (templates[k].yearGroups || []).includes('Year 1'))
    if (key) {
      const t = templates[key]
      const areas = t.areas ? [...t.areas] : [...(t.academic || []), ...(t.specialist || []), ...(t.vocational || [])]
      if (!areas.includes('master_minds')) {
        areas.splice(afterMovement(areas, (k) => subjects.find((sub) => sub.key === k)?.kind === 'specialist'), 0, 'master_minds')
        templates[key] = { ...t, areas }
      }
    }
  }
  if ((Number(v.version) || 1) < 9 && (v.subjects || v.templates)) {
    // Physical Development takes a comment for each child, and Early Years gains Cooking.
    const physical = subjects.find((sub) => sub.key === 'physical')
    if (physical && physical.kind === 'vocational' && physical.comment == null) physical.comment = true
    const cooking = subjects.find((sub) => sub.key === 'cooking')
    if (!cooking) {
      const last = subjects.map((sub) => sub.kind).lastIndexOf('specialist')
      subjects.splice(last < 0 ? subjects.length : last + 1, 0, { ...SUBJECTS.find((sub) => sub.key === 'cooking') })
    } else if ((cooking.yearGroups || []).length) {
      cooking.yearGroups = [...EARLY_YEARS.filter((g) => !cooking.yearGroups.includes(g)), ...cooking.yearGroups]
    }
    const key = Object.keys(templates).find((k) => (templates[k].yearGroups || []).some((g) => EARLY_YEARS.includes(g)))
    if (key) {
      const t = templates[key]
      const areas = t.areas ? [...t.areas] : [...(t.academic || []), ...(t.specialist || []), ...(t.vocational || [])]
      if (!areas.includes('cooking')) {
        const english = areas.indexOf('applied_english')
        areas.splice(english >= 0 ? english + 1 : areas.length, 0, 'cooking')
      }
      // The old subtitle said every card was what the class explored; Physical Development is now about the child.
      const titles = { ...(t.titles || {}) }
      if (titles.vocationalNote === 'What the {yearGroup} class explored together this quarter') titles.vocationalNote = TEMPLATES.early_years.titles.vocationalNote
      if (titles.vocationalNote_vi === 'Những gì lớp {yearGroup} đã cùng khám phá trong quý này') titles.vocationalNote_vi = TEMPLATES.early_years.titles.vocationalNote_vi
      templates[key] = { ...t, areas, titles }
    }
  }
  if ((Number(v.version) || 1) < 10 && v.subjects) {
    // Movement prints its fixed description instead of a comment on each student.
    const at = subjects.findIndex((sub) => sub.key === 'movement')
    if (at >= 0 && subjects[at].kind === 'specialist') {
      const fresh = SUBJECTS.find((sub) => sub.key === 'movement')
      const [movement] = subjects.splice(at, 1)
      movement.kind = 'vocational'
      if (!String(movement.description || '').trim()) Object.assign(movement, { description: fresh.description, description_vi: fresh.description_vi })
      // After the Primary and Lower Secondary vocational areas, before Early Years Physical Development.
      const keys = subjects.map((sub) => sub.key)
      const ey = keys.findIndex((k) => ['physical', 'expressive_arts'].includes(k))
      const last = subjects.map((sub) => sub.kind).lastIndexOf('vocational')
      subjects.splice(ey >= 0 ? ey : last + 1, 0, movement)
    }
    const history = subjects.find((sub) => sub.key === 'history')
    if (history?.name === 'History') history.name = 'Social Studies'
    if (history?.name_vi === 'Lịch sử') history.name_vi = 'Khoa học xã hội'
  }
  if ((Number(v.version) || 1) < 11 && v.subjects) {
    // The vocational classes take last year's English-led names; a name someone changed stays.
    for (const sub of subjects) {
      const old = LIFE_SKILLS_CLASSES[sub.key]
      if (!old) continue
      if (sub.name === old[0]) sub.name = lifeSkills(sub.key).name
      if (sub.name_vi === old[1]) sub.name_vi = lifeSkills(sub.key).name_vi
    }
  }
  if ((Number(v.version) || 1) < 12 && v.subjects) {
    // Movement's shorter description; a description someone changed stays.
    const movement = subjects.find((sub) => sub.key === 'movement')
    if (movement?.description === MOVEMENT_DESCRIPTION_OLD) movement.description = MOVEMENT_DESCRIPTION
    if (movement?.description_vi === MOVEMENT_DESCRIPTION_VI_OLD) movement.description_vi = MOVEMENT_DESCRIPTION_VI
  }
  if ((Number(v.version) || 1) < 13 && v.subjects) {
    // Year 7 Movement takes Mr. Caleb's comment again, with the specialist areas.
    const movement = subjects.find((sub) => sub.key === 'movement')
    if (movement && !movement.specialistIn) movement.specialistIn = ['Year 7']
  }
  if ((Number(v.version) || 1) < 14 && v.subjects) {
    // The "Intensive English in ..." names; a name someone changed stays.
    for (const sub of subjects) {
      const was = NAMES_BEFORE_14[sub.key]
      const now = SUBJECTS.find((x) => x.key === sub.key)
      if (was && now) for (const f of Object.keys(was)) if (was[f].includes(sub[f])) sub[f] = now[f]
    }
  }
  if ((Number(v.version) || 1) < 15 && v.subjects) {
    // The rest of the areas take "Intensive English in ..."; a name someone changed stays.
    for (const sub of subjects) {
      const old = NAMES_BEFORE_15[sub.key]
      const now = SUBJECTS.find((x) => x.key === sub.key)
      if (!old || !now) continue
      if (sub.name === old[0]) sub.name = now.name
      if (sub.name_vi === old[1]) sub.name_vi = now.name_vi
    }
  }
  if ((Number(v.version) || 1) < 15 && v.templates) {
    for (const [k, t] of Object.entries(templates)) {
      if (t.areaNames?.math?.name !== 'Mathematics') continue
      const { math, ...rest } = t.areaNames // eslint-disable-line no-unused-vars
      templates[k] = { ...t, areaNames: rest }
    }
  }
  let levels = s.levels
  if ((Number(v.version) || 1) < 7 && ['EPCM', 'EPCAM'].includes((v.levels || []).map((l) => l.code).join(''))) levels = LEVELS.map((l) => ({ ...l }))
  for (const sub of subjects) if (!tierKeys.includes(sub.kind)) sub.kind = 'vocational'
  for (const [k, t] of Object.entries(templates)) {
    if (!t.areas) templates[k] = { ...t, areas: [...(t.academic || []), ...(t.specialist || []), ...(t.vocational || [])] }
    if (templates[k].program_vi == null && TEMPLATES[k]?.program_vi) templates[k].program_vi = TEMPLATES[k].program_vi
    delete templates[k].academic; delete templates[k].specialist; delete templates[k].vocational
  }
  return { ...s, levels, subjects, templates, version: SETTINGS_VERSION }
}
