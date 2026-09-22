// Layout of the fee announcement PDF as a pdfmake document definition.
// Pure (no browser APIs), so it can be tried out in Node. `invoicePdf.js`
// loads pdfmake + images and picks the largest size that fits one A4 page.

import { fmt, fmtSigned } from './money.js'
import { columnTotal, docTotals } from './pricing.js'
import { FORCE_MAJEURE } from './forceMajeure.js'

// Sacombank · CN CTY TNHH PALM RIVER TAI HOI AN · 040103245445.
// Decoded from the office's VietQR image (public/vietqr.png); CRC checked.
export const VIETQR_PAYLOAD = '00020101021138560010A0000007270126000697040301120401032454450208QRIBFTTA53037045802VN6304C3D9'

const C = {
  navy: '#163a63', blue: '#1a7bc4', green: '#6f9f2f', ink: '#1b2430', muted: '#5f6b7a',
  line: '#d7dee7', soft: '#f3f6fa', head: '#e9f0f8', billed: '#dfeaf8', red: '#c62828', fm: '#4b5563',
}

// PRA is an English language center, never a "school", on anything parents see.
export const centerName = (school, vi) =>
  (vi ? school?.nameVi : school?.nameEn) || (vi ? 'Trung tâm Anh ngữ Palm River Academy' : 'Palm River Academy English Language Center')

const PAGE_W = 595.28
const MARGIN_X = 34
const MARGIN_TOP = 26

// Everything is sized by a scale k (1 = roomy); a long invoice is shrunk
// until it fits one page. The force majeure text shrinks more gently.
const MIN_K = 0.6
const MAX_K = 1.1
const fmSize = (k) => 5 + (Math.max(MIN_K, Math.min(1, k)) - MIN_K) * 3.75

// Rough Roboto advance widths (em), for sizing columns.
function textWidth(s, size) {
  let w = 0
  for (const ch of String(s)) {
    w += /\d/.test(ch) ? 0.562 : ch === ',' || ch === '.' ? 0.2 : ch === ' ' ? 0.25 : ch === '-' ? 0.33
      : ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? 0.66 : 0.52
  }
  return w * size
}
const longestLine = (text, size) => Math.max(0, ...String(text ?? '').split(/\n/).map((l) => textWidth(l, size)))

/**
 * @param {object} p
 * @param {object} p.doc      invoice document (pricing.buildDocument)
 * @param {object} p.fees     fee settings (bank + school details)
 * @param {string} [p.number] invoice number
 * @param {string} [p.issueDate] formatted issue date
 * @param {string} [p.dueDate]   formatted due date (red bar under the total)
 * @param {string} [p.students] student names for the header
 * @param {object} p.images   { logo, vietqr, brands } as data URLs (any may be missing)
 * @param {number} [p.k]     size scale
 * @param {number} [p.fill]  extra space above the force majeure clause, to pin it to the foot of the page
 * @param {object} [p.probe] filled in during layout: { pages, endTop, bottom }
 */
export function invoicePdfDefinition({ doc, fees, number, issueDate, dueDate, students, images = {}, k = 1, fill = 0, probe = {} }) {
  const vi = doc.lang === 'vi'
  const W = PAGE_W - MARGIN_X * 2
  const totals = docTotals(doc)
  const bank = fees.bank
  const school = fees.school
  const gap = 10 * k
  const pad = { x: 5 * k, y: 3.1 * k }
  const has = (name) => typeof images[name] === 'string' && images[name].startsWith('data:')

  // ---------- Header ----------
  const header = {
    columns: [
      has('logo') ? { image: 'logo', width: 122 * k } : { text: 'PALM RIVER ACADEMY', bold: true, color: C.navy, fontSize: 16 * k, width: 'auto' },
      {
        width: '*',
        alignment: 'right',
        stack: [
          { text: vi ? 'THÔNG BÁO HỌC PHÍ' : 'FEES ANNOUNCEMENT', fontSize: 18 * k, bold: true, color: C.navy, characterSpacing: 0.8 * k },
          { text: vi ? `Năm học ${doc.schoolYear}` : `Academic year ${doc.schoolYear}`, fontSize: 9.5 * k, bold: true, color: C.green, margin: [0, 1 * k, 0, 3 * k] },
          { text: centerName(school, vi), fontSize: 7.6 * k, bold: true, color: C.navy },
          { text: school.email, fontSize: 7.2 * k, color: C.muted },
          { text: vi ? school.addressVi : school.addressEn, fontSize: 7.2 * k, color: C.muted },
        ],
      },
    ],
    columnGap: 12,
  }

  const accent = {
    canvas: [
      { type: 'rect', x: 0, y: 0, w: W * 0.74, h: 2.4 * k, color: C.blue },
      { type: 'rect', x: W * 0.74 + 2, y: 0, w: W * 0.26 - 2, h: 2.4 * k, color: C.green },
    ],
    margin: [0, 7 * k, 0, 7 * k],
  }

  const metaCell = (label, value, opts = {}) => ({
    stack: [
      { text: label.toUpperCase(), fontSize: 6.2 * k, bold: true, color: C.muted, characterSpacing: 0.4 * k },
      { text: value || '—', fontSize: (opts.big ? 10.5 : 8.8) * k, bold: true, color: opts.color || C.ink, margin: [0, 1 * k, 0, 0] },
    ],
    alignment: opts.right ? 'right' : 'left',
  })
  const metaItems = [
    number && [metaCell(vi ? 'Số' : 'Invoice no.', number), 'auto'],
    issueDate && [metaCell(vi ? 'Ngày' : 'Date', issueDate), 'auto'],
    students && [metaCell(vi ? 'Học sinh' : 'Student(s)', students), '*'],
    [metaCell(vi ? 'Tổng thanh toán (VNĐ)' : 'Total due (VND)', fmt(totals.total), { big: true, color: C.green, right: true }), 'auto'],
  ].filter(Boolean)
  const meta = {
    table: { widths: metaItems.map((m) => m[1]), body: [metaItems.map((m) => m[0])] },
    layout: {
      hLineWidth: () => 0, vLineWidth: (i, node) => (i > 0 && i < node.table.widths.length ? 0.6 : 0), vLineColor: () => C.line,
      fillColor: () => C.soft, paddingLeft: () => 9 * k, paddingRight: () => 9 * k, paddingTop: () => 5 * k, paddingBottom: () => 5 * k,
    },
    margin: [0, 0, 0, gap + 2 * k],
  }

  // ---------- Fee sections ----------
  let legendShown = false
  const sectionBlock = (s) => {
    const cols = s.columns
    const bodySize = 8 * k
    const headSize = 6.9 * k
    const firstMoney = cols.findIndex((c) => c.type !== 'text')
    const textSpan = firstMoney < 0 ? cols.length : firstMoney
    const moneyCols = cols.filter((c) => c.type === 'money')
    const showTotal = s.rows.length > 1 && moneyCols.length > 0 && textSpan > 0
    const few = cols.length <= 4

    // Wide enough for the amounts and for the longest word of the heading.
    const widths = cols.map((c) => {
      if (c.type === 'text') return '*'
      const word = Math.max(...String(c.label).split(/\s+/).map((w) => textWidth(w, headSize) * 1.08))
      if (c.type === 'number') return Math.max(word, (few ? 54 : 40) * k) + pad.x * 2
      const values = s.rows.map((r) => (r.cells[c.key] === '' || r.cells[c.key] == null ? '' : fmt(r.cells[c.key])))
      if (showTotal && c.key !== 'rate') values.push(fmt(columnTotal(s, c.key)))
      const longest = Math.max(...values.map((v) => textWidth(v, bodySize) * 1.04), word, 30 * k)
      return Math.max(longest + pad.x * 2 + 1, (few ? 76 : 50) * k)
    })
    // Names and curricula need room too: note when their lines would have to wrap.
    const room = W - widths.reduce((a, w) => a + (typeof w === 'number' ? w : 0), 0)
    const textNeed = cols.filter((c) => c.type === 'text')
      .reduce((a, c) => a + Math.min(130 * k, Math.max(...s.rows.map((r) => longestLine(r.cells[c.key], bodySize)), 0)) + pad.x * 2, 0)
    if (textNeed > room) probe.squeezed = true

    const billed = (c) => s.billedKeys.includes(c.key)
    const align = (c) => (c.type === 'money' ? 'right' : c.type === 'number' ? 'center' : 'left')
    const kinds = ['head']
    const body = [cols.map((c) => ({
      text: c.label, fontSize: headSize, bold: true, color: C.navy, alignment: align(c),
      fillColor: billed(c) ? C.billed : C.head, lineHeight: 1.05,
    }))]
    s.rows.forEach((r, i) => {
      // Upper Secondary students have a second row (online fee) with no name: keep it visually joined.
      kinds.push(i > 0 && 'name' in r.cells && !r.cells.name ? 'cont' : 'row')
      body.push(cols.map((c) => {
        const v = r.cells[c.key]
        const text = c.type === 'money' ? (v === '' || v == null ? '' : fmt(v)) : String(v ?? '')
        return { text, fontSize: bodySize, alignment: align(c), bold: billed(c), color: C.ink, fillColor: billed(c) ? C.billed : null }
      }))
    })
    if (showTotal) {
      kinds.push('total')
      body.push(cols.map((c, i) => {
        if (i === 0) return { text: vi ? 'Tổng cộng' : 'Total', colSpan: textSpan, bold: true, fontSize: bodySize, color: C.navy, fillColor: C.soft }
        if (i < textSpan) return {}
        const show = c.type === 'money' && c.key !== 'rate'
        return { text: show ? fmt(columnTotal(s, c.key)) : '', alignment: 'right', bold: true, fontSize: bodySize, color: C.navy, fillColor: billed(c) ? C.billed : C.soft }
      }))
    }

    const table = {
      table: { headerRows: 1, widths, body, dontBreakRows: true },
      layout: {
        hLineWidth: (i) => {
          if (i === 0) return 0
          if (i === 1) return 0.9
          if (i === body.length) return 0.9
          if (kinds[i] === 'cont') return 0
          return kinds[i] === 'total' ? 0.7 : 0.4
        },
        hLineColor: (i) => (i === 1 || i === body.length || kinds[i] === 'total' ? C.navy : C.line),
        vLineWidth: () => 0,
        paddingLeft: () => pad.x, paddingRight: () => pad.x,
        paddingTop: (i) => (i === 0 ? pad.y + 0.6 * k : pad.y), paddingBottom: (i) => (i === 0 ? pad.y + 0.6 * k : pad.y),
      },
    }

    const title = {
      text: [
        { text: s.heading, bold: true, color: C.blue, fontSize: 9 * k, characterSpacing: 0.2 * k },
        s.subheading ? { text: `   ${s.subheading}`, italics: true, color: C.muted, fontSize: 7.6 * k } : '',
      ],
      margin: [0, 0, 0, 3.5 * k],
    }
    const extra = []
    const partBilled = moneyCols.filter((c) => c.key !== 'rate').length > s.billedKeys.length && s.billedKeys.length > 0
    if (partBilled && !legendShown) {
      legendShown = true
      extra.push({
        columns: [
          { canvas: [{ type: 'rect', x: 0, y: 1.2 * k, w: 7 * k, h: 5.5 * k, color: C.billed, lineColor: C.blue, lineWidth: 0.4 }], width: 11 * k },
          { text: vi ? 'Các khoản được tô màu là số tiền cần thanh toán trong đợt này.' : 'Highlighted amounts are the ones due in this payment.', fontSize: 6.8 * k, color: C.muted, italics: true },
        ],
        margin: [0, 3 * k, 0, 0],
      })
    }
    if (s.note) extra.push({ text: s.note, fontSize: 7.2 * k, italics: true, color: C.muted, margin: [0, 3 * k, 0, 0] })

    return { stack: [title, table, ...extra], unbreakable: true, margin: [0, 0, 0, gap] }
  }

  // ---------- Summary ----------
  const hasDeductions = doc.deductions?.length > 0
  const sumRow = (label, amount, opts = {}) => [
    { text: label, fontSize: 8.3 * k, color: opts.color || C.ink, bold: !!opts.bold },
    { text: amount, fontSize: 8.3 * k, alignment: 'right', color: opts.color || C.ink, bold: !!opts.bold },
  ]
  const sumBody = totals.lines.map((l) => sumRow(l.label, fmt(l.amount)))
  const sumKinds = totals.lines.map(() => 'row')
  if (hasDeductions) {
    sumBody.push(sumRow(vi ? 'Tổng cộng' : 'Subtotal', fmt(totals.subtotal), { bold: true })); sumKinds.push('sub')
    doc.deductions.forEach((d) => { sumBody.push(sumRow(d.label, fmtSigned(-d.amount), { color: C.red })); sumKinds.push('row') })
  }
  sumBody.push([
    {
      colSpan: 2, fillColor: C.green,
      columns: [
        { text: hasDeductions ? (vi ? 'SỐ TIỀN CÒN LẠI (VNĐ)' : 'REMAINING TOTAL (VND)') : (vi ? 'TỔNG CỘNG (VNĐ)' : 'TOTAL (VND)'), bold: true, color: 'white', fontSize: 9 * k, margin: [0, 2.6 * k, 0, 0] },
        { text: fmt(totals.total), bold: true, color: 'white', fontSize: 12.5 * k, alignment: 'right', width: 'auto' },
      ],
    },
    {},
  ])
  sumKinds.push('grand')
  // Red bar right under the total: the date the payment has to be with us.
  if (dueDate) {
    sumBody.push([
      {
        colSpan: 2, fillColor: C.red,
        columns: [
          { text: vi ? 'HẠN THANH TOÁN' : 'PAYMENT DUE BY', bold: true, color: 'white', fontSize: 8 * k, margin: [0, 1.6 * k, 0, 0] },
          { text: dueDate, bold: true, color: 'white', fontSize: 10.5 * k, alignment: 'right', width: 'auto' },
        ],
      },
      {},
    ])
    sumKinds.push('due')
  }

  const summary = {
    stack: [
      { text: doc.summaryHeading, bold: true, color: C.blue, fontSize: 9 * Math.min(k, 1), characterSpacing: 0.2 * k, margin: [0, 0, 0, 3.5 * k] },
      {
        table: { widths: ['*', 'auto'], body: sumBody },
        layout: {
          hLineWidth: (i) => (i === 0 ? 0.9 : i >= sumBody.length ? 0 : sumKinds[i] === 'due' ? 0 : sumKinds[i] === 'sub' ? 0.7 : 0.4),
          hLineColor: (i) => (i === 0 || sumKinds[i] === 'sub' ? C.navy : C.line),
          vLineWidth: () => 0,
          paddingLeft: () => 6 * k, paddingRight: () => 6 * k,
          paddingTop: (i) => (sumKinds[i] === 'grand' ? 5 * k : sumKinds[i] === 'due' ? 4 * k : 3.2 * k),
          paddingBottom: (i) => (sumKinds[i] === 'grand' ? 5 * k : sumKinds[i] === 'due' ? 4 * k : 3.2 * k),
        },
      },
      { text: vi ? 'Tất cả các khoản phí tính bằng VNĐ.' : 'All fees are in VND.', fontSize: 6.8 * k, color: C.muted, margin: [0, 3 * k, 0, 0] },
      ...(doc.notes || []).filter(Boolean).map((n) => ({ text: n, fontSize: 8 * k, bold: true, color: C.ink, margin: [0, 4 * k, 0, 0] })),
    ],
  }

  // ---------- Bank transfer ----------
  const showBank = !!doc.flags?.bank
  const showQr = !!doc.flags?.qr
  let payment = null
  if (showBank || showQr) {
    const field = (label, value, opts = {}) => ({
      stack: [
        { text: label.toUpperCase(), fontSize: 5.9 * k, bold: true, color: C.muted, characterSpacing: 0.3 * k },
        { text: value || '—', fontSize: (opts.big ? 10 : 7.7) * k, bold: !!opts.big, color: C.ink, characterSpacing: opts.big ? 0.4 * k : 0 },
      ],
      margin: [0, 0, 0, 3.6 * k],
    })
    const details = showBank ? {
      width: '*',
      stack: [
        field(vi ? 'Tên chủ tài khoản' : 'Account holder', String(bank.holder || '').toUpperCase()),
        field(vi ? 'Số tài khoản' : 'Account number', bank.number, { big: true }),
        field(vi ? 'Ngân hàng · Chi nhánh' : 'Bank · Branch', bank.branch),
        field(vi ? 'Mã ngân hàng (BIC/SWIFT)' : 'Bank code (BIC/SWIFT)', bank.swift),
        field(vi ? 'Địa chỉ chủ tài khoản' : 'Address of account holder', vi ? bank.addressVi : bank.addressEn),
      ],
    } : null
    const qrSize = Math.max(80, 92 * k)
    const qr = showQr ? {
      width: qrSize + 8 * k,
      stack: [
        has('vietqr') ? { image: 'vietqr', width: 50 * k, alignment: 'center', margin: [0, 0, 0, 5 * k] } : { text: 'VietQR', bold: true, alignment: 'center', color: C.red, fontSize: 9 * k },
        { qr: VIETQR_PAYLOAD, fit: qrSize, eccLevel: 'M', alignment: 'center' },
        has('brands') ? { image: 'brands', width: 82 * k, alignment: 'center', margin: [0, 3 * k, 0, 0] } : null,
        { text: vi ? 'Quét mã để chuyển khoản' : 'Scan to pay', fontSize: 6.4 * k, color: C.muted, alignment: 'center', margin: [0, 2 * k, 0, 0] },
      ].filter(Boolean),
    } : null

    payment = {
      stack: [
        { text: vi ? 'THÔNG TIN CHUYỂN KHOẢN' : 'PAY BY BANK TRANSFER', bold: true, color: C.blue, fontSize: 9 * k, characterSpacing: 0.2 * k, margin: [0, 0, 0, 3.5 * k] },
        {
          table: {
            widths: ['*'],
            body: [[{ columns: [details, qr].filter(Boolean), columnGap: 8 * k }]],
          },
          layout: {
            hLineWidth: (i) => (i === 0 ? 0.9 : 0.6), hLineColor: (i) => (i === 0 ? C.navy : C.line), vLineWidth: () => 0,
            fillColor: () => C.soft, paddingLeft: () => 8 * k, paddingRight: () => 8 * k, paddingTop: () => 7 * k, paddingBottom: () => 4 * k,
          },
        },
        {
          text: vi ? 'Lưu ý: Phụ huynh chuyển tiền xong vui lòng chụp ảnh màn hình chuyển thành công gửi Palm River Academy để kiểm tra tài khoản.'
            : 'Note: Please send us the photo of the successful payment receipt for verification.',
          fontSize: 7.2 * k, bold: true, color: C.red, margin: [0, 4 * k, 0, 0],
        },
      ],
    }
  }

  const payW = showQr ? Math.min(262, Math.max(262 * k, 100 + 150 * k)) : Math.min(220, 210 * k)
  if (payment && showBank && textWidth(String(bank.holder || '').toUpperCase(), 7.7 * k) > payW - 16 * k - (showQr ? Math.max(80, 92 * k) + 16 * k : 0)) probe.squeezed = true
  const bottom = payment
    ? { columns: [{ width: '*', ...summary }, { width: payW, ...payment }], columnGap: 16 * k, unbreakable: true, margin: [0, 2 * k, 0, gap] }
    : { columns: [{ width: '*', text: '' }, { width: W * 0.55, ...summary }], unbreakable: true, margin: [0, 2 * k, 0, gap] }

  // ---------- Force majeure (two balanced columns) ----------
  let fm = null
  if (doc.flags?.forceMajeure) {
    const paras = FORCE_MAJEURE[vi ? 'vi' : 'en']
    const total = paras.reduce((s, p) => s + p.length, 0)
    let acc = 0
    let split = paras.length
    for (let i = 0; i < paras.length; i++) {
      if (acc + paras[i].length / 2 > total / 2) { split = i; break }
      acc += paras[i].length
    }
    // Non-breaking hyphens: justified text would otherwise show "third- party".
    const para = (p) => ({ text: p.replace(/(\w)-(\w)/g, '$1\u2011$2'), margin: [0, 0, 0, 2.6 * k] })
    fm = {
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: W, y2: 0, lineWidth: 0.5, lineColor: C.line }], margin: [0, fill, 0, 5 * k] },
        { text: vi ? 'ĐIỀU KHOẢN BẤT KHẢ KHÁNG' : 'FORCE MAJEURE CLAUSE', bold: true, color: C.navy, fontSize: 7 * k, characterSpacing: 0.4 * k, margin: [0, 0, 0, 3 * k] },
        {
          columns: [{ width: '*', stack: paras.slice(0, split).map(para) }, { width: '*', stack: paras.slice(split).map(para) }],
          columnGap: 14 * k, fontSize: fmSize(k), lineHeight: 1.12, color: C.fm, alignment: 'justify',
        },
      ],
      unbreakable: true,
    }
  }

  return {
    pageSize: 'A4',
    pageMargins: [MARGIN_X, MARGIN_TOP, MARGIN_X, 24],
    info: {
      title: [vi ? 'Thông báo học phí' : 'Fees announcement', number, students].filter(Boolean).join(' · '),
      author: 'Palm River Academy',
    },
    defaultStyle: { font: 'Roboto', fontSize: 8 * k, color: C.ink, lineHeight: 1.15 },
    images: Object.fromEntries(Object.entries(images).filter(([, v]) => typeof v === 'string' && v.startsWith('data:'))),
    // `end` marks where the content stops, so free space can go above the clause.
    content: [header, accent, meta, ...doc.sections.map(sectionBlock), bottom, fm, { text: '\u00a0', id: 'end', fontSize: 1, lineHeight: 1 }].filter(Boolean),
    pageBreakBefore: (node) => {
      if (node.id === 'end' && node.startPosition) {
        probe.endTop = node.startPosition.top
        probe.bottom = MARGIN_TOP + node.startPosition.pageInnerHeight
      }
      return false
    },
    footer: (page, pageCount) => {
      probe.pages = pageCount
      return {
        columns: [
          { text: `${centerName(school, vi)} · ${school.email}`, width: '*' },
          { text: [number, pageCount > 1 ? `${page}/${pageCount}` : ''].filter(Boolean).join('  ·  '), width: 'auto', alignment: 'right' },
        ],
        fontSize: 6.2, color: '#94a3b8', margin: [MARGIN_X, 6, MARGIN_X, 0],
      }
    },
  }
}

/**
 * Lays the invoice out at the largest size that fits one A4 page, with the
 * force majeure clause at the foot of the page. `pdfMake` is the browser or
 * Node pdfmake instance with Roboto loaded. Returns pdfmake's output document.
 */
export async function fitInvoicePdf(pdfMake, params) {
  const run = async (k, fill = 0) => {
    const probe = {}
    const out = pdfMake.createPdf(invoicePdfDefinition({ ...params, k, fill, probe }))
    await out.getStream()
    return { out, probe, k }
  }
  const fits = (r) => r.probe.pages <= 1 && !(r.k > 1 && r.probe.squeezed)
  // Largest k in [lo, hi] that still fits, given `fit` already fits at lo.
  const search = async (lo, hi, fit, steps) => {
    for (let i = 0; i < steps; i++) {
      const mid = (lo + hi) / 2
      const r = await run(mid)
      if (fits(r)) { fit = r; lo = mid } else hi = mid
    }
    return fit
  }
  let best = await run(1)
  if (best.probe.pages > 1) {
    best = (await search(MIN_K, 1, null, 6)) || await run(MIN_K)
  } else if (best.probe.bottom - best.probe.endTop > 60) {
    // Short invoice: use the room for slightly larger text.
    const big = await run(MAX_K)
    best = fits(big) ? big : await search(1, MAX_K, best, 3)
  }
  if (best.probe.pages <= 1 && params.doc.flags?.forceMajeure && best.probe.endTop) {
    const free = best.probe.bottom - best.probe.endTop - 6
    if (free > 8) {
      const r = await run(best.k, free)
      if (r.probe.pages <= 1) best = r
    }
  }
  return best.out
}
