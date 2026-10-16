import { useEffect, useRef, useState } from 'react'
import { CircleCheck, CircleX, Copy, ExternalLink, FileText, Globe, LoaderCircle, Mail, RefreshCw, Send, TriangleAlert, Undo2 } from 'lucide-react'
import { gmailConfigured } from '../../lib/gmail'
import { EDITIONS, SOURCES } from '../../lib/newsletter/constants'
import { issueChecks, statusOf, anchorId } from '../../lib/newsletter/payload'
import { publishIssue, unpublishIssue, saveEmailDraft, readyGmail, pageIsLive, startBuild, previewPayloads, publishedFamilies } from '../../lib/newsletter/publish'
import { listViews, sumViews } from '../../lib/newsletter/data'
import { Modal } from '../ui'

const STEPS = ['photos', 'pdf', 'save', 'build', 'email']

/**
 * Publish, and everything after it: checks first; then the steps as they run;
 * then the links, the email draft, the chat message, whether the page is live,
 * and how often it has been read. Also "Take off the website".
 */
export default function PublishPanel({ open, onClose, issue, parts, onIssue, flush, L, toast }) {
  const c = issueChecks(issue, parts)
  const status = statusOf(issue, parts)
  const published = issue.status === 'published'
  const [englishOnly, setEnglishOnly] = useState(false)
  const [run, setRun] = useState(null) // { step, detail, done: Set, error, result }
  const [live, setLive] = useState(null) // null | 'waiting' | 'live' | 'slow'
  const [views, setViews] = useState(null)
  const [busy, setBusy] = useState('')
  const timer = useRef(null)
  const ed = EDITIONS[issue.edition]

  useEffect(() => () => clearInterval(timer.current), [])
  useEffect(() => { if (open && published) listViews([issue.slug]).then((rows) => setViews(sumViews(rows, issue.slug))) }, [open, published, issue.slug])

  const watchLive = () => {
    clearInterval(timer.current)
    setLive('waiting')
    const started = Date.now()
    timer.current = setInterval(async () => {
      if (await pageIsLive(issue.slug)) { setLive('live'); clearInterval(timer.current) } else if (Date.now() - started > 8 * 60 * 1000) { setLive('slow'); clearInterval(timer.current) }
    }, 20000)
  }

  const blocking = (c.needVi.length && !englishOnly) || c.unchecked.length
  const doPublish = async () => {
    // The Gmail pop-up must open straight from the click, before the long steps.
    let gmail = false
    try { gmail = await readyGmail() } catch (e) { toast.error(`Gmail: ${e.message}. The issue is published; save the email afterwards.`) }
    const done = new Set()
    setRun({ step: 'photos', detail: null, done, error: '' })
    try {
      await flush()
      const result = await publishIssue(issue, parts, { onStep: (step, detail) => { setRun((r) => { const d = new Set(r.done); STEPS.slice(0, STEPS.indexOf(step)).forEach((s) => d.add(s)); return { ...r, step, detail, done: d } }) } })
      onIssue(result.issue)
      let email = null
      if (gmail) {
        setRun((r) => ({ ...r, step: 'email', done: new Set([...r.done, 'photos', 'pdf', 'save', 'build']) }))
        try { email = await saveEmailDraft(result.issue, result.fam, result.pdfs); onIssue(email.issue) } catch (e) { email = { error: e.message } }
      }
      setRun((r) => ({ ...r, step: '', done: new Set(STEPS), result: { ...result, email } }))
      if (!result.build?.error && !result.build?.skipped) watchLive()
    } catch (e) {
      setRun((r) => ({ ...r, error: e.message || String(e) }))
    }
  }

  const doEmail = async () => {
    if (status === 'changed') { toast.error(L('The issue has changed since it was published. Publish the changes first, so the email matches the page.', 'Số này đã sửa sau khi đăng. Hãy đăng phần đã sửa trước, để email khớp với trang web.')); return }
    setBusy('email')
    try {
      await readyGmail()
      const r = await saveEmailDraft(issue, publishedFamilies(issue, parts))
      onIssue(r.issue)
      toast(L('Email draft saved in admin@ Gmail', 'Đã lưu thư nháp trong Gmail admin@'))
    } catch (e) { toast.error(e.message) } finally { setBusy('') }
  }
  const doChat = async () => {
    try {
      const { chatMessage } = await import('../../lib/newsletter/email.js')
      const { pub } = previewPayloads(issue, parts)
      await navigator.clipboard.writeText(chatMessage(pub))
      toast(L('Copied. Paste it into the class chat groups.', 'Đã sao chép. Dán vào các nhóm chat của lớp.'))
    } catch (e) { toast.error(e.message || L('The browser did not allow copying.', 'Trình duyệt không cho sao chép.')) }
  }
  const doUnpublish = async () => {
    if (!confirm(L('Take this issue off the website? Its page, photos and PDFs there are removed. The issue stays here, and you can publish it again.', 'Gỡ số này khỏi trang web? Trang, ảnh và PDF trên web sẽ bị xoá. Số báo vẫn còn ở đây và có thể đăng lại.'))) return
    setBusy('unpublish')
    try { const r = await unpublishIssue(issue); onIssue(r.issue); toast(L('Taken off the website. The page goes within a few minutes.', 'Đã gỡ khỏi trang web. Trang sẽ biến mất sau vài phút.')); onClose() } catch (e) { toast.error(e.message) } finally { setBusy('') }
  }
  const doBuild = async () => {
    setBusy('build')
    try { await startBuild(); watchLive(); toast(L('The website is being built again.', 'Trang web đang được cập nhật.')) } catch (e) { toast.error(e.message) } finally { setBusy('') }
  }

  const stepLabel = {
    photos: L('Copying the photos to the website', 'Sao chép ảnh lên trang web'),
    pdf: L('Making the PDFs in English and Vietnamese', 'Làm PDF tiếng Anh và tiếng Việt'),
    save: L('Saving the published issue', 'Lưu số đã đăng'),
    build: L('Asking the website to rebuild (about two minutes)', 'Yêu cầu trang web cập nhật (khoảng hai phút)'),
    email: L('Saving the email in admin@ Gmail, groups in Bcc, PDFs attached', 'Lưu email trong Gmail admin@, nhóm ở Bcc, kèm PDF'),
  }
  const pub = issue.published
  const url = pub?.url || { en: `https://pra.edu.vn/newsletter/${issue.slug}/`, vi: `https://pra.edu.vn/vi/newsletter/${issue.slug}/` }

  const Check = ({ ok, warn, title, children }) => (
    <li className="flex gap-3">
      {ok ? <CircleCheck size={20} className="flex-none text-green-600" /> : warn ? <TriangleAlert size={20} className="flex-none text-amber-600" /> : <CircleX size={20} className="flex-none text-red-600" />}
      <div className="min-w-0 text-sm"><b className="block text-slate-800">{title}</b><span className="text-slate-600">{children}</span></div>
    </li>
  )

  const running = run && !run.result && !run.error
  return (
    <Modal open={open} onClose={running ? () => {} : onClose} wide
      title={published && !run ? L('Published', 'Đã đăng') : L(`Publish ${ed.short}, ${issue.quarter ? `Quarter ${issue.quarter} · Week ${issue.week}` : ''}`, `Đăng ${ed.short}, Quý ${issue.quarter} · Tuần ${issue.week}`)}
      subtitle={ed.readers ? L(ed.readers.en, ed.readers.vi) : null}
      footer={!run ? (
        <>
          {published && <button className="btn-danger mr-auto" disabled={!!busy} onClick={doUnpublish}><Undo2 size={16} />{L('Take off the website', 'Gỡ khỏi trang web')}</button>}
          <button className="btn-secondary" onClick={onClose}>{L('Close', 'Đóng')}</button>
          {(!published || status === 'changed') && <button className="btn-primary" disabled={!!blocking} onClick={doPublish}><Send size={16} />{published ? L('Publish the changes', 'Đăng phần đã sửa') : L('Publish', 'Đăng')}</button>}
        </>
      ) : run.result || run.error ? <button className="btn-primary" onClick={onClose}>{L('Done', 'Xong')}</button> : null}>
      {!run && (
        <div className="space-y-5">
          {published && (
            <div className="space-y-3 rounded-xl border border-green-200 bg-green-50/60 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-green-800"><Globe size={16} /><b>{L('On the website since', 'Có trên trang web từ')} {new Date(issue.published_at).toLocaleString()}</b>{status === 'changed' && <span className="chip bg-amber-100 text-amber-800">{L('Changed since: publish the changes', 'Đã sửa sau khi đăng: hãy đăng lại')}</span>}</div>
              <Links url={url} pdf={pub?.pdf} L={L} />
              <Readers views={views} parts={parts} L={L} />
            </div>
          )}
          {(!published || status === 'changed') && (
            <ul className="space-y-3">
              <Check ok={!c.needVi.length} warn={c.needVi.length && englishOnly} title={L('Vietnamese', 'Tiếng Việt')}>
                {!c.needVi.length ? L('Every part has its Vietnamese.', 'Mọi phần đều có tiếng Việt.') : L(`${c.needVi.length} part${c.needVi.length > 1 ? 's' : ''} still need${c.needVi.length > 1 ? '' : 's'} Vietnamese.`, `Còn ${c.needVi.length} phần chưa có tiếng Việt.`)}
                {c.needVi.length > 0 && <label className="mt-1.5 flex items-start gap-2 text-[13px]"><input type="checkbox" className="mt-0.5" checked={englishOnly} onChange={(e) => setEnglishOnly(e.target.checked)} />{L('Publish now anyway. Those parts show in English on the Vietnamese page and PDF until the issue is published again.', 'Vẫn đăng bây giờ. Các phần đó sẽ hiện bằng tiếng Anh trên trang và PDF tiếng Việt cho đến khi đăng lại.')}</label>}
              </Check>
              <Check ok={!c.unchecked.length} title={L('Photos', 'Ảnh')}>
                {!c.photos.length ? L('No photos. Issues with photos get read more: think about adding a cover photo at least.', 'Chưa có ảnh. Số báo có ảnh được đọc nhiều hơn: ít nhất hãy thêm ảnh bìa.')
                  : !c.unchecked.length ? L(`${c.photos.length} photo${c.photos.length > 1 ? 's' : ''}, all checked against the no-photo list.`, `${c.photos.length} ảnh, tất cả đã đối chiếu danh sách không chụp ảnh.`)
                    : L(`${c.unchecked.length} photo${c.unchecked.length > 1 ? 's are' : ' is'} not checked against the no-photo list yet. Tick them in the issue first.`, `Còn ${c.unchecked.length} ảnh chưa đối chiếu danh sách không chụp ảnh. Hãy đánh dấu trong số báo trước.`)}
              </Check>
              <Check ok={!c.notes.length} warn title={L('Wording', 'Cách dùng từ')}>{c.notes.length ? L(`${c.notes.length} wording note${c.notes.length > 1 ? 's' : ''} (the amber boxes). You can still publish.`, `${c.notes.length} lưu ý về từ ngữ (các ô màu vàng). Vẫn có thể đăng.`) : L('No wording notes.', 'Không có lưu ý nào.')}</Check>
              <Check ok={!c.noCover && !c.noSubject && !c.noOpening} warn title={L('Ready to be read', 'Sẵn sàng để đọc')}>
                {[c.noOpening && L('There is no opening sentence.', 'Chưa có câu mở đầu.'), c.noCover && L('No cover photo: it is the picture families see first, and in the link preview on Zalo and Facebook.', 'Chưa có ảnh bìa: đây là ảnh gia đình thấy đầu tiên, và trong ô xem trước khi chia sẻ link trên Zalo, Facebook.'), c.noSubject && L('The subject line is the suggested one: a specific one gets opened more.', 'Tiêu đề email đang dùng gợi ý: tiêu đề cụ thể được mở nhiều hơn.')].filter(Boolean).join(' ') || L(`About ${c.minutes} minute${c.minutes > 1 ? 's' : ''} to read.`, `Khoảng ${c.minutes} phút để đọc.`)}
              </Check>
            </ul>
          )}
          {(!published || status === 'changed') && (
            <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-700">
              <div className="flex gap-2"><Globe size={15} className="mt-0.5 flex-none text-slate-500" /><span>{L('Website:', 'Trang web:')} <code className="code break-all">{url.en}</code> {L('and the Vietnamese page', 'và trang tiếng Việt')}</span></div>
              <div className="flex gap-2"><FileText size={15} className="mt-0.5 flex-none text-slate-500" /><span>{L('Two PDFs (English and Vietnamese), on the page and attached to the email.', 'Hai file PDF (tiếng Anh và tiếng Việt), trên trang web và đính kèm email.')}</span></div>
              <div className="flex gap-2"><Mail size={15} className="mt-0.5 flex-none text-slate-500" /><span>{gmailConfigured ? L(`Email draft in admin@ Gmail: Bcc ${ed.groups.join(', ')}. The office sends it, or schedules it for Friday 16:30.`, `Thư nháp trong Gmail admin@: Bcc ${ed.groups.join(', ')}. Văn phòng gửi hoặc hẹn giờ gửi lúc 16:30 thứ Sáu.`) : L('Gmail is not connected in this copy of The Current, so the email is not saved as a draft.', 'Bản The Current này chưa kết nối Gmail nên không lưu thư nháp được.')}</span></div>
            </div>
          )}
          {published && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={doChat}><Copy size={16} />{L('Copy for chat groups', 'Sao chép cho nhóm chat')}</button>
              <button className="btn-secondary" disabled={!!busy} onClick={doEmail}>{busy === 'email' ? <LoaderCircle size={16} className="animate-spin" /> : <Mail size={16} />}{issue.email?.saved_at ? L('Save the email again', 'Lưu lại email') : L('Save the email in Gmail', 'Lưu email vào Gmail')}</button>
              {issue.email?.link && <a className="btn-ghost" href={issue.email.link} target="_blank" rel="noreferrer"><ExternalLink size={16} />{L('Open the draft', 'Mở thư nháp')}</a>}
              <button className="btn-ghost" disabled={!!busy} onClick={doBuild}><RefreshCw size={16} />{L('Rebuild the website', 'Cập nhật trang web')}</button>
            </div>
          )}
          {live && <LiveLine live={live} url={url} L={L} />}
        </div>
      )}
      {run && (
        <div className="space-y-4">
          <ul className="space-y-2.5">
            {STEPS.filter((s) => s !== 'email' || gmailConfigured).map((s) => {
              const isDone = run.done.has(s), now = run.step === s && !run.error
              return (
                <li key={s} className="flex items-center gap-3 text-sm">
                  {isDone ? <CircleCheck size={20} className="text-green-600" /> : now ? <LoaderCircle size={20} className="animate-spin text-pra-blue" /> : <span className="h-5 w-5 rounded-full border-2 border-slate-200" />}
                  <span className={isDone || now ? 'text-slate-800' : 'text-slate-400'}>{stepLabel[s]}{now && run.detail?.total ? ` (${run.detail.done}/${run.detail.total})` : ''}</span>
                </li>
              )
            })}
          </ul>
          {run.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{run.error} {L('Nothing families can see has changed unless the step "Saving the published issue" was ticked. You can publish again.', 'Gia đình chưa thấy thay đổi gì nếu bước "Lưu số đã đăng" chưa được đánh dấu. Có thể đăng lại.')}</div>}
          {run.result && (
            <div className="space-y-3 rounded-xl border border-green-200 bg-green-50/60 p-4 text-sm">
              <b className="block text-green-800">{L('Published.', 'Đã đăng.')}</b>
              <Links url={run.result.pub.url} pdf={run.result.pub.pdf} L={L} />
              {run.result.build?.error && <p className="text-amber-800">{run.result.build.error}</p>}
              {run.result.email?.draft && <p className="flex flex-wrap items-center gap-2 text-slate-700"><Mail size={15} />{L('The email is in admin@ Drafts. Check it, then Send or Schedule send.', 'Email đã nằm trong Thư nháp admin@. Kiểm tra rồi Gửi hoặc Hẹn giờ gửi.')}<a className="font-semibold text-pra-blue underline" href={run.result.email.draft.link} target="_blank" rel="noreferrer">{L('Open the draft', 'Mở thư nháp')}</a></p>}
              {run.result.email?.error && <p className="text-amber-800">{L('The email was not saved:', 'Chưa lưu được email:')} {run.result.email.error}</p>}
              <button className="btn-secondary" onClick={doChat}><Copy size={16} />{L('Copy for chat groups', 'Sao chép cho nhóm chat')}</button>
              {live && <LiveLine live={live} url={run.result.pub.url} L={L} />}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function Links({ url, pdf, L }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      <a className="inline-flex items-center gap-1 font-semibold text-pra-blue underline" href={url.en} target="_blank" rel="noreferrer"><Globe size={14} />{L('Page in English', 'Trang tiếng Anh')}</a>
      <a className="inline-flex items-center gap-1 font-semibold text-pra-blue underline" href={url.vi} target="_blank" rel="noreferrer"><Globe size={14} />{L('Page in Vietnamese', 'Trang tiếng Việt')}</a>
      {pdf?.en && <a className="inline-flex items-center gap-1 text-pra-blue underline" href={pdf.en} target="_blank" rel="noreferrer"><FileText size={14} />PDF EN</a>}
      {pdf?.vi && <a className="inline-flex items-center gap-1 text-pra-blue underline" href={pdf.vi} target="_blank" rel="noreferrer"><FileText size={14} />PDF VI</a>}
    </div>
  )
}

function LiveLine({ live, url, L }) {
  if (live === 'live') return <p className="flex items-center gap-2 text-green-800"><CircleCheck size={16} />{L('The page is live on pra.edu.vn.', 'Trang đã có trên pra.edu.vn.')} <a className="underline" href={url.en} target="_blank" rel="noreferrer">{L('Open it', 'Mở trang')}</a></p>
  if (live === 'slow') return <p className="text-amber-800">{L('The page is not showing yet. GitHub may be slow; it also appears with the nightly build.', 'Trang chưa hiện. GitHub có thể chậm; trang cũng sẽ có sau lần cập nhật ban đêm.')}</p>
  return <p className="flex items-center gap-2 text-slate-600"><LoaderCircle size={16} className="animate-spin" />{L('The website is building. This page checks every 20 seconds.', 'Trang web đang cập nhật. Cứ 20 giây kiểm tra một lần.')}</p>
}

/** How often the issue's page was opened, and from where. */
export function Readers({ views, parts, L }) {
  if (!views) return null
  if (!views.total) return <p className="text-slate-600">{L('No one has opened the page yet. Readers show here as they come (nobody is named: only counts).', 'Chưa có ai mở trang. Số lượt đọc sẽ hiện ở đây (không ghi tên ai, chỉ đếm).')}</p>
  const anchors = Object.entries(views.anchors).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const nameOf = (a) => { const p = parts.find((x) => `s-${anchorId(x.id)}` === a); return p ? (p.data?.class || p.data?.en?.heading || p.type) : a }
  return (
    <div className="space-y-1 text-slate-700">
      <p><b className="text-lg text-slate-900">{views.total}</b> {L('page openings', 'lượt mở trang')} · EN {views.en} · VI {views.vi}</p>
      <p className="text-xs text-slate-600">{Object.entries(views.sources).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${L(SOURCES[k]?.en || k, SOURCES[k]?.vi)}: ${n}`).join(' · ')}</p>
      {anchors.length > 0 && <p className="text-xs text-slate-600">{L('Read more clicked from the email:', 'Bấm "Đọc thêm" từ email:')} {anchors.map(([a, n]) => `${nameOf(a)} (${n})`).join(', ')}</p>}
    </div>
  )
}
