import { useState } from 'react'
import { Check, Globe, Undo2 } from 'lucide-react'
import { wantOf, askedFor, fmtMoment, fmtDay, personName, leadForMessage, byWaiting } from '../../lib/leads'
import { Chip } from '../ui'

/** One message as the family sent it. `actions` are the buttons beside it, if any. */
export function WebMessage({ m, t, lang, actions, family }) {
  const want = wantOf(m.want)
  const asked = askedFor(m, lang)
  // A parent who writes again is often on the list under another name ("Tran family").
  const known = family && family.trim().toLowerCase() !== String(m.name || '').trim().toLowerCase()
  const facts = [
    known && t('ldWebFamily', { name: family }),
    asked && t('ldWebAsked', { when: asked }),
    m.child_age && t('ldWebAge', { age: String(m.child_age).toLowerCase() }),
    t(m.lang === 'vi' ? 'ldWebLangVi' : 'ldWebLangEn'),
  ].filter(Boolean)
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-start ${m.done_at ? 'opacity-70' : ''}`}>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Chip tone={want.tone}>{lang === 'vi' ? want.vi : want.en}</Chip>
          <span className="font-semibold text-slate-800">{m.name}</span>
          <span className="text-xs text-slate-500">{fmtMoment(m.created_at, lang)}</span>
        </div>
        <div className="text-xs text-slate-500">{facts.join(' · ')}</div>
        {m.message && <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{m.message}</p>}
        <div className="flex flex-wrap gap-x-3 text-xs">
          <a href={`mailto:${m.email}`} className="text-pra-blue hover:underline" onClick={(e) => e.stopPropagation()}>{m.email}</a>
          {m.phone && <a href={`tel:${String(m.phone).replace(/\s+/g, '')}`} className="text-pra-blue hover:underline" onClick={(e) => e.stopPropagation()}>{m.phone}</a>}
        </div>
        {m.done_at && <div className="text-xs text-slate-400">{t('ldWebDoneBy', { name: personName(m.done_by, lang) || '?', date: fmtDay(m.done_at, lang) })}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/**
 * What families have sent from the form on pra.edu.vn. Waiting messages are
 * always shown; the ones already dealt with are one click away. `onOpen(m)`
 * opens the family, `onDone(m, done)` marks a message done or not done.
 */
export default function WebMessages({ messages, leads, busyId, onOpen, onDone, t, lang }) {
  const [showDone, setShowDone] = useState(false)
  const sorted = [...messages].sort(byWaiting)
  const waiting = sorted.filter((m) => !m.done_at)
  const done = sorted.filter((m) => m.done_at)
  const shown = showDone ? sorted : waiting

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Globe size={16} className="text-pra-blue" /> {t('ldWebTitle')}
            {waiting.length > 0 && <Chip tone="amber">{t('ldWebWaiting', { n: waiting.length })}</Chip>}
          </h2>
          <p className="text-xs text-slate-500">{t('ldWebSub')}</p>
        </div>
        {done.length > 0 && (
          <button type="button" className="btn-ghost text-xs" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            {showDone ? t('ldWebHideDone') : t('ldWebShowDone', { n: done.length })}
          </button>
        )}
      </div>
      {shown.length === 0
        ? <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-400">{t('ldWebNone')}</p>
        : (
          <ul>
            {shown.map((m) => { const lead = leadForMessage(m, leads); return (
              <li key={m.id} className="border-t border-slate-100 p-4">
                <WebMessage m={m} t={t} lang={lang} family={lead?.family} actions={<>
                  <button type="button" className="btn-secondary" onClick={() => onOpen(m)}>{t(lead ? 'ldWebOpen' : 'ldWebAdd')}</button>
                  {m.done_at
                    ? <button type="button" className="btn-ghost" disabled={busyId === m.id} onClick={() => onDone(m, false)}><Undo2 size={16} /> {t('ldWebUndo')}</button>
                    : <button type="button" className="btn-primary" disabled={busyId === m.id} onClick={() => onDone(m, true)}><Check size={16} /> {t('ldWebDone')}</button>}
                </>} />
              </li>
            ) })}
          </ul>
        )}
    </section>
  )
}
