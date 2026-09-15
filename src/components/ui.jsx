import { useEffect, useState } from 'react'
import { Lock, Search, X } from 'lucide-react'
import { fmt, parseMoney } from '../lib/money'

export function Field({ label, children, className = '', hint, right }) {
  return (
    <label className={`block ${className}`}>
      {(label || right) && (
        <span className="mb-1 flex items-center justify-between">
          {label && <span className="label !mb-0">{label}</span>}
          {right && <span className="text-xs text-slate-400">{right}</span>}
        </span>
      )}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function TextInput({ value, onChange, ...rest }) {
  return <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
}

export function NumberInput({ value, onChange, ...rest }) {
  return (
    <input className="input text-right" type="number" inputMode="decimal" value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} {...rest} />
  )
}

/** Money input that shows thousands separators while editing. */
export function MoneyInput({ value, onChange, className = '', allowBlank = false, ...rest }) {
  const shown = value === '' || value == null ? '' : fmt(value)
  const [text, setText] = useState(shown)
  const [prev, setPrev] = useState(value)
  // Re-format when the value changes from outside (e.g. a rebuild), but keep
  // the user's keystrokes while they are typing.
  if (value !== prev) { setPrev(value); setText(shown) }
  return (
    <input className={`input text-right font-mono ${className}`} value={text} inputMode="numeric"
      onChange={(e) => {
        const raw = e.target.value
        if (raw.trim() === '' && allowBlank) { setText(''); onChange(''); return }
        const n = parseMoney(raw)
        setText(raw)
        onChange(n)
      }}
      onBlur={() => setText(value === '' || value == null ? '' : fmt(value))}
      {...rest} />
  )
}

export function Select({ value, onChange, options, ...rest }) {
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export function Checkbox({ checked, onChange, label, className = '', disabled }) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm cursor-pointer select-none ${disabled ? 'opacity-60' : ''} ${className}`}>
      <input type="checkbox" disabled={disabled} className="h-4 w-4 rounded border-slate-300 text-pra-blue focus:ring-pra-sky" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function TextArea({ value, onChange, rows = 4, ...rest }) {
  return <textarea className="input" rows={rows} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
}

export function Card({ title, children, className = '', actions, locked, subtitle }) {
  return (
    <section className={`card p-5 ${locked ? 'bg-slate-50/70' : ''} ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">{title}{locked && <Lock size={14} className="text-slate-400" />}</h2>}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatusChip({ status, t }) {
  const map = {
    draft: 'bg-slate-100 text-slate-700',
    sent: 'bg-sky-100 text-sky-800',
    partial: 'bg-amber-100 text-amber-800',
    paid: 'bg-green-100 text-green-800',
    void: 'bg-red-100 text-red-700',
  }
  return <span className={`chip ${map[status] || map.draft}`}>{t(status)}</span>
}

export function Modal({ open, onClose, title, subtitle, children, wide = false, footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-3 sm:p-8" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className={`modal-in card my-auto flex max-h-[calc(100vh-1.5rem)] w-full flex-col sm:max-h-[calc(100vh-4rem)] ${wide ? 'max-w-4xl' : 'max-w-lg'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h3 className="text-lg font-bold leading-tight text-slate-800">{title}</h3>
            {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
          </div>
          <button className="btn-ghost -mr-2 px-2" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>
  )
}

/** Round photo, or initials on a soft colour when there is no photo. */
export function Avatar({ src, name, size = 32, className = '' }) {
  const initials = String(name || '?').replace(/\(.*?\)/g, '').trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const hues = ['bg-sky-100 text-sky-700', 'bg-green-100 text-green-700', 'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700']
  const hue = hues[[...String(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % hues.length]
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.36) }
  if (src) return <img src={src} alt="" style={style} className={`flex-none rounded-full object-cover ${className}`} />
  return <span style={style} className={`flex flex-none items-center justify-center rounded-full font-bold ${hue} ${className}`}>{initials}</span>
}

/** Row of mutually exclusive buttons: options = [{ value, label }] */
export function Segmented({ value, onChange, options, className = '' }) {
  return (
    <div className={`seg ${className}`} role="group">
      {options.map((o) => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  )
}

/** Search box with an icon and a clear button. */
export function SearchInput({ value, onChange, placeholder, className = '', ...rest }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input className="input pl-8 pr-8" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} {...rest} />
      {value && <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => onChange('')} aria-label="Clear"><X size={15} /></button>}
    </div>
  )
}

/** Button that opens a small list of actions: items = [{ label, icon: Icon, onClick, disabled, hint }] */
export function Menu({ label, icon: ButtonIcon, items, align = 'right' }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="relative">
      <button type="button" className="btn-secondary" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}>
        {ButtonIcon && <ButtonIcon size={16} />} {label}
      </button>
      {open && (
        <div className={`modal-in absolute z-40 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {items.filter(Boolean).map((it) => (
            <button key={it.label} type="button" disabled={it.disabled} onClick={() => { setOpen(false); it.onClick() }}
              className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50">
              {it.icon && <it.icon size={16} className="mt-0.5 flex-none text-slate-500" />}
              <span><span className="block font-semibold text-slate-700">{it.label}</span>{it.hint && <span className="block text-xs text-slate-500">{it.hint}</span>}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="mr-auto min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-slate-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Empty({ text, children }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">{text}{children}</div>
}

export function Chip({ tone = 'slate', children }) {
  const map = {
    slate: 'bg-slate-100 text-slate-700', sky: 'bg-sky-100 text-sky-800', amber: 'bg-amber-100 text-amber-800',
    green: 'bg-green-100 text-green-800', red: 'bg-red-100 text-red-700', navy: 'bg-pra-navy text-white',
  }
  return <span className={`chip ${map[tone] || map.slate}`}>{children}</span>
}

export function ReportStatusChip({ status }) {
  const tone = { draft: 'slate', ready: 'sky', published: 'green' }[status] || 'slate'
  const label = { draft: 'Draft', ready: 'Ready to review', published: 'Published' }[status] || status
  return <Chip tone={tone}>{label}</Chip>
}

/** Picks one of the configured progress levels (1-4). Renders as coloured circles. */
export function LevelPicker({ value, onChange, levels, disabled, size = 'md' }) {
  const dim = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'
  return (
    <div className="flex items-center gap-1.5">
      {levels.map((l) => {
        const on = Number(value) === l.value
        return (
          <button key={l.value} type="button" disabled={disabled} title={`${l.name} (${l.value})`}
            onClick={() => onChange(on ? null : l.value)}
            className={`${dim} rounded-full font-extrabold transition-all ${on ? 'text-white ring-2 ring-offset-2 ring-slate-300 scale-105' : 'bg-white text-slate-400 border border-slate-300 hover:border-slate-400'} disabled:cursor-not-allowed disabled:opacity-60`}
            style={on ? { background: l.color } : undefined}>
            {l.code}
          </button>
        )
      })}
    </div>
  )
}

/** Small "Saved" / "Saving…" indicator: state is 'idle' | 'saving' | 'saved' | 'error'. */
export function SaveState({ state }) {
  if (state === 'saving') return <span className="text-xs font-semibold text-slate-400">Saving…</span>
  if (state === 'saved') return <span className="text-xs font-semibold text-green-600">Saved ✓</span>
  if (state === 'error') return <span className="text-xs font-semibold text-red-600">Not saved</span>
  return null
}

/** Editable list of short lines. */
export function BulletList({ items, onChange, disabled, placeholder = 'Add a line…', max = 6 }) {
  const list = items || []
  const set = (i, v) => onChange(list.map((x, j) => (j === i ? v : x)))
  return (
    <div className="space-y-1.5">
      {list.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-slate-400">•</span>
          <input className="input" value={it} disabled={disabled} onChange={(e) => set(i, e.target.value)} />
          {!disabled && <button type="button" className="btn-ghost px-2" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>}
        </div>
      ))}
      {!disabled && list.length < max && (
        <button type="button" className="btn-secondary text-xs" onClick={() => onChange([...list, ''])}>+ {placeholder}</button>
      )}
    </div>
  )
}

export function Spinner() {
  return <div className="flex items-center justify-center p-10"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-pra-blue" /></div>
}
