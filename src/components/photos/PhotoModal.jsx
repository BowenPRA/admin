import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, EyeOff, Eye, Globe, Maximize2, ShieldAlert, Trash2 } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { Checkbox, Chip, Field, Modal, TextArea, TextInput } from '../ui'
import { SINGLE_TAGS, TAG_GROUPS, canPublish, fileKey, fileUrl, looksOf, onWebsite, scoreTone, tagValues } from '../../lib/eventPhotos'
import LookSwitch from './LookSwitch'

const PARTS = ['moment', 'people', 'light', 'frame', 'story']

// One photo, large, with everything the office can change about it. Text is
// saved when the box is left, so a half-typed caption is never sent. The parent
// gives each photo its own key, so the boxes start afresh for each one.
export default function PhotoModal({ photo, onClose, onPatch, onChecked, onRemove, onPrev, onNext, onWebsite: onChoose, onFullScreen }) {
  const { t } = useT()
  const [title, setTitle] = useState(photo.title || '')
  const [caption, setCaption] = useState(photo.caption || '')
  const [tags, setTags] = useState(() => Object.fromEntries(TAG_GROUPS.map(([k]) => [k, tagValues(photo, k).join(', ')])))

  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
      if (e.key === 'ArrowLeft') onPrev?.()
      if (e.key === 'ArrowRight') onNext?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPrev, onNext])

  const saveText = (field, value) => { if ((photo[field] || '') !== value.trim()) onPatch({ [field]: value.trim() }) }
  const saveTag = (key) => {
    const list = tags[key].split(',').map((s) => s.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean)
    const next = SINGLE_TAGS.has(key) ? (list[0] || null) : list
    if (JSON.stringify(next) === JSON.stringify(photo.tags?.[key] ?? (SINGLE_TAGS.has(key) ? null : []))) return
    const all = { ...(photo.tags || {}) }
    if (next == null || (Array.isArray(next) && !next.length)) delete all[key]; else all[key] = next
    onPatch({ tags: all })
  }
  const src = fileUrl(fileKey(photo))
  const off = photo.listed === false
  const flags = photo.privacy_flags || []
  const words = caption.trim() ? caption.trim().split(/\s+/).length : 0

  return (
    <Modal open wide onClose={onClose} title={`${photo.seq || ''}. ${photo.title || photo.code}`} subtitle={`${photo.code} · ${photo.original_name || ''}`}
      footer={(
        <>
          <button className="btn-ghost mr-auto" disabled={!onPrev} onClick={onPrev}><ChevronLeft size={16} /></button>
          <button className="btn-ghost" disabled={!onNext} onClick={onNext}><ChevronRight size={16} /></button>
          <button className="btn-secondary" onClick={onFullScreen}><Maximize2 size={16} /> {t('phFullScreen')}</button>
          <button className="btn-secondary" title={t('phDelistHint')} onClick={() => onPatch({ listed: off })}>{off ? <><Eye size={16} /> {t('phRelist')}</> : <><EyeOff size={16} /> {t('phDelist')}</>}</button>
          <button className="btn-danger" onClick={onRemove}><Trash2 size={16} /> {t('phRemove')}</button>
        </>
      )}>
      <div className="grid gap-5 md:grid-cols-5">
        <div className="space-y-3 md:col-span-3">
          <button type="button" className="flex min-h-[240px] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-xl bg-slate-900" onClick={onFullScreen} aria-label={t('phFullScreen')}>
            {src && <img src={src} alt={photo.caption || ''} className="max-h-[68vh] w-auto max-w-full" />}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Field label={t('phLook')} hint={t('phLookHint')}><LookSwitch value={photo.look} onChange={(look) => onPatch({ look })} available={looksOf(photo)} /></Field>
            <div className="text-right">
              <Chip tone={scoreTone(Number(photo.score))}>{t('phScore')}: {t('phScoreOf', { n: photo.score })}</Chip>
              <div className="mt-1 text-[11px] text-slate-400">{PARTS.filter((k) => photo.score_parts?.[k]).map((k) => `${k} ${photo.score_parts[k]}`).join(' · ')}</div>
            </div>
          </div>
          {photo.judge_note && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><b>{t('phWhy')}:</b> {photo.judge_note}</p>}
        </div>
        <div className="space-y-3 md:col-span-2">
          <Field label={t('phPhotoTitle')}><TextInput value={title} onChange={setTitle} onBlur={() => saveText('title', title)} maxLength={60} /></Field>
          <Field label={t('phCaption')} hint={t('phCaptionHint')} right={t('phPostWords', { n: words })}>
            <TextArea rows={3} value={caption} onChange={setCaption} onBlur={() => saveText('caption', caption)} />
          </Field>
          {!!flags.length && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <div className="flex items-center gap-1 font-bold"><ShieldAlert size={14} /> {t('phPrivacy')}</div>
              <div>{flags.join(', ')}</div>
              {photo.privacy_note && <div className="mt-0.5">{photo.privacy_note}</div>}
            </div>
          )}
          <div className={`rounded-lg px-3 py-2 ${photo.cleared ? 'bg-green-50' : 'bg-amber-50'}`}>
            <Checkbox checked={!!photo.cleared} onChange={onChecked} label={t('phChecked')} />
            <div className="ml-6 text-xs text-slate-500">{photo.cleared ? t('phCheckedBy', { name: photo.cleared_by || '—', date: photo.cleared_on || '' }) : t('phNotChecked')}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <Checkbox checked={!!photo.website?.want} disabled={onWebsite(photo) || (!photo.website?.want && !canPublish(photo))} onChange={onChoose}
              label={<span className="inline-flex items-center gap-1"><Globe size={14} className="text-pra-blue" /> {t('phWebChoose')}</span>} />
            <div className="ml-6 text-xs text-slate-500">{onWebsite(photo) ? t('phWebLiveHint') : canPublish(photo) ? t('phWebChooseHint') : t('phWebNeedsCheck')}</div>
            {photo.website?.slug && <div className="ml-6 break-all font-mono text-[10px] text-slate-400">{photo.website.slug}</div>}
          </div>
          <details className="rounded-lg border border-slate-200 px-3 py-2" open>
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">{t('phTags')}</summary>
            <p className="mt-1 text-xs text-slate-400">{t('phTagsHint')}</p>
            <div className="mt-2 space-y-2">
              {TAG_GROUPS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <span className="w-24 flex-none text-xs text-slate-500">{t(label)}</span>
                  <input className="input !py-1 text-xs" value={tags[key] ?? ''} onChange={(e) => setTags((x) => ({ ...x, [key]: e.target.value }))} onBlur={() => saveTag(key)} />
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>
    </Modal>
  )
}
