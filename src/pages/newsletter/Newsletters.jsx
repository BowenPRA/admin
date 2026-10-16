import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, Check, ChevronRight, CircleDot, Eye, Globe, Newspaper, PencilLine, Plus, Users } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { useData } from '../../lib/DataContext'
import { useToast } from '../../lib/toast'
import { EDITIONS, HIDDEN_PARTS, TONES } from '../../lib/newsletter/constants'
import { issueChecks, statusOf, sortParts } from '../../lib/newsletter/payload'
import { plain } from '../../lib/newsletter/text'
import { listIssues, listParts, listViews, sumViews, createIssue } from '../../lib/newsletter/data'
import { issueLabel, longDay, todayHoiAn, enDay, fridayOf } from '../../lib/newsletter/dates'
import { academicCalendar } from '../../lib/newsletter/calendarFeed'
import { newIssue, nextFreeFriday } from '../../lib/newsletter/newIssue'
import { Empty, Modal, PageHeader, Segmented, Spinner } from '../../components/ui'
import { useL } from '../../components/newsletter/bits'
import { StatusChips, ownsCorner } from '../../components/newsletter/status'
import { cornerCount } from '../../components/newsletter/EditorBits'

export default function Newsletters() {
  const { isOffice } = useAuth()
  return isOffice ? <OfficeList /> : <TeacherList />
}

function OfficeList() {
  const { L, lang } = useL()
  const navigate = useNavigate()
  const toast = useToast()
  const { calendar, schedule, teachers } = useData()
  const [state, setState] = useState(null)
  const [filter, setFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [starting, setStarting] = useState('')

  useEffect(() => {
    let on = true
    ;(async () => {
      try {
        const issues = await listIssues()
        const today = todayHoiAn()
        // Parts only for issues still being worked on, and the latest ones (the list's chips need them).
        const want = issues.filter((i) => i.status !== 'published' || i.issue_date >= today || issues.indexOf(i) < 6).map((i) => i.id)
        const [parts, views] = await Promise.all([listParts(want), listViews(issues.filter((i) => i.status === 'published').map((i) => i.slug))])
        if (on) setState({ issues, parts, views, error: '' })
      } catch (e) { if (on) setState({ issues: [], parts: [], views: [], error: e.message || String(e) }) }
    })()
    return () => { on = false }
  }, [])

  const partsOf = useMemo(() => {
    const m = new Map()
    for (const p of state?.parts || []) m.set(p.newsletter_id, [...(m.get(p.newsletter_id) || []), p])
    return m
  }, [state])

  if (!state) return <Spinner />
  const today = todayHoiAn()
  const issues = state.issues.filter((i) => filter === 'all' || i.edition === filter)
  const upcoming = state.issues.filter((i) => i.issue_date >= today).sort((a, b) => a.issue_date.localeCompare(b.issue_date))
  const nextFriday = upcoming[0]?.issue_date
  const thisWeek = nextFriday ? upcoming.filter((i) => i.issue_date === nextFriday) : []
  // The coming Friday: each newsletter not started for it yet gets a card that starts it in one click.
  const friday = fridayOf(today)
  const notStarted = Object.values(EDITIONS).filter((ed) => !state.issues.some((i) => i.edition === ed.id && String(i.issue_date).slice(0, 10) === friday))
  const start = async (opts) => {
    try {
      const last = state.issues.filter((i) => i.edition === opts.edition && i.issue_date < opts.date).sort((a, b) => b.issue_date.localeCompare(a.issue_date))[0]
      const [lastParts, events] = await Promise.all([last ? listParts(last.id) : [], academicCalendar()])
      const { issue, parts } = newIssue({ ...opts, last: last ? { issue: last, parts: lastParts } : null, calendar, events, schedule, teachers })
      const made = await createIssue(issue, parts)
      navigate(`/newsletter/${made.issue.id}`)
    } catch (e) { toast.error(e.message || String(e)) }
  }
  const startNow = async (ed) => { setStarting(ed.id); await start({ edition: ed.id, date: friday, from: 'last' }); setStarting('') }
  const byQuarter = []
  for (const i of issues) {
    const k = `${i.school_year} · ${L(`Quarter ${i.quarter}`, `Quý ${i.quarter}`)}`
    const g = byQuarter.find((x) => x.k === k) || (byQuarter.push({ k, rows: [] }), byQuarter[byQuarter.length - 1])
    g.rows.push(i)
  }

  return (
    <div className="space-y-5">
      <PageHeader title={L('Newsletter', 'Bản tin')} subtitle={L('The Palm River Post and the Early Years newsletter. Publish puts an issue on pra.edu.vn, makes its PDFs and saves the email in admin@ Drafts.', 'The Palm River Post và bản tin Early Years. Khi đăng, số báo lên pra.edu.vn, có PDF và email được lưu trong Thư nháp admin@.')}>
        <button className="btn-primary" disabled={!!state.error} onClick={() => setCreating(true)}><Plus size={16} />{L('New issue', 'Số mới')}</button>
      </PageHeader>
      {state.error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}

      {!state.error && (thisWeek.length > 0 || notStarted.length > 0) && (
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {thisWeek.map((i) => <WeekCard key={i.id} issue={i} parts={partsOf.get(i.id) || []} L={L} lang={lang} />)}
          {notStarted.map((ed) => (
            <div key={ed.id} className="card flex flex-col gap-3 border-dashed p-4">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: TONES[ed.tone].pale, color: TONES[ed.tone].ink }}><Newspaper size={18} /></span>
                <div className="min-w-0 flex-1"><b className="block text-slate-800">{L(ed.name.en, ed.name.vi)}</b><span className="text-xs text-slate-500">{longDay(friday, lang)} · {L('not started yet', 'chưa bắt đầu')}</span></div>
              </div>
              <p className="text-sm text-slate-600">{HIDDEN_PARTS.includes('class') ? L('It starts with an opening, one section and the closing, as in the Google Doc. Add a section for each heading.', 'Số mới gồm phần mở đầu, một mục và lời kết, như trong Google Doc. Thêm một mục cho mỗi tiêu đề.') : L('Starting it now gives every class an empty corner, so teachers can write theirs during the week. Reminders and dates come from last week and the calendar.', 'Bắt đầu ngay để mỗi lớp có một góc lớp trống, giáo viên viết trong tuần. Ghi nhớ và ngày tháng lấy từ tuần trước và lịch năm học.')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn-primary" disabled={!!starting} onClick={() => startNow(ed)}><Plus size={16} />{starting === ed.id ? L('Starting…', 'Đang tạo…') : L(`Start ${enDay(friday)}`, `Bắt đầu số ${longDay(friday, 'vi')}`)}</button>
                <button type="button" className="btn-ghost text-sm" disabled={!!starting} onClick={() => setCreating(true)}>{L('Other options…', 'Tuỳ chọn khác…')}</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: L('All', 'Tất cả') }, { value: 'post', label: 'Palm River Post' }, { value: 'ey', label: 'Early Years' }]} />
          <span className="ml-auto text-xs text-slate-400">{L(`${issues.length} issues`, `${issues.length} số`)}</span>
        </div>
        {!issues.length ? <div className="p-4"><Empty text={L('No issues yet. "New issue" starts next Friday\'s.', 'Chưa có số nào. Bấm "Số mới" để bắt đầu số thứ Sáu tới.')} /></div> : byQuarter.map((g) => (
          <section key={g.k}>
            <h2 className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">{g.k}</h2>
            <ul>
              {g.rows.map((i) => {
                const ps = partsOf.get(i.id)
                const v = i.status === 'published' ? sumViews(state.views, i.slug) : null
                return (
                  <li key={i.id}>
                    <Link to={`/newsletter/${i.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-100 px-4 py-3 hover:bg-sky-50/50 sm:flex-nowrap">
                      <span className="chip w-28 flex-none justify-center" style={{ background: TONES[EDITIONS[i.edition].tone].pale, color: TONES[EDITIONS[i.edition].tone].ink }}>{EDITIONS[i.edition].short}</span>
                      <span className="min-w-0 flex-1">
                        <b className="block text-slate-800">{issueLabel(i, lang)}</b>
                        <span className="text-xs text-slate-500">{longDay(i.issue_date, lang)}{i.settings?.subject ? ` · ${i.settings.subject}` : ''}</span>
                      </span>
                      <span className="flex-none">{ps ? <StatusChips issue={i} parts={ps} L={L} /> : i.status === 'published' ? <span className="chip bg-green-100 text-green-800"><Globe size={12} className="mr-1" />{L('Published', 'Đã đăng')}</span> : null}</span>
                      <span className="w-28 flex-none text-right text-xs text-slate-500">{v ? <span className="inline-flex items-center gap-1" title={L('Page openings counted by the website', 'Số lượt mở trang')}><Eye size={13} />{v.total}</span> : ''}</span>
                      <ChevronRight size={16} className="hidden flex-none text-slate-300 sm:block" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      {creating && <NewIssueModal L={L} issues={state.issues} onClose={() => setCreating(false)} onCreate={start} />}
    </div>
  )
}

/** This Friday's issue: what is left to do, in order. */
function WeekCard({ issue, parts, L, lang }) {
  const ed = EDITIONS[issue.edition]
  const st = statusOf(issue, parts)
  const c = issueChecks(issue, parts)
  const corners = cornerCount(parts)
  const steps = [
    !HIDDEN_PARTS.includes('class') && { done: corners.total === 0 || corners.done === corners.total, text: L(`Class corners: ${corners.done} of ${corners.total}`, `Góc lớp: ${corners.done}/${corners.total}`), sub: corners.missing.length ? corners.missing.join(', ') : '' },
    { done: issue.status !== 'draft', text: L('English done', 'Xong tiếng Anh'), sub: c.noOpening ? L('no opening yet', 'chưa có mở đầu') : '' },
    { done: issue.status !== 'draft' && !c.needVi.length, text: L(c.needVi.length ? `Vietnamese: ${c.needVi.length} part${c.needVi.length > 1 ? 's' : ''} left` : 'Vietnamese', c.needVi.length ? `Tiếng Việt: còn ${c.needVi.length} phần` : 'Tiếng Việt') },
    { done: issue.status === 'published', text: L('Published', 'Đã đăng'), sub: st === 'changed' ? L('changed since', 'đã sửa sau đó') : '' },
    { done: !!issue.email?.saved_at, text: L('Email draft saved: send at 16:30', 'Đã lưu thư nháp: gửi lúc 16:30') },
  ].filter(Boolean)
  return (
    <Link to={`/newsletter/${issue.id}`} className="card block p-4 hover:border-pra-sky">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ background: TONES[ed.tone].main }}><Newspaper size={18} /></span>
        <div className="min-w-0 flex-1"><b className="block text-slate-800">{L(ed.name.en, ed.name.vi)}</b><span className="text-xs text-slate-500">{issueLabel(issue, lang)} · {enDay(issue.issue_date)}</span></div>
        <StatusChips issue={issue} parts={parts} L={L} />
      </div>
      <ol className="space-y-1">
        {steps.map((s, k) => (
          <li key={k} className="flex items-start gap-2 text-sm">
            {s.done ? <Check size={16} className="mt-0.5 flex-none text-green-600" /> : <CircleDot size={16} className="mt-0.5 flex-none text-slate-300" />}
            <span className={s.done ? 'text-slate-500' : 'text-slate-800'}>{s.text}{s.sub && <span className="text-xs text-slate-400"> · {s.sub}</span>}</span>
          </li>
        ))}
      </ol>
    </Link>
  )
}

function NewIssueModal({ issues, onClose, onCreate, L }) {
  const [edition, setEdition] = useState('post')
  const [date, setDate] = useState(() => nextFreeFriday(issues, 'post'))
  const [from, setFrom] = useState('last')
  const [busy, setBusy] = useState(false)
  const taken = issues.some((i) => i.edition === edition && String(i.issue_date).slice(0, 10) === date)
  const friday = new Date(`${date}T00:00:00`).getDay() === 5
  return (
    <Modal open onClose={busy ? () => {} : onClose} title={L('New issue', 'Số mới')}
      footer={<><button className="btn-secondary" onClick={onClose} disabled={busy}>{L('Cancel', 'Huỷ')}</button><button className="btn-primary" disabled={busy || taken || !date} onClick={async () => { setBusy(true); await onCreate({ edition, date, from }); setBusy(false) }}><Plus size={16} />{busy ? '…' : L('Start the issue', 'Bắt đầu')}</button></>}>
      <div className="space-y-4 text-sm">
        <div className="grid gap-2">
          {Object.values(EDITIONS).map((ed) => (
            <label key={ed.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${edition === ed.id ? 'border-pra-blue bg-sky-50' : 'border-slate-200'}`}>
              <input type="radio" name="ed" className="mt-1" checked={edition === ed.id} onChange={() => { setEdition(ed.id); setDate(nextFreeFriday(issues, ed.id)) }} />
              <span><b className="block text-slate-800">{L(ed.name.en, ed.name.vi)}</b><span className="text-xs text-slate-500">{L(ed.readers.en, ed.readers.vi)} · {ed.groups[0]}</span></span>
            </label>
          ))}
        </div>
        <label className="block space-y-1"><span className="label"><CalendarDays size={12} className="mr-1 inline" />{L('Friday it goes out', 'Thứ Sáu gửi đi')}</span>
          <input type="date" className="input sm:w-56" value={date} onChange={(e) => setDate(e.target.value)} />
          {taken && <span className="block text-xs font-semibold text-red-600">{L('There is already an issue of this newsletter for that day.', 'Đã có số của bản tin này cho ngày đó.')}</span>}
          {!taken && date && !friday && <span className="block text-xs text-amber-700">{L('That is not a Friday. It still works, for a special issue.', 'Ngày này không phải thứ Sáu. Vẫn được, nếu là số đặc biệt.')}</span>}
        </label>
        <div className="grid gap-2">
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${from === 'last' ? 'border-pra-blue bg-sky-50' : 'border-slate-200'}`}>
            <input type="radio" name="from" className="mt-1" checked={from === 'last'} onChange={() => setFrom('last')} />
            <span><b className="block text-slate-800">{L('Start from last week\'s issue', 'Bắt đầu từ số tuần trước')}</b><span className="text-xs text-slate-500">{L('The "every week" reminders carry over, and a class left out last week is left out again. Every class gets an empty corner for its teacher. Dates come from the academic calendar.', 'Giữ lại các ghi nhớ "hằng tuần"; lớp nào tuần trước không có góc lớp thì tuần này cũng vậy. Mỗi lớp có một góc lớp trống để giáo viên viết. Ngày tháng lấy từ lịch năm học.')}</span></span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${from === 'empty' ? 'border-pra-blue bg-sky-50' : 'border-slate-200'}`}>
            <input type="radio" name="from" className="mt-1" checked={from === 'empty'} onChange={() => setFrom('empty')} />
            <span><b className="block text-slate-800">{L('Start fresh', 'Bắt đầu mới')}</b><span className="text-xs text-slate-500">{L('Class corners and calendar dates, nothing else.', 'Chỉ có góc lớp và ngày từ lịch.')}</span></span>
          </label>
        </div>
      </div>
    </Modal>
  )
}

/** A teacher's view: the coming issues with a class corner of theirs. */
function TeacherList() {
  const { L, lang } = useL()
  const { me } = useAuth()
  const [state, setState] = useState(null)
  useEffect(() => {
    let on = true
    ;(async () => {
      try {
        const today = todayHoiAn()
        const issues = (await listIssues()).filter((i) => i.issue_date >= today || i.status !== 'published').sort((a, b) => a.issue_date.localeCompare(b.issue_date))
        const parts = await listParts(issues.map((i) => i.id))
        if (on) setState({ issues, parts, error: '' })
      } catch (e) { if (on) setState({ issues: [], parts: [], error: e.message || String(e) }) }
    })()
    return () => { on = false }
  }, [])
  if (!state) return <Spinner />
  if (HIDDEN_PARTS.includes('class')) return <div className="space-y-5"><PageHeader title={L('Newsletter', 'Bản tin')} /><Empty text={L('The office writes the newsletter for now. Nothing to do here.', 'Hiện văn phòng viết bản tin. Bạn không cần làm gì ở đây.')} /></div>
  const rows = state.issues.map((i) => ({ i, mine: sortParts(state.parts.filter((p) => p.newsletter_id === i.id && ownsCorner(p, me) && !p.data?.skip)) })).filter((r) => r.mine.length)
  return (
    <div className="space-y-5">
      <PageHeader title={L('Newsletter', 'Bản tin')} subtitle={L('Your class corner for the coming newsletters: a few sentences about the week, a photo or two, the words of the week and one question for families. Please write it by Wednesday.', 'Góc lớp của bạn trong các số sắp tới: vài câu về tuần học, một hai tấm ảnh, từ vựng trong tuần và một câu hỏi cho gia đình. Vui lòng viết trước thứ Tư.')} />
      {state.error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}
      {!rows.length ? <Empty text={L('No newsletter has a class corner for your classes at the moment.', 'Hiện chưa có số nào có góc lớp của bạn.')} /> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map(({ i, mine }) => {
            const ed = EDITIONS[i.edition]
            return (
              <Link key={i.id} to={`/newsletter/${i.id}`} className="card block p-4 hover:border-pra-sky">
                <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ background: TONES[ed.tone].main }}><Users size={18} /></span>
                  <div><b className="block text-slate-800">{L(ed.name.en, ed.name.vi)}</b><span className="text-xs text-slate-500">{issueLabel(i, lang)} · {longDay(i.issue_date, lang)}</span></div></div>
                <ul className="mt-3 space-y-1.5">
                  {mine.map((p) => {
                    const written = plain(p.data?.en?.body).length > 20
                    return (
                      <li key={p.id} className="flex items-center gap-2 text-sm">
                        {written ? <Check size={16} className="text-green-600" /> : <PencilLine size={16} className="text-amber-600" />}
                        <b>{p.data?.class}</b>
                        <span className="text-xs text-slate-500">{written ? `${(p.data?.photos || []).length} ${L('photos', 'ảnh')} · ${Object.keys(p.data?.words || {}).length} ${L('words', 'từ')}` : L('not written yet', 'chưa viết')}</span>
                      </li>
                    )
                  })}
                </ul>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
