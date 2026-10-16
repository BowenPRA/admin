/* eslint-disable react-refresh/only-export-components */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Bold, Italic, List, Link2, Check, Languages, PencilLine, TriangleAlert } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { cleanHtml, plain, safeUrl } from '../../lib/newsletter/text'
import { TONES } from '../../lib/newsletter/constants'

/** Words in the language the app is shown in: L('English', 'Tiếng Việt'). */
export function useL() {
  const { lang } = useT()
  return { L: (en, vi) => (lang === 'vi' && vi ? vi : en), lang }
}

// ---------------- pasting from Google Docs, Word and web pages ----------------
function cleanPasted(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const unwrap = (el) => el.replaceWith(...el.childNodes)
  // Google Docs wraps everything in a <b style="font-weight:normal">.
  doc.querySelectorAll('b, strong').forEach((b) => { if (/font-weight:\s*(normal|400)/i.test(b.getAttribute('style') || '')) unwrap(b) })
  doc.querySelectorAll('span').forEach((s) => {
    const st = s.getAttribute('style') || ''
    let el = s
    if (/font-weight:\s*(bold|[6-9]00)/i.test(st)) { const b = doc.createElement('b'); b.append(...el.childNodes); el.replaceWith(b); el = b }
    if (/font-style:\s*italic/i.test(st)) { const i = doc.createElement('i'); i.append(...el.childNodes); el.replaceWith(i) }
  })
  doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => { const p = doc.createElement('p'); const b = doc.createElement('b'); b.append(...h.childNodes); p.append(b); h.replaceWith(p) })
  return cleanHtml(doc.body.innerHTML)
}
const textToHtml = (t) => String(t || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  .map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\n/g, '<br>')}</p>`).join('')

/**
 * A text box that keeps bold, italics, bullet lists and links, and nothing else.
 * Pasting from a Google Doc keeps those and drops fonts, colours and sizes.
 */
export function RichText({ value, onChange, placeholder = '', disabled = false, minHeight = 88, label, lang = 'en', invalid = false }) {
  const ref = useRef(null)
  const focused = useRef(false)
  const last = useRef(value || '')
  const [linking, setLinking] = useState(null) // { range, url }

  useLayoutEffect(() => { if (ref.current) ref.current.innerHTML = value || '' }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!focused.current && ref.current && (value || '') !== last.current) { ref.current.innerHTML = value || ''; last.current = value || '' }
  }, [value])

  const emit = () => {
    const html = cleanHtml(ref.current.innerHTML)
    last.current = html
    onChange(html)
  }
  const cmd = (name, arg = null) => { ref.current.focus(); document.execCommand(name, false, arg); emit() }
  const startLink = () => {
    const sel = window.getSelection()
    if (!sel?.rangeCount || !ref.current.contains(sel.anchorNode)) { ref.current.focus(); return }
    setLinking({ range: sel.getRangeAt(0).cloneRange(), url: 'https://' })
  }
  const finishLink = () => {
    const url = safeUrl(linking.url)
    const sel = window.getSelection()
    ref.current.focus()
    sel.removeAllRanges()
    sel.addRange(linking.range)
    if (url) document.execCommand(sel.isCollapsed ? 'insertHTML' : 'createLink', false, sel.isCollapsed ? `<a href="${url}">${url}</a>` : url)
    setLinking(null)
    emit()
  }

  return (
    <div className={`rounded-lg border bg-white ${invalid ? 'border-amber-300' : 'border-slate-300'} focus-within:border-pra-sky focus-within:ring-2 focus-within:ring-pra-sky/30 ${disabled ? 'opacity-70' : ''}`}>
      {!disabled && (
        <div className="flex items-center gap-0.5 border-b border-slate-100 px-1 py-0.5">
          {[[Bold, 'bold', 'Bold'], [Italic, 'italic', 'Italic'], [List, 'insertUnorderedList', 'Bullet list']].map(([I, c, t]) => (
            <button key={c} type="button" title={t} aria-label={t} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onMouseDown={(e) => { e.preventDefault(); cmd(c) }}><I size={15} /></button>
          ))}
          <button type="button" title="Link" aria-label="Link" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onMouseDown={(e) => { e.preventDefault(); startLink() }}><Link2 size={15} /></button>
          {linking && (
            <span className="ml-1 flex flex-1 items-center gap-1">
              <input autoFocus className="input !py-1 text-xs" value={linking.url} onChange={(e) => setLinking({ ...linking, url: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); finishLink() } if (e.key === 'Escape') setLinking(null) }} aria-label="Link address" />
              <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={finishLink}>OK</button>
            </span>
          )}
        </div>
      )}
      <div ref={ref} role="textbox" aria-multiline="true" aria-label={label} lang={lang} contentEditable={!disabled} suppressContentEditableWarning
        data-ph={placeholder}
        className="px-3 py-2 text-sm leading-relaxed text-slate-800 outline-none empty:before:text-slate-400 empty:before:content-[attr(data-ph)] [&_a]:text-pra-blue [&_a]:underline [&_p:last-child]:mb-0 [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
        style={{ minHeight }}
        onFocus={() => { focused.current = true }}
        onBlur={() => { focused.current = false; emit() }}
        onInput={emit}
        onPaste={(e) => {
          e.preventDefault()
          const html = e.clipboardData.getData('text/html')
          const clean = html ? cleanPasted(html) : textToHtml(e.clipboardData.getData('text/plain'))
          document.execCommand('insertHTML', false, clean)
          emit()
        }} />
    </div>
  )
}

/** "212 / 450" under a box, amber past the soft limit. Nothing is ever cut. */
export function Meter({ text, limit, html = false, className = '' }) {
  if (!limit) return null
  const n = (html ? plain(text) : String(text || '')).length
  if (!n) return null
  const over = n > limit
  return <span className={`text-[11px] tabular-nums ${over ? 'font-semibold text-amber-700' : 'text-slate-400'} ${className}`}>{n} / {limit}{over ? ' · long for a newsletter' : ''}</span>
}

/** Where a part's Vietnamese stands, as a small chip. */
export function ViChip({ state, L }) {
  if (state.kind === 'ok') return <span className="chip bg-green-100 text-green-800"><Check size={12} className="mr-1" />{L('Vietnamese up to date', 'Tiếng Việt đã cập nhật')}</span>
  if (state.kind === 'missing') return <span className="chip bg-amber-100 text-amber-800"><Languages size={12} className="mr-1" />{L('Vietnamese missing', 'Thiếu tiếng Việt')}{state.n > 1 ? ` · ${state.n}` : ''}</span>
  if (state.kind === 'changed') return <span className="chip bg-amber-100 text-amber-800"><PencilLine size={12} className="mr-1" />{L('English changed since translated', 'Tiếng Anh đã sửa sau khi dịch')}</span>
  if (state.kind === 'empty') return <span className="chip bg-slate-100 text-slate-500">{L('Not written yet', 'Chưa viết')}</span>
  return null
}

/** English on the left, Vietnamese on the right (one under the other on a phone). */
export function TwoCols({ en, vi, L }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2">
      <div className="min-w-0 space-y-3 p-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">English</div>
        {en}
      </div>
      <div className="min-w-0 space-y-3 border-t border-slate-100 bg-slate-50/50 p-4 lg:border-l lg:border-t-0">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-pra-green"><Languages size={12} />{L('Vietnamese', 'Tiếng Việt')}</div>
        {vi}
      </div>
    </div>
  )
}

export function Note({ children, tone = 'amber', action }) {
  const cls = tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900' : tone === 'green' ? 'border-green-200 bg-green-50 text-green-800' : tone === 'red' ? 'border-red-200 bg-red-50 text-red-700' : 'border-sky-200 bg-sky-50 text-sky-900'
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2 text-[13px] ${cls}`}>
      {tone === 'amber' && <TriangleAlert size={15} className="flex-none" />}
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  )
}

export const toneStyle = (tone) => { const t = TONES[tone] || TONES.blue; return { '--tone': t.main, '--tone-ink': t.ink, '--tone-pale': t.pale, '--tone-edge': t.edge } }
