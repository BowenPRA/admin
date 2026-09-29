import { useState } from 'react'
import { Archive, Check, Copy, Download, Globe, HardDrive, ShieldCheck } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { useToast } from '../../lib/toast'
import { Card, Chip } from '../ui'
import { WEBSITE_URL, allKeys, canPublish, fileKey, fileUrl, finishPlan, onWebsite, saveBlob, websiteList } from '../../lib/eventPhotos'

function Step({ n, title, children }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-pra-blue text-xs font-bold text-white">{n}</span>
      <div className="min-w-0 flex-1 space-y-2 pb-1"><h3 className="text-sm font-bold text-slate-800">{title}</h3>{children}</div>
    </li>
  )
}

// Getting photos off private storage. Two ways out: "Finish event" keeps one
// look of each photo; a photo chosen for the public website moves there once
// the website has it. Only photos checked against the no-photo list can be chosen.
export default function WebsitePanel({ event, photos, onChoose, onChooseAll, onFinish, onMove }) {
  const { t } = useT()
  const toast = useToast()
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState(null)

  const album = photos.filter((p) => p.listed !== false)
  const can = album.filter(canPublish)
  const chosen = can.filter((p) => p.website?.want)
  const moved = chosen.filter(onWebsite)
  const waiting = chosen.filter((p) => !onWebsite(p))
  const list = websiteList(event, photos)
  const plan = finishPlan(photos)
  const stored = allKeys(photos).length
  const finished = event.notes?.finished
  const command = `node "C:\\Users\\bowen\\pra-website\\scripts\\add-event-photos.mjs" "C:\\Users\\bowen\\Downloads\\website-${event.slug}.json"`

  const run = async (name, fn) => {
    setBusy(name)
    try { await fn() } catch (e) { toast.error(e.message) } finally { setBusy(''); setProgress(null) }
  }
  const download = () => {
    saveBlob(new Blob([JSON.stringify(list, null, 1)], { type: 'application/json' }), `website-${event.slug}.json`)
    toast(t('phWebListSaved', { n: list.photos.length }))
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(command); toast(t('phWebCommandCopied')) } catch { toast.error('The browser did not allow copying. Select the text and copy it by hand.') }
  }
  const finish = () => {
    if (!window.confirm(t('phFinConfirm', { n: plan.rows.filter((r) => r.drop.length).length, files: plan.drop }))) return
    run('finish', onFinish)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Card className="lg:col-span-3" title={<><Globe size={17} className="text-pra-blue" /> {t('phWebTitle')}</>} subtitle={t('phWebSubtitle')}>
        <ol className="space-y-5">
          <Step n={1} title={t('phWebStepChoose')}>
            <p className="text-sm text-slate-600">{t('phWebChooseCount', { can: can.length, all: album.length, chosen: chosen.length })}</p>
            {can.length < album.length && <p className="flex items-start gap-1.5 text-xs text-amber-800"><ShieldCheck size={14} className="mt-px flex-none" /> {t('phWebNeedsCheck')}</p>}
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary text-xs" disabled={!can.length || chosen.length === can.length} onClick={() => onChooseAll(true)}>{t('phWebChooseAll', { n: can.length })}</button>
              <button className="btn-ghost text-xs" disabled={!waiting.length} onClick={() => onChooseAll(false)}>{t('phWebChooseNone')}</button>
            </div>
          </Step>
          <Step n={2} title={t('phWebStepSend')}>
            <p className="text-sm text-slate-600">{t('phWebSendHint')}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={!list.photos.length && !list.take_down.length} onClick={download}><Download size={16} /> {t('phWebList')} ({list.photos.length})</button>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-slate-900 px-3 py-2">
              <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-slate-100">{command}</code>
              <button className="flex-none rounded p-1 text-slate-300 hover:bg-slate-700" onClick={copy} title={t('phWebCommandCopy')}><Copy size={14} /></button>
            </div>
            {!!list.take_down.length && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{t('phWebTakeDown', { n: list.take_down.length })}</p>}
          </Step>
          <Step n={3} title={t('phWebStepMove')}>
            <p className="text-sm text-slate-600">{t('phWebMoveHint')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-green" disabled={!waiting.length || !!busy} onClick={() => run('move', () => onMove(setProgress))}><HardDrive size={16} /> {busy === 'move' ? t('phWebMoving', progress || { done: 0, total: waiting.length }) : t('phWebMove', { n: waiting.length })}</button>
              <a className="btn-ghost text-xs" href={`${WEBSITE_URL}/album/`} target="_blank" rel="noreferrer">{t('phWebOpenAlbum')}</a>
            </div>
          </Step>
        </ol>
      </Card>

      <div className="space-y-5 lg:col-span-2">
        <Card title={<><Archive size={17} className="text-pra-blue" /> {t('phFinTitle')}</>} subtitle={t('phFinSubtitle')}>
          <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
            {[[stored, 'phFinStored'], [moved.length, 'phFinOnWebsite'], [plan.drop, 'phFinCanGo']].map(([n, l]) => (
              <div key={l} className="rounded-lg bg-slate-50 px-2 py-2"><dt className="text-[11px] text-slate-500">{t(l)}</dt><dd className="text-lg font-black text-slate-800">{n}</dd></div>
            ))}
          </dl>
          {finished && <p className="mb-2 text-xs text-slate-500"><Check size={13} className="mr-1 inline text-green-600" />{t('phFinDone', { name: finished.by || '—', date: finished.on || '' })}</p>}
          <button className="btn-secondary w-full justify-center" disabled={!plan.drop || !!busy} onClick={finish}><Archive size={16} /> {busy === 'finish' ? t('phFinWorking') : t('phFinGo', { files: plan.drop })}</button>
          <p className="mt-2 text-xs text-slate-500">{t('phFinHint')}</p>
        </Card>

        <Card title={t('phWebChosen', { n: chosen.length })}>
          {!chosen.length && <p className="text-sm text-slate-400">{t('phWebNoneChosen')}</p>}
          <ul className="space-y-2">
            {chosen.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5">
                <span className="relative h-11 w-14 flex-none overflow-hidden rounded bg-slate-100">{fileUrl(fileKey(p, p.look, true)) && <img src={fileUrl(fileKey(p, p.look, true))} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-700">{p.title}</span><span className="block truncate font-mono text-[10px] text-slate-400">{p.website.slug}</span></span>
                {onWebsite(p) ? <Chip tone="green">{t('phWebLive')}</Chip> : <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => onChoose(p, false)}>{t('phWebTakeOff')}</button>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
