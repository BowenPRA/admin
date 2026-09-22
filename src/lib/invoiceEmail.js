import { fmt, fmtDate } from './money'
import { docTotals } from './pricing'
import { SENDER } from './gmail'
import { centerName } from './invoicePdfLayout'

export function invoiceFilename(inv) {
  const who = String(inv.student_names || '').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, '-')
  return `${inv.number}-${who}.pdf`
}

/** Default subject + body for emailing an invoice, in the invoice's language. */
export function emailTemplate(inv, fees) {
  const vi = inv.lang === 'vi'
  const total = docTotals(inv.doc).total
  const period = inv.period_label
  const due = fmtDate(inv.due_date, inv.lang)
  const b = fees.bank
  const subject = vi
    ? `Palm River Academy – Thông báo học phí ${period}, năm học ${inv.school_year} (${inv.student_names})`
    : `Palm River Academy – Fee announcement for ${period}, academic year ${inv.school_year} (${inv.student_names})`
  const text = vi
    ? `Kính gửi Quý phụ huynh,

Palm River Academy xin gửi thông báo học phí ${period}, năm học ${inv.school_year} cho ${inv.student_names} (đính kèm file PDF).

Tổng thanh toán: ${fmt(total)} VNĐ
Hạn thanh toán: ${due}
Số hoá đơn: ${inv.number}

Thông tin chuyển khoản:
  Tên chủ tài khoản: ${b.holder}
  Số tài khoản: ${b.number}
  Ngân hàng: ${b.branch} (SWIFT: ${b.swift})

Phụ huynh chuyển tiền xong vui lòng chụp ảnh màn hình giao dịch thành công gửi lại cho trung tâm để đối chiếu.

Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ ${SENDER}.

Trân trọng,
${centerName(fees.school, true)}`
    : `Dear Parents,

Please find attached the fee announcement for ${period}, academic year ${inv.school_year}, for ${inv.student_names}.

Total payment: ${fmt(total)} VND
Due date: ${due}
Invoice number: ${inv.number}

Bank transfer details:
  Account holder: ${b.holder}
  Account number: ${b.number}
  Bank: ${b.branch} (SWIFT: ${b.swift})

After transferring, please send us a screenshot of the successful payment so we can verify it.

If you have any questions, just reply to this email or write to ${SENDER}.

Kind regards,
${centerName(fees.school, false)}`
  return { subject, text }
}
