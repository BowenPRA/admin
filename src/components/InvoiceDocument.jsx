import { fmt, fmtSigned } from '../lib/money'
import { columnTotal, docTotals } from '../lib/pricing'

const FM_EN = [
  'In the event of force majeure occurrences, including but not limited to natural disasters such as storms, floods, earthquakes; global pandemics; fires, government mandates for academy closures, wars, strikes, riots, or any situations beyond the control of Palm River Academy, we will take all necessary measures to protect the health and safety of students and staff.',
  'Parents agree that in cases of force majeure, Palm River Academy reserves the right to temporarily close the center or transition to online learning. This is to ensure the continuity of the educational process in the safest possible conditions while maintaining the academy’s commitment to high educational standards.',
  'Furthermore, parents understand and accept that tuition and development fees already paid will not be refunded or reduced during the occurrence of force majeure events. These funds are essential for maintaining operational stability, retaining high-quality teaching staff on long-term contracts, and covering fixed salaries. By maintaining the agreed fees, Palm River Academy ensures that no additional required costs beyond the monthly tuition and development fees will be incurred during such periods.',
  'This clause does not apply to optional or third-party expenses, such as external examination fees (e.g., Cambridge Tests, GED) or off-campus activities, which are not included in the program fees and may still apply if the activity proceeds and parents choose to participate.',
  'Palm River Academy remains committed to using these funds efficiently to support ongoing educational delivery and protect the learning environment for all students.',
  'Palm River Academy is committed to promptly informing parents of any necessary changes related to teaching methods or other issues during force majeure occurrences. Communication will be conducted through email, and private group chat. The academy will also make every effort to minimize the negative impact on students\' learning experiences and ensure the continued delivery of quality education, whether through in-person or online platforms.',
  'The health and safety of students and staff will always be the top priority in such circumstances, and all decisions made will reflect this commitment.',
]
const FM_VI = [
  'Trong trường hợp xảy ra bất khả kháng, bao gồm nhưng không giới hạn ở các thảm họa thiên nhiên như bão, lũ lụt, động đất; đại dịch toàn cầu; hỏa hoạn, lệnh của chính phủ về việc đóng cửa cơ sở giáo dục, chiến tranh, đình công, bạo loạn hoặc bất kỳ nguyên nhân nào nằm ngoài tầm kiểm soát của Palm River Academy, chúng tôi sẽ thực hiện mọi biện pháp cần thiết để bảo vệ sức khỏe và sự an toàn của học sinh và nhân viên.',
  'Phụ huynh đồng ý rằng trong trường hợp bất khả kháng, Palm River Academy có quyền tạm thời đóng cửa trung tâm hoặc chuyển sang học trực tuyến. Điều này nhằm đảm bảo tính liên tục của quá trình giáo dục trong điều kiện an toàn nhất có thể, đồng thời duy trì cam kết của trung tâm về các tiêu chuẩn giáo dục cao.',
  'Ngoài ra, phụ huynh hiểu và chấp nhận rằng học phí và phí phát triển cơ sở đã đóng sẽ không được hoàn trả hoặc giảm trong thời gian xảy ra các sự kiện bất khả kháng. Các khoản phí này là cần thiết để duy trì sự ổn định trong vận hành, giữ chân đội ngũ giáo viên chất lượng cao với các hợp đồng dài hạn, và chi trả các khoản lương cố định. Việc giữ nguyên các mức phí đã thỏa thuận giúp Palm River Academy đảm bảo rằng sẽ không phát sinh thêm bất kỳ chi phí nào ngoài học phí hàng tháng và phí phát triển cơ sở trong thời gian này.',
  'Điều khoản này không áp dụng cho các khoản chi tùy chọn hoặc từ bên thứ ba, chẳng hạn như lệ phí thi bên ngoài (ví dụ: kỳ thi Cambridge, GED) hoặc các hoạt động ngoài khuôn viên, vốn không bao gồm trong học phí chương trình và có thể vẫn được thu nếu hoạt động diễn ra và phụ huynh chọn tham gia.',
  'Palm River Academy vẫn cam kết sử dụng hiệu quả các khoản tiền này để hỗ trợ việc cung cấp giáo dục đang diễn ra và bảo vệ môi trường học tập cho tất cả học sinh.',
  'Palm River Academy cam kết thông báo kịp thời cho phụ huynh về bất kỳ thay đổi cần thiết nào liên quan đến phương pháp giảng dạy hoặc các vấn đề khác trong trường hợp bất khả kháng. Việc trao đổi sẽ được thực hiện qua email và trò chuyện nhóm riêng. Trung tâm cũng sẽ nỗ lực hết sức để giảm thiểu tác động tiêu cực đến trải nghiệm học tập của học sinh và đảm bảo tiếp tục cung cấp giáo dục chất lượng, dù là thông qua nền tảng trực tiếp hay trực tuyến.',
  'Sức khỏe và sự an toàn của học sinh và nhân viên sẽ luôn là ưu tiên hàng đầu trong những trường hợp như vậy và mọi quyết định đưa ra sẽ phản ánh cam kết này.',
]

/**
 * Renders an invoice document exactly as it prints. Used by the editor
 * preview and the print route. `fees` supplies bank + school details.
 */
export default function InvoiceDocument({ doc, fees, number, issueDate }) {
  const vi = doc.lang === 'vi'
  const base = import.meta.env.BASE_URL
  const totals = docTotals(doc)
  const bank = fees.bank
  const school = fees.school
  const hasDeductions = doc.deductions?.length > 0

  return (
    <div className="page doc">
      {/* Header */}
      <div className="flex items-start justify-between">
        <img src={`${base}logo.png`} alt="Palm River Academy" style={{ height: '17mm' }} />
        <div className="text-right text-[9pt] italic leading-snug">
          <div>Email: {school.email}</div>
          <div>{vi ? 'Địa chỉ' : 'Address'}: {vi ? school.addressVi : school.addressEn}</div>
          {number && <div className="not-italic font-semibold">{vi ? 'Số' : 'No.'}: {number}{issueDate ? ` · ${issueDate}` : ''}</div>}
        </div>
      </div>

      <h1 className="mt-4 mb-4 text-center text-[14pt] font-black tracking-wide" style={{ color: '#6f9f2f' }}>
        {vi ? `THÔNG BÁO HỌC PHÍ NĂM HỌC ${doc.schoolYear}` : `${doc.schoolYear} FEES ANNOUNCEMENT`}
      </h1>

      {doc.sections.map((s) => {
        const moneyCols = s.columns.filter((c) => c.type === 'money')
        const firstMoneyIdx = s.columns.findIndex((c) => c.type === 'money')
        const textSpan = firstMoneyIdx < 0 ? s.columns.length : firstMoneyIdx
        return (
          <table key={s.id} className="mb-4">
            <thead>
              <tr><th colSpan={s.columns.length} className="sec-head">{s.heading}{s.subheading ? <div className="sec-sub">{s.subheading}</div> : null}</th></tr>
              <tr>{s.columns.map((c) => <th key={c.key} className={c.type === 'money' ? 'w-[22mm]' : ''}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {s.rows.map((r) => (
                <tr key={r.id}>
                  {s.columns.map((c) => {
                    const v = r.cells[c.key]
                    const billed = s.billedKeys.includes(c.key)
                    if (c.type === 'money') return <td key={c.key} className={`money ${billed ? 'billed' : ''}`}>{v === '' || v == null ? '' : fmt(v)}</td>
                    if (c.type === 'number') return <td key={c.key} className="num">{v ?? ''}</td>
                    return <td key={c.key} className="pre">{v ?? ''}</td>
                  })}
                </tr>
              ))}
              {s.rows.length > 1 && moneyCols.length > 0 && (
                <tr className="total-row">
                  <td colSpan={textSpan} className="text-center">{vi ? 'Tổng cộng' : 'Total'}</td>
                  {s.columns.slice(textSpan).map((c) => (
                    <td key={c.key} className={c.type === 'money' && c.key !== 'rate' ? `money ${s.billedKeys.includes(c.key) ? 'billed' : ''}` : ''}>{c.type === 'money' && c.key !== 'rate' ? fmt(columnTotal(s, c.key)) : ''}</td>
                  ))}
                </tr>
              )}
            </tbody>
            {s.note ? <tfoot><tr><td colSpan={s.columns.length} className="pre text-[9pt] italic">{s.note}</td></tr></tfoot> : null}
          </table>
        )
      })}

      {/* Summary */}
      <table className="mb-2">
        <thead>
          <tr><th colSpan={2} className="sec-head">{doc.summaryHeading}</th><th className="w-[30mm]">{vi ? 'Tổng' : 'Total'}</th></tr>
        </thead>
        <tbody>
          {totals.lines.map((l, i) => (
            <tr key={i}>
              {i === 0 && <td rowSpan={totals.lines.length + (hasDeductions ? doc.deductions.length + 2 : 1)} className="w-[38mm] text-center font-bold">{vi ? 'Tổng thanh toán' : 'Total payment'}</td>}
              <td>{l.label}</td><td className="money billed">{fmt(l.amount)}</td>
            </tr>
          ))}
          {hasDeductions ? (
            <>
              <tr className="total-row"><td className="text-right">{vi ? 'Tổng cộng' : 'Total'}</td><td className="money">{fmt(totals.subtotal)}</td></tr>
              {doc.deductions.map((d) => (
                <tr key={d.id}><td>{d.label}</td><td className="money">{fmtSigned(-d.amount)}</td></tr>
              ))}
              <tr className="total-row"><td className="grand text-right">{vi ? 'Số tiền còn lại' : 'The remaining total'}</td><td className="money grand">{fmt(totals.total)}</td></tr>
            </>
          ) : (
            <tr className="total-row"><td className="grand text-right">{vi ? 'Tổng cộng' : 'Total'}</td><td className="money grand">{fmt(totals.total)}</td></tr>
          )}
        </tbody>
      </table>
      <div className="text-[9pt]">{vi ? 'Tất cả các khoản phí tính bằng VNĐ.' : 'All fees are in VND.'}</div>

      {doc.notes?.length > 0 && (
        <div className="mt-2 text-[9.5pt] font-semibold">
          {doc.notes.map((n, i) => <div key={i} className="pre">{n}</div>)}
        </div>
      )}

      {/* Bank + QR */}
      {(doc.flags?.bank || doc.flags?.qr) && (
        <div className="mt-4 flex items-start gap-4">
          {doc.flags.bank && (
            <table className="flex-1 text-[9pt]">
              <tbody>
                <tr><td rowSpan={5} className="w-[26mm] text-center font-bold">{vi ? 'Tài khoản ngân hàng' : 'Bank Account'}</td><td className="w-[38mm] font-semibold">{vi ? 'Tên chủ tài khoản' : 'Account holder name'}</td><td>{bank.holder}</td></tr>
                <tr><td className="font-semibold">{vi ? 'Số tài khoản' : 'Account Number'}</td><td>{bank.number}</td></tr>
                <tr><td className="font-semibold">{vi ? 'Mã ngân hàng (BIC/SWIFT)' : 'Bank code (BIC/SWIFT)'}</td><td>{bank.swift}</td></tr>
                <tr><td className="font-semibold">{vi ? 'Chi nhánh ngân hàng' : 'Account Branch'}</td><td>{bank.branch}</td></tr>
                <tr><td className="font-semibold">{vi ? 'Địa chỉ chủ tài khoản' : 'Address of holder name'}</td><td>{vi ? bank.addressVi : bank.addressEn}</td></tr>
              </tbody>
            </table>
          )}
          {doc.flags.qr && <img src={`${base}vietqr.png`} alt="VietQR" style={{ width: '34mm' }} />}
        </div>
      )}

      <div className="mt-3 text-[9pt] font-bold text-red-600 underline">
        {vi ? 'Lưu ý: Phụ huynh chuyển tiền xong vui lòng chụp ảnh màn hình chuyển thành công gửi Palm River Academy để kiểm tra tài khoản.'
          : 'Note: Please send us the photo of the successful payment receipt for verification.'}
      </div>

      {doc.flags?.forceMajeure && (
        <div className="fm mt-4">
          <div className="mb-1 font-bold">{vi ? 'Điều khoản bất khả kháng' : 'Force Majeure Clause'}</div>
          {(vi ? FM_VI : FM_EN).map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}
    </div>
  )
}
