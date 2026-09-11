import { fmt, amountWordsEn, amountWordsVi, fmtDateLong } from '../lib/money'

/** Bilingual cash receipt (Phiếu thu), matching the school's existing form. */
export default function ReceiptDocument({ payment, fees }) {
  const base = import.meta.env.BASE_URL
  const school = fees.school
  const r = payment.receipt || {}
  return (
    <div className="page doc" style={{ minHeight: '148mm' }}>
      <div className="flex items-start gap-8">
        <img src={`${base}logo.png`} alt="Palm River Academy" style={{ height: '18mm' }} />
        <div className="text-[10pt] leading-snug">
          <div className="italic">{school.legalName}</div>
          <div className="italic">MST: {school.taxCode}</div>
          <div className="font-bold" style={{ color: '#1a7bc4' }}>Email: {school.email}</div>
        </div>
      </div>

      <h1 className="mt-5 text-center text-[15pt] font-black">RECEIPT/ PHIẾU THU</h1>
      <div className="mb-5 text-center text-[9.5pt]">{fmtDateLong(payment.paid_on, 'vi')}</div>
      {payment.receipt_number && <div className="mb-3 text-right text-[9pt]">Số / No.: <b>{payment.receipt_number}</b></div>}

      <table className="border-0 text-[10.5pt]" style={{ borderCollapse: 'separate', borderSpacing: '0 3px' }}>
        <tbody>
          {[
            ["Student's name/ Tên học sinh:", r.student || payment.student_names],
            ['Address/ Địa chỉ:', r.address || school.receiptAddress],
            ['For/ Nội dung:', <><div>{r.forVi}</div><div>{r.forEn}</div></>],
            ['Amount/ Số tiền:', `${fmt(payment.amount)} VND`],
            ['In words/ Bằng chữ:', <><div>{amountWordsVi(payment.amount)}</div><div>{amountWordsEn(payment.amount)}</div></>],
          ].map(([k, v], i) => (
            <tr key={i}><td className="w-[52mm] border-0 p-0 pr-4 align-top">{k}</td><td className="border-0 p-0 align-top">{v}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 text-[10pt] font-bold">This payment is non-refundable/ Đây là thanh toán không hoàn lại</div>

      <div className="mt-8 grid grid-cols-3 text-center text-[10pt]">
        <div><div>Chief accountant</div><div className="text-[9pt]">( Sign, full name)</div><div className="mt-14">{r.accountant || ''}</div></div>
        <div><div>Cashier</div><div className="text-[9pt]">( Sign, full name)</div><div className="mt-14">{r.cashier || ''}</div></div>
        <div><div>Payer</div><div className="text-[9pt]">( Sign, full name)</div><div className="mt-14">{r.payer || ''}</div></div>
      </div>
    </div>
  )
}
