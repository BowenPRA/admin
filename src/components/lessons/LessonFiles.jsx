import { useEffect, useRef, useState } from 'react'
import { FileText, Loader2, Paperclip, X } from 'lucide-react'
import { LESSON_ACCEPT, MAX_LESSON_FILES, isImageFile, lessonFileUrl } from '../../lib/lessonFiles'
import { useL } from '../../lib/lessons'

// One file on a request: a saved entry ({ path | data, … }) or one still waiting to be
// uploaded ({ blob, … }). Opens in a new tab.
function FileTile({ item, onRemove, disabled, L }) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    lessonFileUrl(item).then((u) => alive && setUrl(u)).catch(() => alive && setFailed(true))
    return () => { alive = false }
  }, [item])
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
        {failed ? <span className="px-1 text-center text-[10px] text-red-600">{L('File missing', 'Không tìm thấy tệp')}</span>
          : !url ? <Loader2 size={18} className="animate-spin text-slate-400" />
            : isImageFile(item) ? <img src={url} alt={item.name} className="h-full w-full object-cover" />
              : <span className="flex flex-col items-center gap-1 px-1 text-center text-[10px] text-slate-600"><FileText size={26} className="text-slate-500" /><span className="line-clamp-2 break-all">{item.name}</span></span>}
      </a>
      {onRemove && (
        <button type="button" disabled={disabled} onClick={onRemove} aria-label={L('Remove', 'Xóa')}
          className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-slate-600 shadow hover:text-red-600 disabled:opacity-50"><X size={14} /></button>
      )}
    </div>
  )
}

/**
 * Tiles plus an "add" tile, as on the To-Do page. Files can be picked, dropped, or pasted
 * (Ctrl+V after a screenshot) while the tile is on screen. `readOnly` shows the tiles alone.
 * @param {Array} items            saved entries and / or prepared files
 * @param {(files: File[]) => void} onAdd
 * @param {(index: number) => void} onRemove
 */
export default function LessonFiles({ items, onAdd, onRemove, busy = false, readOnly = false }) {
  const { L } = useL()
  const input = useRef(null)
  const [over, setOver] = useState(false)
  const full = items.length >= MAX_LESSON_FILES
  const add = (list) => {
    const files = [...(list || [])]
    if (files.length && !full && !busy) onAdd(files.slice(0, MAX_LESSON_FILES - items.length))
  }
  const addRef = useRef(add)
  useEffect(() => { addRef.current = add })

  useEffect(() => {
    if (readOnly) return
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files || [])]
      if (!files.length) return
      e.preventDefault()
      addRef.current(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [readOnly])

  if (readOnly) {
    return <div className="flex flex-wrap gap-2.5">{items.map((it, i) => <FileTile key={it.path || `${it.at}-${i}`} item={it} L={L} />)}</div>
  }
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}
      className={`rounded-xl border border-dashed p-2.5 transition-colors ${over ? 'border-pra-blue bg-sky-50' : 'border-slate-300'}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        {items.map((it, i) => <FileTile key={it.path || `${it.at}-${i}`} item={it} disabled={busy} L={L} onRemove={onRemove ? () => onRemove(i) : null} />)}
        {!full && (
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="flex h-24 w-24 flex-none flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-pra-blue hover:bg-sky-50 disabled:opacity-50">
            {busy ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
            {busy ? L('Saving…', 'Đang lưu…') : L('Add files', 'Thêm tệp')}
          </button>
        )}
        <p className="min-w-[180px] flex-1 text-xs text-slate-500">
          {L(`Photos of book pages, your slides or worksheets. Drop them here, paste a screenshot, or pick them. Up to ${MAX_LESSON_FILES} files, 25 MB each.`,
            `Ảnh chụp trang sách, slide hoặc phiếu bài tập của thầy cô. Kéo thả vào đây, dán ảnh chụp màn hình, hoặc chọn tệp. Tối đa ${MAX_LESSON_FILES} tệp, mỗi tệp 25 MB.`)}
        </p>
      </div>
      <input ref={input} type="file" multiple accept={LESSON_ACCEPT} className="hidden" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
    </div>
  )
}
