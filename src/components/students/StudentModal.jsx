import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, RotateCcw, Trash2, AlertTriangle, Mail, Phone, ClipboardCheck, Sprout, History } from 'lucide-react'
import { LEVELS, PROGRAMS } from '../../lib/fees'
import { suggestClass } from '../../lib/placement'
import { guessFirstName } from '../../lib/names'
import { resizeImage, photoSrc } from '../../lib/report/photo'
import { nextStudentCode, codeTakenBy, normalizeCode } from '../../lib/studentIds'
import { ageOf, STATUSES, statusOf, withStatus, partialFrom, DEFAULT_PARTIAL_FROM, endDateOf, startsLater } from '../../lib/studentRecords'
import { quartersOf, currentQuarter, dayText } from '../../lib/studentDates'
import { onChecklist, onboardingOf, startedBy, startChecklist, ChecklistSetupError } from '../../lib/onboarding'
import { todayIso } from '../../lib/leads'
import { db } from '../../lib/db'
import { Field, TextInput, Select, Checkbox, Modal, Avatar } from '../ui'
import { StudentTrips } from '../attendance/Trips'
import EmailSlip from '../EmailSlip'
import NewStudentChecklist from './NewStudentChecklist'

function Section({ title, children }) {
  return (
    <fieldset className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-pra-navy">{title}</legend>
      {children}
    </fieldset>
  )
}

/**
 * Add / edit a student (office accounts), or a read-only summary for teachers.
 * `onSave(row)` and `onDelete(row)` return promises; the modal stays open on error.
 * `checklist` = { ctx, me, onChanged } shows the new-student checklist (office accounts).
 */
export default function StudentModal({ value, onClose, onSave, onDelete, students, families, schoolYear, calendar, canEdit, checklist, onError, t, lang }) {
  const [s, setS] = useState(value)
  // The row as saved: ticks on the checklist are written straight away, apart from Save.
  const [saved, setSaved] = useState(value)
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setS((cur) => ({ ...cur, [k]: v }))
  const isNew = !s.id
  const me = checklist?.me
  // After a write from the checklist: keep what it changed, and the rest of the form as typed.
  const onChecklistSaved = (row) => {
    if (!row) return
    setSaved((cur) => ({ ...cur, ...row }))
    setS((cur) => ({ ...cur, onboarding: row.onboarding, ...('lead_id' in row ? { lead_id: row.lead_id } : {}) }))
  }
  // A past student brought back (To-Do #38): an expected end date that has gone by is cleared,
  // or it would keep them off the register and the invoices; one still to come is kept, and the
  // window asks. Their checklist starts again: ticks from an earlier time do not count.
  const wasPast = statusOf(value) === 'inactive'
  const changeStatus = (v) => setS((cur) => {
    const next = withStatus(cur, v)
    if (!wasPast) return next
    if (v === 'inactive') return { ...next, end_date: value.end_date ?? '', onboarding: value.onboarding ?? null }
    const oldEnd = endDateOf(value)
    return { ...next, ...(oldEnd && oldEnd < todayIso() ? { end_date: '' } : {}), onboarding: startedBy(me?.email, { returning: true }) }
  })
  const startTracking = async () => {
    try { onChecklistSaved(await startChecklist(db, saved, me?.email)); await checklist?.onChanged?.() } catch (e) { onError?.(e instanceof ChecklistSetupError ? t('checklistSetup') : e.message) }
  }
  // New students: the class follows the birthday until someone picks a class by hand.
  const [levelTouched, setLevelTouched] = useState(false)
  const [levelAuto, setLevelAuto] = useState(false)
  const setDob = (dob) => {
    const g = isNew && !levelTouched ? suggestClass({ ...s, dob }, students, schoolYear) : null
    setS((cur) => ({ ...cur, dob, ...(g ? { level: g.level } : {}) }))
    setLevelAuto(!!g)
  }
  const status = statusOf(s)
  const taken = codeTakenBy(students, s.student_code, s.id)
  const fam = families.find((f) => f.id === s.family_id)
  const programName = (id) => { const p = PROGRAMS.find((x) => x.id === id); return p ? (lang === 'vi' ? p.vi : p.en) : id }
  // Expected end date (lib/studentDates.js): shortcuts to the end of each quarter in the calendar.
  const end = endDateOf(s)
  const quarters = quartersOf(calendar)
  const thisQuarter = currentQuarter(calendar)
  const endsThisQuarter = !!end && status === 'active' && !!thisQuarter && end <= thisQuarter.end
  const endBeforeStart = !!end && !!s.start_date && end < String(s.start_date).slice(0, 10)
  // Coming back from Past, not saved yet: say what happened to the end date.
  const backFromPast = wasPast && status !== 'inactive'
  const oldEnd = endDateOf(value)
  // New students get an S number; one typed by hand in another form is pointed out.
  const codeNotS = !!s.student_code && !/^S\d+$/.test(normalizeCode(s.student_code)) && (isNew || (status === 'pending' && !onboardingOf(s)?.returning))
  const showChecklist = canEdit && !isNew && !!checklist && onChecklist(s)
  const lead = s.lead_id ? (checklist?.ctx?.leads || []).find((l) => l.id === s.lead_id) : null

  const save = async (e) => {
    e?.preventDefault()
    if (!s.full_name.trim() || taken) return
    setBusy(true)
    const row = { ...s, full_name: s.full_name.trim(), student_code: normalizeCode(s.student_code) || null }
    // first_name needs supabase/updates-2026-09-15-legal-names.sql; leave it out until someone types one.
    if (!(row.first_name || '').trim() && !('first_name' in value)) delete row.first_name
    // Likewise partial_from (supabase/updates-2026-09-22-partial-day.sql): only sent once someone sets it.
    if (!partialFrom(row) && !('partial_from' in value)) delete row.partial_from
    try { await onSave(row) } finally { setBusy(false) }
  }
  const pickPhoto = async (file) => { try { set('photo')(await resizeImage(file)) } catch (err) { alert(err.message) } }
  const age = ageOf(s.dob)

  if (!canEdit) {
    const row = (label, v) => v ? <div className="flex gap-3 py-1.5 text-sm"><span className="w-36 flex-none text-slate-500">{label}</span><span className="text-slate-800">{v}</span></div> : null
    return (
      <Modal open onClose={onClose} title={s.full_name} subtitle={[s.student_code, s.level].filter(Boolean).join(' · ')}
        footer={<button className="btn-secondary" onClick={onClose}>{t('close')}</button>}>
        <div className="mb-4 flex items-center gap-4">
          <Avatar src={photoSrc(s.photo)} name={s.full_name} size={64} />
          <div>
            {s.nickname && <div className="text-lg font-bold text-slate-800">“{s.nickname}”</div>}
            <div className="text-sm text-slate-500">{programName(s.program)}{age != null && ` · ${age} ${lang === 'vi' ? 'tuổi' : 'years old'}`}</div>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {row(t('legalFirstName'), (s.first_name || '').trim() || guessFirstName(s.full_name, s.nickname))}
          {row(t('classGroup'), s.class_group)}
          {row(t('allergies'), s.allergies && <span className="font-semibold text-red-700">{s.allergies}</span>)}
          {row(t('arrivesAt'), partialFrom(s) && <span className="font-semibold text-amber-700">{partialFrom(s)} · {t('partialDay')}</span>)}
          {row(t('endDate'), end && <span className={endsThisQuarter ? 'font-semibold text-sky-800' : ''}>{dayText(end, lang)}{endsThisQuarter ? ` · ${t('endsThisQuarter')}` : ''}</span>)}
          {row(t('dob'), s.dob)}
          {row(t('nationality'), s.nationality)}
          {row(t('family'), fam?.name)}
          {row(t('parentsEmail'), s.parents_email)}
          {row(t('parentPhone'), s.parent_phone)}
        </div>
        {/* Trips are added from the attendance page by whoever takes the class; here they are only listed. */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-pra-navy">{t('travelSection')}</div>
          <StudentTrips student={s} canEdit={false} />
        </div>
      </Modal>
    )
  }

  return (
    <Modal open onClose={onClose} wide title={isNew ? t('addStudent') : s.full_name || t('edit')}
      subtitle={!isNew && [s.student_code, s.level, fam?.name].filter(Boolean).join(' · ')}
      footer={(<>
        {!isNew && onDelete && <button type="button" className="btn-ghost mr-auto text-red-600 hover:bg-red-50" onClick={() => onDelete(s)}><Trash2 size={16} /> {t('delete')}</button>}
        <button type="button" className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button type="submit" form="student-form" className="btn-primary" disabled={busy || !s.full_name.trim() || !!taken}>{busy ? t('saving') : t('save')}</button>
      </>)}>
      <form id="student-form" onSubmit={save} className="space-y-5">
        {showChecklist && (
          <NewStudentChecklist student={s} record={saved} ctx={checklist.ctx} me={me} t={t} lang={lang}
            locked={statusOf(s) !== statusOf(saved)}
            onSaved={onChecklistSaved} onChanged={checklist.onChanged}
            onTickFee={() => set('is_new')(true)} />
        )}
        <Section title={t('student')}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-1">
              <label className="group relative cursor-pointer" title={t('photoHint')}>
                {s.photo ? <img src={photoSrc(s.photo)} alt="" className="h-24 w-24 rounded-full object-cover ring-2 ring-slate-200" />
                  : <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 group-hover:border-pra-blue group-hover:text-pra-blue"><Camera /></div>}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && pickPhoto(e.target.files[0])} />
              </label>
              {s.photo && <button type="button" className="text-[11px] text-slate-400 hover:text-red-600" onClick={() => set('photo')('')}>{t('removePhoto')}</button>}
            </div>
            <div className="grid flex-1 gap-3 sm:grid-cols-6">
              <Field label={t('fullName')} className="sm:col-span-4"><TextInput value={s.full_name} onChange={set('full_name')} autoFocus={isNew} required /></Field>
              <Field label={t('nickname')} className="sm:col-span-2"><TextInput value={s.nickname} onChange={set('nickname')} /></Field>
              <Field label={t('legalFirstName')} className="sm:col-span-6" hint={!(s.first_name || '').trim() && s.full_name.trim() ? t('legalFirstNameHint', { name: guessFirstName(s.full_name, s.nickname) }) : undefined}>
                <TextInput value={s.first_name} onChange={set('first_name')} placeholder={guessFirstName(s.full_name, s.nickname)} />
              </Field>
              <div className="sm:col-span-3">
                <span className="label">{t('studentCode')}</span>
                <div className="flex gap-1.5">
                  <input className={`input font-mono uppercase ${taken ? '!border-red-400 focus:!ring-red-200' : ''}`} value={s.student_code || ''} onChange={(e) => set('student_code')(e.target.value)} placeholder={nextStudentCode(students)} />
                  <button type="button" className="btn-secondary flex-none px-2.5" title={t('nextFreeId')} onClick={() => set('student_code')(nextStudentCode(students.filter((x) => x.id !== s.id)))}><RotateCcw size={15} /></button>
                </div>
                {taken ? <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle size={13} /> {t('idTaken', { name: taken.full_name })}</span>
                  : codeNotS ? <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-700"><AlertTriangle size={13} /> {t('idNotS', { next: nextStudentCode(students.filter((x) => x.id !== s.id)) })}</span>
                  : isNew && <span className="mt-1 block text-xs text-slate-400">{t('idAutoHint')}</span>}
              </div>
              <Field label={t('status')} className="sm:col-span-3" hint={status === 'pending' ? t('pendingHint') : undefined}>
                <Select value={status} onChange={changeStatus}
                  options={STATUSES.map((v) => ({ value: v, label: t(v === 'active' ? 'enrolled' : v === 'pending' ? 'pending' : 'past') }))} />
              </Field>
              {backFromPast && (
                <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 sm:col-span-6">
                  <History size={16} className="mt-0.5 flex-none text-sky-600" />
                  <div className="space-y-1">
                    {oldEnd && !end && <div>{t('returnEndCleared', { date: dayText(oldEnd, lang) })} <button type="button" className="font-semibold text-pra-blue underline" onClick={() => set('end_date')(oldEnd)}>{t('returnKeepEnd')}</button></div>}
                    {end && end >= todayIso() && <div>{t('returnEndAsk', { date: dayText(end, lang) })} <button type="button" className="font-semibold text-pra-blue underline" onClick={() => set('end_date')('')}>{t('returnClearEnd')}</button></div>}
                    {end && end < todayIso() && <div className="font-semibold text-amber-800">{t('returnEndPast', { date: dayText(end, lang) })} <button type="button" className="font-semibold text-pra-blue underline" onClick={() => set('end_date')('')}>{t('returnClearEnd')}</button></div>}
                    <div className="text-xs text-sky-800">{t('returnChecklist')}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title={t('sectionEnrollment')}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={t('yearGroup')} hint={levelAuto && !levelTouched ?t('placeAutoHint') : undefined}>
              <Select value={s.level} onChange={(v) => { setLevelTouched(true); set('level')(v) }} options={LEVELS.map((l) => ({ value: l, label: l }))} />
            </Field>
            <Field label={t('program')}><Select value={s.program} onChange={set('program')} options={PROGRAMS.map((p) => ({ value: p.id, label: lang === 'vi' ? p.vi : p.en }))} /></Field>
            <Field label={t('classGroup')} className="sm:col-span-2"><TextInput value={s.class_group} onChange={set('class_group')} placeholder={s.level} /></Field>
            <Field label={t('startDate')}><TextInput type="date" value={s.start_date || ''} onChange={set('start_date')} /></Field>
            <Field label={t('endDate')} hint={endsThisQuarter ? <span className="font-semibold text-sky-700">{t('endsThisQuarter')}</span> : undefined}>
              <TextInput type="date" value={end} onChange={set('end_date')} />
            </Field>
            {/* Buttons sit outside the Field: a click inside its label would land on the date box. */}
            {quarters.length > 0 && (
              <div className="sm:col-span-2">
                <span className="label">{t('endOfQuarter')}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {quarters.map((q) => (
                    <button key={q.id} type="button" aria-pressed={end === q.end} title={t('quarterEnds', { quarter: lang === 'vi' ? q.vi : q.en, date: dayText(q.end, lang) })}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${end === q.end ? 'border-pra-blue bg-pra-blue text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-pra-blue hover:text-pra-blue'}`}
                      onClick={() => set('end_date')(q.end)}>
                      {lang === 'vi' ? q.vi : q.en.replace('Quarter ', 'Q')}
                    </button>
                  ))}
                  {end && <button type="button" className="px-1.5 py-1.5 text-xs text-slate-400 hover:text-red-600" onClick={() => set('end_date')('')}>{t('clearEndDate')}</button>}
                </div>
              </div>
            )}
            <p className={`text-xs sm:col-span-4 ${endBeforeStart ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{endBeforeStart ? t('endBeforeStart') : t('endDateHint')}</p>
            {startsLater(s) && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 sm:col-span-4">
                <AlertTriangle size={16} className="mt-0.5 flex-none text-amber-600" />
                <span>{t('startsLaterLong', { date: dayText(String(s.start_date).slice(0, 10), lang) })}</span>
              </div>
            )}
            <Field label={t('enrollmentStatus')} className="sm:col-span-4"><TextInput value={s.enrollment_status} onChange={set('enrollment_status')} placeholder="Enrolled, trial week…" /></Field>
            <div className="sm:col-span-4">
              <div className="flex min-h-[38px] flex-wrap items-center gap-x-4 gap-y-2">
                <Checkbox checked={!!partialFrom(s)} onChange={(on) => set('partial_from')(on ? DEFAULT_PARTIAL_FROM : '')} label={t('partialDay')} />
                {!!partialFrom(s) && (
                  <label className="flex items-center gap-2 text-sm text-slate-600">{t('arrivesAt')}
                    <span className="w-32"><TextInput type="time" value={s.partial_from} onChange={(v) => set('partial_from')(v || DEFAULT_PARTIAL_FROM)} /></span>
                  </label>
                )}
              </div>
              {!!partialFrom(s) && <p className="mt-1 text-xs text-slate-500">{t('partialDayHint')}</p>}
            </div>
            {/* An enrolled student added before the checklist existed (an August starter, say) can be given one. */}
            {!isNew && checklist && status === 'active' && statusOf(saved) === 'active' && !onboardingOf(saved) && (
              <div className="flex flex-wrap items-center gap-x-2 sm:col-span-4">
                <button type="button" className="btn-ghost px-2 text-xs text-pra-blue" onClick={startTracking}><ClipboardCheck size={14} /> {t('obStartTracking')}</button>
                <span className="text-xs text-slate-400">{t('obStartTrackingHint')}</span>
              </div>
            )}
          </div>
        </Section>

        {/* Trips save by themselves, apart from the Save button below. */}
        {!isNew && (
          <Section title={t('travelSection')}>
            <StudentTrips student={s} />
          </Section>
        )}

        <Section title={t('sectionPersonal')}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={t('dob')} right={age != null ? `${age} ${lang === 'vi' ? 'tuổi' : 'yrs'}` : null}><TextInput type="date" value={s.dob || ''} onChange={setDob} /></Field>
            <Field label={t('gender')}><Select value={s.gender || ''} onChange={set('gender')} options={[{ value: '', label: '—' }, { value: 'female', label: t('female') }, { value: 'male', label: t('male') }]} /></Field>
            <Field label={t('nationality')}><TextInput value={s.nationality} onChange={set('nationality')} /></Field>
            <Field label={t('allergies')}><TextInput value={s.allergies} onChange={set('allergies')} /></Field>
          </div>
        </Section>

        <Section title={t('sectionFamily')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('family')}>
              <Select value={s.family_id || ''} onChange={set('family_id')} options={[{ value: '', label: `— ${t('noFamily')} —` }, { value: '__new', label: t('newFamilyOption') }, ...[...families].sort((a, b) => a.name.localeCompare(b.name)).map((f) => ({ value: f.id, label: f.name }))]} />
            </Field>
            <Field label={t('address')}><TextInput value={s.address} onChange={set('address')} /></Field>
            {fam && (fam.contacts || []).length > 0 ? (
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:col-span-2">
                <div className="mb-1 font-semibold text-slate-500">{t('contacts')}</div>
                {(fam.contacts || []).map((c, i) => (
                  <div key={i} className="flex flex-wrap gap-x-4 gap-y-0.5 py-0.5">
                    <span className="font-semibold text-slate-700">{c.name || '—'}{c.relation ? ` (${c.relation})` : ''}</span>
                    {c.email && <span className="inline-flex items-center gap-1"><Mail size={12} />{c.email}</span>}
                    {c.phone && <span className="inline-flex items-center gap-1"><Phone size={12} />{c.phone}</span>}
                  </div>
                ))}
                {/* A slip in a parent's address is put right on the family (Students > Families). */}
                <EmailSlip value={(fam.contacts || []).map((c) => c.email).filter(Boolean).join(', ')} t={t} bad={false} className="mt-1" />
              </div>
            ) : (<>
              <div>
                <Field label={t('parentsEmail')}><TextInput value={s.parents_email} onChange={set('parents_email')} /></Field>
                <EmailSlip value={s.parents_email} onFix={set('parents_email')} t={t} className="mt-1" />
              </div>
              <Field label={t('parentPhone')}><TextInput value={s.parent_phone} onChange={set('parent_phone')} /></Field>
            </>)}
            {lead && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 sm:col-span-2">
                <Sprout size={13} className="text-pra-green" /> {t('obFromLead')} <Link to={`/leads?lead=${lead.id}`} className="font-semibold text-pra-blue hover:underline">{lead.family}</Link>
              </div>
            )}
          </div>
        </Section>

        <Section title={t('sectionBilling')}>
          <div className="flex flex-col gap-2">
            <Checkbox checked={s.is_new} onChange={set('is_new')} label={t('isNew')} />
            <Checkbox checked={!!s.q4_full} onChange={set('q4_full')} label={t('q4Full')} />
            <Checkbox checked={s.legacy} onChange={set('legacy')} label={t('legacy')} />
          </div>
          <Field label={t('notes')} className="mt-3"><TextInput value={s.notes} onChange={set('notes')} /></Field>
        </Section>
      </form>
    </Modal>
  )
}
