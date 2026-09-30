import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, Send } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { Field, Modal, Segmented } from '../ui'
import { SCHEDULE_MAX_MS, SCHEDULE_MIN_MS, facebookStatus, postToFacebook } from '../../lib/facebook'
import { fileKey, fileUrl } from '../../lib/eventPhotos'

// A value for <input type="datetime-local"> in this computer's time zone.
const localInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

/** Tonight at 7:30 pm, or tomorrow's if that is too soon: the usual posting time. */
function defaultTime() {
  const d = new Date()
  d.setHours(19, 30, 0, 0)
  if (d.getTime() - Date.now() < SCHEDULE_MIN_MS) d.setDate(d.getDate() + 1)
  return localInput(d)
}

// Last look before a post goes to the Page: the text as it will read, the
// photos in order, and when. Nothing is sent until the button at the bottom.
export default function FacebookPost({ post, caption, photos, by, onBeforeSend, onPosted, onClose }) {
  const { t } = useT()
  const [page, setPage] = useState(null) // { ready, page } | { error }
  const [when, setWhen] = useState('now')
  const [time, setTime] = useState(defaultTime)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const sending = !!progress

  useEffect(() => {
    let off = false
    facebookStatus().then((s) => { if (!off) setPage(s) }, (e) => { if (!off) setPage({ error: e.message }) })
    const tick = setInterval(() => setNow(Date.now()), 30 * 1000)
    return () => { off = true; clearInterval(tick) }
  }, [])

  const at = when === 'later' && time ? new Date(time) : null
  const tooSoon = at && at.getTime() - now < SCHEDULE_MIN_MS
  const tooLate = at && at.getTime() - now > SCHEDULE_MAX_MS
  const ready = page?.ready && !(when === 'later' && (!at || tooSoon || tooLate))

  const send = async () => {
    setError('')
    setProgress({ done: 0, total: photos.length })
    try {
      await onBeforeSend()
      const row = await postToFacebook(post, photos, { at, by }, setProgress)
      onPosted(row)
    } catch (e) {
      setError(e.message)
      setProgress(null)
    }
  }

  return (
    <Modal open onClose={sending ? undefined : onClose} wide
      title={t('fbTitle')}
      subtitle={page?.page?.name ? t('fbTo', { page: page.page.name }) : page?.error ? '' : t('fbChecking')}
      footer={(
        <>
          {progress && <span className="mr-auto text-sm text-slate-600">{progress.publishing ? t('fbPublishing') : t('fbSendingPhoto', { done: progress.done + 1, total: progress.total })}</span>}
          <button className="btn-secondary" disabled={sending} onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" disabled={!ready || sending} onClick={send}>
            {when === 'later' ? <CalendarClock size={16} /> : <Send size={16} />} {when === 'later' ? t('fbSchedule') : t('fbPostNow')}
          </button>
        </>
      )}>
      {page?.error && <p className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 flex-none" /> {page.error}</p>}
      {error && <p className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 flex-none" /> {error}</p>}
      <div className="grid gap-5 sm:grid-cols-5">
        <div className="sm:col-span-3">
          <div className="label">{t('fbText')}</div>
          <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800">{caption}</p>
        </div>
        <div className="sm:col-span-2">
          <div className="label">{t('fbPhotos', { n: photos.length, shape: post.shape || '4:5' })}</div>
          <div className="grid grid-cols-4 gap-1.5">
            {photos.map((p, i) => (
              <div key={p.code} className={`relative overflow-hidden rounded-md bg-slate-100 ${i === 0 ? 'col-span-4' : ''}`} style={{ aspectRatio: i === 0 ? (post.shape || '4:5').replace(':', ' / ') : '1 / 1' }}>
                <img src={fileUrl(fileKey(p, p.look, true))} alt={p.caption || ''} className="absolute inset-0 h-full w-full object-cover" />
                {progress && (i < progress.done || progress.publishing) && <span className="absolute inset-0 bg-pra-green/30" />}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
        <Segmented value={when} onChange={setWhen} options={[{ value: 'now', label: t('fbNow') }, { value: 'later', label: t('fbLater') }]} />
        {when === 'later' && (
          <Field label={t('fbWhen')} hint={tooSoon ? t('fbTooSoon') : tooLate ? t('fbTooLate') : t('fbWhenHint')}>
            <div className="w-60"><input type="datetime-local" className="input" value={time} onChange={(e) => setTime(e.target.value)} disabled={sending} /></div>
          </Field>
        )}
        <p className="text-xs text-slate-500">{when === 'later' ? t('fbLaterNote') : t('fbNowNote')}</p>
      </div>
    </Modal>
  )
}
