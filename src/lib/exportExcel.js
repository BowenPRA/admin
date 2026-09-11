import * as XLSX from 'xlsx'
import { rowTotal } from './pricing'

// One workbook, four sheets: Invoices, Line items, Payments, Students.
export function exportWorkbook({ invoices, payments, students, families }) {
  const famName = (id) => families.find((f) => f.id === id)?.name || ''

  const inv = invoices.map((i) => ({
    Number: i.number, Status: i.status, Language: i.lang, 'School year': i.school_year, Period: i.period_label,
    Students: i.student_names, Family: i.family_name || famName(i.family_id),
    'Issue date': i.issue_date, 'Due date': i.due_date,
    Total: Number(i.total) || 0, Paid: Number(i.paid) || 0, Balance: (Number(i.total) || 0) - (Number(i.paid) || 0),
    Plan: i.inputs?.plan || '', 'Internal notes': i.notes || '', Created: i.created_at,
  }))

  const lines = []
  invoices.forEach((i) => {
    ;(i.doc?.sections || []).forEach((s) => {
      s.rows.forEach((r) => {
        lines.push({
          Invoice: i.number, Section: s.kind, Heading: s.heading, Student: r.cells.name, Item: r.cells.item || r.cells.desc || r.cells.curriculum || '',
          Quantity: r.cells.days ?? r.cells.months ?? r.cells.weeks ?? '', Rate: r.cells.rate ?? '',
          'Row total': r.cells.total ?? '', 'Billed now': rowTotal(s, r),
        })
      })
    })
    ;(i.doc?.deductions || []).forEach((d) => {
      lines.push({ Invoice: i.number, Section: 'deduction', Heading: '', Student: '', Item: d.label, Quantity: '', Rate: '', 'Row total': -d.amount, 'Billed now': -d.amount })
    })
  })

  const invByIdNum = Object.fromEntries(invoices.map((i) => [i.id, i.number]))
  const pay = payments.map((p) => ({
    Receipt: p.receipt_number, Invoice: invByIdNum[p.invoice_id] || p.invoice_id, Student: p.student_names, Amount: Number(p.amount) || 0,
    'Paid on': p.paid_on, Method: p.method, Reference: p.reference || '', Note: p.note || '',
  }))

  const stu = students.map((s) => ({
    'Full name': s.full_name, Nickname: s.nickname, Level: s.level, Program: s.program, Family: famName(s.family_id),
    Legacy: s.legacy ? 'yes' : '', 'New student': s.is_new ? 'yes' : '', Active: s.active === false ? 'no' : 'yes', DOB: s.dob || '', Nationality: s.nationality || '', Notes: s.notes || '',
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inv), 'Invoices')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lines), 'Line items')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pay), 'Payments')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stu), 'Students')
  const d = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `PRA-invoices-${d}.xlsx`)
}

// Import students from a spreadsheet with columns like the school's roster
// ("Họ và tên", "Tên thường gọi", ...). Returns plain objects; caller saves.
export async function readRosterFile(file) {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  // find header row: the one containing a "name"-like column
  const norm = (s) => String(s || '').toLowerCase().trim()
  let hi = rows.findIndex((r) => r.some((c) => /họ và tên|full name|student/.test(norm(c))))
  if (hi < 0) hi = 0
  const header = rows[hi].map(norm)
  const col = (...alts) => header.findIndex((h) => alts.some((a) => h.includes(a)))
  const cName = col('họ và tên', 'full name', 'student'), cNick = col('thường gọi', 'nickname'), cLevel = col('level', 'khối', 'lớp', 'year'),
    cDob = col('ngày sinh', 'birth', 'dob'), cNat = col('quốc tịch', 'national')
  const out = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]
    const name = String(r[cName] || '').replace(/\s+/g, ' ').trim()
    if (!name || /^tổng/i.test(name)) continue
    out.push({
      full_name: name, nickname: String(r[cNick] || '').trim(), level: cLevel >= 0 ? String(r[cLevel] || '').trim() : '',
      dob: cDob >= 0 ? String(r[cDob] || '').trim() : '', nationality: cNat >= 0 ? String(r[cNat] || '').trim() : '',
    })
  }
  return out
}
