import { useEffect, useState } from 'react'
import { ExternalLink, ListChecks, MonitorPlay, Users } from 'lucide-react'
import { fmtDay } from '../../lib/leads'
import { useL } from '../../lib/lessons'
import { classLink, hasLearnParts, learnError, notSetUp, requestResults } from '../../lib/learn'

const PART = { review: { icon: ListChecks, en: 'Guided review', vi: 'Ôn tập có hướng dẫn' }, practice: { icon: MonitorPlay, en: 'Practice', vi: 'Luyện tập' } }
const pct = (x) => `${Math.round(100 * Number(x))}%`

/** One part of a pack: done / started / not started as a bar, and the average first score. */
function PartRow({ part, students }) {
  const { L, lang } = useL()
  const look = PART[part.kind] || PART.practice
  const Icon = look.icon
  const size = Math.max(students || 0, part.started || 0, 1)
  const done = part.finished || 0
  const started = Math.max(0, (part.started || 0) - done)
  const none = Math.max(0, size - done - started)
  const w = (n) => `${(100 * n) / size}%`
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-slate-800"><Icon size={16} className="text-green-700" />{lang === 'vi' ? look.vi : look.en}</span>
        <span className="text-sm font-semibold text-green-800">{L(`${done} of ${size} done`, `${done}/${size} em đã làm xong`)}</span>
        {part.avg_first_score != null && <span className="text-sm text-slate-600">{L(`Average score ${pct(part.avg_first_score)} (first try)`, `Điểm trung bình ${pct(part.avg_first_score)} (lần đầu)`)}</span>}
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={L(`${done} done, ${started} started, ${none} not started`, `${done} xong, ${started} đang làm, ${none} chưa bắt đầu`)}>
        <div className="h-full bg-green-500" style={{ width: w(done) }} />
        <div className="h-full bg-amber-400" style={{ width: w(started) }} />
      </div>
      <div className="flex flex-wrap gap-x-4 text-xs text-slate-600">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />{L(`${done} done`, `${done} xong`)}</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />{L(`${started} started`, `${started} đang làm`)}</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-300" />{L(`${none} not started`, `${none} chưa bắt đầu`)}</span>
      </div>
    </div>
  )
}

/**
 * How the class is getting on with the request's online parts on PRA Learn: for each pack made
 * for it, each part's done / started / not started, the average first score, the questions most
 * often wrong the first time, and a link to the class page there. From learn_request_results,
 * which returns only what the signed-in person may see; nothing shows until there is a pack.
 */
export default function LearnResults({ request }) {
  const { L, lang } = useL()
  const [res, setRes] = useState(null)
  const [error, setError] = useState('')
  const wanted = hasLearnParts(request)
  useEffect(() => {
    if (!wanted) return undefined
    let on = true
    requestResults(request.id).then((r) => on && setRes(r)).catch((e) => {
      if (!on) return
      if (notSetUp(e)) console.warn('PRA Learn results:', e.message)
      else setError(learnError(e))
    })
    return () => { on = false }
  }, [wanted, request.id])
  if (!wanted) return null
  if (error) return <p className="text-sm text-red-600">{L('PRA Learn results could not be read:', 'Không đọc được kết quả từ PRA Learn:')} {error}</p>
  const packs = res?.packs || []
  if (!packs.length) return null

  return (
    <section className="space-y-4">
      {packs.map((p) => {
        const open = p.status === 'published'
        const noLogin = Math.max(0, (p.students || 0) - (p.logins || 0))
        return (
          <div key={p.id} className="space-y-3 rounded-xl border border-green-100 bg-green-50/50 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-900"><Users size={14} />{L('Students on PRA Learn', 'Học viên trên PRA Learn')}</h4>
              {packs.length > 1 && <span className="text-sm font-semibold text-slate-700">{p.title}</span>}
              {p.due_on && <span className="chip bg-white text-slate-700">{L(`Due ${fmtDay(p.due_on, lang)}`, `Hạn ${fmtDay(p.due_on, lang)}`)}</span>}
              <a href={classLink(p.class_key)} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-green-800 hover:underline">{L('Class page on PRA Learn', 'Trang lớp trên PRA Learn')}<ExternalLink size={13} /></a>
            </div>
            {!open ? (
              <p className="text-sm text-slate-700">
                {p.status === 'hidden' ? L('Hidden from the class for now.', 'Hiện đang ẩn với lớp.') : L('Not open to the class yet. The teacher opens it on PRA Learn after checking it.', 'Chưa mở cho lớp. Giáo viên mở bài trên PRA Learn sau khi xem lại.')}
                {' '}<a href={p.links?.pack} target="_blank" rel="noreferrer" className="font-semibold text-pra-blue hover:underline">{L('Open it on PRA Learn', 'Mở trên PRA Learn')}</a>
              </p>
            ) : (
              <div className="space-y-3">
                {(p.parts || []).map((pt) => <PartRow key={pt.id} part={pt} students={p.students} />)}
              </div>
            )}
            {noLogin > 0 && <p className="text-sm text-amber-800">{noLogin === 1 ? L('1 student cannot sign in yet: no login, or a disabled one (Student logins, at the top of this tab).', '1 học viên chưa đăng nhập được: chưa có tài khoản hoặc tài khoản đang bị khóa (nút Tài khoản học viên ở đầu trang này).') : L(`${noLogin} students cannot sign in yet: no login, or a disabled one (Student logins, at the top of this tab).`, `${noLogin} học viên chưa đăng nhập được: chưa có tài khoản hoặc tài khoản đang bị khóa (nút Tài khoản học viên ở đầu trang này).`)}</p>}
            {open && (p.misses || []).length > 0 && (
              <div>
                <div className="mb-1.5 text-[13px] font-bold text-slate-700">{L('Most often wrong the first time', 'Câu sai nhiều nhất ở lần đầu')}</div>
                <ol className="space-y-1">
                  {p.misses.map((m) => {
                    const label = (lang === 'vi' && m.label?.vi) || m.label?.en || `${(PART[m.part] || PART.practice)[lang === 'vi' ? 'vi' : 'en']} · ${m.id}`
                    return (
                      <li key={`${m.part}:${m.id}`} className="flex items-start gap-3 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-green-100">
                        <span className="min-w-0 flex-1 text-slate-800">{label}</span>
                        <span className="flex-none whitespace-nowrap text-xs font-semibold text-red-700">{L(`${m.wrong_first} of ${m.asked} wrong`, `${m.wrong_first}/${m.asked} em sai`)}</span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
