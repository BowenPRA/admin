import { fmt, fmtDate } from './money'
import { docTotals } from './pricing'
import { centerName } from './invoicePdfLayout'

export function invoiceFilename(inv) {
  const who = String(inv.student_names || '').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, '-')
  return `${inv.number}-${who}.pdf`
}

/**
 * Default subject + body for emailing an invoice, in the invoice's language.
 * Follows what the office actually sent for Quarters 1 and 2 of 2026-2027:
 * no "Palm River Academy –" at the start of the subject, the names after a
 * dash, no invoice number line (it is on the PDF and in the file name) and
 * no "any questions" line.
 */
export function emailTemplate(inv, fees) {
  const vi = inv.lang === 'vi'
  const total = docTotals(inv.doc).total
  const period = inv.period_label
  const due = fmtDate(inv.due_date, inv.lang)
  const b = fees.bank
  const subject = vi
    ? `Thông báo học phí ${period}, năm học ${inv.school_year} - ${inv.student_names}`
    : `Fee announcement for ${period}, academic year ${inv.school_year} - ${inv.student_names}`
  const text = vi
    ? `Kính gửi Quý phụ huynh,

Palm River Academy xin gửi thông báo học phí ${period}, năm học ${inv.school_year} cho ${inv.student_names} (đính kèm file PDF).

Tổng thanh toán: ${fmt(total)} VNĐ
Hạn thanh toán: ${due}

Thông tin chuyển khoản:
  Tên chủ tài khoản: ${b.holder}
  Số tài khoản: ${b.number}
  Ngân hàng: ${b.branch} (SWIFT: ${b.swift})

Phụ huynh chuyển tiền xong vui lòng chụp ảnh màn hình giao dịch thành công gửi lại cho trung tâm để đối chiếu.

Trân trọng,
${centerName(fees.school, true)}`
    : `Dear Parents,

Please find attached the fee announcement for ${period}, academic year ${inv.school_year}, for ${inv.student_names}.

Total payment: ${fmt(total)} VND
Due date: ${due}

Bank transfer details:
  Account holder: ${b.holder}
  Account number: ${b.number}
  Bank: ${b.branch} (SWIFT: ${b.swift})

After transferring, please send us a screenshot of the successful payment so we can verify it.

Kind regards,
${centerName(fees.school, false)}`
  return { subject, text }
}
