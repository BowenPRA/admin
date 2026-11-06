import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpenCheck, Calculator, ChevronDown, FlaskConical, KeyRound, Languages, MessageSquare, Paperclip, Plus, StepForward, Users } from 'lucide-react'
import { db, dbMode } from '../lib/db'
import { useAuth } from '../lib/AuthContext'
import { useData } from '../lib/DataContext'
import { useToast } from '../lib/toast'
import { splitSubjectKey } from '../data/staff'
import {
  QUEUE_TABS, TEACHER_GROUPS, allClasses, blankRequest, byClass, byNeeded, byNewest, canDeleteRequest, className, countByStatus,
  inLessonsPilot, lessonsError, myClasses, nextPreview, nextRequest, profileFilled, requestTitle, statusLabel, statusOf, teacherName, teachersOf, useL,
} from '../lib/lessons'
import { removeLessonFiles } from '../lib/lessonFiles'
import { Card, Empty, PageHeader, SearchInput, Segmented, Spinner } from '../components/ui'
import { DayChip, StatusPill, WantChips } from '../components/lessons/LessonBits'
import RequestForm from '../components/lessons/RequestForm'
import RequestView from '../components/lessons/RequestView'
import ClassProfileModal from '../components/lessons/ClassProfileModal'
import StudentLogins from '../components/learn/StudentLogins'

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
const SUBJECT_LOOK = {
  math: { icon: Calculator, tone: 'bg-sky-100 text-sky-700', band: 'from-sky-50' },
  science: { icon: FlaskConical, tone: 'bg-green-100 text-green-700', band: 'from-green-50' },
  english: { icon: Languages, tone: 'bg-violet-100 text-violet-700', band: 'from-violet-50' },
}
const lookOf = (k) => SUBJECT_LOOK[splitSubjectKey(k)[0]] || { icon: BookOpenCheck, tone: 'bg-amber-100 text-amber-700', band: 'from-amber-50' }

// One request in a list: what it is in bold, then one quiet line (number, class, teacher,
// what was asked for, files, messages). The teaching date and status sit on the right
// (under it on a phone). The left edge is the colour of its status.
function RequestRow({ x, sources, teachers, showTeacher, showClass, office, onOpen }) {
  const { lang } = useL()
  const notes = (x.updates || []).filter((u) => u.kind !== 'status').length
  const files = (x.files || []).length
  return (
    <li className={`flex cursor-pointer items-start gap-3 border-b border-l-4 border-b-slate-100 py-3 pl-3 pr-4 transition-colors hover:bg-sky-50/50 sm:items-center ${statusOf(x.status).bar}`} onClick={onOpen}>
      <div className="min-w-0 flex-1">
        <button type="button" className="text-left text-base font-semibold leading-snug text-slate-900 hover:text-pra-blue focus:outline-none focus-visible:underline">{requestTitle(x, sources, lang)}</button>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-slate-600">
          <span className="font-semibold tabular-nums text-slate-400">#{x.number}</span>
          {showClass && <span className="font-medium text-slate-700">{className(x.class_key, lang)}</span>}
          {showTeacher && <span>{teacherName(x.teacher_email, teachers)}</span>}
          <WantChips wants={x.wants} compact />
          {files > 0 && <span className="inline-flex items-center gap-1 text-violet-700"><Paperclip size={13} />{files}</span>}
          {notes > 0 && <span className="inline-flex items-center gap-1 text-sky-700"><MessageSquare size={13} />{notes}</span>}
          <span className="sm:hidden"><DayChip x={x} /></span>
        </div>
      </div>
      <div className="hidden w-32 flex-none text-sm sm:block"><DayChip x={x} /></div>
      <div className="flex flex-none justify-end sm:w-44"><StatusPill status={x.status} office={office} /></div>
    </li>
  )
}

function ClassCard({ classKey, rows, profile, sources, onNew, onNext, onProfile, onOpen, onLogins }) {
  const { L, lang } = useL()
  const look = lookOf(classKey)
  const Icon = look.icon
  const counts = countByStatus(rows)
  const latest = [...rows].sort(byNewest)[0]
  // What Next lesson will ask for: the section after the last request's (cancelled ones skipped, as nextFor does).
  const next = nextPreview([...rows].filter((x) => x.status !== 'cancelled').sort(byNewest)[0], sources, lang)
  const open = TEACHER_GROUPS.filter((s) => !['done', 'cancelled'].includes(s) && counts[s])
  return (
    <section className="card flex flex-col overflow-hidden">
      <div className={`flex items-center gap-3 bg-gradient-to-b ${look.band} to-white px-4 pb-3 pt-4`}>
        <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${look.tone}`}><Icon size={22} /></span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-black tracking-tight text-slate-800">{className(classKey, lang)}</h2>
          <p className="text-xs text-slate-500">{rows.length ? L(`${rows.length} ${rows.length === 1 ? 'request' : 'requests'}, ${counts.done || 0} done`, `${rows.length} yêu cầu, ${counts.done || 0} đã hoàn tất`) : L('No requests yet', 'Chưa có yêu cầu')}</p>
        </div>
      </div>
      <div className="flex-1 space-y-3 px-4 pb-4">
        {open.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {open.map((s) => <span key={s} className={`chip ${statusOf(s).tone}`}>{counts[s]} · {statusLabel(s, lang)}</span>)}
          </div>
        )}
        {latest && (
          <button type="button" onClick={() => onOpen(latest)} className="block w-full rounded-lg bg-slate-50 px-3 py-2 text-left ring-1 ring-slate-100 hover:bg-sky-50">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">{L('Latest', 'Gần nhất')} · #{latest.number}</span>
            <span className="block truncate text-sm font-semibold text-slate-800">{requestTitle(latest, sources, lang)}</span>
          </button>
        )}
        <button type="button" onClick={onProfile} className={`flex w-full items-center gap-2 text-left text-[13px] font-semibold ${profileFilled(profile) ? 'text-slate-600 hover:text-pra-blue' : 'text-amber-700 hover:text-amber-800'}`}>
          <Users size={14} />{profileFilled(profile) ? L('About this class: filled in', 'Về lớp này: đã điền') : L('About this class: not filled in yet', 'Về lớp này: chưa điền')}
        </button>
        {next && (
          <p className="flex items-start gap-2 text-[13px] text-slate-600">
            <StepForward size={14} className="mt-0.5 flex-none text-pra-blue" />
            <span>{L('Next lesson asks for', 'Bài tiếp theo sẽ là')} <b className="font-semibold text-slate-800">{next}</b></span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
        <button type="button" className="btn-primary" onClick={onNew}><Plus size={15} /> {L('New request', 'Yêu cầu mới')}</button>
        <button type="button" className="btn-secondary" onClick={onNext} disabled={!latest} title={latest ? L('Starts from your last request for this class', 'Bắt đầu từ yêu cầu gần nhất của lớp này') : ''}><StepForward size={15} /> {L('Next lesson', 'Bài tiếp theo')}</button>
        {onLogins && <button type="button" className="btn-ghost" onClick={onLogins} title={L('Logins for PRA Learn, and the cards to print', 'Tài khoản PRA Learn và thẻ đăng nhập để in')}><KeyRound size={15} /> {L('Student logins', 'Tài khoản học viên')}</button>}
      </div>
    </section>
  )
}

function GroupHeading({ status, n, office }) {
  const { lang } = useL()
  const s = statusOf(status)
  return (
    <h3 className={`flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-wider ${s.tone}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />{statusLabel(status, lang, office)}
      <span className="rounded-full bg-white/80 px-1.5 text-[11px] font-bold tabular-nums">{n}</span>
    </h3>
  )
}

// Lessons: teachers ask for a lesson for one of their classes and get back slides, a
// guided review, online practice and printed sheets. Teachers see their classes and
// their own requests; office accounts and head teachers also see the queue.
export default function Lessons() {
  const { L, lang } = useL()
  const toast = useToast()
  const { me, isOffice, isHead, displayName } = useAuth()
  const { teachers } = useData()
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState(null)
  const [pickedView, setView] = useState(null)
  const [tab, setTab] = useState(null)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const [form, setForm] = useState(null)
  const [profileFor, setProfileFor] = useState(null)
  const [saving, setSaving] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [loginsFor, setLoginsFor] = useState(null) // { classKey } while the Student logins window is open

  const manager = isOffice || isHead
  const classes = useMemo(() => myClasses(me), [me])
  const myEmail = String(me?.email || '').toLowerCase()
  const who = { email: myEmail, name: displayName }

  useEffect(() => {
    let on = true
    // Offline preview only: made-up requests and part of the catalogue (never loaded live).
    const seed = dbMode === 'local' ? import('../lib/lessonsSeed').then((m) => m.seedLessonsOffline()) : Promise.resolve()
    seed.catch((e) => console.warn('Lessons seed:', e.message))
      .then(() => Promise.all([db.lessons.list(), db.lessons.sources.list().catch(() => []), db.lessons.profiles.list().catch(() => [])]))
      .then(([rows, sources, profiles]) => on && setState({ rows, sources, profiles, error: '' }))
      .catch((e) => on && setState({ rows: [], sources: [], profiles: [], error: lessonsError(e) }))
    return () => { on = false }
  }, [])
  const rows = state?.rows
  const sources = state?.sources || []
  const profiles = state?.profiles || []
  const put = (row) => setState((st) => ({ ...st, rows: st.rows.some((x) => x.id === row.id) ? st.rows.map((x) => (x.id === row.id ? row : x)) : [...st.rows, row] }))
  const profileOf = (k) => profiles.find((p) => p.class_key === k) || null

  const isMine = (x) => [x.teacher_email, x.created_by].map((e) => String(e || '').toLowerCase()).includes(myEmail)
  const mine = useMemo(() => (rows || []).filter(isMine), [rows, myEmail]) // eslint-disable-line react-hooks/exhaustive-deps
  const formClasses = useMemo(() => (manager ? [...new Set([...classes, ...allClasses(teachers), ...(rows || []).map((x) => x.class_key)])].sort(byClass) : classes), [manager, classes, teachers, rows])
  // PRA Learn logins: office and head teachers for any class, a teacher for their own (the database checks again).
  const loginClasses = manager ? formClasses : classes

  // Office accounts and head teachers open on the queue; teachers on their classes.
  const view = !manager ? 'classes' : !classes.length ? 'queue' : pickedView || 'queue'

  // A link such as /lessons?request=12 opens that request.
  const wanted = params.get('request')
  const shown = (openId && rows?.find((x) => x.id === openId)) || (wanted && rows?.find((x) => String(x.number) === wanted)) || null
  const closeView = () => { setOpenId(null); if (wanted) setParams({}, { replace: true }) }

  const run = async (id, fn) => {
    setSaving(id)
    try { return await fn() } catch (e) { toast.error(lessonsError(e)); return null } finally { setSaving('') }
  }
  const saveRequest = (row, isNew) => run(row.id, async () => {
    const saved = isNew
      ? await db.lessons.save({ ...row, created_by: myEmail, updated_by: myEmail })
      : await db.lessons.patch(row.id, { ...row, updated_by: myEmail }, who)
    put(saved)
    setForm(null)
    setOpenId(saved.id)
    toast(saved.status === 'draft' ? L(`Draft #${saved.number} saved`, `Đã lưu nháp #${saved.number}`) : isNew ? L(`Request #${saved.number} sent`, `Đã gửi yêu cầu #${saved.number}`) : L(`#${saved.number} saved`, `Đã lưu #${saved.number}`))
    return saved
  })
  const changeStatus = (x, next) => run(x.id, async () => {
    const saved = await db.lessons.patch(x.id, { status: next, updated_by: myEmail }, who)
    put(saved)
    toast(`#${x.number}: ${statusLabel(next, lang, manager && !isMine(x))}`)
    return saved
  })
  const addNote = (x, text, kind) => run(x.id, async () => { const saved = await db.lessons.addUpdate(x.id, text, kind, who); put(saved); return saved })
  const saveOutputs = (x, outputs) => run(x.id, async () => { const saved = await db.lessons.patch(x.id, { outputs, updated_by: myEmail }, who); put(saved); toast(L('Links saved', 'Đã lưu đường dẫn')); return saved })
  const remove = (x) => run(x.id, async () => {
    if (!confirm(L(`Delete request #${x.number}? This cannot be undone.`, `Xóa yêu cầu #${x.number}? Không thể hoàn tác.`))) return null
    await db.lessons.remove(x.id)
    removeLessonFiles(x.files).catch((e) => console.warn('Request files not removed:', e.message))
    setState((st) => ({ ...st, rows: st.rows.filter((y) => y.id !== x.id) }))
    closeView()
    toast(L(`#${x.number} deleted`, `Đã xóa #${x.number}`))
    return true
  })
  const saveProfile = async (row) => {
    try {
      const saved = await db.lessons.profiles.save({ ...row, updated_by: myEmail })
      setState((st) => ({ ...st, profiles: [...st.profiles.filter((p) => p.class_key !== saved.class_key), saved] }))
      toast(L('Saved', 'Đã lưu'))
      return saved
    } catch (e) { toast.error(lessonsError(e)); return null }
  }

  // For yourself when it is your class (or you are a teacher); else for the class's first teacher.
  const newFor = (k) => {
    const cls = k || classes[0] || ''
    const teacher = classes.includes(cls) || !manager ? myEmail : (teachersOf(cls, teachers)[0]?.email || '').toLowerCase()
    setForm(blankRequest(cls, teacher))
  }
  const nextFor = (k) => {
    const last = mine.filter((x) => x.class_key === k && x.status !== 'cancelled').sort(byNewest)[0]
    setForm(last ? nextRequest(last, sources) : blankRequest(k, myEmail))
  }

  // The pilot (LESSONS_PILOT in lib/lessons.js): anyone else who opens the address sees only this.
  if (!inLessonsPilot(myEmail)) {
    return (
      <div className="space-y-5">
        <PageHeader title={L('Lessons', 'Bài giảng')} />
        <Empty text={L('Lessons is being tried with a few teachers first.', 'Trang Bài giảng đang được dùng thử với một vài giáo viên trước.')} />
      </div>
    )
  }
  if (!rows) return <Spinner />
  if (!manager && !classes.length) {
    return (
      <div className="space-y-5">
        <PageHeader title={L('Lessons', 'Bài giảng')} />
        <Empty text={L('Lessons are for teachers with a class. Ask the office to add your classes on the Teachers page.', 'Trang này dành cho giáo viên có lớp. Thầy cô vui lòng nhờ văn phòng thêm lớp của mình ở trang Giáo viên.')} />
      </div>
    )
  }

  // ---- the office's queue ----
  const needle = norm(q)
  const matches = (x) => !needle || [requestTitle(x, sources, lang), `#${x.number}`, className(x.class_key, lang), teacherName(x.teacher_email, teachers), x.source?.topic, ...(x.updates || []).map((u) => u.text)].some((v) => norm(v).includes(needle))
  const tabCounts = Object.fromEntries(QUEUE_TABS.map((t) => [t.id, rows.filter((x) => t.statuses.includes(x.status)).length]))
  const curTab = tab || QUEUE_TABS.find((t) => tabCounts[t.id])?.id || 'build'
  const tabDef = QUEUE_TABS.find((t) => t.id === curTab)
  const queue = rows.filter((x) => tabDef.statuses.includes(x.status) && matches(x)).sort(curTab === 'done' ? byNewest : byNeeded)

  // ---- a teacher's own requests, grouped by what needs them first ----
  const groups = TEACHER_GROUPS.map((s) => ({ status: s, rows: mine.filter((x) => x.status === s).sort(s === 'done' || s === 'cancelled' ? byNewest : byNeeded) })).filter((g) => g.rows.length)
  const waitingOnMe = mine.filter((x) => ['question', 'ready'].includes(x.status)).length
  // A teacher with many classes (Ms. Kiu has eleven) gets full cards for the classes in use,
  // and one short list for the rest. With four classes or fewer, every class is a card.
  const inUse = (k) => mine.some((x) => x.class_key === k) || profileFilled(profileOf(k))
  const cardClasses = classes.length <= 4 ? classes : classes.filter(inUse)
  const quietClasses = classes.filter((k) => !cardClasses.includes(k))

  return (
    <div className="space-y-5">
      <PageHeader title={L('Lessons', 'Bài giảng')}
        subtitle={L('Ask for a lesson for your class. It comes back as slides, a guided review, online practice and printed sheets.', 'Gửi yêu cầu soạn bài cho lớp của thầy cô. Bài soạn gồm slide, phần ôn tập có hướng dẫn, luyện tập trực tuyến và phiếu bài tập in.')}>
        {loginClasses.length > 0 && <button type="button" className="btn-secondary" onClick={() => setLoginsFor({ classKey: '' })}><KeyRound size={16} /> {L('Student logins', 'Tài khoản học viên')}</button>}
        <button type="button" className="btn-primary" disabled={!!state.error} onClick={() => newFor(view === 'classes' ? ([...mine].sort(byNewest)[0]?.class_key || cardClasses[0] || classes[0]) : '')}><Plus size={16} /> {L('New request', 'Yêu cầu mới')}</button>
      </PageHeader>

      {state.error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>}

      {manager && classes.length > 0 && (
        <Segmented value={view} onChange={setView} options={[
          { value: 'queue', label: L(`Queue (${tabCounts.build + tabCounts.building + tabCounts.question + tabCounts.ready})`, `Danh sách chờ (${tabCounts.build + tabCounts.building + tabCounts.question + tabCounts.ready})`) },
          { value: 'classes', label: L('My classes', 'Lớp của tôi') },
        ]} />
      )}

      {view === 'classes' && (
        <>
          {!state.error && mine.length === 0 && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[15px] text-sky-900">
              <p>{L('Pick a class and press New request. Say what the lesson is about: a book and its pages, your own files, or a topic.', 'Chọn lớp rồi bấm Yêu cầu mới. Ghi bài học về nội dung gì: sách và số trang, tệp của thầy cô, hoặc một chủ đề.')}</p>
              <p className="mt-1">{L('When the lesson is built it comes back here and by email. Look it over, then approve it or ask for changes.', 'Khi bài soạn xong, thầy cô sẽ thấy ở trang này và nhận email. Thầy cô xem lại, rồi duyệt hoặc yêu cầu sửa.')}</p>
            </div>
          )}
          {waitingOnMe > 0 && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-[15px] font-semibold text-teal-800">
              {L(`${waitingOnMe} ${waitingOnMe === 1 ? 'request needs' : 'requests need'} you: a question to answer or a lesson to check.`, `Có ${waitingOnMe} yêu cầu cần thầy cô: trả lời câu hỏi hoặc xem bài đã soạn.`)}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cardClasses.map((k) => (
              <ClassCard key={k} classKey={k} rows={mine.filter((x) => x.class_key === k)} profile={profileOf(k)} sources={sources}
                onNew={() => newFor(k)} onNext={() => nextFor(k)} onProfile={() => setProfileFor(k)} onOpen={(x) => setOpenId(x.id)} onLogins={() => setLoginsFor({ classKey: k })} />
            ))}
          </div>
          {quietClasses.length > 0 && (
            <Card className="!p-0">
              <h2 className="border-b border-slate-100 px-4 py-3 text-base font-bold text-slate-800">{cardClasses.length ? L('Your other classes', 'Các lớp khác của tôi') : L('Your classes', 'Lớp của tôi')}</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {quietClasses.map((k) => {
                  const Icon = lookOf(k).icon
                  return (
                    <li key={k} className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-2.5">
                      <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${lookOf(k).tone}`}><Icon size={16} /></span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-800">{className(k, lang)}</span>
                      <button type="button" className="btn-ghost px-2 text-xs" onClick={() => setProfileFor(k)} title={L('About this class', 'Về lớp này')}><Users size={14} /></button>
                      <button type="button" className="btn-secondary px-2.5 py-1 text-xs" onClick={() => newFor(k)}><Plus size={13} /> {L('New request', 'Yêu cầu mới')}</button>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          <Card className="overflow-hidden !p-0">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <h2 className="text-base font-bold text-slate-800">{L('My requests', 'Yêu cầu của tôi')}</h2>
              <span className="text-xs text-slate-400">{mine.length}</span>
            </div>
            {groups.length === 0 ? (
              <div className="p-4"><Empty text={L('No requests yet. Start with New request on one of your classes.', 'Chưa có yêu cầu. Bấm Yêu cầu mới ở một lớp để bắt đầu.')} /></div>
            ) : groups.map((g) => {
              const fold = (g.status === 'done' || g.status === 'cancelled') && !showDone
              const list = fold ? g.rows.slice(0, g.status === 'done' ? 3 : 0) : g.rows
              return (
                <section key={g.status}>
                  <GroupHeading status={g.status} n={g.rows.length} />
                  <ul>{list.map((x) => <RequestRow key={x.id} x={x} sources={sources} teachers={teachers} showClass onOpen={() => setOpenId(x.id)} />)}</ul>
                  {fold && g.rows.length > list.length && (
                    <button type="button" className="flex w-full items-center justify-center gap-1 border-b border-slate-100 py-2 text-[13px] font-semibold text-slate-500 hover:bg-slate-50" onClick={() => setShowDone(true)}>
                      <ChevronDown size={14} />{L(`Show all ${g.rows.length}`, `Xem tất cả ${g.rows.length}`)}
                    </button>
                  )}
                </section>
              )
            })}
          </Card>
        </>
      )}

      {view === 'queue' && (
        <Card className="overflow-hidden !p-0">
          <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-slate-100 px-2 pt-2">
            {QUEUE_TABS.map((t) => {
              const on = curTab === t.id
              const n = tabCounts[t.id]
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => setTab(t.id)}
                  className={`-mb-px flex flex-none items-center gap-2 border-b-[3px] px-3 py-2.5 text-[15px] font-semibold transition-colors ${on ? t.on : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  {lang === 'vi' ? t.vi : t.en}
                  <span className={`min-w-[1.5rem] rounded-full px-1.5 py-px text-center text-xs font-bold tabular-nums ${on ? t.badge : n ? t.soft : 'bg-slate-100 text-slate-400'}`}>{n}</span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <SearchInput value={q} onChange={setQ} placeholder={L('Search requests…', 'Tìm yêu cầu…')} className="w-full sm:w-72" />
            <span className="ml-auto text-xs text-slate-400">{curTab === 'done' ? L('Newest first', 'Mới nhất trước') : L('By teaching date', 'Theo ngày dạy')}</span>
          </div>
          {queue.length === 0
            ? <div className="p-4"><Empty text={q ? L('Nothing matches.', 'Không có kết quả phù hợp.') : L('Nothing here.', 'Không có yêu cầu nào.')} /></div>
            : <ul>{queue.map((x) => <RequestRow key={x.id} x={x} sources={sources} teachers={teachers} showClass showTeacher office onOpen={() => setOpenId(x.id)} />)}</ul>}
        </Card>
      )}

      {shown && !form && (
        <RequestView key={shown.id} value={shown} me={me} manager={manager} teachers={teachers} sources={sources} profile={profileOf(shown.class_key)}
          canDelete={canDeleteRequest(shown, me)} saving={saving === shown.id}
          onClose={closeView} onEdit={() => setForm(shown)}
          onStatus={(s) => changeStatus(shown, s)} onNote={(text, kind) => addNote(shown, text, kind)}
          onOutputs={(o) => saveOutputs(shown, o)} onDelete={remove}
          onProfile={() => setProfileFor(shown.class_key)} />
      )}
      {form && (
        <RequestForm key={form.id || 'new'} value={form} classes={formClasses} teachers={teachers} sources={sources} profiles={profiles} me={me} manager={manager}
          onClose={() => setForm(null)} onSave={saveRequest} />
      )}
      {profileFor && (
        <ClassProfileModal classKey={profileFor} value={profileOf(profileFor)} sources={sources} canEdit={manager || classes.includes(profileFor)}
          onClose={() => setProfileFor(null)} onSave={saveProfile} />
      )}
      {loginsFor && <StudentLogins classKey={loginsFor.classKey} classes={loginClasses} onClose={() => setLoginsFor(null)} />}
    </div>
  )
}
