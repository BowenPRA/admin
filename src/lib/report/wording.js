// Wording rules for what teachers write on progress reports. The editor shows
// these as advice while typing; nothing is ever blocked.

import { foldName } from '../names.js'

// Unicode-aware whole-word match (\b does not understand Vietnamese letters).
const word = (w) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${w})(?![\\p{L}\\p{N}])`, 'iu')

const RULES = {
  en: [
    { re: word('schools?'), msg: 'Never call Palm River Academy a "school". Say "Palm River Academy" or "our learning community".' },
    { re: word('report\\s+cards?'), msg: 'This is a Learning Progress Report, not a "report card".' },
    { re: word('grades?|graded|grading'), msg: 'Say "scores" or "levels" instead of "grades".' },
    { re: /(?<!fair\s)(?<![\p{L}\p{N}])(?:tests?|tested|testing|exams?)(?![\p{L}\p{N}])/iu, msg: 'Say "assessments" instead of "tests".' },
  ],
  vi: [
    { re: /(?<!môi\s)(?<![\p{L}])trường(?![\p{L}])(?!\s+hợp)/iu, msg: 'Không gọi Palm River Academy là "trường". Dùng "Palm River Academy" hoặc "trung tâm".', en: 'Says "trường" (school). Use "Palm River Academy" or "trung tâm".' },
    { re: word('học bạ|sổ liên lạc'), msg: 'Đây là Báo cáo tiến bộ học tập, không phải "học bạ".', en: 'Says "học bạ" (report card). It is a "Báo cáo tiến bộ học tập".' },
    { re: word('(?:bài\\s+)?kiểm tra|bài thi|thi cử'), msg: 'Dùng "bài đánh giá" thay cho "kiểm tra" / "bài thi".', en: 'Says "kiểm tra" / "bài thi" (test). Use "bài đánh giá" (assessment).' },
  ],
}

/**
 * Messages for the rules `text` breaks, e.g. using a nickname instead of the legal first name.
 * `lang` is the language of the text; `messages: 'en'` explains Vietnamese problems in English.
 */
export function wordingIssues(text, { lang = 'en', legalName = '', nickname = '', messages } = {}) {
  const t = String(text || '')
  if (!t.trim()) return []
  const viMessages = lang === 'vi' && messages !== 'en'
  const out = RULES[lang === 'vi' ? 'vi' : 'en'].filter((r) => r.re.test(t)).map((r) => (viMessages || !r.en ? r.msg : r.en))
  const nick = foldName(nickname)
  const legal = foldName(legalName)
  // Only when the nickname is used on its own: "Chau" is flagged, "Bảo Châu" is not.
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const outsideLegal = legal ? foldName(t).replace(new RegExp(word(esc(legal)).source, 'giu'), ' ') : foldName(t)
  if (nick && legal && nick !== legal && !word(esc(legal)).test(nick) && word(esc(nick)).test(outsideLegal)) {
    out.push(viMessages ? `Dùng tên chính thức "${legalName}", không dùng tên thường gọi "${nickname}".` : `Use the legal first name "${legalName}", not the nickname "${nickname}".`)
  }
  // "Bao Chau" typed without the accents of "Bảo Châu".
  if (legal && legal !== legalName.toLowerCase() && word(legal).test(t)) {
    out.push(viMessages ? `Viết tên có dấu: "${legalName}".` : `Write the name with its Vietnamese accents: "${legalName}".`)
  }
  return out
}
