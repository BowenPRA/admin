import { useState } from 'react'
import { Pencil, Plane, Plus, Trash2 } from 'lucide-react'
import { db } from '../../lib/db'
import { useT } from '../../lib/i18n'
import { useData } from '../../lib/DataContext'
import { useToast } from '../../lib/toast'
import { todayIso } from '../../lib/attendanceSummary'
import { blankTrip, tripProblem, travelError, tripsOf, tripDates } from '../../lib/travel'

// A student's trips (lib/travel.js): the boxes for one trip, and the list in the student window.
// A trip saves by itself, apart from whatever window it sits in.

/**
 * First day away, last day away, where. `trip` is a saved trip or a blank one
 * (blankTrip). `onDone()` is called once it is saved, removed or cancelled.
 * Not a <form>: it also sits inside the student window's form.
 */
export function TripForm({ trip, onDone }) {
  const { t } = useT()
  const toast = useToast()
  const { refreshTravel } = useData()
  const [row, setRow] = useState(trip)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setRow((r) => ({ ...r, [k]: e.target.value }))
  // Moving the first day past the last day takes the last day along.
  const setFrom = (e) => setRow((r) => ({ ...r, from_date: e.target.value, to_date: !r.to_date || r.to_date < e.target.value ? e.target.value : r.to_date }))
  const run = async (fn, said) => {
    setBusy(true)
    try { await fn(); await refreshTravel(); if (said) toast(said); onDone?.() } catch (e) { toast.error(travelError(e)) } finally { setBusy(false) }
  }
  const save = () => {
    const problem = tripProblem(row)
    if (problem) return toast.error(t(problem))
    return run(() => db.travel.save(row), t('tripSaved'))
  }
  const remove = () => { if (confirm(t('tripRemoveConfirm'))) run(() => db.travel.remove(row.id)) }
  const onEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[9.5rem_9.5rem_1fr]">
        <label className="block"><span className="label">{t('tripFrom')}</span>
          <input type="date" className="input text-base sm:text-sm" value={row.from_date || ''} onChange={setFrom} onKeyDown={onEnter} /></label>
        <label className="block"><span className="label">{t('tripTo')}</span>
          <input type="date" className="input text-base sm:text-sm" value={row.to_date || ''} min={row.from_date || undefined} onChange={set('to_date')} onKeyDown={onEnter} /></label>
        <label className="col-span-2 block sm:col-span-1"><span className="label">{t('tripPlace')}</span>
          <input className="input text-base sm:text-sm" value={row.place || ''} placeholder={t('tripPlaceHint')} maxLength={120} onChange={set('place')} onKeyDown={onEnter} /></label>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary !py-1.5 text-xs" disabled={busy} onClick={save}><Plane size={14} /> {t('tripSave')}</button>
        <button type="button" className="btn-ghost !py-1.5 text-xs" disabled={busy} onClick={() => onDone?.()}>{t('cancel')}</button>
        {row.id && <button type="button" className="btn-ghost ml-auto !py-1.5 text-xs text-red-600 hover:bg-red-50" disabled={busy} onClick={remove}><Trash2 size={14} /> {t('tripRemove')}</button>}
      </div>
    </div>
  )
}

/** The Travel part of the student window: every trip, the latest first, and a way to add one. */
export function StudentTrips({ student, canEdit = true }) {
  const { t, lang } = useT()
  const { travel } = useData()
  const [open, setOpen] = useState(null) // a trip's id, or 'new'
  const trips = tripsOf(travel, student.id).reverse()
  const today = todayIso()

  return (
    <div className="space-y-2">
      {trips.length === 0 && open !== 'new' && <p className="text-sm text-slate-400">{t('noTrips')}</p>}
      {trips.map((trip) => (open === trip.id ? <TripForm key={trip.id} trip={trip} onDone={() => setOpen(null)} /> : (
        <div key={trip.id} className={`flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm ${trip.to_date < today ? 'text-slate-400' : 'text-slate-800'}`}>
          <Plane size={15} className={`flex-none ${trip.to_date < today ? 'text-slate-300' : 'text-violet-600'}`} />
          <span className="min-w-0 flex-1"><span className="font-semibold">{tripDates(trip, lang)}</span>{trip.place && <span>  ·  {trip.place}</span>}</span>
          {canEdit && <button type="button" className="btn-ghost flex-none !p-1.5" title={t('changeTrip')} aria-label={t('changeTrip')} onClick={() => setOpen(trip.id)}><Pencil size={14} /></button>}
        </div>
      )))}
      {canEdit && (open === 'new'
        ? <TripForm trip={blankTrip(student.id, today)} onDone={() => setOpen(null)} />
        : <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => setOpen('new')}><Plus size={14} /> {t('addTrip')}</button>)}
      <p className="text-xs text-slate-500">{t('travelHint')}</p>
    </div>
  )
}
