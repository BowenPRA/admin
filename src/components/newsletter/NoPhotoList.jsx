import { useEffect, useState } from 'react'
import { EyeOff } from 'lucide-react'
import { db } from '../../lib/db'
import { useData } from '../../lib/DataContext'
import { isEnrolled } from '../../lib/studentRecords'
import { photoSrc } from '../../lib/report/photo'
import { Avatar } from '../ui'
import { useL } from './bits'

let cache = null
/** Enrolled students whose enrollment form says photos are for private use only. */
async function privateIds() {
  cache ||= db.enrollments.list().then((rows) => new Set(rows.filter((e) => e.photo_consent === 'private' && e.student_id).map((e) => e.student_id))).catch(() => new Set())
  return cache
}

/**
 * The children whose photos must not go out, shown next to the photos being
 * checked. It comes from the enrollment forms in The Current, so a family who
 * said no on paper or by message may be missing: the note says so.
 */
export default function NoPhotoList({ compact = false }) {
  const { L } = useL()
  const { students } = useData()
  const [ids, setIds] = useState(null)
  useEffect(() => { privateIds().then(setIds) }, [])
  if (!ids) return null
  const list = students.filter((s) => ids.has(s.id) && isEnrolled(s)).sort((a, b) => String(a.class_group || a.level).localeCompare(String(b.class_group || b.level)))
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-red-800"><EyeOff size={15} />{L('The no-photo list', 'Danh sách không chụp ảnh')}{list.length ? ` · ${list.length}` : ''}</div>
      {list.length ? (
        <ul className={`flex flex-wrap gap-2 ${compact ? '' : 'mb-2'}`}>
          {list.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 text-xs shadow-sm">
              <Avatar src={photoSrc(s.photo)} name={s.nickname || s.full_name} size={compact ? 26 : 34} />
              <span><b className="text-slate-800">{s.nickname || s.full_name}</b> <span className="text-slate-500">{s.class_group || s.level}</span></span>
            </li>
          ))}
        </ul>
      ) : <p className="mb-2 text-xs text-red-800">{L('No enrolled child has "private use only" on their enrollment form.', 'Không học viên nào chọn "chỉ dùng nội bộ" trong phiếu đăng ký.')}</p>}
      {!compact && <p className="text-[11px] text-red-800/80">{L('From the enrollment forms in The Current. A family who said no on paper or by message may not be here: when unsure, ask the office.', 'Lấy từ phiếu đăng ký trong The Current. Gia đình từ chối bằng giấy hoặc qua tin nhắn có thể không có ở đây: nếu chưa chắc, hãy hỏi văn phòng.')}</p>}
    </div>
  )
}
