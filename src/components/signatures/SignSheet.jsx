import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { X, Undo2, Eraser, Check, ArrowRight, PenLine } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { SignaturePad, strokesToPng, tooSmall } from '../../lib/signature'

// The whole screen given over to signing, for the touch-screen laptop passed round the
// staff room: the person's name, a large pad with a line to sign on, Undo, Clear and Save.
// After saving it shows the signature as kept and offers the next person still to sign.
export default function SignSheet({ person, replacing, onSave, onClose, next, onNext }) {
  const { t } = useT()
  const canvasRef = useRef(null)
  const padRef = useRef(null)
  const [ink, setInk] = useState({ empty: true, pen: false })
  const [step, setStep] = useState('draw') // 'draw', 'saving', 'saved'
  const [saved, setSaved] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    const pad = new SignaturePad(canvas, { onChange: (s) => { setInk(s); setError('') } })
    padRef.current = pad
    const ro = new ResizeObserver(() => pad.resize())
    ro.observe(canvas)
    return () => { ro.disconnect(); pad.destroy() }
  }, [])

  const close = () => {
    if (step === 'draw' && !ink.empty && !confirm(t('sigLeaveConfirm'))) return
    onClose()
  }
  const onEscape = useEffectEvent(close)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onEscape() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [])

  const save = async () => {
    const pad = padRef.current
    if (pad.empty) return
    if (tooSmall(pad.strokes)) { setError(t('sigTooSmall')); return }
    setStep('saving')
    try {
      const png = strokesToPng(pad.strokes)
      await onSave({ ...png, method: 'drawn' })
      setSaved(png)
      setStep('saved')
    } catch (e) {
      setError(e.message || String(e))
      setStep('draw')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-100" role="dialog" aria-modal="true" aria-label={t('sigSheetTitle', { name: person.label })}>
      <div className="flex items-start gap-3 px-4 pb-2 pt-4 sm:px-8 sm:pt-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">{person.label}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {step === 'saved' ? t('sigSaved', { name: person.label }) : t('sigSheetHint')}
            {step !== 'saved' && replacing && <> {t('sigReplaces', { date: replacing })}</>}
          </p>
        </div>
        <button type="button" className="btn-ghost -mr-2 px-2" onClick={close} aria-label={t('sigClose')}><X size={22} /></button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-3 sm:px-8">
        <div className="relative h-full max-h-[560px] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* The line to sign on, a cross where to start, and the name under the line. */}
          <div className="pointer-events-none absolute inset-x-[7%] top-[70%] select-none" aria-hidden="true">
            <div className="absolute -top-9 left-0 text-2xl font-light text-slate-300">×</div>
            <div className="border-t-2 border-slate-300" />
            <div className="mt-2 text-center text-sm font-semibold text-slate-400">{person.label}</div>
          </div>
          {ink.empty && step === 'draw' && (
            <div className="pointer-events-none absolute inset-x-0 top-[34%] flex select-none flex-col items-center gap-2 text-slate-300" aria-hidden="true">
              <PenLine size={30} />
              <span className="text-base font-semibold">{t('sigPadHint')}</span>
            </div>
          )}
          <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full touch-none ${step === 'saved' ? 'invisible' : 'cursor-crosshair'}`} />
          {step === 'saved' && saved && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white p-6">
              <img src={saved.image} alt={t('sigAlt', { name: person.label })} className="max-h-[55%] max-w-[80%] object-contain" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800"><Check size={16} /> {t('sigSavedShort')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-3 pb-5 pt-3 sm:px-8">
        {step === 'saved' ? (
          <>
            <span className="mr-auto" />
            <button type="button" className="btn-secondary px-5 py-3 text-base" onClick={onClose}>{t('sigDone')}</button>
            {next && <button type="button" className="btn-primary px-5 py-3 text-base" onClick={onNext}>{t('sigNext', { name: next.label })} <ArrowRight size={18} /></button>}
          </>
        ) : (
          <>
            <button type="button" className="btn-secondary px-4 py-3 text-base" disabled={ink.empty || step === 'saving'} onClick={() => padRef.current.undo()}><Undo2 size={18} /> {t('sigUndo')}</button>
            <button type="button" className="btn-secondary px-4 py-3 text-base" disabled={ink.empty || step === 'saving'} onClick={() => padRef.current.clear()}><Eraser size={18} /> {t('sigClear')}</button>
            <span className="mr-auto min-w-0 px-2 text-xs text-slate-500">
              {error ? <span className="font-semibold text-red-600">{error}</span> : ink.pen ? t('sigPenOnly') : ''}
            </span>
            <button type="button" className="btn-primary px-6 py-3 text-base" disabled={ink.empty || step === 'saving'} onClick={save}>
              <Check size={18} /> {step === 'saving' ? t('sigSaving') : t('sigSave')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
