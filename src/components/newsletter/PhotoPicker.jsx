import { useEffect, useMemo, useState } from 'react'
import { Check, ImagePlus, Lock, ShieldAlert, Upload } from 'lucide-react'
import { db } from '../../lib/db'
import { fileKey, fileUrl, prepareFiles } from '../../lib/eventPhotos'
import { addPhoto, photoLink } from '../../lib/newsletter/photos'
import { Modal, Segmented, Spinner } from '../ui'
import { useL } from './bits'

/**
 * Adds photos to a part (or chooses the cover): uploaded from this phone or
 * computer, picked from an album in the Photos tab, or (for the cover) one of
 * the issue's own photos. Album photos can only be picked once they are checked
 * against the no-photo list, as for the website and Facebook. Resolves with the
 * stored photos through onAdd([photo]).
 */
export default function PhotoPicker({ open, onClose, onAdd, issueId, max = 3, by = '', issuePhotos = null, title, canSeeAlbums = true }) {
  const { L } = useL()
  const [tab, setTab] = useState(issuePhotos?.length ? 'issue' : 'upload')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const done = async (fn) => {
    setError('')
    try { const photos = await fn(); if (photos?.length) { onAdd(photos); onClose() } } catch (e) { setError(e.message || String(e)) } finally { setBusy('') }
  }

  const upload = (files) => done(async () => {
    const list = [...(files || [])].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|heic|webp)$/i.test(f.name)).slice(0, max)
    const out = []
    for (const [i, f] of list.entries()) {
      setBusy(L(`Making photo ${i + 1} of ${list.length} smaller…`, `Đang thu nhỏ ảnh ${i + 1}/${list.length}…`))
      out.push(await addPhoto(issueId, f, { by }))
    }
    return out
  })

  const tabs = [
    ...(issuePhotos?.length ? [{ value: 'issue', label: L('In this issue', 'Trong số này') }] : []),
    { value: 'upload', label: L('Upload', 'Tải lên') },
    ...(canSeeAlbums ? [{ value: 'album', label: L('From the Photos tab', 'Từ mục Ảnh') }] : []),
  ]

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} wide title={title || L('Add photos', 'Thêm ảnh')}
      subtitle={max > 1 ? L(`Up to ${max} more`, `Tối đa ${max} ảnh nữa`) : null}>
      <div className="space-y-4">
        {tabs.length > 1 && <Segmented value={tab} onChange={setTab} options={tabs} />}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {busy ? <div className="py-8 text-center text-sm text-slate-500"><Spinner />{busy}</div>
          : tab === 'upload' ? <UploadTab onFiles={upload} L={L} />
            : tab === 'issue' ? <IssueTab photos={issuePhotos} onPick={(p) => { onAdd([p]); onClose() }} L={L} />
              : <AlbumTab max={max} L={L} onPick={(picked) => done(async () => {
                const out = []
                for (const [i, { event, photo }] of picked.entries()) {
                  setBusy(L(`Copying photo ${i + 1} of ${picked.length}…`, `Đang sao chép ảnh ${i + 1}/${picked.length}…`))
                  const key = fileKey(photo)
                  if (!/^https?:/.test(key)) await prepareFiles([key])
                  const src = fileUrl(key)
                  if (!src) throw new Error(L('That photo could not be loaded from the Photos tab.', 'Không tải được ảnh từ mục Ảnh.'))
                  out.push(await addPhoto(issueId, src, { by, extra: { source: 'album', album: event.slug, en: photo.caption || '', cleared: true, cleared_by: photo.cleared_by || '', cleared_on: photo.cleared_on || '' } }))
                }
                return out
              })} />}
      </div>
    </Modal>
  )
}

function UploadTab({ onFiles, L }) {
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-center text-slate-600 hover:border-pra-blue hover:bg-sky-50/40">
        <Upload size={28} className="text-pra-blue" />
        <span className="font-semibold">{L('Choose photos from this phone or computer', 'Chọn ảnh từ điện thoại hoặc máy tính')}</span>
        <span className="text-xs text-slate-500">{L('They are made smaller and the hidden camera data (including where they were taken) is removed before they are saved.', 'Ảnh được thu nhỏ và xoá thông tin ẩn của máy ảnh (kể cả nơi chụp) trước khi lưu.')}</span>
        <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
      </label>
      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
        <ShieldAlert size={16} className="mt-0.5 flex-none" />
        <span>{L('Uploaded photos must be checked against the no-photo list before the issue can be published. The office does this in the issue.', 'Ảnh tải lên phải được đối chiếu danh sách không chụp ảnh trước khi đăng số này. Văn phòng kiểm tra trong số báo.')}</span>
      </div>
    </div>
  )
}

function IssueTab({ photos, onPick, L }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {photos.map((p) => (
        <button key={p.key} type="button" onClick={() => onPick(p)} className="group overflow-hidden rounded-xl border-2 border-slate-200 text-left hover:border-pra-blue">
          <img src={photoLink(p)?.small} alt="" className="aspect-[4/3] w-full object-cover" />
          <span className="block truncate px-2 py-1 text-xs text-slate-600">{p.en || L('No caption', 'Chưa có chú thích')}</span>
        </button>
      ))}
    </div>
  )
}

function AlbumTab({ onPick, max, L }) {
  const [events, setEvents] = useState(null)
  const [eventId, setEventId] = useState('')
  const [loaded, setLoaded] = useState({ eventId: '', photos: null })
  const [chosen, setChosen] = useState([])
  const [, setTick] = useState(0)

  useEffect(() => {
    db.photoEvents.list().then((evs) => {
      const list = evs.filter((e) => e.status !== 'requested').sort((a, b) => String(b.event_date || '').localeCompare(String(a.event_date || '')))
      setEvents(list)
      if (list[0]) setEventId(list[0].id)
    }).catch(() => setEvents([]))
  }, [])
  useEffect(() => {
    if (!eventId) return
    let on = true
    db.eventPhotos.list(eventId).then(async (ps) => {
      const list = ps.filter((p) => p.listed !== false).sort((a, b) => (a.seq || 999) - (b.seq || 999))
      if (on) setLoaded({ eventId, photos: list })
      if (await prepareFiles(list.map((p) => fileKey(p, p.look, true))).catch(() => false)) setTick((n) => n + 1)
    }).catch(() => on && setLoaded({ eventId, photos: [] }))
    return () => { on = false }
  }, [eventId])
  const photos = loaded.eventId === eventId ? loaded.photos : null
  const event = useMemo(() => events?.find((e) => e.id === eventId), [events, eventId])

  if (!events) return <Spinner />
  if (!events.length) return <p className="py-6 text-center text-sm text-slate-500">{L('There are no albums in the Photos tab yet.', 'Chưa có album nào trong mục Ảnh.')}</p>
  const toggle = (p) => setChosen((c) => (c.includes(p.id) ? c.filter((x) => x !== p.id) : c.length < max ? [...c, p.id] : c))
  return (
    <div className="space-y-3">
      <select className="input sm:w-80" value={eventId} onChange={(e) => { setEventId(e.target.value); setChosen([]) }} aria-label={L('Album', 'Album')}>
        {events.map((e) => <option key={e.id} value={e.id}>{e.name}{e.event_date ? ` · ${e.event_date}` : ''}</option>)}
      </select>
      {!photos ? <Spinner /> : !photos.length ? <p className="text-sm text-slate-500">{L('No photos in this album.', 'Album này chưa có ảnh.')}</p> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((p) => {
            const ok = !!p.cleared
            const on = chosen.includes(p.id)
            return (
              <button key={p.id} type="button" disabled={!ok} onClick={() => toggle(p)} aria-pressed={on}
                title={ok ? p.caption || p.title : L('Not checked against the no-photo list yet', 'Chưa đối chiếu danh sách không chụp ảnh')}
                className={`relative overflow-hidden rounded-xl border-2 text-left ${on ? 'border-pra-blue ring-2 ring-pra-sky/40' : 'border-slate-200'} ${ok ? 'hover:border-pra-blue' : 'cursor-not-allowed opacity-60'}`}>
                <img src={fileUrl(fileKey(p, p.look, true))} alt="" className="aspect-[4/3] w-full object-cover" />
                {!ok && <span className="chip absolute left-1.5 top-1.5 bg-amber-100 text-amber-800"><Lock size={11} className="mr-1" />{L('Not checked', 'Chưa kiểm')}</span>}
                {on && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-pra-blue text-white"><Check size={14} /></span>}
                <span className="block truncate px-2 py-1 text-xs text-slate-600">{p.caption || p.title}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">{L('Locked photos are not checked against the no-photo list yet. Check them in the Photos tab first.', 'Ảnh bị khoá chưa được đối chiếu danh sách không chụp ảnh. Hãy kiểm trong mục Ảnh trước.')}</span>
        <button type="button" className="btn-primary ml-auto" disabled={!chosen.length} onClick={() => onPick(chosen.map((id) => ({ event, photo: photos.find((p) => p.id === id) })))}>
          <ImagePlus size={16} />{L(`Add ${chosen.length || ''} photo${chosen.length === 1 ? '' : 's'}`, `Thêm ${chosen.length || ''} ảnh`)}
        </button>
      </div>
    </div>
  )
}

