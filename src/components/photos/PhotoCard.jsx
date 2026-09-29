import { EyeOff, Eye, Globe, Maximize2, PencilLine, ShieldAlert, Star } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { Checkbox, Chip } from '../ui'
import { canPublish, fileKey, fileUrl, looksOf, onWebsite, scoreTone, tagValues } from '../../lib/eventPhotos'
import LookSwitch from './LookSwitch'

// Clicking the picture opens it full screen; Details opens the title, caption and tags.
export default function PhotoCard({ photo, onView, onDetails, onLook, onChecked, onListed, onWebsite: onChoose }) {
  const { t } = useT()
  const src = fileUrl(fileKey(photo, photo.look, true))
  const off = photo.listed === false
  const tags = [...tagValues(photo, 'stage'), ...tagValues(photo, 'activity'), ...tagValues(photo, 'shot')].slice(0, 4)
  const flags = photo.privacy_flags || []
  const want = !!photo.website?.want
  const live = onWebsite(photo)
  return (
    <article className={`card flex flex-col overflow-hidden ${off ? 'opacity-60' : ''}`}>
      <button type="button" className="group relative block aspect-[4/3] w-full overflow-hidden bg-slate-100" onClick={onView} aria-label={`${t('phFullScreen')}: ${photo.title || photo.code}`}>
        {src && <img src={src} alt={photo.caption || ''} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" style={{ objectPosition: photo.focus ? `${photo.focus[0] * 100}% ${photo.focus[1] * 100}%` : undefined }} />}
        <span className="absolute bottom-2 right-2 rounded-full bg-black/55 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Maximize2 size={14} /></span>
        <span className="absolute left-2 top-2 flex gap-1">
          <span className="chip bg-white/90 text-slate-700">{photo.seq}</span>
          {photo.hero && <span className="chip bg-pra-navy text-white">{t('phHero')}</span>}
          {off && <span className="chip bg-slate-700 text-white">{t('phDelisted')}</span>}
          {live && <span className="chip bg-green-600 text-white"><Globe size={11} className="mr-1" />{t('phWebLive')}</span>}
        </span>
        <span className="absolute right-2 top-2" title={t('phScoreOf', { n: photo.score })}><Chip tone={scoreTone(Number(photo.score))}><Star size={11} className="mr-1" />{photo.score}</Chip></span>
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-800"><button type="button" className="max-w-full truncate text-left hover:text-pra-blue" onClick={onDetails}>{photo.title || photo.code}</button></h3>
          <p className="line-clamp-2 text-xs text-slate-500">{photo.caption}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {tags.map((x) => <span key={x} className="chip bg-slate-100 !px-2 text-[11px] text-slate-600">{x}</span>)}
          {!!flags.length && <span className="chip bg-amber-100 !px-2 text-[11px] text-amber-800" title={`${flags.join(', ')}${photo.privacy_note ? `: ${photo.privacy_note}` : ''}`}><ShieldAlert size={11} className="mr-1" />{t('phPrivacy')}</span>}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <LookSwitch value={photo.look} onChange={onLook} available={looksOf(photo)} className="text-xs" />
          <div className="flex gap-0.5">
            <button type="button" aria-pressed={want} disabled={live || (!want && !canPublish(photo))} className={`btn-ghost !px-2 ${want ? 'text-pra-blue' : ''}`}
              title={live ? t('phWebLive') : canPublish(photo) ? t(want ? 'phWebUnchoose' : 'phWebChoose') : t('phWebNeedsCheck')} onClick={() => onChoose(!want)}><Globe size={16} /></button>
            <button type="button" className="btn-ghost !px-2" title={off ? t('phRelist') : `${t('phDelist')}: ${t('phDelistHint')}`} onClick={() => onListed(off)}>{off ? <Eye size={16} /> : <EyeOff size={16} />}</button>
            <button type="button" className="btn-ghost !px-2" title={t('phDetails')} onClick={onDetails}><PencilLine size={16} /></button>
          </div>
        </div>
        <div className={`rounded-lg px-2.5 py-1.5 ${photo.cleared ? 'bg-green-50' : 'bg-amber-50'}`}>
          <Checkbox checked={!!photo.cleared} onChange={onChecked} label={<span className={`text-xs ${photo.cleared ? 'text-green-800' : 'text-amber-900'}`}>{t('phChecked')}</span>} />
        </div>
      </div>
    </article>
  )
}
