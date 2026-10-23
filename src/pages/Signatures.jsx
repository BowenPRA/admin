import { useEffect, useMemo, useState } from 'react'
import { PenLine, ImageUp, Download, Trash2, UserPlus, Check } from 'lucide-react'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { db } from '../lib/db'
import { fmtDate } from '../lib/money'
import { OFFICE_ACCOUNTS, ACCESS_ROLES, noLoginId } from '../data/staff'
import { Avatar, Chip, Empty, Field, Modal, PageHeader, Segmented, Select, Spinner, TextInput } from '../components/ui'
import SignSheet from '../components/signatures/SignSheet'
import UploadSheet from '../components/signatures/UploadSheet'

// Setup > Signatures: one signature per member of staff, drawn on a touch screen (or with
// a pen or a mouse) or taken from a photo of it on paper. Office accounts and head
// teachers see everyone, so the touch-screen laptop can be passed round the staff room;
// a teacher sees only their own. Nothing prints them yet (supabase/updates-2026-10-23-signatures.sql).

const ROLE_ORDER = { head: 0, teacher: 1, office: 2, other: 3 }
const needsSql = (msg) => /adm_signatures|does not exist|schema cache/i.test(msg || '')
const labelOf = (p) => (p.title ? `${p.title} ${p.name}` : p.name)

export default function Signatures() {
  const { t, lang } = useT()
  const { teachers, loading } = useData()
  const { me, isOffice, isHead } = useAuth()
  const toast = useToast()
  const everyone = isOffice || isHead
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [signing, setSigning] = useState(null)
  const [uploading, setUploading] = useState(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let on = true
    db.signatures.list()
      .then((r) => { if (on) { setRows(r); setError('') } })
      .catch((e) => { if (on) { setRows([]); setError(e.message || String(e)) } })
    return () => { on = false }
  }, [])

  const byKey = useMemo(() => new Map((rows || []).map((r) => [String(r.person).toLowerCase(), r])), [rows])

  // Everyone on the Teachers page who is still active (with or without a login), the office
  // accounts, and anyone else who has a signature saved here (added by hand, or who has left).
  const people = useMemo(() => {
    if (!me) return []
    if (!everyone) return [{ key: me.email, name: me.name, title: me.title, role: 'teacher' }].map((p) => ({ ...p, label: labelOf(p) }))
    const list = []
    const seen = new Set()
    const add = (p) => { const key = String(p.key).toLowerCase(); if (!key || seen.has(key)) return; seen.add(key); list.push({ ...p, key, label: labelOf(p) }) }
    teachers.filter((x) => x.active !== false).forEach((x) => add({ key: x.email, name: x.name || '', title: x.title || '', role: x.role === 'head' ? 'head' : 'teacher' }))
    OFFICE_ACCOUNTS.forEach((o) => add({ key: o.email, name: o.name, title: '', role: 'office' }))
    ;(rows || []).forEach((r) => add({ key: r.person, name: r.name, title: r.title, role: 'other' }))
    return list.sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name))
  }, [me, everyone, teachers, rows])

  const signedCount = people.filter((p) => byKey.has(p.key)).length
  const shown = people.filter((p) => filter === 'all' || (filter === 'done') === byKey.has(p.key))
  // After someone signs, the next person further down the list who has not.
  const nextAfter = (p) => {
    const i = people.findIndex((x) => x.key === p.key)
    return [...people.slice(i + 1), ...people.slice(0, Math.max(0, i))].find((x) => !byKey.has(x.key)) || null
  }
  const whoSaved = (email) => {
    const e = String(email || '').toLowerCase()
    const p = people.find((x) => x.key === e) || OFFICE_ACCOUNTS.find((o) => o.email === e)
    return p ? (p.label || p.name) : e
  }
  const dateOf = (row) => fmtDate(String(row.updated_at || row.created_at || '').slice(0, 10), lang)

  const save = (p) => async (png) => {
    try {
      const row = await db.signatures.save({
        person: p.key, name: p.name, title: p.title || '', image: png.image, width: png.width, height: png.height,
        method: png.method, strokes: png.strokes || null, captured_by: me?.email || '',
      })
      setRows((rs) => [...(rs || []).filter((r) => String(r.person).toLowerCase() !== p.key), row])
      if (png.method === 'uploaded') toast(t('sigSaved', { name: p.label }))
    } catch (e) {
      throw new Error(needsSql(e.message) ? t('sigNeedsSql') : e.message || String(e), { cause: e })
    }
  }

  const remove = async (p, row) => {
    if (!confirm(t('sigDeleteConfirm', { name: p.label }))) return
    try {
      await db.signatures.remove(row.id)
      setRows((rs) => rs.filter((r) => r.id !== row.id))
    } catch (e) { toast.error(e.message || String(e)) }
  }

  const download = (p, row) => {
    const a = document.createElement('a')
    a.href = row.image
    a.download = `Signature - ${p.label}.png`
    a.click()
  }

  if (loading || rows === null) return <Spinner />

  return (
    <>
      <div className="space-y-5">
        <PageHeader title={everyone ? t('sigTitle') : t('sigYours')} subtitle={everyone ? t('sigIntro') : t('sigIntroOwn')}>
          {everyone && people.length > 0 && (
            <>
              <Chip tone={signedCount === people.length ? 'green' : 'sky'}>{t('sigCount', { n: signedCount, total: people.length })}</Chip>
              <Segmented value={filter} onChange={setFilter} options={[
                { value: 'all', label: t('sigFilterAll') },
                { value: 'missing', label: t('sigFilterMissing') },
                { value: 'done', label: t('sigFilterDone') },
              ]} />
              <button type="button" className="btn-secondary" onClick={() => setAdding(true)}><UserPlus size={16} /> {t('sigOther')}</button>
            </>
          )}
        </PageHeader>

        {error && (needsSql(error)
          ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{t('sigNeedsSql')}</div>
          : <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>)}

        {!error && (shown.length === 0
          ? <Empty text={filter === 'missing' ? t('sigAllSigned') : t('sigNoneYet')} />
          : (
            <div className={everyone ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'max-w-md'}>
              {shown.map((p) => {
                const row = byKey.get(p.key)
                const role = p.role === 'office' ? t('sigOffice') : p.role === 'other' ? t('sigExtra')
                  : (lang === 'vi' ? ACCESS_ROLES[p.role].label_vi : ACCESS_ROLES[p.role].label)
                const by = String(row?.captured_by || '').includes('@') && String(row.captured_by).toLowerCase() !== p.key ? whoSaved(row.captured_by) : ''
                return (
                  <section key={p.key} className="card flex flex-col p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-slate-800">{p.label}</div>
                        <div className="text-xs text-slate-500">{role}</div>
                      </div>
                      {row ? <Chip tone="green"><Check size={12} className="mr-1" />{t('sigFilterDone')}</Chip> : <Chip tone="amber">{t('sigFilterMissing')}</Chip>}
                    </div>

                    {row ? (
                      <div className="relative mt-3 flex h-28 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-2">
                        <div className="pointer-events-none absolute inset-x-[8%] top-[80%] border-t border-slate-200" />
                        <img src={row.image} alt={t('sigAlt', { name: p.label })} className="relative max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <button type="button" onClick={() => setSigning(p)}
                        className="mt-3 flex h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-pra-sky hover:bg-sky-50 hover:text-pra-blue">
                        <PenLine size={22} />
                        <span className="text-sm font-semibold">{t('sigTapToSign')}</span>
                      </button>
                    )}

                    <div className="mt-2 min-h-[1rem] text-xs text-slate-500">
                      {row && <>{t(row.method === 'uploaded' ? 'sigUploaded' : 'sigDrawn', { date: dateOf(row) })}{by && <> · {t('sigBy', { who: by })}</>}</>}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" className={row ? 'btn-secondary' : 'btn-primary'} onClick={() => setSigning(p)}><PenLine size={16} /> {row ? t('sigSignAgain') : t('sigSign')}</button>
                      <button type="button" className="btn-secondary" onClick={() => setUploading(p)}><ImageUp size={16} /> {t('sigUpload')}</button>
                      {row && (
                        <span className="ml-auto flex gap-1">
                          <button type="button" className="btn-ghost px-2" onClick={() => download(p, row)} title={t('sigDownload')} aria-label={t('sigDownload')}><Download size={16} /></button>
                          <button type="button" className="btn-ghost px-2 text-red-500 hover:bg-red-50" onClick={() => remove(p, row)} title={t('delete')} aria-label={t('delete')}><Trash2 size={16} /></button>
                        </span>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          ))}

        <p className="text-xs text-slate-500">{t('sigPrivacy')}</p>
      </div>

        {/* Outside the spaced column above, so its spacing does not push the sheets down. */}
        {signing && (
          <SignSheet key={signing.key} person={signing}
            replacing={byKey.has(signing.key) ? dateOf(byKey.get(signing.key)) : ''}
            onSave={save(signing)} onClose={() => setSigning(null)}
            next={everyone ? nextAfter(signing) : null} onNext={() => setSigning(nextAfter(signing))} />
        )}
        {uploading && (
          <UploadSheet person={uploading}
            replacing={byKey.has(uploading.key) ? dateOf(byKey.get(uploading.key)) : ''}
            onSave={save(uploading)} onClose={() => setUploading(null)} />
        )}
        {adding && (
          <AddPerson people={people} onClose={() => setAdding(false)}
            onPick={(p, how) => { setAdding(false); if (how === 'upload') setUploading(p); else setSigning(p) }} />
        )}
    </>
  )
}

// Someone who signs PRA papers but is not on the Teachers page or an office account.
function AddPerson({ people, onClose, onPick }) {
  const { t } = useT()
  const [title, setTitle] = useState('Ms.')
  const [name, setName] = useState('')
  const clean = name.trim().replace(/\s+/g, ' ')
  const pick = (how) => {
    const key = noLoginId(clean)
    const listed = people.find((p) => p.key === key || p.name.toLowerCase() === clean.toLowerCase())
    const p = listed || { key, name: clean, title: title === '-' ? '' : title, role: 'other' }
    onPick({ ...p, label: labelOf(p) }, how)
  }
  return (
    <Modal open onClose={onClose} title={t('sigOther')} subtitle={t('sigOtherHint')} footer={(
      <>
        <button type="button" className="btn-secondary mr-auto" onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="btn-secondary" disabled={!clean} onClick={() => pick('upload')}><ImageUp size={16} /> {t('sigUpload')}</button>
        <button type="button" className="btn-primary" disabled={!clean} onClick={() => pick('draw')}><PenLine size={16} /> {t('sigSign')}</button>
      </>
    )}>
      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <Field label={t('sigTitleLabel')}>
          <Select value={title} onChange={setTitle} options={[{ value: 'Mr.', label: 'Mr.' }, { value: 'Ms.', label: 'Ms.' }, { value: 'Mrs.', label: 'Mrs.' }, { value: 'Dr.', label: 'Dr.' }, { value: '-', label: '–' }]} />
        </Field>
        <Field label={t('sigName')}>
          <TextInput value={name} onChange={setName} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && clean) pick('draw') }} />
        </Field>
      </div>
    </Modal>
  )
}
