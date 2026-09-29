import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { dbMode } from '../../lib/db'
import { Checkbox, Modal } from '../ui'
import { planUpload, readPackage, runUpload } from '../../lib/eventUpload'

// "Upload event": choose the event's `current` folder that the laptop made, see
// what will happen, then send it with this office account. No secret key.
export default function UploadEvent({ onDone }) {
  const { t, lang } = useT()
  const nav = useNavigate()
  const input = useRef(null)
  const [pack, setPack] = useState(null) // { bundle, uploads, bytes, plan }
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const [replaceText, setReplaceText] = useState(false)
  const [delist, setDelist] = useState(true)
  const [progress, setProgress] = useState(null) // { stage, done, total }
  const [result, setResult] = useState(null)
  const running = !!progress && !result && !error

  // A folder picker, not a file picker. React does not pass this attribute through on its own.
  useEffect(() => { input.current?.setAttribute('webkitdirectory', ''); input.current?.setAttribute('directory', '') }, [])
  // Closing the page half way would leave some pictures sent and no records; ask first.
  useEffect(() => {
    if (!running) return
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [running])

  const reset = () => { setPack(null); setError(''); setProgress(null); setResult(null); setReplaceText(false); setDelist(true) }
  const close = () => { if (running) return; const done = result; reset(); if (done) onDone?.(done) }

  const onPick = async (e) => {
    const files = e.target.files
    reset()
    if (!files?.length) return
    setReading(true)
    try {
      const read = await readPackage(files)
      setPack({ ...read, plan: await planUpload(read.bundle) })
    } catch (err) { setError(err.message); setPack({}) } finally { setReading(false); e.target.value = '' }
  }

  const go = async () => {
    setError('')
    setProgress({ stage: 'pictures', done: 0, total: pack.uploads.length })
    try {
      setResult(await runUpload({ bundle: pack.bundle, uploads: pack.uploads, replaceText, delistMissing: delist, step: setProgress }))
    } catch (err) { setError(err.message) }
  }

  const ev = pack?.bundle?.event
  const plan = pack?.plan
  const day = ev?.event_date ? new Date(`${ev.event_date}T12:00:00`).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const pct = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0

  const footer = result ? (
    <>
      <button className="btn-secondary" onClick={close}>{t('close')}</button>
      <button className="btn-primary" onClick={() => { const id = result.event.id; close(); nav(`/photos/${id}`) }}>{t('phUpOpen')}</button>
    </>
  ) : plan ? (
    <>
      <button className="btn-secondary" disabled={running} onClick={close}>{t('cancel')}</button>
      <button className="btn-primary" disabled={running} onClick={go}><UploadCloud size={16} /> {running ? t('phUpSending') : t('phUpGo')}</button>
    </>
  ) : <button className="btn-secondary" onClick={close}>{t('close')}</button>

  return (
    <>
      <input ref={input} type="file" multiple className="hidden" onChange={onPick} />
      <button className="btn-primary" disabled={reading} onClick={() => input.current?.click()}><UploadCloud size={16} /> {reading ? t('phUpReading') : t('phUpload')}</button>
      <Modal open={!!pack} onClose={close} title={ev ? t('phUpTitle', { name: ev.name }) : t('phUpload')} subtitle={[day, ev?.school_year].filter(Boolean).join(' · ')} footer={footer}>
        <div className="space-y-4 text-sm text-slate-700">
          {plan && !result && (
            <>
              <ul className="space-y-1.5">
                <li>{t('phUpPhotos', { n: pack.bundle.photos.length, fresh: plan.fresh, again: plan.again })}</li>
                <li>{t('phUpPictures', { n: pack.uploads.length, mb: Math.max(1, Math.round(pack.bytes / 1e6)) })}</li>
                <li>{t('phUpPosts', { n: pack.bundle.posts.length, fresh: plan.postsNew, kept: plan.postsDraft + plan.postsDone })}</li>
                {!plan.was && <li className="text-slate-500">{t('phUpNewEvent')}</li>}
              </ul>
              {plan.delist.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <Checkbox checked={delist} onChange={setDelist} disabled={running} label={t('phUpDelist', { n: plan.delist.length })} />
                  <p className="mt-1 text-xs text-slate-600">{plan.delist.map((d) => `${d.code} ${d.title}`).join(' · ')}</p>
                  <p className="mt-1 text-xs text-slate-500">{t('phUpDelistHint')}</p>
                </div>
              )}
              {plan.was && (
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  <Checkbox checked={replaceText} onChange={setReplaceText} disabled={running} label={t('phUpReplace')} />
                  <p className="mt-1 text-xs text-slate-500">{t('phUpReplaceHint', { n: plan.again, p: plan.postsDraft })}{plan.textFix ? ` ${t('phUpReplaceGone', { n: plan.textFix })}` : ''}</p>
                </div>
              )}
              <p className="text-xs text-slate-500">{t('phUpKept')}{plan.postsDone ? ` ${t('phUpPostedKept', { n: plan.postsDone })}` : ''}</p>
              {dbMode === 'local' && <p className="text-xs text-amber-700">{t('phUpOffline')}</p>}
            </>
          )}
          {progress && !result && !error && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-600">
                <span>{progress.stage === 'pictures' ? t('phUpStagePictures', { done: progress.done, total: progress.total }) : t('phUpStageRecords')}</span>
                {progress.stage === 'pictures' && <span>{pct}%</span>}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-pra-blue transition-all" style={{ width: `${progress.stage === 'pictures' ? pct : 100}%` }} /></div>
              <p className="mt-2 text-xs text-slate-500">{t('phUpKeepOpen')}</p>
            </div>
          )}
          {result && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-800">
              {t('phUpDone', { fresh: result.fresh, again: result.again, delisted: result.delisted.length, posts: result.postsWritten })}
            </p>
          )}
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>}
        </div>
      </Modal>
    </>
  )
}
