import { useState } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { photoLink, dropPhotoFile } from '../../lib/newsletter/photos'
import { todayHoiAn } from '../../lib/newsletter/dates'
import { enSnapshot } from '../../lib/newsletter/payload'
import { SHOW_CAPTIONS } from '../../lib/newsletter/constants'
import { applyEdit } from '../../lib/newsletter/data'
import { useL } from './bits'
import PhotoPicker from './PhotoPicker'

/**
 * The photos of one part, with their captions in both languages. Captions are
 * also the photos' alt text on the website. Uploaded photos wait for the office
 * to tick them as checked against the no-photo list.
 */
export default function PhotoStrip({ part, max, edit, issueId, me, canClear, canSeeAlbums, disabled, keyInUse = () => false }) {
  const { L } = useL()
  const [picking, setPicking] = useState(false)
  const photos = part.data?.photos || []
  // Each photo is saved on its own, by its id, so two people working on these photos both keep their change.
  const change = (p, fields) => {
    const edits = Object.entries(fields).map(([f, v]) => [['photos', `@${p.id}`, f], v])
    // Writing a Vietnamese caption counts as bringing the part's Vietnamese up to date, as in the text boxes.
    if ('vi' in fields) edits.push([['vi_from'], enSnapshot({ ...part, data: applyEdit(part.data, ['photos', `@${p.id}`, 'vi'], fields.vi) })])
    edit(part.id, edits, { now: 'cleared' in fields })
  }
  // The file goes too, unless the cover or another part shows the same photo.
  const remove = (p) => { edit(part.id, [['photos', `@${p.id}`], null, true], { now: true }); if (!keyInUse(p.key, part.id, p.id)) dropPhotoFile(p) }
  const move = (k, d) => {
    const j = k + d
    if (j < 0 || j >= photos.length) return
    const ids = photos.map((p) => p.id);
    [ids[k], ids[j]] = [ids[j], ids[k]]
    edit(part.id, [['photos', '@order'], ids], { now: true })
  }
  // A photo a teacher adds waits for the office's check, even one taken from another part.
  const add = (added) => edit(part.id, added.map((p) => [['photos', `@${p.id}`], canClear ? p : { ...p, cleared: false, cleared_by: '', cleared_on: '' }]), { now: true })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {photos.map((p, k) => {
          const ok = !!p.cleared
          return (
            <div key={p.id || p.key} className="w-full rounded-xl border border-slate-200 bg-white p-2 sm:w-[210px]">
              <div className="relative overflow-hidden rounded-lg bg-slate-100">
                {photoLink(p) ? <img src={photoLink(p).small} alt="" className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] w-full animate-pulse" />}
                <span className={`chip absolute bottom-1.5 left-1.5 ${ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                  {ok ? <ShieldCheck size={12} className="mr-1" /> : <ShieldAlert size={12} className="mr-1" />}{ok ? L('Checked', 'Đã kiểm') : L('Not checked', 'Chưa kiểm')}
                </span>
                {!disabled && (
                  <span className="absolute right-1.5 top-1.5 flex gap-1">
                    {photos.length > 1 && <button type="button" onClick={() => move(k, -1)} disabled={k === 0} aria-label={L('Move left', 'Sang trái')} className="grid h-6 w-6 place-items-center rounded-full bg-slate-900/60 text-white disabled:opacity-30"><ArrowLeft size={13} /></button>}
                    {photos.length > 1 && <button type="button" onClick={() => move(k, 1)} disabled={k === photos.length - 1} aria-label={L('Move right', 'Sang phải')} className="grid h-6 w-6 place-items-center rounded-full bg-slate-900/60 text-white disabled:opacity-30"><ArrowRight size={13} /></button>}
                    <button type="button" onClick={() => remove(p)} aria-label={L('Remove photo', 'Bỏ ảnh')} className="grid h-6 w-6 place-items-center rounded-full bg-slate-900/60 text-white"><X size={13} /></button>
                  </span>
                )}
              </div>
              {!ok && (canClear ? (
                <label className="mt-1.5 flex cursor-pointer items-start gap-1.5 text-xs font-semibold text-amber-800">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-amber-400" disabled={disabled}
                    onChange={(e) => e.target.checked && change(p, { cleared: true, cleared_by: me?.email || '', cleared_on: todayHoiAn() })} />
                  {L('Checked against the no-photo list', 'Đã đối chiếu danh sách không chụp ảnh')}
                </label>
              ) : <p className="mt-1.5 text-xs text-amber-800">{L('The office checks it against the no-photo list.', 'Văn phòng sẽ đối chiếu danh sách không chụp ảnh.')}</p>)}
              {SHOW_CAPTIONS && <>
              <input className="input mt-1.5 !py-1.5 text-xs" value={p.en || ''} disabled={disabled} placeholder={L('Caption (first names only)', 'Chú thích tiếng Anh')} aria-label={L('Caption in English', 'Chú thích tiếng Anh')}
                onChange={(e) => change(p, { en: e.target.value })} />
              <input className={`input mt-1 !py-1.5 text-xs ${p.en && !p.vi ? '!border-amber-300 !bg-amber-50' : ''}`} value={p.vi || ''} disabled={disabled} placeholder={L('Vietnamese caption', 'Chú thích tiếng Việt')} aria-label={L('Caption in Vietnamese', 'Chú thích tiếng Việt')}
                onChange={(e) => change(p, { vi: e.target.value })} /></>}
            </div>
          )
        })}
        {!disabled && photos.length < max && (
          <button type="button" onClick={() => setPicking(true)} className="flex min-h-[120px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-pra-blue hover:text-pra-blue sm:w-[150px]">
            <ImagePlus size={22} />{L('Add photo', 'Thêm ảnh')}
          </button>
        )}
      </div>
      {picking && <PhotoPicker open onClose={() => setPicking(false)} issueId={issueId} max={max - photos.length} by={me?.email || ''} canSeeAlbums={canSeeAlbums}
        onAdd={add} />}
    </div>
  )
}
