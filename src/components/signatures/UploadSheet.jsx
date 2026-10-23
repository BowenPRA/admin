import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageUp, RotateCw, Maximize, Check } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { Modal, Segmented } from '../ui'
import { openPicture, turnPicture, cleanPicture } from '../../lib/signature'

const WHOLE = { x: 0, y: 0, w: 1, h: 1 }

// A signature from a photo or a scan: choose the picture, turn it upright, drag a box
// round the signature if there is anything else in the picture, and see it cleaned up
// (paper out, ink kept) before saving.
export default function UploadSheet({ person, replacing, onSave, onClose }) {
  const { t } = useT()
  const [bitmap, setBitmap] = useState(null)
  const [quarter, setQuarter] = useState(0)
  const [crop, setCrop] = useState(WHOLE)
  const [strength, setStrength] = useState(0.5)
  const [colour, setColour] = useState('pen')
  const [result, setResult] = useState(null) // { image, width, height }, or 'none' when no ink was found
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [over, setOver] = useState(false)
  const fileRef = useRef(null)
  const viewRef = useRef(null)
  const dragRef = useRef(null)
  const [drag, setDrag] = useState(null)

  const source = useMemo(() => (bitmap ? turnPicture(bitmap, quarter) : null), [bitmap, quarter])

  // The picture on screen, small enough to draw quickly.
  useEffect(() => {
    const view = viewRef.current
    if (!source || !view) return
    const k = Math.min(1, 900 / Math.max(source.width, source.height))
    view.width = Math.round(source.width * k)
    view.height = Math.round(source.height * k)
    view.getContext('2d').drawImage(source, 0, 0, view.width, view.height)
  }, [source])

  // Cleaned again a moment after each change.
  useEffect(() => {
    if (!source) return
    const id = setTimeout(() => setResult(cleanPicture(source, { crop, strength, colour }) || 'none'), 120)
    return () => clearTimeout(id)
  }, [source, crop, strength, colour])

  const choose = async (file) => {
    if (!file) return
    setError('')
    try {
      const b = await openPicture(file)
      setBitmap(b); setQuarter(0); setCrop(WHOLE); setResult(null)
    } catch {
      setError(t('sigBadFile'))
    }
  }

  // Dragging on the picture draws the box; a tap with no drag leaves the box as it was.
  const at = (e) => {
    const r = viewRef.current.getBoundingClientRect()
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]
  }
  const boxOf = (a, b) => ({ x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(a[0] - b[0]), h: Math.abs(a[1] - b[1]) })
  const onDown = (e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = at(e); setDrag(boxOf(dragRef.current, dragRef.current)) }
  const onMove = (e) => { if (dragRef.current) setDrag(boxOf(dragRef.current, at(e))) }
  const onUp = (e) => {
    if (!dragRef.current) return
    const box = boxOf(dragRef.current, at(e))
    dragRef.current = null
    setDrag(null)
    if (box.w > 0.03 && box.h > 0.03) setCrop(box)
  }
  const shown = drag || crop
  const cropped = shown !== WHOLE && (shown.w < 0.999 || shown.h < 0.999)

  const turn = () => { setQuarter((q) => (q + 1) % 4); setCrop(WHOLE) }

  const save = async () => {
    if (!result || result === 'none') return
    setSaving(true)
    try {
      await onSave({ ...result, method: 'uploaded', strokes: null })
      onClose()
    } catch (e) {
      setError(e.message || String(e))
      setSaving(false)
    }
  }

  const footer = (
    <>
      {bitmap && <button type="button" className="btn-ghost mr-auto" onClick={() => fileRef.current?.click()}>{t('sigUploadOther')}</button>}
      <button type="button" className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
      <button type="button" className="btn-primary" disabled={!result || result === 'none' || saving} onClick={save}><Check size={16} /> {saving ? t('sigSaving') : t('sigSave')}</button>
    </>
  )

  return (
    <Modal open wide onClose={onClose} title={t('sigUploadTitle', { name: person.label })}
      subtitle={replacing ? t('sigReplaces', { date: replacing }) : t('sigUploadHint')} footer={footer}>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" className="hidden"
        onChange={(e) => { choose(e.target.files?.[0]); e.target.value = '' }} />

      {!bitmap ? (
        <button type="button" onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); choose(e.dataTransfer.files?.[0]) }}
          className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${over ? 'border-pra-sky bg-sky-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'}`}>
          <ImageUp size={32} className="text-slate-400" />
          <span className="text-base font-semibold text-slate-700">{t('sigUploadPick')}</span>
          <span className="text-sm text-slate-500">{t('sigUploadDrop')}</span>
        </button>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="label mb-0 mr-auto">{t('sigUploadCrop')}</span>
              <button type="button" className="btn-ghost whitespace-nowrap px-2 py-1 text-xs" onClick={turn}><RotateCw size={14} /> {t('sigRotate')}</button>
              <button type="button" className="btn-ghost whitespace-nowrap px-2 py-1 text-xs" disabled={!cropped} onClick={() => setCrop(WHOLE)}><Maximize size={14} /> {t('sigUploadWhole')}</button>
            </div>
            <div className="flex justify-center rounded-xl bg-slate-100 p-2">
              <div className="relative inline-block touch-none select-none overflow-hidden rounded" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                <canvas ref={viewRef} className="block max-h-[320px] max-w-full cursor-crosshair rounded" />
                {cropped && (
                  <div className="pointer-events-none absolute border-2 border-pra-sky shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]"
                    style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, width: `${shown.w * 100}%`, height: `${shown.h * 100}%` }} />
                )}
              </div>
            </div>
          </div>
          <div>
            <div className="label">{t('sigResult')}</div>
            <div className="relative flex h-[200px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
              <div className="pointer-events-none absolute inset-x-[8%] top-[78%] border-t border-slate-200" />
              {result && result !== 'none' && <img src={result.image} alt={t('sigAlt', { name: person.label })} className="relative max-h-full max-w-full object-contain" />}
              {result === 'none' && <p className="relative max-w-xs text-center text-sm text-amber-700">{t('sigNoInk')}</p>}
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="label">{t('sigInk')}</div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{t('sigLighter')}</span>
                  <input type="range" min="0" max="1" step="0.05" value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="flex-1 accent-pra-blue" aria-label={t('sigInk')} />
                  <span>{t('sigDarker')}</span>
                </div>
              </div>
              <div>
                <div className="label">{t('sigColour')}</div>
                <Segmented value={colour} onChange={setColour} options={[{ value: 'pen', label: t('sigColourPen') }, { value: 'dark', label: t('sigColourDark') }]} />
              </div>
            </div>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
    </Modal>
  )
}
