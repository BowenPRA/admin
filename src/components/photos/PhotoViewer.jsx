import { useEffect, useMemo, useRef } from 'react'
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, Globe, PencilLine, ShieldAlert, Star, X } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { LOOKS, canPublish, fileKey, fileUrl, looksOf, onWebsite } from '../../lib/eventPhotos'

// Keys for the looks: N (or O) for none, then A, B, C; 1 to 4 also work.
const KEYS = { n: 'original', o: 'original', a: 'A', b: 'B', c: 'C', 1: 'original', 2: 'A', 3: 'B', 4: 'C' }
const preload = (url) => { if (url) new Image().src = url }

/**
 * One photo at a time, filling the screen, for going through an event: arrows or
 * swipes move between photos and N A B C picks the look, which is saved at once.
 * It asks the browser for full screen; leaving full screen (Esc) closes it.
 */
export default function PhotoViewer({ photo, index, total, onClose, onPrev, onNext, onLook, onChecked, onListed, onWebsite: onChoose, onDetails }) {
  const { t } = useT()
  const touch = useRef(null)
  const available = useMemo(() => looksOf(photo), [photo])
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })
  const off = photo.listed === false
  const want = !!photo.website?.want
  const live = onWebsite(photo)
  const flags = photo.privacy_flags || []

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const root = document.documentElement
    let full = false
    const onChange = () => { if (full && !document.fullscreenElement) close.current(); full = !!document.fullscreenElement }
    document.addEventListener('fullscreenchange', onChange)
    if (!document.fullscreenElement) root.requestFullscreen?.().catch(() => {})
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
      const look = KEYS[e.key.toLowerCase()]
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev?.()
      else if (e.key === 'ArrowRight') onNext?.()
      else if (look && available.includes(look)) onLook(look)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext, onLook, available])

  // The other looks of this photo, so switching is instant.
  useEffect(() => { for (const l of available) preload(fileUrl(fileKey(photo, l))) }, [photo, available])

  const src = fileUrl(fileKey(photo))
  const swipeStart = (e) => { touch.current = e.touches[0].clientX }
  const swipeEnd = (e) => {
    if (touch.current == null) return
    const dx = e.changedTouches[0].clientX - touch.current
    touch.current = null
    if (dx > 50) onPrev?.()
    if (dx < -50) onNext?.()
  }
  const bar = 'flex items-center gap-2 bg-black/60 px-3 py-2.5 sm:px-5'
  const ghost = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-35'
  const arrow = 'absolute top-1/2 hidden -translate-y-1/2 rounded-full bg-black/45 p-3 text-white transition-colors hover:bg-black/70 disabled:opacity-0 sm:block'

  return (
    <div role="dialog" aria-modal="true" aria-label={photo.title || photo.code} className="fixed inset-0 z-[60] flex flex-col bg-neutral-950 text-white">
      <div className={bar}>
        <span className="flex-none rounded-md bg-white/10 px-2 py-1 text-xs font-bold tabular-nums">{t('phPosition', { n: index + 1, m: total })}</span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-bold sm:text-base">{photo.title || photo.code}</h2>
            <span className="inline-flex flex-none items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold" title={t('phScoreOf', { n: photo.score })}><Star size={11} />{photo.score}</span>
            {photo.hero && <span className="hidden flex-none rounded-full bg-pra-blue px-2 py-0.5 text-xs font-semibold sm:inline">{t('phHero')}</span>}
            {off && <span className="flex-none rounded-full bg-slate-600 px-2 py-0.5 text-xs font-semibold">{t('phDelisted')}</span>}
            {!!flags.length && <span className="inline-flex flex-none items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950" title={`${flags.join(', ')}${photo.privacy_note ? `: ${photo.privacy_note}` : ''}`}><ShieldAlert size={11} />{t('phPrivacy')}</span>}
          </div>
          {photo.caption && <p className="hidden truncate text-xs text-white/60 sm:block">{photo.caption}</p>}
        </div>
        <button type="button" className={ghost} onClick={onDetails}><PencilLine size={16} /><span className="hidden sm:inline">{t('phDetails')}</span></button>
        <button type="button" className={ghost} onClick={onClose} aria-label={t('phClose')} title={`${t('phClose')} (Esc)`}><X size={20} /></button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2 sm:px-16" onTouchStart={swipeStart} onTouchEnd={swipeEnd}>
        {src && <img src={src} alt={photo.caption || ''} className="max-h-full max-w-full object-contain" draggable={false} />}
        <button type="button" className={`${arrow} left-3`} disabled={!onPrev} onClick={onPrev} aria-label={t('phPrev')}><ChevronLeft size={26} /></button>
        <button type="button" className={`${arrow} right-3`} disabled={!onNext} onClick={onNext} aria-label={t('phNext')}><ChevronRight size={26} /></button>
      </div>

      <div className={`${bar} flex-wrap justify-center gap-y-2`}>
        <button type="button" className={`${ghost} sm:hidden`} disabled={!onPrev} onClick={onPrev} aria-label={t('phPrev')}><ChevronLeft size={20} /></button>
        <div className="inline-flex rounded-xl bg-white/10 p-1" role="group" aria-label={t('phLook')} title={t('phLookHint')}>
          {LOOKS.map((l) => (
            <button key={l} type="button" aria-pressed={photo.look === l} disabled={!available.includes(l)} onClick={() => onLook(l)}
              className={`min-w-[3.25rem] rounded-lg px-3 py-1.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${photo.look === l ? 'bg-white text-slate-900' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>
              {l === 'original' ? t('phLookOriginal') : l}
            </button>
          ))}
        </div>
        <button type="button" className={`${ghost} sm:hidden`} disabled={!onNext} onClick={onNext} aria-label={t('phNext')}><ChevronRight size={20} /></button>
        <span className="mx-1 hidden h-6 w-px bg-white/20 sm:block" />
        <button type="button" aria-pressed={!!photo.cleared} onClick={() => onChecked(!photo.cleared)} title={t('phChecked')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${photo.cleared ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-amber-400 text-amber-950 hover:bg-amber-300'}`}>
          {photo.cleared ? <><Check size={16} /> {t('phStatusChecked')}</> : <><ShieldAlert size={16} /> {t('phMarkChecked')}</>}
        </button>
        <button type="button" aria-pressed={want} disabled={live || (!want && !canPublish(photo))} onClick={() => onChoose(!want)}
          className={`${ghost} ${want ? '!bg-pra-blue !text-white' : ''}`} title={live ? t('phWebLive') : canPublish(photo) ? t(want ? 'phWebUnchoose' : 'phWebChoose') : t('phWebNeedsCheck')}>
          <Globe size={16} /><span className="hidden md:inline">{live ? t('phWebLive') : t('phWebChoose')}</span>
        </button>
        <button type="button" className={ghost} onClick={() => onListed(off)} title={off ? t('phRelist') : `${t('phDelist')}: ${t('phDelistHint')}`}>
          {off ? <Eye size={16} /> : <EyeOff size={16} />}<span className="hidden md:inline">{off ? t('phRelist') : t('phDelist')}</span>
        </button>
        <span className="ml-auto hidden text-[11px] text-white/45 xl:block">{t('phKeys')}</span>
      </div>
    </div>
  )
}
