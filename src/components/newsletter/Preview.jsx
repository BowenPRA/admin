import { useEffect, useRef, useState } from 'react'
import { CalendarPlus, Check, Clock, Download, ExternalLink, LoaderCircle, Maximize2, MessageCircleQuestion, Quote } from 'lucide-react'
import { TONES, PREVIEW_PAGE, word } from '../../lib/newsletter/constants'
import { pick } from '../../lib/newsletter/payload'
import { cleanHtml } from '../../lib/newsletter/text'
import { Segmented } from '../ui'
import { NlIcon } from './icons'

const tone = (k) => TONES[k] || TONES.blue
// A paragraph all in bold shows as a small heading, as on the page and in the email.
const subheads = (html) => cleanHtml(html).replace(/<p><b>((?:(?!<\/?(?:p|b)>).)*)<\/b><\/p>/g, '<h4>$1</h4>')
const Html = ({ html, className = '' }) => <div className={`[&_a]:text-[#116DFF] [&_a]:underline [&_h4:first-child]:mt-0 [&_h4]:mb-1.5 [&_h4]:mt-5 [&_h4]:text-[17px] [&_h4]:font-bold [&_h4]:text-[#0E2A5C] [&_li]:my-0.5 [&_p:last-child]:mb-0 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 ${className}`} dangerouslySetInnerHTML={{ __html: subheads(html) }} />
/** A field in one language, with a small "English" tag when the Vietnamese is not written yet. */
function T({ v, lang, as: As = 'span', className = '', html = false }) {
  const p = pick(v, lang)
  if (!p.text) return null
  const tag = p.english ? <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 align-middle text-[10px] font-semibold text-amber-800">{lang === 'vi' ? 'Tiếng Anh' : 'English'}</span> : null
  if (html) return <div className={className}><Html html={p.text} />{tag}</div>
  return <As className={className}>{p.text}{tag}</As>
}
function Photo({ p, lang, className = '', square = false }) {
  if (!p?.src) return <div className={`aspect-[4/3] rounded-xl bg-slate-100 ${className}`} />
  return (
    <figure className={className}>
      <img src={p.small || p.src} alt={pick(p.alt, lang).text} className={`w-full rounded-2xl border-[6px] border-white object-cover shadow-[0_4px_16px_rgba(14,42,92,.12)] ${square ? 'aspect-square' : ''}`}
        style={{ ...(!square && p.w && p.h ? { aspectRatio: `${p.w}/${p.h}` } : {}), ...(p.focus ? { objectPosition: p.focus } : {}) }} />
      <T v={p.alt} lang={lang} as="figcaption" className="mt-1.5 block text-xs leading-snug text-[#55657A]" />
    </figure>
  )
}

/** The issue as the website will show it (close to the real page, made from the same payload). */
export function WebPreview({ p, lang = 'en' }) {
  const ed = tone(p.tone)
  const font = lang === 'vi' ? '"Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif' : 'Poppins, "Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif'
  return (
    <div lang={lang} className="bg-white text-[15px] leading-relaxed text-[#1B2A41]" style={{ fontFamily: font }}>
      <header className="relative overflow-hidden px-5 pb-6 pt-5" style={{ background: ed.pale }}>
        <div className="text-xs text-[#55657A]">{lang === 'vi' ? 'Gia đình › Bản tin' : 'Families › Newsletter'}</div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[.14em]" style={{ color: TONES.green.ink }}>{p.label[lang]} · {p.day[lang]}</p>
        <h1 className="mt-1 text-[1.9rem] font-bold leading-[1.08] tracking-tight text-[#0E2A5C]">{p.edition_name[lang]}</h1>
        {p.cover && <Photo p={p.cover} lang={lang} className="mt-4" />}
        <p className="mt-4 text-base"><T v={p.opening.lead} lang={lang} as="b" className="text-[#0E2A5C]" /> </p>
        <T v={p.opening.body} lang={lang} html className="mt-1" />
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          {['en', 'vi'].map((l) => <span key={l} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 ${l === 'en' ? 'bg-[#116DFF] text-white' : 'bg-white text-[#0E2A5C] ring-1 ring-[#D3E4FF]'}`}><Download size={13} />{word(lang, l === 'en' ? 'pdfEn' : 'pdfVi')}</span>)}
        </div>
      </header>
      <div className="space-y-7 px-5 py-6">
        {(p.need.dates.length > 0 || p.need.reminders.length > 0) && (
          <section className="space-y-3 rounded-2xl border border-[#E3EAF2] p-4 shadow-[0_4px_16px_rgba(14,42,92,.07)]">
            <h2 className="text-lg font-semibold text-[#0E2A5C]">{word(lang, 'needToKnow')}</h2>
            {p.need.dates.length > 0 && <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#55657A]">{word(lang, 'dates')}</div>
              {p.need.dates.map((d) => (
                <div key={d.id} className="grid grid-cols-[minmax(0,9.5rem)_1fr] gap-x-3 border-t border-[#E3EAF2] py-2 first:border-t-0">
                  <div className="text-sm font-semibold text-[#0B4FBF]">{d.date[lang]}{d.time && <div className="text-xs font-medium text-[#55657A]">{d.time[lang]}</div>}</div>
                  <div className="text-sm"><T v={d.what} lang={lang} />{d.tag === 'off' && <span className="ml-1.5 rounded-full bg-[#FFEEEA] px-2 text-[11px] font-semibold text-[#B03523]">{word(lang, 'off')}</span>}{d.tag === 'fees' && <span className="ml-1.5 rounded-full bg-[#FFF6DE] px-2 text-[11px] font-semibold text-[#7A5000]">{word(lang, 'fees')}</span>}
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#116DFF]"><CalendarPlus size={12} />{word(lang, 'addToCalendar')}</div></div>
                </div>
              ))}
            </div>}
            {p.need.reminders.length > 0 && <div className="rounded-xl p-3" style={{ background: TONES.green.pale }}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: TONES.green.ink }}>{word(lang, 'reminders')}</div>
              <ul className="space-y-1.5">{p.need.reminders.map((r, i) => <li key={i} className="flex gap-2 text-sm"><Check size={15} className="mt-0.5 flex-none" style={{ color: TONES.green.ink }} /><T v={r} lang={lang} /></li>)}</ul>
            </div>}
          </section>
        )}
        {p.parts.length > 0 && <nav className="flex flex-wrap gap-1.5">{p.parts.filter((x) => ['story', 'class', 'photos'].includes(x.type)).map((x) => (
          <span key={x.id} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: tone(x.tone).pale, color: tone(x.tone).ink }}>
            {x.type === 'class' && <span className="h-2 w-2 rounded-full" style={{ background: tone(x.tone).main }} />}{x.type === 'class' ? x.class : pick(x.heading, lang).text}</span>))}</nav>}
        {p.parts.map((x) => {
          const t = tone(x.tone)
          if (x.type === 'story') return (
            <section key={x.id} className="space-y-2.5">
              <div className="flex items-center gap-3">{!x.emoji_heading && <span className="grid h-10 w-10 flex-none place-items-center rounded-full" style={{ background: t.pale, color: t.main }}><NlIcon name={x.icon} size={20} /></span>}<T v={x.heading} lang={lang} as="h2" className="text-lg font-semibold leading-snug text-[#0E2A5C]" /></div>
              {pick(x.when, lang).text && <p className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold" style={{ background: TONES.green.pale, color: TONES.green.ink }}><Clock size={13} /><T v={x.when} lang={lang} /></p>}
              <T v={x.body} lang={lang} html />
              {x.photos.length > 0 && <div className={`grid gap-3 ${x.photos.length === 1 ? 'grid-cols-1' : x.photos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>{x.photos.map((ph, i) => <Photo key={i} p={ph} lang={lang} square={x.photos.length > 1} />)}</div>}
              {x.button && <span className="inline-block rounded-full bg-[#116DFF] px-4 py-2 text-sm font-semibold text-white">{pick(x.button.label, lang).text}</span>}
            </section>
          )
          if (x.type === 'class') {
            return (
              <section key={x.id} className="overflow-hidden rounded-2xl border" style={{ borderColor: t.edge }}>
                <div className="flex items-center gap-3 px-4 py-3" style={{ background: t.pale }}>
                  {x.teacher?.photo ? <img src={x.teacher.photo} alt="" className="h-11 w-11 rounded-full border-2 border-white bg-white object-cover object-top" /> : <span className="h-11 w-11 rounded-full" style={{ background: t.main }} />}
                  <div><div className="text-lg font-bold leading-tight" style={{ color: t.ink }}>{x.class}</div>{x.teacher && <div className="text-xs" style={{ color: t.ink }}>{word(lang, 'fromTeacher', { name: x.teacher.name })}</div>}</div>
                </div>
                <div className="space-y-3 p-4">
                  <T v={x.body} lang={lang} html />
                  {x.photos.length > 0 && <div className={`grid gap-3 ${x.photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>{x.photos.map((ph, i) => <Photo key={i} p={ph} lang={lang} square={x.photos.length > 1} />)}</div>}
                  {x.words.length > 0 && <div><div className="mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: t.ink }}>{word(lang, 'wordsOfWeek')}</div>
                    <div className="flex flex-wrap gap-2">{x.words.map((w, i) => <span key={i} className="rounded-xl border bg-white px-3 py-1.5 text-center leading-tight" style={{ borderColor: t.edge }}><b className="block text-sm text-[#0E2A5C]">{w.en}</b><span className="text-[11px] text-[#55657A]">{w.vi}</span></span>)}</div></div>}
                  {x.ask && <div className="relative rounded-2xl border-2 bg-white px-4 py-3" style={{ borderColor: t.edge }}>
                    <div className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: t.ink }}><MessageCircleQuestion size={14} />{word(lang, 'askYourChild')}</div>
                    <T v={x.ask} lang={lang} className="text-[15px] font-medium text-[#0E2A5C]" /></div>}
                </div>
              </section>
            )
          }
          if (x.type === 'photos') return (
            <section key={x.id} className="space-y-3">
              <div className="flex items-center gap-3">{!x.emoji_heading && <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: t.pale, color: t.main }}><NlIcon name={x.icon} size={20} /></span>}<T v={x.heading} lang={lang} as="h2" className="text-lg font-semibold text-[#0E2A5C]" /></div>
              <div className="grid grid-cols-2 gap-4 px-1 pt-2">{x.photos.map((ph, i) => (
                <figure key={i} className="relative bg-white p-1.5 pb-2 shadow-[0_8px_22px_rgba(14,42,92,.16)]" style={{ transform: `rotate(${i % 2 ? 1.2 : -1.4}deg)` }}>
                  <span className="absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 -rotate-3 bg-[#FFC857]/70" />
                  <img src={ph.small || ph.src} alt={pick(ph.alt, lang).text} className="aspect-square w-full object-cover" />
                  <T v={ph.alt} lang={lang} as="figcaption" className="mt-1 block text-[11px] leading-snug text-[#55657A]" />
                </figure>))}</div>
            </section>
          )
          if (x.type === 'quote') return (
            <blockquote key={x.id} className="rounded-2xl px-5 py-4" style={{ background: TONES.green.pale }}>
              <Quote size={26} style={{ color: TONES.green.main }} />
              <T v={x.text} lang={lang} as="p" className="mt-1 text-lg font-medium leading-snug text-[#0E2A5C]" />
              <T v={x.who} lang={lang} as="p" className="mt-1 text-sm text-[#55657A]" />
            </blockquote>
          )
          if (x.type === 'press') return (
            <section key={x.id} className="rounded-2xl px-5 py-4" style={{ background: TONES.violet.pale, color: TONES.violet.ink }}>
              <div className="text-[11px] font-semibold uppercase tracking-wider">{word(lang, 'pressFrom')}</div>
              <div className="text-base font-semibold text-[#0E2A5C]">{x.title}</div>
              {x.author && <div className="text-sm">{word(lang, 'by', { name: x.author })}</div>}
              <T v={x.blurb} lang={lang} as="p" className="mt-1 text-sm text-[#1B2A41]" />
            </section>
          )
          if (x.type === 'welcome') return (
            <section key={x.id} className="rounded-2xl px-5 py-4" style={{ background: TONES.sun.pale }}>
              <T v={x.heading} lang={lang} as="h2" className="text-base font-semibold text-[#0E2A5C]" />
              <T v={x.body} lang={lang} html className="text-sm" />
              <div className="mt-2 flex flex-wrap gap-1.5">{x.names.map((n, i) => <span key={i} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-[#7A5000]">{n.name}{n.class ? ` · ${n.class}` : ''}</span>)}</div>
              <div className="mt-2 text-[11px] text-[#7A5000]">{lang === 'vi' ? 'Chỉ gửi gia đình: không đăng lên trang web.' : 'Families only: not on the public page.'}</div>
            </section>
          )
          if (x.type === 'closing') return (
            <div key={x.id} className="border-t border-[#E3EAF2] pt-4">
              <T v={x.body} lang={lang} html />
              <p className="mt-3">{word(lang, 'signoff')}<br /><b className="text-[#0E2A5C]">{word(lang, 'from')}</b></p>
            </div>
          )
          return null
        })}
      </div>
    </div>
  )
}

/** The email as Gmail will show it, from email.js. */
function EmailPreview({ p }) {
  const [out, setOut] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let on = true
    import('../../lib/newsletter/email.js').then(({ newsletterEmail }) => { if (on) setOut(newsletterEmail(p, { preview: true })) }).catch((e) => on && setErr(e.message))
    return () => { on = false }
  }, [p])
  if (err) return <p className="p-4 text-sm text-red-700">{err}</p>
  if (!out) return <p className="p-4 text-sm text-slate-500">…</p>
  return (
    <div className="bg-[#f6f8fb]">
      <div className="border-b border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><b className="text-slate-800">{out.subject}</b></div>
      <iframe title="Email" srcDoc={out.html} className="h-[1400px] w-full border-0" sandbox="allow-popups allow-popups-to-escape-sandbox" />
    </div>
  )
}

/**
 * The PDF, made as soon as this tab is opened, and made again a moment after
 * the issue changes (the last one stays on screen meanwhile).
 */
function PdfPreview({ p, lang, L }) {
  const [state, setState] = useState({ url: '', busy: true, error: '', pages: 0, size: 0 })
  const urlRef = useRef('')
  const run = useRef(0)
  const key = `${lang}|${JSON.stringify(p)}`
  useEffect(() => {
    const n = ++run.current
    const t = setTimeout(async () => {
      setState((s) => ({ ...s, busy: true, error: '' }))
      try {
        const { newsletterPdf } = await import('../../lib/newsletter/pdf.js')
        const { blob, pages } = await newsletterPdf(p, lang)
        if (n !== run.current) return
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = URL.createObjectURL(blob)
        setState({ url: urlRef.current, busy: false, error: '', pages, size: blob.size })
      } catch (e) { if (n === run.current) setState((s) => ({ ...s, busy: false, error: e.message || String(e) })) }
    }, urlRef.current ? 2500 : 0)
    return () => clearTimeout(t)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])
  return (
    <div className="space-y-2 p-3">
      <div className="flex min-h-[32px] flex-wrap items-center gap-2 text-xs text-slate-500">
        {state.busy && <span className="inline-flex items-center gap-1.5"><LoaderCircle size={14} className="animate-spin" />{state.url ? L('Updating the PDF…', 'Đang cập nhật PDF…') : L('Making the PDF…', 'Đang làm PDF…')}</span>}
        {!state.busy && state.url && <span>{L(`${state.pages} page${state.pages === 1 ? '' : 's'}`, `${state.pages} trang`)} · {(state.size / 1048576).toFixed(1)} MB</span>}
        {state.url && <a className="btn-ghost ml-auto !py-1 text-xs" href={state.url} target="_blank" rel="noreferrer"><Maximize2 size={14} />{L('Open', 'Mở')}</a>}
      </div>
      {state.error && <p className="text-sm text-red-700">{L('The PDF could not be made: ', 'Không làm được PDF: ')}{state.error}</p>}
      {state.url ? <iframe title="PDF" src={state.url} className="h-[900px] w-full rounded-lg border border-slate-200" /> : !state.error && <div className="h-[600px] w-full animate-pulse rounded-lg bg-slate-100" />}
    </div>
  )
}

/**
 * The website tab: the real page (pra.edu.vn/newsletter/preview/, drawn by the website's own
 * code) at the width of a phone, sent the issue as it changes. If the website cannot be
 * reached (no internet, or the page is not on the website yet) the simple preview shows instead.
 */
function SitePreview({ p, lang, L }) {
  const frame = useRef(null)
  const [ready, setReady] = useState(false)
  const [gone, setGone] = useState(false)
  const origin = new URL(PREVIEW_PAGE).origin
  useEffect(() => {
    const on = (e) => { if (frame.current && e.source === frame.current.contentWindow && e.data?.type === 'nl-preview-ready') setReady(true) }
    window.addEventListener('message', on)
    const t = setTimeout(() => setGone(true), 9000)
    return () => { window.removeEventListener('message', on); clearTimeout(t) }
  }, [])
  useEffect(() => {
    if (!ready) return undefined
    const t = setTimeout(() => { try { frame.current?.contentWindow?.postMessage({ type: 'nl-preview', issue: p, lang, force: true }, origin) } catch { /* reloading */ } }, 250)
    return () => clearTimeout(t)
  }, [ready, p, lang, origin])
  if (gone && !ready) {
    return (
      <div>
        <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{L('The website could not be reached, so this is a simpler preview. "Full page" shows the real page once you are online.', 'Không kết nối được trang web nên đây là bản xem trước đơn giản. "Toàn trang" sẽ hiện trang thật khi có mạng.')}</p>
        <WebPreview p={p} lang={lang} />
      </div>
    )
  }
  return <iframe ref={frame} title={L('The page on pra.edu.vn', 'Trang trên pra.edu.vn')} src={`${PREVIEW_PAGE}?embed=1`} className="block h-[calc(100vh-11rem)] min-h-[520px] w-full border-0" />
}

/** The preview beside the editor: website, email or PDF, in English or Vietnamese. */
export default function Preview({ payload, families, L, onFull }) {
  const [kind, setKind] = useState('web')
  const [lang, setLang] = useState('en')
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={kind} onChange={setKind} options={[{ value: 'web', label: L('Website', 'Trang web') }, { value: 'email', label: 'Email' }, { value: 'pdf', label: 'PDF' }]} />
        {kind !== 'email' && <Segmented value={lang} onChange={setLang} options={[{ value: 'en', label: 'EN' }, { value: 'vi', label: 'VI' }]} />}
        {onFull && <button type="button" className="btn-secondary ml-auto !px-3 !py-1.5 text-sm" onClick={() => onFull(lang)} aria-label={L('Full page preview', 'Xem toàn trang')} title={L('The page as families will see it on pra.edu.vn, in a new tab. It updates as you edit.', 'Trang web như gia đình sẽ thấy trên pra.edu.vn, trong thẻ mới. Tự cập nhật khi bạn sửa.')}><ExternalLink size={15} />{L('Full page', 'Toàn trang')}</button>}
      </div>
      <div className="max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white">
        {kind === 'web' && <SitePreview p={payload} lang={lang} L={L} />}
        {kind === 'email' && <EmailPreview p={families} />}
        {kind === 'pdf' && <PdfPreview p={payload} lang={lang} L={L} />}
      </div>
      <p className="text-xs text-slate-400">{kind === 'web' ? L('The page on pra.edu.vn as a phone shows it. "Full page" opens it full size in a new tab.', 'Trang trên pra.edu.vn như trên điện thoại. "Toàn trang" mở cỡ lớn trong thẻ mới.') : kind === 'email' ? L('The email families get: Need to know in full, the rest one tap away.', 'Email gia đình nhận: phần Cần biết đầy đủ, phần còn lại bấm để xem.') : L('The PDF attached to the email and linked on the page.', 'PDF đính kèm email và có trên trang web.')}</p>
    </div>
  )
}
