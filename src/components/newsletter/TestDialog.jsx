import { useState } from 'react'
import { LoaderCircle, MailCheck } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { sendTest } from '../../lib/newsletter/publish'
import { Modal, Segmented } from '../ui'

/**
 * Send a test of an issue to staff, at any stage (supabase/updates-2026-10-22-mail.sql,
 * adm_newsletter_send_test). With a schedule there is a choice: the scheduled email
 * exactly as it will go, or the issue as it is now. A note goes in a box at the top.
 */
export default function TestDialog({ issue, job = null, onClose, toast, L }) {
  const { me } = useAuth()
  const hasSchedule = !!job && ['waiting', 'ready', 'failed'].includes(job.status)
  const [version, setVersion] = useState(hasSchedule ? 'scheduled' : 'now')
  const [to, setTo] = useState(me?.email || '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setBusy(true)
    try {
      const row = await sendTest(issue, { jobId: version === 'scheduled' ? job.id : null, to: to.trim(), note: note.trim(), me })
      toast(L(`The test is on its way to ${row.to_addr}. It arrives within five minutes, with "[Test]" in front of the subject.`, `Email gửi thử đang đến ${row.to_addr}, trong vòng năm phút, tiêu đề có "[Test]" ở đầu.`))
      onClose()
    } catch (e) { toast.error(e.message || String(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={busy ? () => {} : onClose} title={L('Send a test', 'Gửi thử')}
      subtitle={L('Only staff get it. Families do not.', 'Chỉ nhân viên nhận được. Gia đình không nhận.')}
      footer={<>
        <button className="btn-secondary" disabled={busy} onClick={onClose}>{L('Cancel', 'Hủy')}</button>
        <button className="btn-primary" disabled={busy || !to.trim()} onClick={send}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <MailCheck size={16} />}{L('Send the test', 'Gửi thử')}</button>
      </>}>
      <div className="space-y-4 text-sm">
        {hasSchedule && (
          <div className="space-y-1.5">
            <Segmented value={version} onChange={setVersion} options={[
              { value: 'scheduled', label: L('The scheduled email', 'Email đã hẹn giờ') },
              { value: 'now', label: L('The issue as it is now', 'Số báo hiện tại') },
            ]} />
            <p className="text-xs text-slate-500">{version === 'scheduled'
              ? L('Exactly what families will get, with both PDFs.', 'Đúng như gia đình sẽ nhận, kèm hai file PDF.')
              : L('With the changes made since it was scheduled. No PDFs.', 'Có cả những chỗ đã sửa sau khi hẹn giờ. Không kèm PDF.')}</p>
          </div>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">{L('Send it to', 'Gửi đến')}</span>
          <input className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          <span className="mt-1 block text-xs text-slate-500">{L('You, or other staff: up to six addresses, separated by commas, all @pra.edu.vn or @palmriveracademy.edu.vn.', 'Bạn, hoặc nhân viên khác: tối đa sáu địa chỉ, cách nhau bằng dấu phẩy, đều là @pra.edu.vn hoặc @palmriveracademy.edu.vn.')}</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">{L('A note for the reader (optional)', 'Ghi chú cho người đọc (không bắt buộc)')}</span>
          <textarea className="input" rows={3} value={note} placeholder={L('For example: check the Vietnamese in the Kindergarten section.', 'Ví dụ: kiểm tra phần tiếng Việt ở mục Kindergarten.')} onChange={(e) => setNote(e.target.value)} />
          <span className="mt-1 block text-xs text-slate-500">{L('It shows in a yellow box at the top, with your name and "Families have not received this".', 'Ghi chú hiện trong ô màu vàng ở đầu email, kèm tên bạn và dòng "Families have not received this" (gia đình chưa nhận email này).')}</span>
        </label>
        {version === 'now' && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{L('The photos show for a week. The PDFs are attached once the issue is scheduled, and the links to the website page work once it is on the website.', 'Ảnh hiển thị trong một tuần. PDF được đính kèm khi số báo đã hẹn giờ, và đường link đến trang web chỉ mở được khi số báo đã lên web.')}</p>
        )}
      </div>
    </Modal>
  )
}
