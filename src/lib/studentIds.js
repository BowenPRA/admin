// Student IDs. PRA students are S0001, S0002…; the older PAL0115-style codes
// become S0115 (same number). BLE codes from the Global program are kept as
// they are. The database assigns the next S number too (see
// supabase/updates-2026-09-15.sql); doing it here lets the form show it.

export const normalizeCode = (code) => {
  const c = String(code || '').replace(/\s+/g, '').toUpperCase()
  return /^PAL\d+$/.test(c) ? `S${c.slice(3)}` : c
}

export function nextStudentCode(students) {
  let max = 0
  for (const s of students || []) {
    const m = normalizeCode(s.student_code).match(/^S(\d+)$/)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `S${String(max + 1).padStart(4, '0')}`
}

/** Students whose code is still PAL… (or has stray spaces / lower case). */
export const needsCodeUpdate = (s) => !!s.student_code && normalizeCode(s.student_code) !== s.student_code

/** Other students already using this code. */
export const codeTakenBy = (students, code, selfId) => {
  const c = normalizeCode(code)
  return c ? (students || []).find((s) => s.id !== selfId && normalizeCode(s.student_code) === c) : null
}
