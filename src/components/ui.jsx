import { useState } from 'react'
import { fmt, parseMoney } from '../lib/money'

export function Field({ label, children, className = '', hint }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}</span>}
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

export function Checkbox({ checked, onChange, label, className = '' }) {
  return (
    <label className={`inline-flex items-center gap-2 text-sm cursor-pointer select-none ${className}`}>
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-pra-blue focus:ring-pra-sky" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function Card({ title, children, className = '', actions }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-bold text-slate-800">{title}</h2>}
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

export function Empty({ text }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">{text}</div>
}

export function Spinner() {
  return <div className="flex items-center justify-center p-10"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-pra-blue" /></div>
}
