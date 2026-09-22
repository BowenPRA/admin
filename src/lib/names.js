// Students' legal first names, used on progress reports instead of nicknames.
// The office can type one on the student record (first_name); otherwise it is
// worked out from the full name, keeping Vietnamese accents.

import { VN_SURNAMES, VN_CHARS } from './families.js'

/** Lower case without accents, for comparing "Chau" with "Châu". */
export const foldName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim()

const SURNAMES = new Set(VN_SURNAMES.map(foldName))

/**
 * "Nguyễn Minh Anh" -> "Minh Anh"; "Phạm Lê Bảo Châu" -> "Bảo Châu";
 * "Miller Clara Thu Hà" (goes by Clara) -> "Clara"; "Emma Clarke" -> "Emma".
 */
export function guessFirstName(fullName, nickname) {
  const words = String(fullName || '').replace(/\(.*?\)/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length <= 1) return words[0] || ''
  const nick = foldName(nickname)
  const last = words[words.length - 1]
  // Vietnamese order, family name first: the first name is the last two words
  // (Minh Anh, Bảo Châu). A two-word name, or two family names before a
  // one-word name the student goes by (Trần Lê Mia), keeps just the last word.
  if (SURNAMES.has(foldName(words[0]))) {
    if (words.length === 2) return last
    if (SURNAMES.has(foldName(words[words.length - 2])) && !VN_CHARS.test(last) && foldName(last) === nick) return last
    return words.slice(-2).join(' ')
  }
  // Family name first with the name they go by further along (Rossi Marco Hoang, Keller June Mai).
  const hit = words.find((w) => foldName(w) === nick)
  if (hit) return hit
  // A non-Vietnamese family name before Vietnamese first names (Rossi Thảo Vy).
  if (!VN_CHARS.test(words[0]) && VN_CHARS.test(words[1])) return words.slice(1, 3).join(' ')
  return words[0]
}

/** { name, guessed } — the stored legal first name, or the guess from the full name. */
export function legalFirstName(student) {
  const stored = String(student?.first_name || '').trim()
  if (stored) return { name: stored, guessed: false }
  return { name: guessFirstName(student?.full_name, student?.nickname), guessed: true }
}
