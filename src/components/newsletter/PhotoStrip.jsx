import { useState } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { photoLink, dropPhotoFile } from '../../lib/newsletter/photos'
import { todayHoiAn } from '../../lib/newsletter/dates'
import { enSnapshot } from '../../lib/newsletter/payload'
import { useL } from './bits'
import PhotoPicker from './PhotoPicker'

/**
 * The photos of one part, with their captions in both languages. Captions are
 * also the photos' alt text on the website. Uploaded photos wait for the office
 * to tick them as checked against the no-photo list.
 */
export default function PhotoStrip({ part, max, edit, issueId, me, canClear, canSeeAlbums, disabled }) {
  const { L } = useL()
  const [picking, setPicking] = useState(false)
  const photos = part.data?.photos || []
  const set = (list) => edit(part.id, [['photos'], list], { now: true })
  const change = (k, fields) => {
    const list = photos.map((p, i) => (i === k ? { ...p, ...fields } : p))
    // Writing a Vietnamese caption counts as bringing the part's Vietnamese up to date, as in the text boxes.
    edit(part.id, 'vi' in fields ? [[['photos'], list], [['vi_from'], enSnapshot({ ...part, data: { ...part.data, photos: list } })]] : [['photos'], list])
  }
  const remove = (k) => { dropPhotoFile(photos[k]); set(photos.filter((_, i) => i !== k)) }
  const move = (k, d) => { const j = k + d; if (j < 0 || j >= photos.length) return; const l = [...photos]; [l[k], l[j]] = [l[j], l[k]]; set(l) }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        {photos.map((p, k) => {
          const ok = !!p.cleared
          return (
            <div key={p.key} className="w-full rounded-xl border border-slate-200 bg-white p-2 sm:w-[210px]">
              <div className="relative overflow-hidden rounded-lg bg-slate-100">
                {photoLink(p) ? <img src={photoLink(p).small} alt="" className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] w-full animate-pulse" />}
                <span className={`chip absolute bottom-1.5 left-1.5 ${ok ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                  {ok ? <ShieldCheck size={12} className="mr-1" /> : <ShieldAlert size={12} className="mr-1" />}{ok ? L('Checked', 'Đã kiểm') : L('Not checked', 'Chưa kiểm')}
                </span>
                {!disabled && (
                  <span className="absolute right-1.5 top-1.5 flex gap-1">
                    {photos.length > 1 && <button type="button" onClick={() => move(k, -1)} disabled={k === 0} aria-label={L('Move left', 'Sang trái')} className="grid h-6 w-6 place-items-center rounded-full bg-slate-900/60 text-white disabled:opacity-30"><ArrowLeft size={13} /></button>}
                    {photos.length > 1 && <button type="button" onClick={() => move(k, 1)} disabled={k === photos.length - 1} aria-label={L('Move right', 'Sang phải')} className="grid h-6 w-6 place-items-center rounded-full bg-slate-900/60 text-white disabled:opacity-30"><ArrowRight size={13} /></button>}
                    <button type="button" onClick={() => remove(k)} aria-label={L('Remove photo', 'Bỏ ảnh')} className="grid h-6 w-6 place-items-center rounded-full bg-slate-900/60 text-white"><X size={13} /></button>
                  </span>
                )}
              </div>
              {!ok && (canClear ? (
                <label className="mt-1.5 flex cursor-pointer items-start gap-1.5 text-xs font-semibold text-amber-800">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-amber-400" disabled={disabled}
                    onChange={(e) => e.target.checked && change(k, { cleared: true, cleared_by: me?.email || '', cleared_on: todayHoiAn() })} />
                  {L('Checked against the no-photo list', 'Đã đối chiếu danh sách không chụp ảnh')}
                </label>
              ) : <p className="mt-1.5 text-xs text-amber-800">{L('The office checks it against the no-photo list.', 'Văn phòng sẽ đối chiếu danh sách không chụp ảnh.')}</p>)}
              <input className="input mt-1.5 !py-1.5 text-xs" value={p.en || ''} disabled={disabled} placeholder={L('Caption (first names only)', 'Chú thích tiếng Anh')} aria-label={L('Caption in English', 'Chú thích tiếng Anh')}
                onChange={(e) => change(k, { en: e.target.value })} />
              <input className={`input mt-1 !py-1.5 text-xs ${p.en && !p.vi ? '!border-amber-300 !bg-amber-50' : ''}`} value={p.vi || ''} disabled={disabled} placeholder={L('Vietnamese caption', 'Chú thích tiếng Việt')} aria-label={L('Caption in Vietnamese', 'Chú thích tiếng Việt')}
                onChange={(e) => change(k, { vi: e.target.value })} />
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
        onAdd={(added) => set([...photos, ...added])} />}
    </div>
  )
}
