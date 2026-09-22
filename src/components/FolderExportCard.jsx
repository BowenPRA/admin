import { useEffect, useRef, useState } from 'react'
import { FolderOpen, FolderSync, CircleStop, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { Card, Checkbox } from './ui'
import { folderExportSupported, savedFolder, pickFolder, allowWriting, runFolderExport } from '../lib/folderExport'

const LAST_KEY = 'pra-admin-last-folder-export'
const readLast = () => { try { return JSON.parse(localStorage.getItem(LAST_KEY) || 'null') } catch { return null } }

// Super admin only (Settings shows it to no one else): copies every invoice,
// progress report, proof of payment and the student list into a folder on this
// computer, e.g. one that Google Drive for desktop keeps in sync.
export default function FolderExportCard() {
  const { t, lang } = useT()
  const data = useData()
  const [folder, setFolder] = useState(null)
  const [everything, setEverything] = useState(false)
  const [includeUnpublished, setIncludeUnpublished] = useState(true)
  const [progress, setProgress] = useState(null) // { done, total, label } while exporting
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [last, setLast] = useState(readLast)
  const signal = useRef({ cancelled: false })

  useEffect(() => { if (folderExportSupported) savedFolder().then((h) => h && setFolder(h)) }, [])

  const choose = async () => {
    setError('')
    try { const h = await pickFolder(); if (h) { setFolder(h); setResult(null) } } catch (e) { setError(e.message || String(e)) }
  }
  const run = async () => {
    setError(''); setResult(null)
    try {
      if (!(await allowWriting(folder))) { setError(t('folderExportDenied')); return }
      signal.current = { cancelled: false }
      setProgress({ done: 0, total: 0, label: '' })
      const out = await runFolderExport(folder, data, { everything, includeUnpublished }, setProgress, signal.current)
      setResult(out)
      if (!out.cancelled) {
        const stamp = { at: new Date().toISOString(), folder: folder.name }
        try { localStorage.setItem(LAST_KEY, JSON.stringify(stamp)) } catch { /* ignore */ }
        setLast(stamp)
      }
    } catch (e) {
      setError(e.name === 'NotFoundError' ? t('folderExportGone') : e.message || String(e))
    } finally { setProgress(null) }
  }

  const running = !!progress
  const pct = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0
  const when = (iso) => new Date(iso).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <Card title={t('folderExport')} subtitle={t('folderExportSuper')}>
      <p className="mb-3 text-sm text-slate-500">{t('folderExportHint')}</p>
      {!folderExportSupported ? (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"><AlertTriangle size={16} className="flex-none" /> {t('folderExportUnsupported')}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-secondary" onClick={choose} disabled={running}><FolderOpen size={16} /> {folder ? t('folderExportChange') : t('folderExportChoose')}</button>
            {folder && <span className="text-sm text-slate-600">{t('folderExportTo')} <span className="code">{folder.name}</span></span>}
            {last && <span className="text-xs text-slate-400">· {t('folderExportLast', { when: when(last.at) })}</span>}
          </div>
          {folder && (<>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <Checkbox checked={includeUnpublished} onChange={setIncludeUnpublished} disabled={running} label={t('folderExportUnpublished')} />
              <Checkbox checked={everything} onChange={setEverything} disabled={running} label={t('folderExportEverything')} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary" onClick={run} disabled={running || data.loading}><FolderSync size={16} /> {running ? t('folderExportRunning') : t('folderExportRun')}</button>
              {running && <button className="btn-secondary" onClick={() => { signal.current.cancelled = true }}><CircleStop size={16} /> {t('cancel')}</button>}
            </div>
          </>)}
          {running && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-pra-blue transition-all" style={{ width: `${pct}%` }} /></div>
              <div className="mt-1 truncate text-xs text-slate-500">{progress.total ? `${progress.done}/${progress.total} · ${progress.label}` : t('folderExportPreparing')}</div>
            </div>
          )}
          {result && (
            <div className={`rounded-lg px-3 py-2 text-sm ${result.failed.length ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'}`}>
              <div className="flex items-center gap-2 font-semibold">
                {result.failed.length ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                {result.cancelled ? t('folderExportStopped') : t('folderExportDone')} {t('folderExportSummary', { written: result.written, unchanged: result.unchanged })}
              </div>
              <div className="mt-0.5 text-xs">{t('folderExportCounts', { invoices: result.counts.invoice, reports: result.counts.report, proofs: result.counts.proof, sheets: result.counts.sheet })}</div>
              {result.failed.length > 0 && (
                <details className="mt-1 text-xs"><summary className="cursor-pointer font-semibold">{t('folderExportFailed', { n: result.failed.length })}</summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">{result.failed.map((f) => <li key={f}>{f}</li>)}</ul>
                </details>
              )}
            </div>
          )}
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        </div>
      )}
    </Card>
  )
}
