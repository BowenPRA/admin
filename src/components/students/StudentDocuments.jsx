import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, File, FileQuestion, FileText, FolderOpen, Globe, IdCard, Image as ImageIcon, Pencil, Plus, RefreshCw, Users, X } from 'lucide-react'
import { db } from '../../lib/db'
import { useT } from '../../lib/i18n'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { fmtDay, fmtMoment } from '../../lib/leads'
import { foldName } from '../../lib/names'
import { statusOf } from '../../lib/studentRecords'
import { DOC_KINDS, LIST_KINDS, driveFolderUrl, drivePreviewUrl, driveUrl, missingKinds, openId, toSort } from '../../lib/driveDocs'
import { checkDrive, driveMessage, refreshIfStale, saveDocLink, useDriveDocs } from '../../lib/useDriveDocs'
import { Modal } from '../ui'

// A student's documents (lib/driveDocs.js): what is on the shared drive with their name on
// it, and what the family sent with the website form. Office accounts only. Corrections
// save by themselves, apart from the student window's Save button.

const ICON = { form: FileText, unsorted: FileQuestion, student_id: IdCard, parent_id: Users, photo: ImageIcon, other: File }
// The buttons under a Drive file in the viewer, in the order the office most often needs them.
const SORT_KINDS = ['student_id', 'parent_id', 'photo', 'form', 'other']
const isImageName = (n) => /\.(jpe?g|png|gif|webp|heic)$/i.test(n || '')
// "2026-2027" -> "2026-27"
const shortYear = (y) => (/^\d{4}-\d{4}$/.test(y || '') ? `${y.slice(0, 5)}${y.slice(7)}` : '')

/** The Check Drive button, with the time of the last check beside it. */
export function CheckDriveButton({ check, checking, small = false }) {
  const { t, lang } = useT()
  const { me } = useAuth()
  const toast = useToast()
  const run = async () => {
    try { const c = await checkDrive(me?.email); if (c) toast(t('docsCheckedOk', { n: c.files })) } catch (e) { toast.error(driveMessage(e, t)) }
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button type="button" className={`btn-secondary ${small ? '!py-1.5 text-xs' : ''}`} disabled={checking} onClick={run} title={t('docsCheckHint')}>
        <RefreshCw size={small ? 14 : 16} className={checking ? 'animate-spin' : ''} /> {checking ? t('docsChecking') : t('docsCheck')}
      </button>
      {check?.at && <span className="text-xs text-slate-400">{t('docsCheckedAt', { when: fmtMoment(check.at, lang) })}{check.by ? ` · ${check.by}` : ''}</span>}
    </div>
  )
}

/**
 * Shows one document after another inside The Current: Drive's viewer for Drive files, the file
 * itself for website uploads. With `onSort(doc, kind)` (kind 'hidden' for "Not this student's",
 * resolving true once saved), buttons under a Drive file say what it is; after one is clicked the
 * viewer moves on to the next file not sorted yet, or closes when `closeWhenDone` and none is left.
 */
export function DocViewer({ docs, startId, onClose, onSort, closeWhenDone = false }) {
  const { t } = useT()
  // The file shown, and where it was in the list: sorting can take it out of `docs` (the summary
  // lists only files not sorted yet), and then the one that took its place is shown.
  const [at, setAt] = useState({ id: startId, index: 0 })
  const [busy, setBusy] = useState(false)
  const found = docs.findIndex((x) => x.id === at.id)
  const index = found >= 0 ? found : Math.min(at.index, docs.length - 1)
  useEffect(() => { if (!docs.length) onClose() }, [docs.length, onClose])
  const onIndex = (i) => setAt({ id: docs[i]?.id, index: i })
  const d = docs[index]
  const [url, setUrl] = useState({})
  const web = d?.source === 'web'
  useEffect(() => {
    if (!web || url[d.path] !== undefined) return
    db.enrollments.fileUrls([d.path]).then((u) => setUrl((m) => ({ ...m, [d.path]: u[d.path] || '' }))).catch(() => setUrl((m) => ({ ...m, [d.path]: '' })))
  }, [web, d, url])
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1)
      if (e.key === 'ArrowRight' && index < docs.length - 1) onIndex(index + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (!d) return null
  const sort = async (kind) => {
    const after = [...docs.slice(index + 1), ...docs.slice(0, index)]
    const next = after.find((x) => x.kind === 'unsorted' && x.source === 'drive')
    setBusy(true)
    const ok = await onSort(d, kind)
    setBusy(false)
    if (!ok) return
    if (next) setAt({ id: next.id, index: docs.indexOf(next) })
    else if (closeWhenDone) onClose()
  }
  const unsorted = d.kind === 'unsorted'
  const href = web ? url[d.path] : driveUrl(openId(d.file))
  // The folders from the year down: "2026-2027 › Regular Program › Year 1 - 26-27 › Hart Family".
  const sub = [t(`docsLabel_${d.label}`), web ? t('docsWebsiteFile') : (d.path || []).join(' › ')].filter(Boolean).join(' · ')

  return (
    <Modal open wide onClose={onClose} title={d.name || d.file?.name} subtitle={sub}
      footer={(<>
        <button type="button" className="btn-secondary mr-auto" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label={t('docsPrev')}><ChevronLeft size={16} /> <span className="hidden sm:inline">{t('docsPrev')}</span></button>
        <span className="text-xs text-slate-500">{t('docsOfN', { i: index + 1, n: docs.length })}</span>
        <button type="button" className="btn-secondary" disabled={index === docs.length - 1} onClick={() => onIndex(index + 1)} aria-label={t('docsNext')}><span className="hidden sm:inline">{t('docsNext')}</span> <ChevronRight size={16} /></button>
        {href && <a className="btn-secondary" href={href} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> {web ? t('docsOpenFile') : t('docsOpenInDrive')}</a>}
      </>)}>
      {web ? (
        url[d.path] === undefined ? <div className="h-[65vh] animate-pulse rounded-lg bg-slate-100" />
          : !url[d.path] ? <p className="text-sm text-slate-500">{t('docsOpenFailed')}</p>
            : isImageName(d.name) ? <img src={url[d.path]} alt={d.name} className="mx-auto max-h-[65vh] rounded-lg object-contain" />
              : <iframe key={d.id} src={url[d.path]} title={d.name} className="h-[65vh] w-full rounded-lg border border-slate-200" />
      ) : (<>
        <iframe key={d.id} src={drivePreviewUrl(openId(d.file))} title={d.file.name} className={`${onSort ? 'h-[45vh] sm:h-[55vh]' : 'h-[65vh]'} w-full rounded-lg border border-slate-200 bg-slate-50`} allow="autoplay" />
        <p className="mt-2 text-xs text-slate-400">{t('docsViewerHint')}</p>
        {onSort && (
          <div className={`mt-3 rounded-lg border px-3 py-2 ${unsorted ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className={`text-xs font-semibold ${unsorted ? 'text-amber-900' : 'text-slate-600'}`}>{unsorted ? t('docsWhatIsThis') : t('docsFiledAs')}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SORT_KINDS.map((k) => (
                <button key={k} type="button" disabled={busy} onClick={() => sort(k)} aria-pressed={d.kind === k}
                  className={`btn-secondary !px-2.5 !py-1 text-xs ${d.kind === k ? '!border-pra-blue !bg-pra-blue !text-white' : ''}`}>{t(`docsKind_${k}`)}</button>
              ))}
              <button type="button" disabled={busy} onClick={() => sort('hidden')} className="btn-ghost !px-2.5 !py-1 text-xs text-red-600 hover:bg-red-50"><X size={13} /> {t('docsNotTheirs')}</button>
            </div>
          </div>
        )}
      </>)}
    </Modal>
  )
}

/** The Documents part of the student window. */
export default function StudentDocuments({ student }) {
  const { t, lang } = useT()
  const { me } = useAuth()
  const toast = useToast()
  const { files, check, error, loaded, checking, match, web } = useDriveDocs()
  const [editing, setEditing] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const closeViewer = useCallback(() => setViewing(null), [])
  // A list older than half an hour is read again when this tab already holds a Drive token.
  useEffect(() => { if (loaded) refreshIfStale(me?.email) }, [loaded, me?.email])

  const drive = (match.byStudent.get(student.id) || []).map((d) => ({ ...d, source: 'drive', name: d.file.name }))
  const fromWeb = web.get(student.id) || []
  const all = [...drive, ...fromWeb].sort((a, b) => LIST_KINDS.indexOf(a.kind) - LIST_KINDS.indexOf(b.kind))
  const viewable = all.filter((d) => d.source !== 'webform')
  const current = statusOf(student) !== 'inactive'
  const missing = current && loaded && !error ? missingKinds(all, student) : []
  // Their folder: where the newest form sits, or else most of their files.
  const folderId = (() => {
    const counts = new Map()
    drive.forEach((d) => counts.set(d.folderId, (counts.get(d.folderId) || 0) + (d.kind === 'form' ? 10 : 1)))
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || null
  })()

  const save = async (row, said) => {
    setBusy(true)
    try { await saveDocLink({ student_id: student.id, ...row }); if (said) toast(said); return true } catch (e) { toast.error(driveMessage(e, t)); return false } finally { setBusy(false) }
  }
  const setKind = (d, kind) => save({ file_id: d.file.id, kind, hidden: false }, t('docsSaved'))
  const notTheirs = (d) => save({ file_id: d.file.id, kind: null, hidden: true }, t('docsNotTheirsDone'))
  const sortAs = (d, kind) => (kind === 'hidden' ? notTheirs(d) : setKind(d, kind))
  const waiting = toSort(drive)
  const add = (f) => { setQ(''); save({ file_id: f.id, kind: null, hidden: false }, t('docsAdded')) }

  // Files that could be added: any in the folder that is not on the list, found by name or folder.
  const mine = new Set(drive.map((d) => d.file.id))
  const needle = foldName(q).trim()
  const byId = new Map(files.map((f) => [f.id, f]))
  const pathOf = (f) => { const out = []; let p = byId.get(f.parent_id); while (p && p.parent_id) { out.unshift(p.name); p = byId.get(p.parent_id) } return out }
  const found = needle.length < 2 ? [] : files.filter((f) => !f.is_folder && !mine.has(f.id) && foldName(`${pathOf(f).join(' ')} ${f.name}`).includes(needle)).slice(0, 8)

  if (error === 'setup') return <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 flex-none text-amber-600" />{t('docsSetup')}</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!loaded) return <div className="h-16 animate-pulse rounded-lg bg-slate-100" />

  const row = (d) => {
    const Icon = d.source === 'webform' ? Globe : ICON[d.kind] || File
    const meta = d.source === 'webform' ? '' : [
      d.label && d.label !== 'form' && d.label !== 'photo' ? t(`docsLabel_${d.label}`) : '',
      d.source === 'web' ? t('docsWebsiteFile') : shortYear(d.year),
      d.copies > 1 ? t('docsFiledTimes', { n: d.copies }) : '',
      d.how === 'office' ? t('docsByOffice') : '',
    ].filter(Boolean).join(' · ')
    return (
      <div key={d.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
        <Icon size={15} className={`flex-none ${d.source === 'drive' ? 'text-pra-blue' : 'text-pra-green'}`} />
        {d.source === 'webform' ? (
          <Link to={`/enrollments?form=${d.formId}`} className="min-w-0 flex-1 truncate font-semibold text-pra-blue hover:underline">{t('docsWebsiteForm', { date: fmtDay(d.when, lang) })}</Link>
        ) : (
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setViewing(d.id)}>
            <span className="block truncate font-semibold text-slate-800 hover:text-pra-blue hover:underline">{d.name}</span>
            {meta && <span className="block truncate text-xs text-slate-400">{meta}</span>}
          </button>
        )}
        {editing && d.source === 'drive' ? (<>
          <select className="input !w-auto flex-none !py-1 text-xs" value={d.kind} disabled={busy} aria-label={t('docsEdit')} onChange={(e) => setKind(d, e.target.value)}>
            {d.kind === 'unsorted' && <option value="unsorted" disabled>{t('docsChoose')}</option>}
            {DOC_KINDS.map((k) => <option key={k} value={k}>{t(`docsKind_${k}`)}</option>)}
          </select>
          <button type="button" className="btn-ghost flex-none !p-1.5 text-red-600 hover:bg-red-50" disabled={busy} title={t('docsNotTheirs')} aria-label={t('docsNotTheirs')} onClick={() => notTheirs(d)}><X size={14} /></button>
        </>) : d.source === 'drive' && (
          <a className="btn-ghost flex-none !p-1.5" href={driveUrl(openId(d.file))} target="_blank" rel="noopener noreferrer" title={t('docsOpenInDrive')} aria-label={t('docsOpenInDrive')}><ExternalLink size={14} /></a>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {missing.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700"><AlertTriangle size={13} /> {t('docsMissing', { list: missing.map((k) => t(`docsNeed_${k}`)).join(', ') })}</p>
      )}
      {!check && !files.length ? <p className="text-sm text-slate-500">{t('docsNeverChecked')}</p>
        : !all.length && <p className="text-sm text-slate-400">{t('docsNone')}</p>}
      {LIST_KINDS.map((k) => {
        const list = all.filter((d) => d.kind === k)
        if (!list.length) return null
        return k === 'unsorted' ? (
          <div key={k} className="rounded-lg border border-amber-300 bg-amber-50/60 p-2">
            <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs font-semibold text-amber-900">{t('docsKind_unsorted')} ({list.length})</span>
              {waiting.length > 0 && <button type="button" className="btn-secondary ml-auto !py-1 text-xs" onClick={() => setViewing(waiting[0].id)}>{t('docsSortThem')}</button>}
            </div>
            <p className="mb-1.5 text-xs text-amber-900/80">{t('docsUnsortedHint')}</p>
            <div className="space-y-1.5">{list.map(row)}</div>
          </div>
        ) : (
          <div key={k}>
            <div className="mb-1 text-xs font-semibold text-slate-500">{t(`docsKind_${k}`)}</div>
            <div className="space-y-1.5">{list.map(row)}</div>
          </div>
        )
      })}
      {editing && (
        <div>
          <label className="block"><span className="label">{t('docsAddFile')}</span>
            <input className="input text-base sm:text-sm" value={q} placeholder={t('docsAddFilePlaceholder')} onChange={(e) => setQ(e.target.value)} />
          </label>
          {found.length > 0 && (
            <div className="mt-1 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {found.map((f) => (
                <button key={f.id} type="button" disabled={busy} className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => add(f)}>
                  <Plus size={14} className="mt-0.5 flex-none text-pra-blue" />
                  <span className="min-w-0"><span className="block truncate font-semibold text-slate-700">{f.name}</span><span className="block truncate text-xs text-slate-400">{pathOf(f).join(' › ')}</span></span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <CheckDriveButton check={check} checking={checking} small />
        {folderId && <a className="btn-ghost !py-1.5 text-xs text-pra-blue" href={driveFolderUrl(folderId)} target="_blank" rel="noopener noreferrer"><FolderOpen size={14} /> {t('docsOpenFolder')}</a>}
        {files.length > 0 && <button type="button" className="btn-ghost ml-auto !py-1.5 text-xs" onClick={() => setEditing((v) => !v)}>{editing ? t('docsEditDone') : <><Pencil size={14} /> {t('docsEdit')}</>}</button>}
      </div>
      <p className="text-xs text-slate-500">{t('docsOfficeOnly')}</p>
      {viewing != null && <DocViewer docs={viewable} startId={viewing} onSort={sortAs} onClose={closeViewer} />}
    </div>
  )
}
