import { useState } from 'react'
import { DEVICES, booksFor, className, useL } from '../../lib/lessons'
import { useToast } from '../../lib/toast'
import { Field, Modal, TextArea, TextInput } from '../ui'

/**
 * About this class: what the builder should know, filled once by the class's teachers
 * (or the office) and shown inside every request for the class.
 */
export default function ClassProfileModal({ classKey, value, sources, canEdit, onClose, onSave }) {
  const { L, lang } = useL()
  const toast = useToast()
  const [p, setP] = useState(() => ({ ...(value?.profile || {}) }))
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setP((cur) => ({ ...cur, [k]: v }))
  const books = booksFor(classKey, sources)
  const ids = p.book_ids || []
  const toggleBook = (id) => setP((cur) => ({ ...cur, book_ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] }))

  const save = async (e) => {
    e?.preventDefault()
    setBusy(true)
    try {
      const profile = Object.fromEntries(Object.entries(p).filter(([, v]) => (Array.isArray(v) ? v.length : v !== '' && v != null)))
      if (await onSave({ class_key: classKey, profile })) onClose()
    } catch (err) { toast.error(err.message || String(err)) } finally { setBusy(false) }
  }

  const yesNo = (v) => setP((cur) => ({ ...cur, vietnamese_support: cur.vietnamese_support === v ? undefined : v }))
  return (
    <Modal open onClose={onClose} title={L('About this class', 'Về lớp này')} subtitle={className(classKey, lang)}
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose}>{canEdit ? L('Cancel', 'Hủy') : L('Close', 'Đóng')}</button>
        {canEdit && <button type="submit" form="class-profile" className="btn-primary" disabled={busy}>{busy ? L('Saving…', 'Đang lưu…') : L('Save', 'Lưu')}</button>}
      </>}>
      <form id="class-profile" onSubmit={save} className="space-y-4">
        <p className="text-sm text-slate-600">{L('Filled in once for the class. Every lesson made for it uses this.', 'Chỉ cần điền một lần cho lớp. Mọi bài giảng soạn cho lớp đều dùng thông tin này.')}</p>
        <fieldset disabled={!canEdit} className="space-y-4">
          <Field label={L('English level', 'Trình độ tiếng Anh')} hint={L('In your words, e.g. "most around A2, three beginners".', 'Ghi theo cách của thầy cô, ví dụ "phần lớn khoảng A2, ba em mới bắt đầu".')}>
            <TextInput value={p.english_level} onChange={set('english_level')} maxLength={200} />
          </Field>
          <div>
            <div className="label">{L('Vietnamese support on slides and sheets', 'Thêm tiếng Việt hỗ trợ trên slide và phiếu bài tập')}</div>
            <div className="seg" role="group">
              <button type="button" aria-pressed={p.vietnamese_support === true} onClick={() => yesNo(true)}>{L('Yes, where it helps', 'Có, khi cần')}</button>
              <button type="button" aria-pressed={p.vietnamese_support === false} onClick={() => yesNo(false)}>{L('No, English only', 'Không, chỉ tiếng Anh')}</button>
            </div>
          </div>
          <div>
            <div className="label">{L('Devices at home for online practice', 'Học viên có thiết bị ở nhà để luyện tập trực tuyến')}</div>
            <div className="seg" role="group">
              {DEVICES.map((d) => <button key={d.id} type="button" aria-pressed={p.devices_at_home === d.id} onClick={() => set('devices_at_home')(p.devices_at_home === d.id ? '' : d.id)}>{lang === 'vi' ? d.vi : d.en}</button>)}
            </div>
          </div>
          <Field label={L('Name to use in examples', 'Tên dùng trong ví dụ')} hint={L('How students call you, e.g. "Ms. Kiu". Used where the slides say who is talking.', 'Cách học viên gọi thầy cô, ví dụ "Ms. Kiu". Dùng trong slide khi cần tên giáo viên.')}>
            <TextInput value={p.example_name} onChange={set('example_name')} maxLength={60} />
          </Field>
          {books.length > 0 && (
            <div>
              <div className="label">{L('Books the class uses', 'Sách lớp đang dùng')}</div>
              <div className="space-y-1.5">
                {books.map((b) => (
                  <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-pra-blue" checked={ids.includes(b.id)} onChange={() => toggleBook(b.id)} />
                    <span>{b.title}{b.near && <span className="ml-1 text-xs text-slate-400">({b.year_group})</span>}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <Field label={L('Notes', 'Ghi chú')} hint={L('Anything that helps: how the class works best, routines, what they enjoy.', 'Những điều hữu ích: lớp học tốt nhất theo cách nào, nề nếp, các em thích gì.')}>
            <TextArea rows={3} value={p.notes} onChange={set('notes')} />
          </Field>
        </fieldset>
      </form>
    </Modal>
  )
}
