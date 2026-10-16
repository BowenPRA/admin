import { useCallback, useEffect, useRef } from 'react'
import { PREVIEW_PAGE } from '../../lib/newsletter/constants'

/**
 * The full-page preview: pra.edu.vn/newsletter/preview/ in its own tab, drawn by the
 * website's own code (lib/nl-page.js in the website repo), so it is the real page.
 * This sends it the public payload when it says it is ready, and again a moment
 * after each change while it stays open. Returns open(lang).
 */
export function useFullPreview(payload) {
  const win = useRef(null)
  const latest = useRef(payload)
  const lang = useRef('en')
  const origin = useRef('')
  useEffect(() => { latest.current = payload }, [payload])

  const send = useCallback(() => {
    const w = win.current
    if (!w || w.closed || !latest.current) return
    try { w.postMessage({ type: 'nl-preview', issue: latest.current, lang: lang.current }, origin.current) } catch { /* the tab went elsewhere */ }
  }, [])

  // The page says when it is ready (on opening, and after a reload).
  useEffect(() => {
    const on = (e) => { if (win.current && e.source === win.current && e.data?.type === 'nl-preview-ready') send() }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [send])

  // Edits show in the open preview a moment after typing stops.
  useEffect(() => {
    const t = setTimeout(send, 700)
    return () => clearTimeout(t)
  }, [payload, send])

  return useCallback((l = 'en') => {
    lang.current = l === 'vi' ? 'vi' : 'en'
    origin.current = new URL(PREVIEW_PAGE).origin
    // The same tab is reused: opening again brings it to the front with the issue as it is now.
    win.current = window.open(PREVIEW_PAGE, 'pra-newsletter-preview')
    if (win.current) { try { win.current.focus() } catch { /* fine */ } }
    send()
  }, [send])
}
