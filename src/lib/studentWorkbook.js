// The student list as a finished Excel workbook: photos, colour bands, a key,
// and locked sheets. One tab ("Students") holds the information; the class
// lists, allergy list, birthdays and the summary counts are formulas that read
// it, so nothing can drift apart. The look follows the office's Acellus step
// goals workbook (navy banner, pastel bands, colours that apply themselves).
// ExcelJS is loaded on first use; SheetJS (exportExcel.js) cannot do styles or pictures.

import { LEVELS, PROGRAMS, DEFAULT_FEES } from './fees'
import { statusOf, contactsOf, ageOf, isPast } from './studentRecords'
import { photoSrc, preparePhotos } from './report/photo'

const loadExcel = () => import('exceljs/dist/exceljs.min.js').then((m) => m.default || m)

// ---------------- look ----------------
const C = {
  navy: 'FF1F3864', white: 'FFFFFFFF', sub: 'FF5A5A5A', headBg: 'FFEDEFF3', ink: 'FF33415C', noteBg: 'FFF9F9F7', noteInk: 'FF444444', line: 'FFD5DAE3',
  green: ['FFD6EAD6', 'FF2E6B3A'], red: ['FFFAD4D4', 'FFA32020'], grey: ['FFEFEFEF', 'FF8A8A8A'], amber: ['FFFBEFD0', 'FF8A6D1F'],
  purple: ['FFEDE3F7', 'FF5B2C87'], tan: ['FFF3E4D0', 'FF7A4E1E'], blue: ['FFDCE9FB', 'FF1B4F8A'], teal: ['FFE3F2FA', 'FF14607F'], pink: ['FFF5E1EC', 'FF7A2E5E'],
}
const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const edge = { style: 'thin', color: { argb: C.line } }
const BOX = { top: edge, left: edge, bottom: edge, right: edge }
function paint(cell, { bg, ink = C.ink, bold = false, italic = false, size = 11, h = 'center', v = 'middle', wrap = true, numFmt, box = true } = {}) {
  cell.font = { name: 'Calibri', size, bold, italic, color: { argb: ink } }
  cell.alignment = { horizontal: h, vertical: v, wrapText: wrap, indent: h === 'left' ? 1 : 0 }
  if (bg) cell.fill = solid(bg)
  if (box) cell.border = BOX
  if (numFmt) cell.numFmt = numFmt
  return cell
}
// Early years, primary, lower secondary, upper secondary: one colour each, as on the Acellus tabs.
const stageOf = (level) => (/^(Nursery|Kindergarten)$/.test(level) ? C.amber : /^Year [1-6]$/.test(level) ? C.blue : /^Year [78]$/.test(level) ? C.purple : C.pink)
const levelOrder = (l) => { const i = LEVELS.indexOf(l); return i < 0 ? 99 : i }
const STATUS = { active: 'Enrolled', pending: 'Pending', inactive: 'Past' }
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '')
const DATE_FMT = 'd mmm yyyy'
// Excel dates carry no time zone, so a birthday is written as that calendar day in UTC.
const asDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null }

function banner(ws, title, subtitle, cols) {
  ws.mergeCells(1, 1, 1, cols)
  paint(ws.getCell(1, 1), { bg: C.navy, ink: C.white, bold: true, size: 18, box: false }).value = title
  ws.getRow(1).height = 42
  ws.mergeCells(2, 1, 2, cols)
  paint(ws.getCell(2, 1), { ink: C.sub, box: false }).value = subtitle
  ws.getRow(2).height = 21.75
  ws.getRow(3).height = 9.75
}
const LOCK = { selectLockedCells: true, selectUnlockedCells: true, autoFilter: true, formatColumns: true, formatRows: true }
const PAGE = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }

// ---------------- photos ----------------
// A small square JPEG per student (the same file is reused on every tab).
async function squareThumb(src, size = 132) {
  try {
    const blob = await (await fetch(src)).blob()
    const bmp = await createImageBitmap(blob)
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, size, size)
    const s = Math.max(size / bmp.width, size / bmp.height)
    g.drawImage(bmp, (size - bmp.width * s) / 2, (size - bmp.height * s) / 3, bmp.width * s, bmp.height * s) // a little above centre: faces sit high in a portrait
    bmp.close?.()
    return c.toDataURL('image/jpeg', 0.86)
  } catch { return null }
}
const ROW_H = 46 // points: the shortest a row with a photo can be
const PHOTO_PX = 52
const PHOTO_COL_W = 9 // characters; about 68 px
/** Row height that fits the longest cell: `lines` counted lines of 10pt text. */
const heightFor = (lines) => Math.max(ROW_H, Math.ceil(lines) * 12.5 + 8)
/** Lines a text takes in a column `width` characters wide (typed line breaks plus wrapping). */
const linesIn = (text, width) => String(text || '').split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / (width * 1.15))), 0)
// "Move and size with cells" (both corners anchored), so a photo hides with its
// row when the list is filtered. The corners are given in Excel's own units
// (EMU, 9525 to a pixel): ExcelJS's fractional rows come out a fifth too small.
const EMU = 9525
function placePhoto(ws, imageId, row, col, rowHeight = ROW_H) {
  if (imageId == null) return
  const x = Math.round(((PHOTO_COL_W * 7 + 5) - PHOTO_PX) / 2), y = Math.round((rowHeight * 96 / 72 - PHOTO_PX) / 2)
  const at = (dx, dy) => ({ nativeCol: col - 1, nativeColOff: dx * EMU, nativeRow: row - 1, nativeRowOff: dy * EMU })
  ws.addImage(imageId, { tl: at(x, y), br: at(x + PHOTO_PX, y + PHOTO_PX), editAs: 'twoCell' })
}

// ---------------- the workbook ----------------
/**
 * @param {Array} list      students to include
 * @param {Array} students  every student (for siblings on the Contacts tab)
 * @param {Array} families
 * @param {string} [label]  what the list is, for the subtitle ("Enrolled", "Year 3", …)
 * @returns {Promise<Blob>}
 */
export async function studentWorkbookBlob({ list, students, families, label = '', schoolYear = DEFAULT_FEES.schoolYear }) {
  const ExcelJS = await loadExcel()
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PRA Admin'
  wb.created = new Date()
  wb.calcProperties.fullCalcOnLoad = true

  const rows = [...list].sort((a, b) => levelOrder(a.level) - levelOrder(b.level) || (a.nickname || a.full_name || '').localeCompare(b.nickname || b.full_name || ''))
  const famById = Object.fromEntries(families.map((f) => [f.id, f]))
  const kidsOf = (fid) => students.filter((k) => k.family_id === fid)
  const programName = (id) => (PROGRAMS.find((p) => p.id === id)?.en || id || '').replace(/ Program$| Pathway$/, '')
  await preparePhotos(rows.map((s) => s.photo)).catch(() => {})
  const thumbs = await Promise.all(rows.map((s) => (photoSrc(s.photo) ? squareThumb(photoSrc(s.photo)) : null)))
  const imageIds = thumbs.map((t) => (t ? wb.addImage({ base64: t, extension: 'jpeg' }) : null))

  const exported = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const subtitle = (what) => `Palm River Academy   •   ${schoolYear.replace('-', '–')}   •   ${what}   •   exported ${exported} from PRA Admin`

  // Summary comes first in the file but is written last (it counts the other tabs' rows).
  const wsSummary = wb.addWorksheet('Summary', { properties: { tabColor: { argb: C.navy } } })

  // ======== Students: the one tab that holds the information ========
  const COLS = [
    { key: 'no', head: 'No.', w: 5, group: 'STUDENT' },
    { key: 'photo', head: 'Photo', w: 9, group: 'STUDENT' },
    { key: 'code', head: 'Student ID', w: 11, group: 'STUDENT', get: (s) => s.student_code || '' },
    { key: 'name', head: 'Full name', w: 30, group: 'STUDENT', h: 'left', bold: true, get: (s) => s.full_name || '' },
    { key: 'nick', head: 'Nickname', w: 13, group: 'STUDENT', bold: true, get: (s) => s.nickname || '' },
    { key: 'level', head: 'Year group', w: 15, group: 'STUDENT', get: (s) => s.level || '' },
    { key: 'program', head: 'Program', w: 13, group: 'STUDENT', get: (s) => programName(s.program) },
    { key: 'status', head: 'Status', w: 11, group: 'STUDENT', get: (s) => STATUS[statusOf(s)] },
    { key: 'gender', head: 'Gender', w: 9, group: 'ABOUT', get: (s) => cap(s.gender) },
    { key: 'dob', head: 'Birthday', w: 13, group: 'ABOUT', numFmt: DATE_FMT, get: (s) => asDate(s.dob) || '' },
    { key: 'age', head: 'Age', w: 6, group: 'ABOUT' },
    { key: 'nation', head: 'Nationality', w: 13, group: 'ABOUT', get: (s) => s.nationality || '' },
    { key: 'allergy', head: 'Allergies / medical', w: 30, group: 'ABOUT', h: 'left', get: (s) => s.allergies || '' },
    { key: 'family', head: 'Family', w: 22, group: 'FAMILY & CONTACT', h: 'left', get: (s, x) => x.fam?.name || '' },
    { key: 'parents', head: 'Parents / guardians', w: 26, group: 'FAMILY & CONTACT', h: 'left', get: (s, x) => x.contacts.map((c) => [c.name, c.relation && `(${c.relation})`].filter(Boolean).join(' ')).filter(Boolean).join('\n') },
    { key: 'emails', head: 'Parent emails', w: 34, group: 'FAMILY & CONTACT', h: 'left', get: (s, x) => x.join('email') || (s.parents_email || '').split(/[,;\s]+/).filter(Boolean).join('\n') },
    { key: 'phones', head: 'Parent phones', w: 28, group: 'FAMILY & CONTACT', h: 'left', get: (s, x) => x.join('phone') || (s.parent_phone || '').split(/\s*\|\s*/).filter(Boolean).join('\n') },
    { key: 'address', head: 'Address', w: 38, group: 'FAMILY & CONTACT', h: 'left', get: (s) => s.address || '' },
    { key: 'start', head: 'Start date', w: 13, group: 'OFFICE', numFmt: DATE_FMT, get: (s) => asDate(s.start_date) || '' },
    { key: 'isNew', head: 'New this year', w: 9, group: 'OFFICE', get: (s) => (s.is_new ? 'Yes' : '') },
    { key: 'legacy', head: 'Legacy', w: 9, group: 'OFFICE', get: (s) => (s.legacy ? 'Yes' : '') },
    { key: 'notes', head: 'Notes', w: 34, group: 'OFFICE', h: 'left', get: (s) => s.notes || '' },
  ]
  const GROUP_TINT = { STUDENT: C.blue, ABOUT: C.purple, 'FAMILY & CONTACT': C.teal, OFFICE: C.tan }
  const ws = wb.addWorksheet('Students', { properties: { tabColor: { argb: 'FF2E75B6' } }, views: [{ state: 'frozen', xSplit: 5, ySplit: 5, showGridLines: false }] })
  ws.columns = COLS.map((c) => ({ width: c.w }))
  const L = Object.fromEntries(COLS.map((c, i) => [c.key, ws.getColumn(i + 1).letter]))
  const FIRST = 6
  const LAST = Math.max(FIRST, FIRST + rows.length - 1)
  const rowOf = new Map(rows.map((s, i) => [s, FIRST + i]))
  const current = rows.filter((s) => !isPast(s))

  banner(ws, 'PALM RIVER ACADEMY   •   STUDENT LIST', subtitle(`${label || 'All students'}   •   ${rows.length} students`), COLS.length)
  // Row 4: what each block of columns is about. Row 5: the columns.
  for (let i = 0; i < COLS.length;) {
    let j = i
    while (j + 1 < COLS.length && COLS[j + 1].group === COLS[i].group) j++
    ws.mergeCells(4, i + 1, 4, j + 1)
    paint(ws.getCell(4, i + 1), { bg: C.navy, ink: C.white, bold: true, size: 12 }).value = COLS[i].group
    i = j + 1
  }
  ws.getRow(4).height = 25.5
  COLS.forEach((c, i) => { const [bg, ink] = GROUP_TINT[c.group]; paint(ws.getCell(5, i + 1), { bg, ink, bold: true, size: 10 }).value = c.head })
  ws.getRow(5).height = 30

  rows.forEach((s, i) => {
    const r = FIRST + i
    const fam = famById[s.family_id]
    const contacts = contactsOf(fam, fam ? kidsOf(fam.id) : [s])
    // Siblings' records often repeat a number with different spacing: "Mẹ (0779…)" and "Mẹ(0779…)" are one line.
    const join = (key) => {
      const seen = new Set()
      return contacts.map((c) => String(c[key] || '').trim()).filter((v) => {
        const id = (key === 'phone' && v.replace(/\D/g, '')) || v.toLowerCase()
        if (!v || seen.has(id)) return false
        seen.add(id)
        return true
      }).join('\n')
    }
    const x = { fam, contacts, join }
    const past = isPast(s)
    const newGroup = i === 0 || rows[i - 1].level !== s.level
    COLS.forEach((c, ci) => {
      const cell = ws.getCell(r, ci + 1)
      paint(cell, { h: c.h || 'center', bold: !!c.bold && !past, ink: past ? C.grey[1] : C.ink, size: c.h === 'left' && !c.bold ? 10 : 11, numFmt: c.numFmt, bg: i % 2 ? 'FFF7F9FC' : C.white })
      if (c.key === 'no') cell.value = i + 1
      else if (c.key === 'age') cell.value = { formula: `IF(${L.dob}${r}="","",DATEDIF(${L.dob}${r},TODAY(),"Y"))`, result: ageOf(s.dob) ?? '' }
      else if (c.key === 'photo') { if (imageIds[i] == null) paint(cell, { ink: C.grey[1], size: 9, bg: i % 2 ? 'FFF7F9FC' : C.white }).value = 'no photo' }
      else cell.value = c.get(s, x)
      if (c.key === 'level') { const [bg, ink] = stageOf(s.level); paint(cell, { bg, ink, bold: true }) }
      // A heavier line where a new year group starts.
      if (newGroup && i > 0) cell.border = { ...BOX, top: { style: 'medium', color: { argb: C.navy } } }
    })
    const tall = heightFor(Math.max(...COLS.map((c, ci) => (c.h === 'left' ? linesIn(ws.getCell(r, ci + 1).value, c.w) : 1))))
    ws.getRow(r).height = tall
    placePhoto(ws, imageIds[i], r, 2, tall)
  })
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: LAST, column: COLS.length } }
  const cf = (ref, formula, [bg, ink], priority) => ws.addConditionalFormatting({ ref, rules: [{ type: 'expression', priority, formulae: [formula], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: bg } }, font: { bold: true, color: { argb: ink } } } }] })
  const col = (k) => `${L[k]}${FIRST}:${L[k]}${LAST}`
  cf(col('status'), `$${L.status}${FIRST}="Enrolled"`, C.green, 1)
  cf(col('status'), `$${L.status}${FIRST}="Pending"`, C.amber, 2)
  cf(col('status'), `$${L.status}${FIRST}="Past"`, C.grey, 3)
  cf(col('allergy'), `LEN(TRIM($${L.allergy}${FIRST}))>0`, C.red, 4)
  cf(col('emails'), `AND($${L.status}${FIRST}<>"Past",LEN(TRIM($${L.emails}${FIRST}))=0)`, C.red, 5)
  cf(col('phones'), `AND($${L.status}${FIRST}<>"Past",LEN(TRIM($${L.phones}${FIRST}))=0)`, C.red, 6)
  ws.pageSetup = { ...PAGE, orientation: 'landscape', printTitlesRow: '4:5' }

  // A cell on another tab that shows a Students cell (blank stays blank, not 0).
  const M = (k, s) => `Students!$${L[k]}$${rowOf.get(s)}`
  const linked = (cell, k, s, result, style) => { paint(cell, style).value = { formula: `IF(${M(k, s)}="","",${M(k, s)})`, result: result ?? '' } }
  const range = (k) => `Students!$${L[k]}$${FIRST}:$${L[k]}$${LAST}`
  const byLevel = LEVELS.concat([...new Set(current.map((s) => s.level))].filter((l) => !LEVELS.includes(l))).map((level) => [level, current.filter((s) => s.level === level)]).filter(([, ss]) => ss.length)

  // ======== Class lists: for teachers, one block per year group, prints a page each ========
  const wc = wb.addWorksheet('Class lists', { properties: { tabColor: { argb: 'FF5B2C87' } }, views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] })
  const CL = [['No.', 5], ['Photo', 9], ['Nickname', 16], ['Full name', 32], ['Gender', 9], ['Birthday', 13], ['Age', 6], ['Allergies / medical', 34], ['Parent phones', 30]]
  wc.columns = CL.map(([, w]) => ({ width: w }))
  banner(wc, 'CLASS LISTS', subtitle(`${current.length} students   •   reads the Students tab`), CL.length)
  CL.forEach(([head], i) => paint(wc.getCell(4, i + 1), { bg: C.headBg, bold: true, size: 10 }).value = head)
  wc.getRow(4).height = 22
  let r = 5
  byLevel.forEach(([level, ss], gi) => {
    const [bg, ink] = stageOf(level)
    wc.mergeCells(r, 1, r, CL.length)
    paint(wc.getCell(r, 1), { bg, ink, bold: true, size: 13 }).value = {
      formula: `"${level.toUpperCase()}   •   "&COUNTIFS(${range('level')},"${level}",${range('status')},"<>Past")&" students"`, result: `${level.toUpperCase()}   •   ${ss.length} students`,
    }
    wc.getRow(r).height = 26
    if (gi > 0) wc.getRow(r - 1).addPageBreak()
    r++
    ss.forEach((s, i) => {
      paint(wc.getCell(r, 1)).value = i + 1
      paint(wc.getCell(r, 2), { ink: C.grey[1], size: 9 }).value = imageIds[rows.indexOf(s)] == null ? 'no photo' : ''
      linked(wc.getCell(r, 3), 'nick', s, s.nickname, { bold: true, size: 13 })
      linked(wc.getCell(r, 4), 'name', s, s.full_name, { h: 'left' })
      linked(wc.getCell(r, 5), 'gender', s, cap(s.gender))
      linked(wc.getCell(r, 6), 'dob', s, asDate(s.dob), { numFmt: DATE_FMT })
      linked(wc.getCell(r, 7), 'age', s, ageOf(s.dob))
      linked(wc.getCell(r, 8), 'allergy', s, s.allergies, s.allergies ? { h: 'left', bg: C.red[0], ink: C.red[1], bold: true, size: 10 } : { h: 'left', size: 10 })
      const phones = ws.getCell(`${L.phones}${rowOf.get(s)}`).value
      linked(wc.getCell(r, 9), 'phones', s, phones, { h: 'left', size: 10 })
      const tall = heightFor(Math.max(linesIn(phones, 30), linesIn(s.allergies, 34)))
      wc.getRow(r).height = tall
      placePhoto(wc, imageIds[rows.indexOf(s)], r, 2, tall)
      r++
    })
  })
  wc.pageSetup = { ...PAGE, printTitlesRow: '1:4' }

  // ======== Allergies: for the kitchen and anyone supervising food ========
  const wa = wb.addWorksheet('Allergies', { properties: { tabColor: { argb: C.red[1] } }, views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] })
  const AL = [['Photo', 9], ['Nickname', 16], ['Full name', 30], ['Year group', 15], ['Allergies / medical', 70]]
  wa.columns = AL.map(([, w]) => ({ width: w }))
  const allergic = current.filter((s) => (s.allergies || '').trim())
  banner(wa, 'ALLERGIES & MEDICAL NOTES', subtitle(`${allergic.length} students   •   reads the Students tab`), AL.length)
  AL.forEach(([head], i) => paint(wa.getCell(4, i + 1), { bg: C.red[0], ink: C.red[1], bold: true, size: 10 }).value = head)
  wa.getRow(4).height = 22
  allergic.forEach((s, i) => {
    const row = 5 + i
    paint(wa.getCell(row, 1), { ink: C.grey[1], size: 9 }).value = imageIds[rows.indexOf(s)] == null ? 'no photo' : ''
    linked(wa.getCell(row, 2), 'nick', s, s.nickname, { bold: true, size: 13 })
    linked(wa.getCell(row, 3), 'name', s, s.full_name, { h: 'left' })
    const [bg, ink] = stageOf(s.level)
    linked(wa.getCell(row, 4), 'level', s, s.level, { bg, ink, bold: true })
    linked(wa.getCell(row, 5), 'allergy', s, s.allergies, { h: 'left', ink: C.red[1], bold: true })
    const tall = heightFor(linesIn(s.allergies, 70) * 1.15) // 11pt bold here
    wa.getRow(row).height = tall
    placePhoto(wa, imageIds[rows.indexOf(s)], row, 1, tall)
  })
  if (!allergic.length) { wa.mergeCells(5, 1, 5, AL.length); paint(wa.getCell(5, 1), { bg: C.noteBg, ink: C.noteInk, italic: true }).value = 'No allergies or medical notes are recorded for these students.' }
  wa.pageSetup = { ...PAGE, printTitlesRow: '1:4' }

  // ======== Birthdays: by month, in academic-year order ========
  const wbd = wb.addWorksheet('Birthdays', { properties: { tabColor: { argb: C.amber[1] } }, views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] })
  const BD = [['Day', 7], ['Nickname', 16], ['Full name', 32], ['Year group', 15], ['Born', 14], ['Age now', 9]]
  wbd.columns = BD.map(([, w]) => ({ width: w }))
  banner(wbd, 'BIRTHDAYS', `${schoolYear.replace('-', '–')}   •   by month   •   reads the Students tab   •   exported ${exported}`, BD.length)
  BD.forEach(([head], i) => paint(wbd.getCell(4, i + 1), { bg: C.headBg, bold: true, size: 10 }).value = head)
  wbd.getRow(4).height = 22
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  r = 5
  for (const m of [7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6]) {
    const born = current.filter((s) => asDate(s.dob)?.getUTCMonth() === m).sort((a, b) => asDate(a.dob).getUTCDate() - asDate(b.dob).getUTCDate())
    if (!born.length) continue
    wbd.mergeCells(r, 1, r, BD.length)
    paint(wbd.getCell(r, 1), { bg: C.amber[0], ink: C.amber[1], bold: true, size: 12 }).value = `${MONTHS[m].toUpperCase()}   •   ${born.length}`
    wbd.getRow(r).height = 22
    r++
    for (const s of born) {
      paint(wbd.getCell(r, 1), { bold: true }).value = { formula: `DAY(${M('dob', s)})`, result: asDate(s.dob).getUTCDate() }
      linked(wbd.getCell(r, 2), 'nick', s, s.nickname, { bold: true })
      linked(wbd.getCell(r, 3), 'name', s, s.full_name, { h: 'left' })
      const [bg, ink] = stageOf(s.level)
      linked(wbd.getCell(r, 4), 'level', s, s.level, { bg, ink, bold: true, size: 10 })
      linked(wbd.getCell(r, 5), 'dob', s, asDate(s.dob), { numFmt: DATE_FMT })
      linked(wbd.getCell(r, 6), 'age', s, ageOf(s.dob))
      wbd.getRow(r).height = 20
      r++
    }
  }
  wbd.pageSetup = { ...PAGE, printTitlesRow: '1:4' }

  // ======== Contacts: one row per parent / guardian ========
  const wf = wb.addWorksheet('Contacts', { properties: { tabColor: { argb: C.teal[1] } }, views: [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }] })
  const FC = [['Family', 24], ['Children', 34], ['Contact', 24], ['Relation', 12], ['Email', 34], ['Phone', 22], ['Language', 10], ['Notes', 36]]
  wf.columns = FC.map(([, w]) => ({ width: w }))
  const listed = new Set(rows.map((s) => s.family_id).filter(Boolean))
  const fams = families.filter((f) => listed.has(f.id)).sort((a, b) => a.name.localeCompare(b.name))
  banner(wf, 'FAMILY CONTACTS', subtitle(`${fams.length} families`), FC.length)
  FC.forEach(([head], i) => paint(wf.getCell(4, i + 1), { bg: C.teal[0], ink: C.teal[1], bold: true, size: 10 }).value = head)
  wf.getRow(4).height = 22
  r = 5
  fams.forEach((f, fi) => {
    const kids = kidsOf(f.id).sort((a, b) => levelOrder(a.level) - levelOrder(b.level))
    const contacts = contactsOf(f, kids)
    const bg = fi % 2 ? 'FFF7F9FC' : C.white
    ;(contacts.length ? contacts : [{}]).forEach((c, ci) => {
      const vals = [ci ? '' : f.name, ci ? '' : kids.map((k) => `${k.nickname || k.full_name} (${k.level || '?'})`).join(', '), c.name || '', c.relation || '', c.email || '', c.phone || '', ci ? '' : (f.language || 'en').toUpperCase(), ci ? '' : f.notes || '']
      vals.forEach((v, i) => { paint(wf.getCell(r, i + 1), { bg, h: i === 3 || i === 6 ? 'center' : 'left', bold: i === 0, size: i === 0 ? 11 : 10 }).value = v })
      if ((c.email || '').includes('@')) { const cell = wf.getCell(r, 5); cell.value = { text: c.email, hyperlink: `mailto:${c.email}` }; cell.font = { ...cell.font, underline: true, color: { argb: 'FF1B4F8A' } } }
      wf.getRow(r).height = ci ? 18 : 22
      r++
    })
  })
  if (fams.length) wf.autoFilter = { from: { row: 4, column: 1 }, to: { row: r - 1, column: FC.length } }
  wf.pageSetup = { ...PAGE, orientation: 'landscape', printTitlesRow: '1:4' }

  // ======== Summary: counts that read the Students tab, the tabs, the key ========
  const SC = [['Year group', 18], ['Enrolled', 11], ['Pending', 11], ['Boys', 9], ['Girls', 9], ['With allergies', 14], ['Total', 10], ['', 46]]
  const S = wsSummary
  S.views = [{ showGridLines: false }]
  S.columns = SC.map(([, w]) => ({ width: w }))
  banner(S, 'PALM RIVER ACADEMY   •   STUDENT LIST', subtitle(label || 'All students'), SC.length)
  S.mergeCells(4, 1, 4, 7)
  paint(S.getCell(4, 1), { bg: C.navy, ink: C.white, bold: true, size: 12 }).value = 'STUDENTS BY YEAR GROUP   ·   COUNTS UPDATE THEMSELVES'
  S.getRow(4).height = 25.5
  SC.slice(0, 7).forEach(([head], i) => paint(S.getCell(5, i + 1), { bg: C.headBg, bold: true, size: 10 }).value = head)
  const count = (level, extra = '') => `COUNTIFS(${range('level')},"${level}"${extra})`
  const not = `,${range('status')},"<>Past"`
  const n = (ss, test) => ss.filter(test).length
  byLevel.forEach(([level, ss], i) => {
    const row = 6 + i
    const [bg, ink] = stageOf(level)
    paint(S.getCell(row, 1), { bg, ink, bold: true }).value = level
    const cells = [
      [count(level, `,${range('status')},"Enrolled"`), n(ss, (s) => statusOf(s) === 'active')],
      [count(level, `,${range('status')},"Pending"`), n(ss, (s) => statusOf(s) === 'pending')],
      [count(level, `${not},${range('gender')},"Male"`), n(ss, (s) => s.gender === 'male')],
      [count(level, `${not},${range('gender')},"Female"`), n(ss, (s) => s.gender === 'female')],
      [count(level, `${not},${range('allergy')},"?*"`), n(ss, (s) => (s.allergies || '').trim())],
      [count(level, not), ss.length],
    ]
    cells.forEach(([formula, result], ci) => { paint(S.getCell(row, ci + 2), { bold: ci === 5 }).value = { formula, result } })
    S.getRow(row).height = 20
  })
  const totalRow = 6 + byLevel.length
  paint(S.getCell(totalRow, 1), { bg: C.navy, ink: C.white, bold: true }).value = 'TOTAL'
  for (let ci = 2; ci <= 7; ci++) {
    const letter = S.getColumn(ci).letter
    const result = byLevel.reduce((sum, _, i) => sum + (Number(S.getCell(6 + i, ci).value?.result) || 0), 0)
    paint(S.getCell(totalRow, ci), { bg: C.headBg, bold: true }).value = byLevel.length ? { formula: `SUM(${letter}6:${letter}${totalRow - 1})`, result } : 0
  }
  S.getRow(totalRow).height = 22

  let k = totalRow + 2
  const heading = (text) => { S.mergeCells(k, 1, k, SC.length); paint(S.getCell(k, 1), { bg: C.navy, ink: C.white, bold: true, size: 12 }).value = text; S.getRow(k).height = 25.5; k++ }
  const note = (tag, text, tint = [C.headBg, C.ink], link) => {
    paint(S.getCell(k, 1), { bg: tint[0], ink: tint[1], bold: true, size: 10 }).value = link ? { text: tag, hyperlink: `#'${link}'!A1` } : tag
    if (link) S.getCell(k, 1).font = { ...S.getCell(k, 1).font, underline: true }
    S.mergeCells(k, 2, k, SC.length)
    paint(S.getCell(k, 2), { bg: C.noteBg, ink: C.noteInk, size: 10, h: 'left' }).value = text
    S.getRow(k).height = Math.max(20, 14 * Math.ceil(text.length / 120) + 6)
    k++
  }
  heading('TABS   ·   CLICK A NAME TO GO THERE')
  note('Students', 'Every student with photo, year group, status, birthday, allergies, family, parent contacts and office notes. Use the arrows on the column headings to filter. This is the only tab that holds information; the others read it.', C.blue, 'Students')
  note('Class lists', 'For teachers: one block per year group with photo, nickname, birthday, allergies and parent phones. Prints one year group per page.', C.purple, 'Class lists')
  note('Allergies', 'For the kitchen and anyone supervising food: only the students with an allergy or medical note.', C.red, 'Allergies')
  note('Birthdays', 'Month by month, starting in August.', C.amber, 'Birthdays')
  note('Contacts', 'One row per parent or guardian, with email links.', C.teal, 'Contacts')
  k++
  heading('KEY   ·   COLOURS APPLY THEMSELVES')
  note('ENROLLED', 'In class now. Counted in every total.', C.green)
  note('PENDING', 'On the way in: can be invoiced, but is not on the register or in the reports until the office marks them enrolled.', C.amber)
  note('PAST', 'No longer at PRA. Shown in grey on the Students tab only, and left out of the class lists, birthdays and totals.', C.grey)
  note('RED CELL', 'An allergy or medical note — or, under Parent emails / Parent phones, a current student with no contact on file.', C.red)
  note('YEAR GROUPS', 'Yellow = Early Years · Blue = Primary · Purple = Lower Secondary · Pink = Upper Secondary.')
  k++
  heading('HOW TO UPDATE')
  note('Do not type here', 'This file is a copy made by PRA Admin, so every sheet is locked. Change a student in the app (Students page), then export again: the new file replaces this one and every tab follows.')
  note('Why it is locked', 'The class lists, allergy list, birthdays and the counts above are formulas reading the Students tab. Locking stops a stray keystroke from breaking those links. Filtering and resizing columns still work.')
  note('If you must edit', 'Review > Unprotect Sheet (there is no password). Anything typed will be lost at the next export, so put lasting changes in the app.')
  S.pageSetup = { ...PAGE }

  for (const sheet of wb.worksheets) await sheet.protect('', LOCK)
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
