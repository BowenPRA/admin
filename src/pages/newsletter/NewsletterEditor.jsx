import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Image as ImageIcon, Languages, Lightbulb, Mail, MoreHorizontal, Plus, Send, Trash2, Wand2, X, CheckCheck } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { useData } from '../../lib/DataContext'
import { useToast } from '../../lib/toast'
import { db } from '../../lib/db'
import { OFFICE_ACCOUNTS } from '../../data/staff'
import { EDITIONS, PART_TYPES, PART_LABELS_VI as VI_LABELS, ADDABLE, TONES } from '../../lib/newsletter/constants'
import { issueChecks, statusOf, suggestSubject, viState, sortParts } from '../../lib/newsletter/payload'
import { longDay, issueLabel } from '../../lib/newsletter/dates'
import { photoLink, dropPhotoFile } from '../../lib/newsletter/photos'
import { previewPayloads, issuePhotos } from '../../lib/newsletter/publish'
import { removeIssue } from '../../lib/newsletter/data'
import { blankPart, classCorner, positionBetween } from '../../lib/newsletter/newIssue'
import { Modal, SaveState, Spinner, Menu } from '../../components/ui'
import { useL, Note } from '../../components/newsletter/bits'
import { useIssue } from '../../components/newsletter/useIssue'
import PartEditor from '../../components/newsletter/PartEditor'
import NeedToKnow from '../../components/newsletter/NeedToKnow'
import Preview from '../../components/newsletter/Preview'
import PhotoPicker from '../../components/newsletter/PhotoPicker'
import PublishPanel from '../../components/newsletter/PublishPanel'
import NoPhotoList from '../../components/newsletter/NoPhotoList'
import { StatusChips, ownsCorner } from '../../components/newsletter/status'
import { NlIcon } from '../../components/newsletter/icons'

const FIXED = ['dates', 'reminders', 'opening', 'closing']
const TRANSLATOR_KEY = 'pra-newsletter-translator'

export default function NewsletterEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { me, isOffice } = useAuth()
  const { schedule, teachers } = useData()
  const toast = useToast()
  const { L, lang } = useL()
  const iss = useIssue(id, { onError: (e) => toast.error(e.message || String(e)) })
  const { issue, parts, loading, error } = iss
  const [onlyVi, setOnlyVi] = useState(false)
  const [addAt, setAddAt] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const [doneOpen, setDoneOpen] = useState(false)
  const [coverPick, setCoverPick] = useState(false)
  const [tips, setTips] = useState(() => { try { return localStorage.getItem('pra-newsletter-tips') !== 'off' } catch { return true } })

  const payloads = useMemo(() => (issue ? previewPayloads(issue, parts) : null), [issue, parts, iss.photoTick]) // eslint-disable-line react-hooks/exhaustive-deps
  if (loading) return <Spinner />
  if (error || !issue) return <div className="space-y-3"><Link to="/newsletter" className="inline-flex items-center gap-1 text-sm font-semibold text-pra-blue"><ChevronLeft size={16} />{L('All issues', 'Tất cả các số')}</Link><Note tone="red">{error || L('This issue no longer exists.', 'Số này không còn nữa.')}</Note></div>

  const office = isOffice
  const ed = EDITIONS[issue.edition] || EDITIONS.post
  const status = statusOf(issue, parts)
  const c = issueChecks(issue, parts)
  const sorted = sortParts(parts)
  const dates = sorted.find((p) => p.type === 'dates')
  const reminders = sorted.find((p) => p.type === 'reminders')
  const opening = sorted.find((p) => p.type === 'opening')
  const closing = sorted.find((p) => p.type === 'closing')
  const movable = sorted.filter((p) => !FIXED.includes(p.type))
  const canEdit = (p) => office || ownsCorner(p, me)
  const visible = (p) => (!onlyVi || ['missing', 'changed'].includes(viState(p).kind)) && (office || ownsCorner(p, me))
  const counted = c.counted.length
  const upToDate = counted - c.needVi.length
  const suggestion = suggestSubject(issue, parts)
  const subject = issue.settings?.subject || ''

  const add = async (type, index, extra = {}) => {
    const position = positionBetween(movable[index - 1]?.position ?? null, movable[index]?.position ?? null)
    const data = type === 'class' ? classCorner(extra.cls, teachers).data : blankPart(type)
    const row = await iss.addPart({ type, position, data, public: !PART_TYPES[type]?.familiesOnly })
    setAddAt(null)
    if (row) setTimeout(() => document.getElementById(`part-${row.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }
  const remove = async (p) => {
    const T = PART_TYPES[p.type]
    if (!confirm(L(`Remove this ${T.label.toLowerCase()}? What is written in it goes too.`, `Xoá phần "${VI_LABELS[p.type]}" này? Nội dung trong đó cũng bị xoá.`))) return
    if (await iss.removePart(p.id)) (p.data?.photos || []).forEach(dropPhotoFile)
  }
  const englishDone = async (translator) => {
    setDoneOpen(false)
    try { localStorage.setItem(TRANSLATOR_KEY, translator) } catch { /* ignore */ }
    await iss.flush()
    const row = await iss.patchIssue({ status: 'english_done', settings: { ...(issue.settings || {}), translator } })
    if (!row) return
    if (!c.needVi.length) { toast(L('Marked as English done. Nothing needs Vietnamese.', 'Đã đánh dấu xong tiếng Anh. Không có phần nào cần dịch.')); return }
    try {
      const n = await db.todos.save({
        title: `Vietnamese for ${ed.short}, ${issueLabel(issue, 'en')} (${c.needVi.length} part${c.needVi.length > 1 ? 's' : ''})`,
        details: `The newsletter for ${longDay(issue.issue_date, 'en')} is written in English. Open it in The Current (Outreach > Newsletter) and tick "Show only parts that need Vietnamese". Please finish by Friday noon, so it can be published and sent at 16:30.\n\nhttps://current.pra.edu.vn/#/newsletter/${issue.id}`,
        status: 'open', priority: 'normal', assignee: translator, giver: me?.name || '', due_date: issue.issue_date, files: [], updates: [], source: 'person', created_by: me?.email, updated_by: me?.email,
      })
      toast(L(`English done. To-Do #${n.number} is with the office for the Vietnamese.`, `Đã xong tiếng Anh. Việc #${n.number} đã giao văn phòng dịch.`))
    } catch (e) { toast.error(L(`English done, but the To-Do could not be made: ${e.message}`, `Đã xong tiếng Anh nhưng không tạo được việc: ${e.message}`)) }
  }
  const delIssue = async () => {
    if (!confirm(L('Delete this issue and everything in it? This cannot be undone.', 'Xoá số này và toàn bộ nội dung? Không thể hoàn tác.'))) return
    try { issuePhotos(issue, parts).forEach(dropPhotoFile); await removeIssue(issue.id); navigate('/newsletter') } catch (e) { toast.error(e.message) }
  }
  const hideTips = () => { setTips(false); try { localStorage.setItem('pra-newsletter-tips', 'off') } catch { /* ignore */ } }

  const usedClasses = new Set(parts.filter((p) => p.type === 'class').map((p) => p.data?.class_key))
  const freeClasses = (schedule?.classes || []).filter((cl) => !usedClasses.has(cl.key))
  const addRow = (i) => office && (addAt === i ? (
    <div className="modal-in flex flex-wrap items-center gap-2 rounded-xl border border-pra-blue bg-white p-2.5">
      {ADDABLE.filter((t) => t !== 'class').map((t) => (
        <button key={t} type="button" className="btn-secondary !py-1.5 text-sm" onClick={() => add(t, i)}><NlIcon name={PART_TYPES[t].icon} size={15} />{L(PART_TYPES[t].label, VI_LABELS[t])}</button>
      ))}
      {freeClasses.length > 0 && (
        <select className="input !w-auto !py-1.5 text-sm" value="" onChange={(e) => { const cl = freeClasses.find((x) => x.key === e.target.value); if (cl) add('class', i, { cls: cl }) }}>
          <option value="">{L('+ Class corner…', '+ Góc lớp…')}</option>
          {freeClasses.map((cl) => <option key={cl.key} value={cl.key}>{cl.name}</option>)}
        </select>
      )}
      <button type="button" className="btn-ghost !py-1.5 text-sm" onClick={() => setAddAt(null)}><X size={15} />{L('Cancel', 'Huỷ')}</button>
    </div>
  ) : (
    <div className="relative flex justify-center py-1 before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-dashed before:border-slate-300">
      <button type="button" onClick={() => setAddAt(i)} className="relative inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-3 py-0.5 text-xs font-semibold text-slate-500 hover:border-pra-blue hover:text-pra-blue"><Plus size={13} />{L('Add', 'Thêm')}</button>
    </div>
  ))

  const partProps = (p, i = 0, n = 1) => ({
    part: p, issue, edit: iss.edit, me, L, office, canEdit: canEdit(p), canSeeAlbums: office,
    onMove: (d) => iss.movePart(p.id, d), onRemove: () => remove(p), onPatch: (f) => iss.patchPart(p.id, f), first: i === 0, last: i === n - 1,
  })
  const cover = issue.settings?.cover

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
                <h1 className="text-2xl font-black tracking-tight text-slate-800">{L(ed.name.en, ed.name.vi)}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2"><StatusChips issue={issue} parts={parts} L={L} /><SaveState state={iss.save} /></div>
              </div>
              {office && (
                <div className="flex flex-wrap items-center gap-2">
                  {status === 'draft' && <button className="btn-secondary" onClick={() => setDoneOpen(true)}><CheckCheck size={16} />{L('English is done', 'Đã xong tiếng Anh')}</button>}
                  <button className="btn-primary" onClick={async () => { await iss.flush(); setPublishing(true) }}><Send size={16} />{issue.status === 'published' ? (status === 'changed' ? L('Publish the changes…', 'Đăng phần đã sửa…') : L('Published…', 'Đã đăng…')) : L('Publish…', 'Đăng…')}</button>
                  <Menu label="" icon={MoreHorizontal} items={[
                    issue.status !== 'published' && { label: L('Delete this issue', 'Xoá số này'), icon: Trash2, onClick: delIssue },
                  ]} />
                </div>
              )}
            </div>
            {office && (
              <div className="grid grid-cols-1 gap-4 border-t border-slate-100 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2"><span className="label !mb-0">{L('Email subject', 'Tiêu đề email')}</span><span className={`text-[11px] tabular-nums ${(subject || suggestion).length > 80 ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>{(subject || suggestion).length} / 80</span></div>
                    <input className="input" value={subject} placeholder={suggestion} onChange={(e) => iss.setSetting('subject', e.target.value)} />
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {L('Say what is inside: "Showcase moved to Thursday · no classes 9–14 Oct" gets opened, "Newsletter Week 10" does not.', 'Nói rõ nội dung: "Showcase dời sang thứ Năm · nghỉ học 9–14/10" được mở nhiều hơn "Bản tin tuần 10".')}
                      {subject !== suggestion && <button type="button" className="font-semibold text-pra-blue hover:underline" onClick={() => iss.setSetting('subject', suggestion)}><Wand2 size={12} className="mr-0.5 inline" />{L('Use the suggestion', 'Dùng gợi ý')}</button>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5"><Mail size={13} />{L('Goes to (Bcc)', 'Gửi đến (Bcc)')} {ed.groups.map((g) => <code key={g} className="code">{g}</code>)}</span>
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
          </section>

          {office && tips && <ReadTips L={L} onHide={hideTips} />}
          {office && c.unchecked.length > 0 && <NoPhotoList />}

          {office && (dates || reminders) && (!onlyVi || [dates, reminders].some((p) => p && ['missing', 'changed'].includes(viState(p).kind))) && (
            <NeedToKnow dates={dates} reminders={reminders} issue={issue} edit={iss.edit} disabled={!office} L={L} lang={lang} />
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
        </div>

        <aside className="min-w-0 xl:sticky xl:top-24">
          {payloads && <Preview payload={payloads.pub} families={payloads.fam} L={L} />}
        </aside>
      </div>

      {publishing && <PublishPanel open onClose={() => setPublishing(false)} issue={issue} parts={parts} onIssue={iss.replaceIssue} flush={iss.flush} L={L} toast={toast} />}
      {doneOpen && <EnglishDoneModal onClose={() => setDoneOpen(false)} onDone={englishDone} needVi={c.needVi.length} L={L} />}
      {coverPick && <PhotoPicker open onClose={() => setCoverPick(false)} issueId={issue.id} max={1} by={me?.email || ''} title={L('Cover photo', 'Ảnh bìa')}
        issuePhotos={parts.flatMap((p) => p.data?.photos || [])} canSeeAlbums={office} onAdd={([p]) => iss.setSetting('cover', p)} />}
    </div>
  )
}

function EnglishDoneModal({ onClose, onDone, needVi, L }) {
  const remembered = (() => { try { return localStorage.getItem(TRANSLATOR_KEY) || '' } catch { return '' } })()
  const office = OFFICE_ACCOUNTS.filter((a) => a.access === 'admin')
  const [who, setWho] = useState(remembered || office[0]?.email || '')
  return (
    <Modal open onClose={onClose} title={L('English is done', 'Đã xong tiếng Anh')}
      footer={<><button className="btn-secondary" onClick={onClose}>{L('Cancel', 'Huỷ')}</button><button className="btn-primary" onClick={() => onDone(who)}><CheckCheck size={16} />{L('Send for Vietnamese', 'Gửi đi dịch')}</button></>}>
      <div className="space-y-3 text-sm text-slate-700">
        <p>{needVi ? L(`${needVi} part${needVi > 1 ? 's' : ''} need${needVi > 1 ? '' : 's'} Vietnamese. A To-Do goes to the person below, due Friday, with a link to this issue.`, `${needVi} phần cần dịch. Một việc sẽ được giao cho người dưới đây, hạn thứ Sáu, kèm đường dẫn đến số này.`) : L('Nothing needs Vietnamese: the issue is ready to publish.', 'Không có phần nào cần dịch: số này đã sẵn sàng để đăng.')}</p>
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
          <li>{L('Every class corner with a photo: parents read for their own child first.', 'Góc lớp nào cũng có ảnh: phụ huynh đọc phần của con mình trước tiên.')}</li>
          <li>{L('What families must do goes in Need to know, never only in a story.', 'Việc gia đình cần làm phải nằm trong phần Cần biết, đừng chỉ để trong bài viết.')}</li>
          <li>{L('Short parts. The email shows the first sentence of each: make it the point.', 'Viết ngắn. Email chỉ hiện câu đầu tiên của mỗi phần: hãy viết ý chính ở đó.')}</li>
          <li>{L('A subject line that says what is inside, and a cover photo.', 'Tiêu đề email nói rõ nội dung, và có ảnh bìa.')}</li>
          <li>{L('After publishing, paste "Copy for chat groups" into the class chats.', 'Sau khi đăng, dán "Sao chép cho nhóm chat" vào các nhóm lớp.')}</li>
        </ul>
      </div>
      <button type="button" className="btn-ghost -mr-2 -mt-2 self-start !px-2" onClick={onHide} aria-label={L('Hide', 'Ẩn')}><X size={16} /></button>
    </section>
  )
}

