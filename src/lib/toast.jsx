/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

// Small notices in the corner instead of alert() popups.
//   const toast = useToast(); toast('Saved'); toast.error('Could not save')
const Ctx = createContext(null)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const seq = useRef(0)
  const dismiss = useCallback((id) => setItems((xs) => xs.filter((x) => x.id !== id)), [])
  const push = useCallback((text, tone = 'ok', ms = 3200) => {
    const id = ++seq.current
    setItems((xs) => [...xs.slice(-3), { id, text, tone }])
    if (ms) setTimeout(() => dismiss(id), ms)
  }, [dismiss])
  const [api] = useState(() => {
    const f = (text) => push(text, 'ok')
    f.error = (text) => push(text, 'error', 7000)
    f.info = (text) => push(text, 'info')
    return f
  })
  const icon = { ok: <CheckCircle2 size={18} className="text-green-600" />, error: <AlertTriangle size={18} className="text-red-600" />, info: <Info size={18} className="text-pra-blue" /> }
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
        {items.map((x) => (
          <div key={x.id} className={`toast-in pointer-events-auto flex max-w-sm items-start gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-sm shadow-lg ${x.tone === 'error' ? 'border-red-200' : 'border-slate-200'}`}>
            <span className="mt-px flex-none">{icon[x.tone]}</span>
            <span className="flex-1 whitespace-pre-line text-slate-700">{x.text}</span>
            <button className="flex-none text-slate-400 hover:text-slate-600" onClick={() => dismiss(x.id)} aria-label="Dismiss"><X size={15} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  return useContext(Ctx) || Object.assign((t) => alert(t), { error: (t) => alert(t), info: (t) => alert(t) })
}
