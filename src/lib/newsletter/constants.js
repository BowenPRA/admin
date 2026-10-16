// The weekly newsletters: what an issue is made of, and the fixed choices the
// editor, the PDF, the email and the website all share. See README.md in this
// folder for the published form of an issue (the "payload").

/** Where the public pages are. */
export const SITE = 'https://pra.edu.vn'
/** The website's preview page, which draws an issue The Current sends it (VITE_NL_PREVIEW_URL points a test copy at a local build). */
export const PREVIEW_PAGE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_NL_PREVIEW_URL) || `${SITE}/newsletter/preview/`

/**
 * The two newsletters. `groups` are the Google Groups the email goes to (BCC);
 * `classes` are the class corners an issue starts with (keys of the schedule's classes).
 */
export const EDITIONS = {
  post: {
    id: 'post',
    name: { en: 'The Palm River Post', vi: 'The Palm River Post' },
    short: 'Palm River Post',
    tone: 'blue',
    groups: ['parents_all@palmriveracademy.edu.vn', 'allstaff@pra.edu.vn'],
    readers: { en: 'All families', vi: 'Tất cả gia đình' },
    classes: ['year1', 'year2_3', 'year5', 'year7', 'teens'],
    slugSuffix: '',
  },
  ey: {
    id: 'ey',
    name: { en: 'Early Years Weekly Newsletter', vi: 'Bản tin Early Years' },
    short: 'Early Years',
    tone: 'green',
    groups: ['parents_ey@palmriveracademy.edu.vn', 'allstaff@pra.edu.vn'],
    readers: { en: 'Nursery and Kindergarten families', vi: 'Gia đình Nursery và Kindergarten' },
    classes: ['nursery', 'kindergarten'],
    slugSuffix: '-early-years',
  },
}
export const EDITION_IDS = Object.keys(EDITIONS)

/**
 * The website's colours (pra.edu.vn, src/assets/css/main.css). `main` for marks and
 * icons, `ink` for words on `pale`, `edge` for borders. Blue and green are the page
 * colours; the others are accents (class corners, icons).
 */
export const TONES = {
  blue: { main: '#116DFF', ink: '#0B4FBF', pale: '#EEF5FF', edge: '#D3E4FF' },
  green: { main: '#48971D', ink: '#2F7D14', pale: '#EDF7E3', edge: '#D3EDB9' },
  sun: { main: '#F5A623', ink: '#7A5000', pale: '#FFF6DE', edge: '#FFE4A0' },
  coral: { main: '#FF6F59', ink: '#B03523', pale: '#FFEEEA', edge: '#FFD2C9' },
  violet: { main: '#7C5CFF', ink: '#4B33C2', pale: '#F2EEFF', edge: '#DDD3FF' },
  teal: { main: '#1F8F73', ink: '#15705A', pale: '#E3F4EF', edge: '#BFE5DA' },
  navy: { main: '#0E2A5C', ink: '#0E2A5C', pale: '#E8EDF5', edge: '#C9D4E6' },
}
export const INK = '#1B2A41'
export const INK_SOFT = '#55657A'
export const LINE = '#E3EAF2'
export const NAVY = '#0E2A5C'

/** Each class's colour in its corner. Keys are the schedule's class keys (src/data/schedule.js). */
export const CLASS_TONES = { nursery: 'sun', kindergarten: 'coral', year1: 'green', year2_3: 'blue', year5: 'violet', year7: 'teal', teens: 'navy' }
/** Accent colours the stories take in turn, so neighbours never match. */
export const STORY_TONES = ['blue', 'green', 'sun', 'coral', 'violet', 'teal']

/** Teachers' portraits on the website (src/assets/img/team), by first name as the schedule writes it. */
const PORTRAITS = { bowen: 'bowen', caleb: 'caleb', david: 'david', duyen: 'duyen', kiu: 'kiu', seth: 'seth', solo: 'solo', 'tham n': 'tham', 'tham v': 'tham-v', thanh: 'thanh', thoa: 'thoa' }
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
/** "Ms. Thắm V" -> https://pra.edu.vn/assets/img/team/tham-v-360.webp, or null. */
export function portraitUrl(teacherName) {
  const key = fold(teacherName).replace(/^(mr|ms|mrs|dr)\.?\s+/, '').trim()
  const file = PORTRAITS[key]
  return file ? `${SITE}/assets/img/team/${file}-360.webp` : null
}

/**
 * Hidden for now (Bowen, 16 October 2026): the newsletter follows the office's Google
 * Doc, an opening, sections and a closing, and the email carries all of it. These
 * kinds of part are not offered, not made for a new issue, and left out of the
 * email, the page and the PDF; their code stays, to bring back by emptying this list.
 */
export const HIDDEN_PARTS = ['dates', 'reminders', 'class', 'quote', 'press', 'welcome']
/** 'full': the email is the whole newsletter (as the Google Doc was). 'short': the first lines of each part with "Read more" links to the page. */
export const EMAIL_STYLE = 'full'

/**
 * The kinds of part. `limit` is the soft length (characters) the meter counts
 * against; past it the meter turns amber, nothing is cut. `photos` is the most
 * photos the part holds. `once` parts appear once per issue, in a fixed place.
 */
export const PART_TYPES = {
  opening: { label: 'Opening', icon: 'sun', once: true, limits: { heading: 140, body: 450 }, photos: 0,
    help: 'One sentence that says what this week was about, then two or three more. It opens the email and the page, and is the preview line in the inbox.' },
  dates: { label: 'Dates to remember', icon: 'calendar-days', once: true, limits: { what: 90 }, photos: 0,
    help: 'Tick the dates from the academic calendar, or add one for this issue. The app writes the dates in both languages.' },
  reminders: { label: 'Reminders', icon: 'pin', once: true, limits: { item: 140 }, photos: 0,
    help: 'Things to bring, pay or send. Short lines. "Every week" ones carry over to next week\'s issue.' },
  story: { label: 'Section', icon: 'book-open', limits: { heading: 90, when: 60, body: 2500 }, photos: 3,
    help: 'A heading (an emoji first, as in the Google Doc, is fine), then the text: paste it from the Doc. A line in bold on its own becomes a small heading; bullets, bold and links are kept. Up to three photos.' },
  class: { label: 'Class corner', icon: 'users', limits: { body: 700, ask: 140, word: 30 }, photos: 4, words: 8,
    help: 'What the class did this week, by its teacher: a few sentences, a photo or two, the words of the week and one question families can ask at home.' },
  photos: { label: 'Photos', icon: 'images', limits: { heading: 60 }, photos: 8,
    help: 'A set of photos with a heading: an event, a trip, a project.' },
  quote: { label: 'Student quote', icon: 'quote', limits: { text: 280, who: 60 }, photos: 1,
    help: 'A student\'s own words, with their first name and class.' },
  press: { label: 'From The Palm Press', icon: 'pen-line', limits: { blurb: 200 }, photos: 0,
    help: 'A link to a post on the student writing blog.' },
  welcome: { label: 'Welcome', icon: 'hand-heart', limits: { body: 300 }, photos: 0, familiesOnly: true,
    help: 'New students this week, by first name and class. Families only: in the email and the PDF, never on the public page.' },
  closing: { label: 'Closing', icon: 'heart', once: true, limits: { body: 300 }, photos: 0,
    help: 'A line to finish. "Warm regards, Palm River Academy English Center" is added by itself.' },
}
/** The kinds of part, in Vietnamese (for the editor in Vietnamese). */
export const PART_LABELS_VI = { opening: 'Mở đầu', dates: 'Ngày cần nhớ', reminders: 'Ghi nhớ', story: 'Mục', class: 'Góc lớp', photos: 'Ảnh', quote: 'Câu nói của học viên', press: 'Từ The Palm Press', welcome: 'Chào mừng', closing: 'Lời kết' }
/** What each kind of part is for, in Vietnamese (PART_TYPES.help is the English). */
export const PART_HELP_VI = {
  opening: 'Một câu nói tuần này có gì, rồi hai ba câu nữa. Phần này mở đầu email và trang web, và là dòng xem trước trong hộp thư.',
  dates: 'Đánh dấu những ngày từ lịch năm học, hoặc thêm ngày cho số này. Ngày tháng được viết sẵn bằng hai thứ tiếng.',
  reminders: 'Những thứ cần mang, cần đóng hoặc gửi lại. Mỗi việc một dòng ngắn. Dòng "hằng tuần" sẽ tự chuyển sang số tuần sau.',
  story: 'Một tiêu đề (có thể bắt đầu bằng emoji như trong Google Doc), rồi nội dung: dán từ Doc. Dòng in đậm đứng riêng sẽ thành tiêu đề nhỏ; giữ gạch đầu dòng, chữ đậm và liên kết. Tối đa ba ảnh.',
  class: 'Lớp đã làm gì trong tuần, do giáo viên của lớp viết: vài câu, một hai ảnh, từ vựng trong tuần và một câu hỏi để gia đình hỏi con.',
  photos: 'Một bộ ảnh có tiêu đề: một sự kiện, một chuyến đi, một dự án.',
  quote: 'Nguyên văn câu nói của một học viên, kèm tên gọi và lớp.',
  press: 'Đường dẫn đến một bài trên blog The Palm Press.',
  welcome: 'Học viên mới trong tuần, chỉ tên gọi và lớp. Chỉ gửi gia đình: có trong email và PDF, không đăng lên trang web.',
  closing: 'Một câu kết. "Trân trọng, Trung tâm Anh ngữ Palm River Academy" được thêm tự động.',
}
/** Parts Seth adds with "+ Add", in the order the menu shows them. */
export const ADDABLE = ['story', 'class', 'photos', 'quote', 'press', 'welcome'].filter((t) => !HIDDEN_PARTS.includes(t))

/** Icons a story or a photo set can wear (lucide names). Emoji are not used: they do not print in a PDF. */
export const STORY_ICONS = [
  'book-open', 'pencil', 'flask-conical', 'microscope', 'calculator', 'globe', 'languages', 'palette', 'paintbrush', 'music', 'drama', 'mic',
  'cooking-pot', 'apple', 'sprout', 'leaf', 'flower-2', 'tree-palm', 'sun', 'cloud-rain', 'waves', 'bus', 'map-pin', 'ticket',
  'trophy', 'medal', 'star', 'party-popper', 'gift', 'cake-slice', 'ghost', 'moon', 'lamp', 'heart', 'hand-heart', 'users',
  'calendar-days', 'clock', 'credit-card', 'clipboard-list', 'megaphone', 'camera', 'dumbbell', 'bike', 'puzzle', 'lightbulb', 'rocket', 'smile',
]

/** Plain words for the website's "where they came from" counts. */
export const SOURCES = {
  email: { en: 'From the email', vi: 'Từ email' },
  chat: { en: 'From a chat group', vi: 'Từ nhóm chat' },
  facebook: { en: 'From Facebook', vi: 'Từ Facebook' },
  site: { en: 'From the website', vi: 'Từ website' },
  pdf: { en: 'From the PDF', vi: 'Từ PDF' },
  direct: { en: 'Other', vi: 'Khác' },
}

/** Fixed words in both languages, for the PDF, the email and the page. */
export const WORDS = {
  en: {
    needToKnow: 'Need to know', dates: 'Dates to remember', reminders: 'Remember', inIssue: 'In this issue', readMore: 'Read more',
    readAll: 'Read the whole newsletter', fromTeacher: 'From {name}', wordsOfWeek: 'Words of the week', askYourChild: 'Ask your child',
    signoff: 'Warm regards,', from: 'Palm River Academy English Center', addToCalendar: 'Add to calendar', off: 'no classes', fees: 'fees',
    readVi: 'Đọc bằng tiếng Việt', pdf: 'PDF', pdfEn: 'PDF in English', pdfVi: 'PDF tiếng Việt', page: 'Page {n} of {total}',
    welcome: 'Welcome', pressFrom: 'From The Palm Press', by: 'by {name}', attached: 'This issue is attached as a PDF in English and Vietnamese.',
    pastIssues: 'Past issues', english: 'English',
  },
  vi: {
    needToKnow: 'Cần biết', dates: 'Ngày cần nhớ', reminders: 'Ghi nhớ', inIssue: 'Trong số này', readMore: 'Đọc thêm',
    readAll: 'Đọc toàn bộ bản tin', fromTeacher: '{name} chia sẻ', wordsOfWeek: 'Từ vựng trong tuần', askYourChild: 'Hỏi con nhé',
    signoff: 'Trân trọng,', from: 'Trung tâm Anh ngữ Palm River Academy', addToCalendar: 'Thêm vào lịch', off: 'nghỉ học', fees: 'học phí',
    readVi: 'Đọc bằng tiếng Việt', pdf: 'PDF', pdfEn: 'PDF in English', pdfVi: 'PDF tiếng Việt', page: 'Trang {n}/{total}',
    welcome: 'Chào mừng', pressFrom: 'Từ The Palm Press', by: '{name}', attached: 'Bản tin được đính kèm dạng PDF bằng tiếng Anh và tiếng Việt.',
    pastIssues: 'Các số trước', english: 'Tiếng Anh',
  },
}
export const word = (lang, key, vars = {}) => String(WORDS[lang === 'vi' ? 'vi' : 'en'][key] ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')

/** The Gmail address the email is saved from. */
export const SENDER = 'admin@palmriveracademy.edu.vn'
/** Private photos while an issue is written; the public folder holds what is published. */
export const BUCKET = 'adm-newsletter'
export const PUBLIC_BUCKET = 'newsletter'
