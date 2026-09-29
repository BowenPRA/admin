import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, Copy, Download, ExternalLink, Eye, Lock, Trash2, Undo2, X } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/toast'
import { Card, Chip, Field, NumberInput, Select, TextArea, TextInput } from '../ui'
import { FACEBOOK_PAGE, SHAPES, cropBox, fileKey, fileUrl, postZip, saveBlob } from '../../lib/eventPhotos'

const KIND = { recap: 'phPostRecap', spotlight: 'phPostSpotlight', thanks: 'phPostThanks', office: 'phPostOffice' }
const STATUS = { draft: ['phPostDraft', 'slate'], posted: ['phPostPosted', 'green'], dropped: ['phPostDropped', 'amber'] }

/** A thumbnail shown the way the post's shape will cut it. */
function Cut({ photo, shape }) {
  const src = fileUrl(fileKey(photo, photo.look, true))
  const [rw, rh] = (SHAPES[shape] ? shape : '4:5').split(':').map(Number)
  const box = cropBox(photo.width || 4, photo.height || 5, shape, photo.focus)
  const x = photo.width > box.w ? (box.x / (photo.width - box.w)) * 100 : 50
  const y = photo.height > box.h ? (box.y / (photo.height - box.h)) * 100 : 50
  return <div className="relative overflow-hidden rounded-lg bg-slate-100" style={{ aspectRatio: `${rw} / ${rh}` }}>{src && <img src={src} alt={photo.caption || ''} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${x}% ${y}%` }} />}</div>
}

// One draft post: its text, its photos in order, and the two things the office
// does with it, copy the text and download the photos. Nothing here posts to
// Facebook; a person does that.
export default function PostCard({ event, post, photos, onPatch, onOpenPhoto, onRelist, onDelete }) {
  const { t } = useT()
  const toast = useToast()
  const { displayName } = useAuth()
  const [text, setText] = useState(post.caption || '')
  const [name, setName] = useState(post.title || '')
  const [busy, setBusy] = useState(false)

  const byCode = new Map(photos.map((p) => [p.code, p]))
  const codes = post.photo_codes || []
  const used = codes.map((c) => byCode.get(c)).filter((p) => p && p.listed !== false)
  const goneCodes = codes.filter((c) => !used.some((p) => p.code === c))
  const gone = goneCodes.length
  const unchecked = used.filter((p) => !p.cleared).length
  const locked = unchecked > 0 || gone > 0 || !used.length
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const spare = photos.filter((p) => p.listed !== false && !codes.includes(p.code)).sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
  const [label, tone] = STATUS[post.status] || STATUS.draft
  const posted = post.status === 'posted'

  const saveName = () => { if (name.trim() !== (post.title || '').trim()) onPatch({ title: name.trim() }) }
  const saveText = () => { if (text.trim() !== (post.caption || '').trim()) onPatch({ caption: text.trim() }) }
  const setCodes = (next) => onPatch({ photo_codes: next })
  const move = (i, by) => { const next = [...codes]; const [x] = next.splice(i, 1); next.splice(i + by, 0, x); setCodes(next) }
  const swapLine = (line) => {
    const [first, ...rest] = text.split('\n')
    const next = [line, ...rest].join('\n')
    setText(next)
    onPatch({ caption: next.trim(), other_first_lines: [...(post.other_first_lines || []).filter((l) => l !== line), first].filter(Boolean) })
  }
  const copy = async () => {
    saveText()
    try { await navigator.clipboard.writeText(text.trim()); toast(t('phCopied')) } catch { toast.error('The browser did not allow copying. Select the text and copy it by hand.') }
  }
  const download = async () => {
    setBusy(true)
    try {
      const { blob, name } = await postZip(event, { ...post, caption: text.trim() }, used)
      saveBlob(blob, name)
      toast(t('phDownloaded', { n: used.length }))
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  const setResult = (key, value) => onPatch({ results: { ...(post.results || {}), [key]: value === '' ? null : value } })

  return (
    <Card title={<>{post.title || t(KIND[post.kind] || 'phPostRecap')} <Chip tone={tone}>{t(label)}</Chip></>}
      subtitle={`${t(KIND[post.kind] || 'phPostRecap')}${post.suggested_time ? ` · ${t('phPostTime')}: ${post.suggested_time}` : ''}`}
      actions={(
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-primary" onClick={copy}><Copy size={16} /> {t('phCopy')}</button>
          <button className="btn-secondary" disabled={locked || busy} onClick={download}>{locked ? <Lock size={16} /> : <Download size={16} />} {busy ? t('phDownloading') : t('phDownload')}</button>
          <a className="btn-ghost" href={FACEBOOK_PAGE} target="_blank" rel="noreferrer"><ExternalLink size={16} /> {t('phOpenFacebook')}</a>
          <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={onDelete}><Trash2 size={16} /> {t('phPostDelete')}</button>
        </div>
      )}>
      {unchecked > 0 && <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><Lock size={15} className="mt-0.5 flex-none" /> {t('phLocked', { n: unchecked })}</p>}
      {gone > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="flex-1">{t('phPostDelisted', { n: gone })}</span>
          <button className="btn-danger !py-1 text-xs" onClick={() => setCodes(codes.filter((c) => !goneCodes.includes(c)))}><X size={14} /> {t('phTakeOutGone')}</button>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-2">
          <Field label={t('phPostName')}><TextInput value={name} onChange={setName} onBlur={saveName} maxLength={80} /></Field>
          <Field label={t('phPostCaption')} right={t('phPostWords', { n: words })}>
            <TextArea rows={10} value={text} onChange={setText} onBlur={saveText} />
          </Field>
          {!!post.other_first_lines?.length && (
            <div>
              <div className="label">{t('phOtherFirstLines')}</div>
              <ul className="space-y-1.5">
                {post.other_first_lines.map((line) => (
                  <li key={line} className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700">
                    <span className="flex-1">{line}</span>
                    <button className="btn-ghost !px-2 !py-0.5 text-xs" onClick={() => swapLine(line)}>{t('phUseLine')}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {post.notes && <div><div className="label">{t('phPostNotes')}</div><p className="rounded-lg bg-amber-50/70 px-3 py-2 text-sm text-slate-700">{post.notes}</p></div>}
        </div>
        <div className="space-y-3 lg:col-span-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="label !mb-0">{t('phPostPhotos')} ({used.length})</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{t('phPostShape')}</span>
              <div className="w-24"><Select value={post.shape || '4:5'} onChange={(shape) => onPatch({ shape })} options={Object.keys(SHAPES).map((s) => ({ value: s, label: s }))} /></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {codes.map((code, i) => {
              const p = byCode.get(code)
              // A photo delisted or removed since the post was drafted stays in its place,
              // marked, so it can be taken out or put back.
              const off = p?.listed === false
              return (
                <div key={code} className="space-y-1">
                  {p ? (
                    <button type="button" className={`relative block w-full rounded-lg ${off ? 'ring-2 ring-red-500 ring-offset-1' : ''}`} onClick={() => onOpenPhoto(p.id)} title={p.title}>
                      <Cut photo={p} shape={post.shape || '4:5'} />
                      {off && <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-900/55"><span className="chip bg-red-600 text-white">{t('phDelisted')}</span></span>}
                      <span className="absolute left-1.5 top-1.5 chip bg-white/90 text-slate-700">{i === 0 ? t('phLeads') : i + 1}</span>
                      {!p.cleared && !off && <span className="absolute right-1.5 top-1.5 chip bg-amber-100 text-amber-800"><Lock size={11} /></span>}
                    </button>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 rounded-lg bg-red-50 text-xs text-red-700 ring-2 ring-red-400 ring-offset-1" style={{ aspectRatio: (post.shape || '4:5').replace(':', ' / ') }}>
                      <b>{t('phRemovedPhoto')}</b><span className="font-mono">{code}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className={`truncate text-[11px] ${p && !off ? 'text-slate-500' : 'font-semibold text-red-700'}`}>{p?.title || code}</span>
                    <span className="flex flex-none">
                      {off && onRelist && <button className="btn-ghost !p-1 text-slate-600" title={t('phRelist')} onClick={() => onRelist(p)}><Eye size={13} /></button>}
                      <button className="btn-ghost !p-1" disabled={i === 0} title={t('phMoveUp')} onClick={() => move(i, -1)}><ArrowUp size={13} /></button>
                      <button className="btn-ghost !p-1" disabled={i === codes.length - 1} title={t('phMoveDown')} onClick={() => move(i, 1)}><ArrowDown size={13} /></button>
                      <button className="btn-ghost !p-1" title={t('phTakeOut')} onClick={() => setCodes(codes.filter((c) => c !== code))}><X size={13} /></button>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          {!!spare.length && (
            <div className="w-64">
              <Select value="" onChange={(code) => code && setCodes([...codes, code])}
                options={[{ value: '', label: t('phAddPhoto') }, ...spare.map((p) => ({ value: p.code, label: `${p.score} · ${p.title}${p.cleared ? '' : ' 🔒'}` }))]} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            {posted
              ? <><span className="text-sm text-slate-600"><Check size={15} className="mr-1 inline text-green-600" />{t('phPostedBy', { name: post.posted_by || '—', date: String(post.posted_at || '').slice(0, 10) })}</span>
                <button className="btn-ghost text-xs" onClick={() => onPatch({ status: 'draft', posted_at: null, posted_by: null })}><Undo2 size={14} /> {t('phMarkDraft')}</button></>
              : <button className="btn-green" disabled={locked} onClick={() => onPatch({ status: 'posted', posted_at: new Date().toISOString(), posted_by: displayName || '' })}><Check size={16} /> {t('phMarkPosted')}</button>}
          </div>
          {posted && (
            <div>
              <div className="label">{t('phResults')}</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[['reach', 'phReach'], ['reactions', 'phReactions'], ['comments', 'phComments'], ['shares', 'phShares']].map(([k, l]) => (
                  <Field key={k} label={t(l)}><NumberInput value={post.results?.[k] ?? ''} onChange={(v) => setResult(k, v)} min={0} /></Field>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
