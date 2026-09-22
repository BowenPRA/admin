import { useEffect, useRef, useState } from 'react'
import { ImagePlus, FileText, X, Loader2 } from 'lucide-react'
import { useT } from '../lib/i18n'
import { MAX_PROOFS, PROOF_ACCEPT, isPdfProof, proofUrl } from '../lib/proof'

// One proof file: a saved entry ({ path | data, … }) or one still waiting to be
// uploaded ({ blob, … }). Opens full size in a new tab.
function ProofThumb({ item, onRemove, disabled }) {
  const { t } = useT()
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    proofUrl(item).then((u) => alive && setUrl(u)).catch(() => alive && setFailed(true))
    return () => { alive = false }
  }, [item])
  const pdf = isPdfProof(item)
  // Browsers refuse to open a data: link in a new tab, so those are handed over as a blob: link.
  const open = async (e) => {
    if (!url.startsWith('data:')) return
    e.preventDefault()
    const blobUrl = URL.createObjectURL(item.blob || await (await fetch(url)).blob())
    window.open(blobUrl, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
  }
  return (
    <div className="group relative h-24 w-24 flex-none overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      <a href={url || undefined} onClick={open} target="_blank" rel="noreferrer" title={item.name} className="flex h-full w-full items-center justify-center">
        {failed ? <span className="px-1 text-center text-[10px] text-red-600">{t('proofMissing')}</span>
          : !url ? <Loader2 size={18} className="animate-spin text-slate-400" />
            : pdf ? <span className="flex flex-col items-center gap-1 px-1 text-center text-[10px] text-slate-600"><FileText size={26} className="text-red-500" /><span className="line-clamp-2 break-all">{item.name}</span></span>
              : <img src={url} alt={item.name} className="h-full w-full object-cover" />}
      </a>
      {onRemove && (
        <button type="button" disabled={disabled} onClick={onRemove} aria-label={t('remove')}
          className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-slate-600 shadow hover:text-red-600 disabled:opacity-50"><X size={14} /></button>
      )}
    </div>
  )
}

/**
 * Thumbnails plus an "add" tile. Files can be picked, dropped on it, or pasted
 * (Ctrl+V straight after taking a screenshot) while it is on screen.
 * @param {Array} items            saved entries and / or prepared files
 * @param {(files: File[]) => void} onAdd
 * @param {(index: number) => void} onRemove
 */
export default function ProofPicker({ items, onAdd, onRemove, busy = false }) {
  const { t } = useT()
  const input = useRef(null)
  const [over, setOver] = useState(false)
  const full = items.length >= MAX_PROOFS
  const add = (list) => {
    const files = [...(list || [])].filter((f) => /^image\/|^application\/pdf$/.test(f.type))
    if (files.length && !full && !busy) onAdd(files.slice(0, MAX_PROOFS - items.length))
  }
  const addRef = useRef(add)
  useEffect(() => { addRef.current = add })

  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files || [])]
      if (!files.length) return
      e.preventDefault()
      addRef.current(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}
      className={`rounded-xl border border-dashed p-2.5 transition-colors ${over ? 'border-pra-blue bg-sky-50' : 'border-slate-300'}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        {items.map((it, i) => <ProofThumb key={it.path || it.added_at || i} item={it} disabled={busy} onRemove={onRemove ? () => onRemove(i) : null} />)}
        {!full && (
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="flex h-24 w-24 flex-none flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-pra-blue hover:bg-sky-50 disabled:opacity-50">
            {busy ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
            {busy ? t('saving') : t('proofAdd')}
          </button>
        )}
        <p className="min-w-[180px] flex-1 text-xs text-slate-500">{t('proofHint', { n: MAX_PROOFS })}</p>
      </div>
      <input ref={input} type="file" accept={PROOF_ACCEPT} multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
    </div>
  )
}
