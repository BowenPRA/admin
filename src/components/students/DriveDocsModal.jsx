import { useCallback, useState } from 'react'
import { AlertTriangle, Check, ExternalLink, FileQuestion, Minus } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { useToast } from '../../lib/toast'
import { useData } from '../../lib/DataContext'
import { LEVELS, SCHOOL_YEAR } from '../../lib/fees'
import { statusOf } from '../../lib/studentRecords'
import { NEEDED_KINDS, driveUrl, missingKinds, openId, toSort } from '../../lib/driveDocs'
import { driveMessage, saveDocLink, useDriveDocs } from '../../lib/useDriveDocs'
import { Checkbox, Modal } from '../ui'
import { CheckDriveButton, DocViewer } from './StudentDocuments'

// Students > More > Documents on Drive: for every enrolled and pending student, whether a form,
// ID papers and a photo were found; and the files in the folder that went to nobody, so the
// office can hand them to the right student. A student whose missing papers may be among files
// whose names say nothing (IMG_1234.jpg) gets a Sort button: the viewer shows those files one
// after another with a button for each kind.

export default function DriveDocsModal({ onClose, onOpenStudent }) {
  const { t } = useT()
  const toast = useToast()
  const { students, fees } = useData()
  const { files, check, error, loaded, checking, match, web } = useDriveDocs()
  const [onlyMissing, setOnlyMissing] = useState(true)
  const [busy, setBusy] = useState(false)
  const [sorting, setSorting] = useState(null) // student id
  const stopSorting = useCallback(() => setSorting(null), [])

  const levelIndex = (l) => { const i = LEVELS.indexOf(l); return i < 0 ? 99 : i }
  const current = students.filter((s) => statusOf(s) !== 'inactive')
    .sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || a.full_name.localeCompare(b.full_name))
  const rows = current.map((s) => {
    const drive = (match.byStudent.get(s.id) || []).map((d) => ({ ...d, source: 'drive', name: d.file.name }))
    const docs = [...drive, ...(web.get(s.id) || [])]
    const missing = missingKinds(docs, s)
    // Files to sort only matter while something is missing that they could be.
    return { s, docs, missing, waiting: missing.some((k) => k !== 'form') ? toSort(drive) : [] }
  })
  const withWaiting = rows.filter((r) => r.waiting.length).length
  const sortRow = rows.find((r) => r.s.id === sorting)
  const sortAs = async (d, kind) => {
    try {
      await saveDocLink({ file_id: d.file.id, student_id: sorting, kind: kind === 'hidden' ? null : kind, hidden: kind === 'hidden' })
      toast(kind === 'hidden' ? t('docsNotTheirsDone') : t('docsSaved'))
      return true
    } catch (e) { toast.error(driveMessage(e, t)); return false }
  }
  const shown = onlyMissing ? rows.filter((r) => r.missing.length) : rows
  // This year's files that went to nobody need a look; earlier years' are students who left before
  // The Current had them (Bowen, 19 October 2026: keep those in a list of their own).
  const year = fees?.schoolYear || SCHOOL_YEAR
  const unplaced = match.unplaced
  const thisYear = unplaced.filter((u) => !u.year || u.year >= year)
  const earlier = unplaced.filter((u) => u.year && u.year < year)
  const groups = [...earlier.reduce((m, u) => { const k = `${u.year}|${u.group}`; if (!m.has(k)) m.set(k, []); m.get(k).push(u); return m }, new Map())]
    .map(([k, list]) => ({ key: k, year: list[0].year, name: list[0].group, list }))
  const people = [...students].sort((a, b) => (statusOf(a) === 'inactive') - (statusOf(b) === 'inactive') || a.full_name.localeCompare(b.full_name))

  const give = async (u, studentId) => {
    if (!studentId) return
    setBusy(true)
    try { await saveDocLink({ file_id: u.file.id, student_id: studentId, kind: null, hidden: false }); toast(t('docsAdded')) } catch (e) { toast.error(driveMessage(e, t)) } finally { setBusy(false) }
  }
  const fileRow = (u) => (
    <div key={u.file.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
      <a className="min-w-0 flex-1 basis-56" href={driveUrl(openId(u.file))} target="_blank" rel="noopener noreferrer">
        <span className="flex items-center gap-1 truncate font-semibold text-slate-700 hover:text-pra-blue hover:underline">{u.file.name}<ExternalLink size={12} className="flex-none opacity-50" /></span>
        <span className="block truncate text-xs text-slate-400">{u.path.join(' › ') || t('docsNoYear')}</span>
      </a>
      <select className="input !w-48 flex-none !py-1 text-xs" value="" disabled={busy} onChange={(e) => give(u, e.target.value)} aria-label={t('docsGiveTo')}>
        <option value="">{t('docsGiveTo')}</option>
        {people.map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.level ? ` · ${s.level}` : ''}</option>)}
      </select>
    </div>
  )

  return (
    <Modal open wide onClose={onClose} title={t('docsSummary')} subtitle={t('docsSummarySub')}
      footer={<button type="button" className="btn-secondary" onClick={onClose}>{t('close')}</button>}>
      <div className="space-y-5">
        <CheckDriveButton check={check} checking={checking} />
        {error === 'setup' ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 flex-none text-amber-600" />{t('docsSetup')}</p>
        ) : error ? <p className="text-sm text-red-600">{error}</p>
          : !loaded ? <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
            : !files.length ? <p className="text-sm text-slate-500">{t('docsNeverChecked')}</p> : (<>
              <div>
                <Checkbox checked={onlyMissing} onChange={setOnlyMissing} label={`${t('docsMissingOnly')} (${rows.filter((r) => r.missing.length).length})`} />
                {withWaiting > 0 && <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-600"><FileQuestion size={14} className="mt-px flex-none text-amber-600" />{t('docsToSortNote', { n: withWaiting })}</p>}
                {shown.length === 0 ? <p className="mt-2 text-sm text-green-700">{t('docsAllFound')}</p> : (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500">
                          <th className="py-1.5 pr-3 font-semibold">{t('docsColStudent')}</th>
                          {NEEDED_KINDS.map((k) => <th key={k} className="px-2 py-1.5 text-center font-semibold">{t(`docsKind_${k}`)}</th>)}
                          <th className="px-2 py-1.5 text-right font-semibold">{t('docsColFiles')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {shown.map(({ s, docs, missing, waiting }) => (
                          <tr key={s.id}>
                            <td className="py-1.5 pr-3">
                              <button type="button" className="text-left font-semibold text-pra-blue hover:underline" onClick={() => onOpenStudent(s)}>{s.full_name}</button>
                              <span className="ml-1.5 text-xs text-slate-400">{s.level}{statusOf(s) === 'pending' ? ` · ${t('pending')}` : ''}</span>
                            </td>
                            {NEEDED_KINDS.map((k) => (
                              <td key={k} className="px-2 py-1.5 text-center">
                                {!missing.includes(k) ? <Check size={16} className="mx-auto text-green-600" aria-label="✓" />
                                  : k !== 'form' && waiting.length ? <FileQuestion size={16} className="mx-auto text-amber-600" aria-label={t('docsMaybeHere', { n: waiting.length })}><title>{t('docsMaybeHere', { n: waiting.length })}</title></FileQuestion>
                                    : <Minus size={16} className="mx-auto text-amber-500" aria-label="—" />}
                              </td>
                            ))}
                            <td className="whitespace-nowrap px-2 py-1.5 text-right text-slate-500">
                              {waiting.length > 0 && <button type="button" className="btn-secondary mr-2 !px-2 !py-0.5 text-xs" onClick={() => setSorting(s.id)}>{t('docsSortN', { n: waiting.length })}</button>}
                              {docs.filter((d) => d.source !== 'webform').length}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {thisYear.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-pra-navy">{t('docsUnplaced', { n: thisYear.length })}</div>
                  <p className="mt-1 text-xs text-slate-500">{t('docsUnplacedHint')}</p>
                  <div className="mt-2 divide-y divide-slate-100">{thisYear.map(fileRow)}</div>
                </div>
              )}
              {groups.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-pra-navy">{t('docsPrevious', { n: groups.length })}</summary>
                  <p className="mt-1 text-xs text-slate-500">{t('docsPreviousHint')}</p>
                  <div className="mt-2 space-y-1">
                    {groups.map((g) => (
                      <details key={g.key} className="rounded-lg border border-slate-200 px-3 py-1.5">
                        <summary className="cursor-pointer text-sm"><span className="font-semibold text-slate-700">{g.name}</span> <span className="text-xs text-slate-400">· {g.year} · {t('docsFilesN', { n: g.list.length })}</span></summary>
                        <div className="divide-y divide-slate-100">{g.list.map(fileRow)}</div>
                      </details>
                    ))}
                  </div>
                </details>
              )}
            </>)}
      </div>
      {sortRow && <DocViewer docs={sortRow.waiting} startId={sortRow.waiting[0]?.id} onSort={sortAs} onClose={stopSorting} closeWhenDone />}
    </Modal>
  )
}
