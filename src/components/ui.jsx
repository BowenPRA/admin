import { useState } from 'react'
import { Lock } from 'lucide-react'
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

export function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onMouseDown={onClose}>
      <div className={`card w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} p-6`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
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
