import { Component, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Eye, Image as ImageIcon, Languages, Lightbulb, Mail, MoreHorizontal, Plus, Send, Trash2, Wand2, X, CheckCheck } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { useData } from '../../lib/DataContext'
import { useToast } from '../../lib/toast'
import { db } from '../../lib/db'
import { OFFICE_ACCOUNTS } from '../../data/staff'
import { EDITIONS, PART_TYPES, PART_LABELS_VI as VI_LABELS, PART_HELP_VI, ADDABLE, HIDDEN_PARTS, TONES } from '../../lib/newsletter/constants'
import { issueChecks, statusOf, suggestSubject, viState, sortParts } from '../../lib/newsletter/payload'
import { longDay, issueLabel } from '../../lib/newsletter/dates'
import { photoLink, dropPhotoFile } from '../../lib/newsletter/photos'
import { previewPayloads, issuePhotos } from '../../lib/newsletter/publish'
import { removeIssue } from '../../lib/newsletter/data'
import { blankPart, classCorner, positionBetween } from '../../lib/newsletter/newIssue'
import { Modal, Spinner, Menu } from '../../components/ui'
import { useL, Note } from '../../components/newsletter/bits'
import { useIssue } from '../../components/newsletter/useIssue'
import { useFullPreview } from '../../components/newsletter/useFullPreview'
import PartEditor from '../../components/newsletter/PartEditor'
import NeedToKnow from '../../components/newsletter/NeedToKnow'
import Preview from '../../components/newsletter/Preview'
import PhotoPicker from '../../components/newsletter/PhotoPicker'
import PublishPanel from '../../components/newsletter/PublishPanel'
import NoPhotoList from '../../components/newsletter/NoPhotoList'
import { StatusChips, ownsCorner } from '../../components/newsletter/status'
import { NlIcon } from '../../components/newsletter/icons'
import { Outline, SaveLine, NextStep, cornerCount } from '../../components/newsletter/EditorBits'

const FIXED = ['dates', 'reminders', 'opening', 'closing']
const TRANSLATOR_KEY = 'pra-newsletter-translator'

// A fresh editor for each issue, so what is folded or open on one does not carry over to the next.
// The translator's link (?vi=1) starts it afresh too, even when the issue is already open.
export default function NewsletterEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  return <Guard key={`${id}|${params.get('vi') || ''}`}><IssueEditor id={id} /></Guard>
}

/** If something in an issue cannot be shown, says so (with a way back) instead of leaving a blank page. */
class Guard extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="space-y-3">
        <Link to="/newsletter" className="inline-flex items-center gap-1 text-sm font-semibold text-pra-blue"><ChevronLeft size={16} />All issues</Link>
        <Note tone="red">
          Something in this issue could not be shown, so the editor stopped. Reload the page; if it happens again, tell Mr. Bowen what you did last.
          <span className="mt-1 block text-xs opacity-80">{String(this.state.error?.message || this.state.error)}</span>
        </Note>
        <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    )
  }
}

function IssueEditor({ id }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { me, isOffice } = useAuth()
  const { schedule, teachers } = useData()
  const toast = useToast()
  const { L, lang } = useL()
  const iss = useIssue(id, { onError: (e) => toast.error(e.message || String(e)) })
  const { issue, parts, loading, error } = iss
  // The To-Do sent to the translator links here with ?vi=1: only what needs Vietnamese shows.
  const [onlyVi, setOnlyVi] = useState(() => params.get('vi') === '1')
  const [addAt, setAddAt] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [doneOpen, setDoneOpen] = useState(false)
  const [coverPick, setCoverPick] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [tips, setTips] = useState(() => { try { return localStorage.getItem('pra-newsletter-tips') !== 'off' } catch { return true } })
  const foldKey = `pra-newsletter-folded-${id}`
  const [folded, setFolded] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem(foldKey) || '[]')) } catch { return new Set() } })
  const viTodoDone = useRef(false)
  // Parts shown by "only parts that need Vietnamese" stay on screen once translated, so a box does not vanish while it is typed in.
  const [viShown, setViShown] = useState(() => new Set())

  const payloads = useMemo(() => (issue ? previewPayloads(issue, parts) : null), [issue, parts, iss.photoTick]) // eslint-disable-line react-hooks/exhaustive-deps
  // The real web page in its own tab, kept up to date while it is open.
  const openFull = useFullPreview(payloads?.pub)

  // When the last part gets its Vietnamese, the translator's To-Do moves to "To check" by itself.
  const needViNow = issue ? issueChecks(issue, parts).needVi.length : -1
  useEffect(() => {
    if (!isOffice || !issue || issue.status !== 'english_done' || needViNow !== 0) return
    const todoId = issue.settings?.vi_todo
    if (!todoId || issue.settings?.vi_todo_done || viTodoDone.current) return
    viTodoDone.current = true
    ;(async () => {
      try {
        const t = await db.todos.patch(todoId, { status: 'check', updated_by: me?.email })
        await db.todos.addUpdate(todoId, 'The Vietnamese is finished in The Current. The issue is ready to publish.', me?.email).catch(() => {})
        iss.setSetting('vi_todo_done', true)
        toast(L(`All the Vietnamese is done. To-Do #${t?.number || ''} is now "To check", and the issue is ready to publish.`, `Đã dịch xong. Việc #${t?.number || ''} chuyển sang "Cần kiểm tra"; số này sẵn sàng để đăng.`))
      } catch { viTodoDone.current = false }
    })()
  }, [isOffice, issue, needViNow]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Spinner />
  if (error || !issue) return <div className="space-y-3"><Link to="/newsletter" className="inline-flex items-center gap-1 text-sm font-semibold text-pra-blue"><ChevronLeft size={16} />{L('All issues', 'Tất cả các số')}</Link><Note tone="red">{error || L('This issue no longer exists.', 'Số này không còn nữa.')}</Note></div>

  const office = isOffice
  const ed = EDITIONS[issue.edition] || EDITIONS.post
  const status = statusOf(issue, parts)
  const c = issueChecks(issue, parts)
  // Kinds of part hidden for now (HIDDEN_PARTS) stay in the database but are not shown or edited.
  const sorted = sortParts(parts.filter((p) => !HIDDEN_PARTS.includes(p.type)))
  const dates = sorted.find((p) => p.type === 'dates')
  const reminders = sorted.find((p) => p.type === 'reminders')
  const opening = sorted.find((p) => p.type === 'opening')
  const closing = sorted.find((p) => p.type === 'closing')
  const movable = sorted.filter((p) => !FIXED.includes(p.type))
  const canEdit = (p) => office || ownsCorner(p, me)
  const needsVi = (p) => ['missing', 'changed'].includes(viState(p).kind)
  const newlyVi = onlyVi ? parts.filter((p) => needsVi(p) && !viShown.has(p.id)).map((p) => p.id) : []
  if (newlyVi.length) setViShown(new Set([...viShown, ...newlyVi]))
  const visible = (p) => (!onlyVi || viShown.has(p.id) || newlyVi.includes(p.id)) && (office || ownsCorner(p, me))
  const counted = c.counted.length
  const upToDate = counted - c.needVi.length
  const suggestion = suggestSubject(issue, parts)
  const subject = issue.settings?.subject || ''
  const corners = cornerCount(sorted)
  const outlineParts = [dates, reminders, opening, ...movable, closing].filter(Boolean).filter(visible)

  const saveFolded = (next) => { setFolded(next); try { localStorage.setItem(foldKey, JSON.stringify([...next])) } catch { /* ignore */ } }
  const toggle = (pid) => { const n = new Set(folded); if (n.has(pid)) n.delete(pid); else n.add(pid); saveFolded(n) }
  const allOpen = !outlineParts.some((p) => folded.has(p.id))
  const toggleAll = () => saveFolded(allOpen ? new Set(outlineParts.map((p) => p.id)) : new Set())
  /** Goes to a part, opening it first if it is folded. (The reminders live in the Need to know card, folded with the dates.) */
  const jump = (pid) => {
    const holder = pid === reminders?.id && dates ? dates.id : pid
    if (folded.has(holder)) { const n = new Set(folded); n.delete(holder); saveFolded(n) }
    setTimeout(() => {
      const el = document.getElementById(`part-${pid}`) || document.getElementById(`part-${holder}`)
      if (!el) return
      const head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - head - 64, behavior: 'smooth' })
    }, 30)
  }
  /** Saves everything typed first; if something cannot be saved, says so and stops. */
  const flushThen = async (fn) => { try { await iss.flush() } catch (e) { toast.error(e.message); return } fn() }

  const add = async (type, index, extra = {}) => {
    const position = positionBetween(movable[index - 1]?.position ?? null, movable[index]?.position ?? null)
    const data = type === 'class' ? classCorner(extra.cls, teachers).data : blankPart(type)
    const row = await iss.addPart({ type, position, data, public: !PART_TYPES[type]?.familiesOnly })
    setAddAt(null)
    if (row) jump(row.id)
  }
  /**
   * Whether a stored photo file is shown anywhere else in the issue: as the cover, or
   * in another part (or as another photo of part `partId` than `photoId`; null = the whole part).
   */
  const keyInUse = (key, partId, photoId = null) => issue.settings?.cover?.key === key
    || parts.some((q) => (q.data?.photos || []).some((ph) => ph.key === key && !(q.id === partId && (photoId == null || ph.id === photoId))))
  const remove = async (p) => {
    const T = PART_TYPES[p.type]
    if (!confirm(L(`Remove this ${T.label.toLowerCase()}? What is written in it goes too.`, `Xoá phần "${VI_LABELS[p.type]}" này? Nội dung trong đó cũng bị xoá.`))) return
    if (await iss.removePart(p.id)) (p.data?.photos || []).filter((ph) => !keyInUse(ph.key, p.id)).forEach(dropPhotoFile)
  }
  const englishDone = async (translator) => {
    setDoneOpen(false)
    try { localStorage.setItem(TRANSLATOR_KEY, translator) } catch { /* ignore */ }
    try { await iss.flush() } catch (e) { toast.error(e.message); return }
    iss.setSetting('translator', translator)
    const row = await iss.patchIssue({ status: 'english_done' })
    if (!row) return
    if (!c.needVi.length) { toast(L('Marked as English done. Nothing needs Vietnamese: it is ready to publish.', 'Đã đánh dấu xong tiếng Anh. Không có phần nào cần dịch: đã sẵn sàng để đăng.')); return }
    try {
      const n = await db.todos.save({
        title: `Vietnamese for ${ed.short}, ${issueLabel(issue, 'en')} (${c.needVi.length} part${c.needVi.length > 1 ? 's' : ''})`,
        details: `The newsletter for ${longDay(issue.issue_date, 'en')} is written in English. The link below opens it with only the parts that need Vietnamese. Please finish by Friday noon, so it can be published and sent at 16:30. This task moves to "To check" by itself when the last part has its Vietnamese.\n\nhttps://current.pra.edu.vn/#/newsletter/${issue.id}?vi=1`,
        status: 'open', priority: 'normal', assignee: translator, giver: me?.name || '', due_date: issue.issue_date, files: [], updates: [], source: 'person', created_by: me?.email, updated_by: me?.email,
      })
      iss.setSetting('vi_todo', n.id)
      toast(L(`English done. To-Do #${n.number} is with the office for the Vietnamese.`, `Đã xong tiếng Anh. Việc #${n.number} đã giao văn phòng dịch.`))
    } catch (e) { toast.error(L(`English done, but the To-Do could not be made: ${e.message}`, `Đã xong tiếng Anh nhưng không tạo được việc: ${e.message}`)) }
  }
  const delIssue = async () => {
    if (!confirm(L('Delete this issue and everything in it? This cannot be undone.', 'Xoá số này và toàn bộ nội dung? Không thể hoàn tác.'))) return
    try { issuePhotos(issue, parts).forEach(dropPhotoFile); await removeIssue(issue.id); navigate('/newsletter') } catch (e) { toast.error(e.message) }
  }
  const hideTips = () => { setTips(false); try { localStorage.setItem('pra-newsletter-tips', 'off') } catch { /* ignore */ } }

  const usedClasses = new Set(parts.filter((p) => p.type === 'class').map((p) => p.data?.class_key))
  const freeClasses = HIDDEN_PARTS.includes('class') ? [] : (schedule?.classes || []).filter((cl) => !usedClasses.has(cl.key))
  const addRow = (i) => office && (addAt === i ? (
    <div className="modal-in space-y-2 rounded-xl border border-pra-blue bg-white p-3">
      <div className="text-xs font-semibold text-slate-500">{L('Add a part here:', 'Thêm một phần ở đây:')}</div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ADDABLE.filter((t) => t !== 'class').map((t) => (
          <button key={t} type="button" className="flex items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-pra-blue hover:bg-sky-50/60" onClick={() => add(t, i)}>
            <span className="mt-0.5 text-pra-blue"><NlIcon name={PART_TYPES[t].icon} size={17} /></span>
            <span><b className="block text-sm text-slate-800">{L(PART_TYPES[t].label, VI_LABELS[t])}</b><span className="block text-xs leading-snug text-slate-500">{L(PART_TYPES[t].help, PART_HELP_VI[t])}</span></span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {freeClasses.length > 0 && (
          <select className="input !w-auto !py-1.5 text-sm" value="" onChange={(e) => { const cl = freeClasses.find((x) => x.key === e.target.value); if (cl) add('class', i, { cls: cl }) }}>
            <option value="">{L('+ A class corner for…', '+ Góc lớp cho…')}</option>
            {freeClasses.map((cl) => <option key={cl.key} value={cl.key}>{cl.name}</option>)}
          </select>
        )}
        <button type="button" className="btn-ghost ml-auto !py-1.5 text-sm" onClick={() => setAddAt(null)}><X size={15} />{L('Cancel', 'Huỷ')}</button>
      </div>
    </div>
  ) : (
    <div className="relative flex justify-center py-1 before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-dashed before:border-slate-300">
      <button type="button" onClick={() => setAddAt(i)} className="relative inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-3 py-0.5 text-xs font-semibold text-slate-500 hover:border-pra-blue hover:text-pra-blue"><Plus size={13} />{L('Add a part', 'Thêm phần')}</button>
    </div>
  ))

  const partProps = (p, i = 0, n = 1) => ({
    part: p, issue, edit: iss.edit, me, L, office, canEdit: canEdit(p), canSeeAlbums: office,
    onMove: (d) => iss.movePart(p.id, d), onRemove: () => remove(p), onPatch: (f) => iss.patchPart(p.id, f), first: i === 0, last: i === n - 1,
    open: !folded.has(p.id), onToggle: office ? () => toggle(p.id) : undefined, keyInUse,
  })
  const cover = issue.settings?.cover
  const inbox = payloads?.fam?.preheader?.en || ''
  const publishLabel = issue.status === 'published' ? (status === 'changed' ? L('Publish the changes…', 'Đăng phần đã sửa…') : L('Published…', 'Đã đăng…')) : L('Publish…', 'Đăng…')

  return (
    <div className="space-y-4">
      <Link to="/newsletter" className="inline-flex items-center gap-1 text-sm font-semibold text-pra-blue"><ChevronLeft size={16} />{office ? L('All issues', 'Tất cả các số') : L('Newsletter', 'Bản tin')}</Link>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_440px] 2xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="min-w-0 space-y-4">
          {/* The issue */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-start gap-4 p-4" style={{ background: `linear-gradient(90deg, ${TONES[ed.tone].pale}, #fff)` }}>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: TONES.green.ink }}>{issueLabel(issue, lang === 'vi' ? 'vi' : 'en')} · {longDay(issue.issue_date, lang === 'vi' ? 'vi' : 'en')}</div>
                <h1 className="text-xl font-black tracking-tight text-slate-800 sm:text-2xl">{L(ed.name.en, ed.name.vi)}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2"><StatusChips issue={issue} parts={parts} L={L} /><SaveLine save={iss.save} unsaved={iss.unsaved} onRetry={iss.retry} L={L} /></div>
              </div>
              {office && (
                <div className="flex flex-wrap items-center gap-2">
                  {status === 'draft' && <button className="btn-secondary" onClick={() => setDoneOpen(true)}><CheckCheck size={16} />{L('English is done', 'Đã xong tiếng Anh')}</button>}
                  <button className="btn-primary" onClick={() => flushThen(() => setPublishing(true))}><Send size={16} />{publishLabel}</button>
                  <Menu label="" icon={MoreHorizontal} items={[
                    issue.status !== 'published' && { label: L('Delete this issue', 'Xoá số này'), icon: Trash2, onClick: delIssue },
                  ]} />
                </div>
              )}
            </div>
            {office && (
              <div className="grid grid-cols-1 gap-4 border-t border-slate-100 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="min-w-0 space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2"><span className="label !mb-0">{L('Email subject', 'Tiêu đề email')}</span><span className={`text-[11px] tabular-nums ${(subject || suggestion).length > 80 ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>{(subject || suggestion).length} / 80</span></div>
                    <input className="input" value={subject} placeholder={suggestion} onChange={(e) => iss.setSetting('subject', e.target.value, { typing: true })} />
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {L('Say what is inside: "Showcase moved to Thursday · no classes 9–14 Oct" gets opened, "Newsletter Week 10" does not.', 'Nói rõ nội dung: "Showcase dời sang thứ Năm · nghỉ học 9–14/10" được mở nhiều hơn "Bản tin tuần 10".')}
                      {subject !== suggestion && <button type="button" className="font-semibold text-pra-blue hover:underline" onClick={() => iss.setSetting('subject', suggestion)}><Wand2 size={12} className="mr-0.5 inline" />{L('Use the suggestion', 'Dùng gợi ý')}</button>}
                    </div>
                  </div>
                  {/* How it looks in a parent's inbox, before anyone opens it. */}
                  <div>
                    <div className="label">{L('In the inbox', 'Trong hộp thư')}</div>
                    <div className="flex min-w-0 items-baseline gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px]">
                      <b className="hidden flex-none text-slate-800 sm:inline">Palm River Academy</b>
                      <span className="min-w-0 truncate"><b className="text-slate-800">{subject || suggestion}</b><span className="text-slate-500"> – {inbox || L('(the opening sentence)', '(câu mở đầu)')}</span></span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5"><Mail size={13} />{L('Goes to (Bcc)', 'Gửi đến (Bcc)')} {ed.groups.map((g) => <code key={g} className="code break-all">{g}</code>)}</span>
                    <span>{L(`About ${c.minutes} min to read`, `Khoảng ${c.minutes} phút đọc`)}</span>
                  </div>
                </div>
                <div>
                  <div className="label">{L('Cover photo', 'Ảnh bìa')}</div>
                  {cover ? (
                    <div className="space-y-1.5">
                      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        {photoLink(cover) ? (
                          // The whole photo, so a click marks a point on it: crops in the PDF, the email and the page keep that point.
                          <img src={photoLink(cover).small} alt="" className="block w-full cursor-crosshair" style={{ aspectRatio: cover.w && cover.h ? `${cover.w}/${cover.h}` : '16/10' }}
                            title={L('Click where the faces are', 'Bấm vào chỗ có khuôn mặt')}
                            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const x = Math.round(((e.clientX - r.left) / r.width) * 100), y = Math.round(((e.clientY - r.top) / r.height) * 100); iss.setSetting('cover', { ...cover, focus: `${x}% ${y}%` }) }} />
                        ) : <div className="aspect-[16/10] w-full animate-pulse" />}
                        {cover.focus && /^(\d+)% (\d+)%$/.test(cover.focus) && <span className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-pra-blue/70 shadow" style={{ left: cover.focus.split(' ')[0], top: cover.focus.split(' ')[1] }} />}
                        {!cover.cleared && <span className="chip absolute left-1.5 top-1.5 bg-amber-100 text-amber-800">{L('Not checked', 'Chưa kiểm')}</span>}
                      </div>
                      <p className="text-[11px] leading-snug text-slate-500">{cover.focus ? L('Crops keep the blue dot. Click elsewhere to move it.', 'Khi cắt ảnh sẽ giữ chấm xanh. Bấm chỗ khác để đổi.') : L('Click the photo where the faces are, so crops keep them.', 'Bấm vào chỗ có khuôn mặt để khi cắt ảnh vẫn giữ lại.')}</p>
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setCoverPick(true)}>{L('Change', 'Đổi')}</button>
                        {!cover.cleared && <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => iss.setSetting('cover', { ...cover, cleared: true, cleared_by: me?.email || '' })}>{L('Checked', 'Đã kiểm')}</button>}
                        <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => iss.setSetting('cover', null)} aria-label={L('Remove the cover', 'Bỏ ảnh bìa')}><X size={13} /></button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setCoverPick(true)} className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 px-3 text-center text-xs font-semibold text-amber-800 hover:border-pra-blue hover:text-pra-blue">
                      <ImageIcon size={22} />{L('Add a cover photo', 'Thêm ảnh bìa')}<span className="font-normal">{L('the first thing families see, and the picture when the link is shared', 'thứ gia đình thấy đầu tiên, và ảnh khi chia sẻ link')}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Languages size={15} className="text-pra-green" />{L('Vietnamese', 'Tiếng Việt')}</span>
              <div className="h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${counted ? Math.round((100 * upToDate) / counted) : 100}%` }} /></div>
              <span className="text-xs text-slate-600">{L(`${upToDate} of ${counted} parts up to date`, `${upToDate}/${counted} phần đã cập nhật`)}</span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600"><input type="checkbox" checked={onlyVi} onChange={(e) => setOnlyVi(e.target.checked)} />{L('Show only parts that need Vietnamese', 'Chỉ hiện các phần cần dịch')}</label>
            </div>
            {office && <NextStep issue={issue} parts={parts} corners={corners} L={L} onEnglishDone={() => setDoneOpen(true)} onPublish={() => flushThen(() => setPublishing(true))} onlyVi={onlyVi} onOnlyVi={() => setOnlyVi(true)} />}
          </section>

          {!office && <TeacherHelp L={L} />}
          {office && tips && <ReadTips L={L} onHide={hideTips} />}
          {office && c.unchecked.length > 0 && <NoPhotoList />}
          {office && outlineParts.length > 1 && <Outline parts={outlineParts} onJump={jump} allOpen={allOpen} onToggleAll={toggleAll} onPreview={() => setPreviewOpen(true)} L={L} />}
          {onlyVi && !c.needVi.length && <Note tone="green" action={<button type="button" className="btn-secondary !py-1 text-xs" onClick={() => setOnlyVi(false)}>{L('Show the whole issue', 'Xem toàn bộ số này')}</button>}>{L('Every part has its Vietnamese.', 'Mọi phần đều đã có tiếng Việt.')}</Note>}

          {office && (dates || reminders) && (!onlyVi || [dates, reminders].some((p) => p && visible(p))) && (
            <NeedToKnow dates={dates} reminders={reminders} issue={issue} edit={iss.edit} disabled={!office} L={L} lang={lang} open={!folded.has(dates?.id)} onToggle={dates ? () => toggle(dates.id) : undefined} />
          )}
          {opening && visible(opening) && <PartEditor {...partProps(opening)} />}
          {movable.map((p, i) => visible(p) && (
            <div key={p.id} className="space-y-2">
              {!onlyVi && addRow(i)}
              <PartEditor {...partProps(p, i, movable.length)} />
            </div>
          ))}
          {!onlyVi && addRow(movable.length)}
          {closing && visible(closing) && <PartEditor {...partProps(closing)} />}
          {!office && !parts.some((p) => ownsCorner(p, me)) && <Note tone="sky">{L('This issue has no class corner for your classes.', 'Số này không có góc lớp nào của bạn.')}</Note>}
          {!office && <button type="button" className="btn-secondary xl:hidden" onClick={() => setPreviewOpen(true)}><Eye size={16} />{L('See how it looks', 'Xem trước')}</button>}
        </div>

        <aside className="hidden min-w-0 xl:sticky xl:top-24 xl:block">
          {payloads && <Preview payload={payloads.pub} families={payloads.fam} L={L} onFull={openFull} />}
        </aside>
      </div>

      {/* Below 1280 px the preview opens on top of the page. */}
      {previewOpen && payloads && (
        <Modal open wide onClose={() => setPreviewOpen(false)} title={L('Preview', 'Xem trước')} subtitle={L('How families will see this issue', 'Gia đình sẽ thấy số này như thế nào')}>
          <Preview payload={payloads.pub} families={payloads.fam} L={L} onFull={openFull} />
        </Modal>
      )}
      {publishing && <PublishPanel open onClose={() => setPublishing(false)} issue={issue} parts={parts} onIssue={iss.replaceIssue} flush={iss.flush} refresh={iss.refresh} L={L} toast={toast} />}
      {doneOpen && <EnglishDoneModal onClose={() => setDoneOpen(false)} onDone={englishDone} needVi={c.needVi.length} L={L} />}
      {coverPick && <PhotoPicker open onClose={() => setCoverPick(false)} issueId={issue.id} max={1} by={me?.email || ''} title={L('Cover photo', 'Ảnh bìa')}
        issuePhotos={parts.flatMap((p) => p.data?.photos || [])} canSeeAlbums={office} onAdd={([p]) => iss.setSetting('cover', p)} />}
    </div>
  )
}

/** For a teacher writing their class corner: what is wanted, in a few lines. */
function TeacherHelp({ L }) {
  return (
    <section className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-slate-700">
      <Lightbulb size={18} className="mt-0.5 flex-none text-pra-blue" />
      <div className="min-w-0 flex-1">
        <b className="text-slate-800">{L('Your class corner', 'Góc lớp của bạn')}</b>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>{L('Two or three short paragraphs about the week, in English. Bold words make small headings.', 'Hai, ba đoạn ngắn về tuần học, bằng tiếng Anh. Chữ in đậm làm tiêu đề nhỏ.')}</li>
          <li>{L('One or two photos. First names only in captions. The office checks every photo against the no-photo list.', 'Một hai tấm ảnh. Chú thích chỉ ghi tên gọi. Văn phòng sẽ đối chiếu mọi ảnh với danh sách không chụp ảnh.')}</li>
          <li>{L('Three to five words of the week, and one question families can ask at home.', 'Ba đến năm từ vựng trong tuần, và một câu hỏi gia đình có thể hỏi con ở nhà.')}</li>
          <li>{L('Everything saves by itself. The office writes the Vietnamese and publishes it.', 'Mọi thứ tự lưu. Văn phòng sẽ dịch sang tiếng Việt và đăng.')}</li>
        </ul>
      </div>
    </section>
  )
}

function EnglishDoneModal({ onClose, onDone, needVi, L }) {
  const remembered = (() => { try { return localStorage.getItem(TRANSLATOR_KEY) || '' } catch { return '' } })()
  const office = OFFICE_ACCOUNTS.filter((a) => a.access === 'admin')
  const [who, setWho] = useState(remembered || office[0]?.email || '')
  return (
    <Modal open onClose={onClose} title={L('English is done', 'Đã xong tiếng Anh')}
      footer={<><button className="btn-secondary" onClick={onClose}>{L('Cancel', 'Huỷ')}</button><button className="btn-primary" onClick={() => onDone(who)}><CheckCheck size={16} />{needVi ? L('Send for Vietnamese', 'Gửi đi dịch') : L('Mark as done', 'Đánh dấu xong')}</button></>}>
      <div className="space-y-3 text-sm text-slate-700">
        <p>{needVi ? L(`${needVi} part${needVi > 1 ? 's' : ''} need${needVi > 1 ? '' : 's'} Vietnamese. A To-Do goes to the person below, due Friday, with a link that opens only those parts. It moves to "To check" by itself when the Vietnamese is finished.`, `${needVi} phần cần dịch. Một việc sẽ được giao cho người dưới đây, hạn thứ Sáu, kèm đường dẫn chỉ mở các phần đó. Việc tự chuyển sang "Cần kiểm tra" khi dịch xong.`) : L('Nothing needs Vietnamese: the issue is ready to publish.', 'Không có phần nào cần dịch: số này đã sẵn sàng để đăng.')}</p>
        {needVi > 0 && (
          <label className="block space-y-1"><span className="label">{L('Who writes the Vietnamese', 'Ai dịch tiếng Việt')}</span>
            <select className="input" value={who} onChange={(e) => setWho(e.target.value)}>{office.map((a) => <option key={a.email} value={a.email}>{a.name}</option>)}</select></label>
        )}
        <p className="text-xs text-slate-500">{L('You can still change the English after this. Anything changed is flagged for the translator.', 'Sau bước này vẫn có thể sửa tiếng Anh. Phần nào sửa sẽ được đánh dấu cho người dịch.')}</p>
      </div>
    </Modal>
  )
}

/** What gets a newsletter read, kept short, beside the editor until hidden. */
function ReadTips({ L, onHide }) {
  return (
    <section className="flex gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-slate-700">
      <Lightbulb size={18} className="mt-0.5 flex-none text-pra-blue" />
      <div className="min-w-0 flex-1">
        <b className="text-slate-800">{L('What gets a newsletter read', 'Điều gì khiến bản tin được đọc')}</b>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>{L('One section per heading of the Google Doc: paste the heading, then the text. Bold, bullets and links are kept.', 'Mỗi tiêu đề trong Google Doc là một mục: dán tiêu đề, rồi nội dung. Chữ đậm, gạch đầu dòng và liên kết được giữ nguyên.')}</li>
          <li>{L('A photo in each section that has one: parents look at the pictures first.', 'Mục nào có ảnh thì thêm ảnh: phụ huynh xem ảnh trước tiên.')}</li>
          <li>{L('What families must do (bring, pay, sign up) in a section of its own, as a short bullet list.', 'Việc gia đình cần làm (mang, đóng tiền, đăng ký) để trong một mục riêng, thành danh sách ngắn.')}</li>
          <li>{L('A subject line that says what is inside, and a cover photo.', 'Tiêu đề email nói rõ nội dung, và có ảnh bìa.')}</li>
          <li>{L('After publishing, paste "Copy for chat groups" into the class chats.', 'Sau khi đăng, dán "Sao chép cho nhóm chat" vào các nhóm lớp.')}</li>
        </ul>
      </div>
      <button type="button" className="btn-ghost -mr-2 -mt-2 self-start !px-2" onClick={onHide} aria-label={L('Hide', 'Ẩn')}><X size={16} /></button>
    </section>
  )
}
