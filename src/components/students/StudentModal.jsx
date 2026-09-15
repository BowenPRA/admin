import { useState } from 'react'
import { Camera, RotateCcw, Trash2, AlertTriangle, Mail, Phone } from 'lucide-react'
import { LEVELS, PROGRAMS } from '../../lib/fees'
import { resizeImage, photoSrc } from '../../lib/report/photo'
import { nextStudentCode, codeTakenBy, normalizeCode } from '../../lib/studentIds'
import { ageOf } from '../../lib/studentRecords'
import { Field, TextInput, Select, Checkbox, Modal, Avatar } from '../ui'

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
 */
export default function StudentModal({ value, onClose, onSave, onDelete, students, families, canEdit, t, lang }) {
  const [s, setS] = useState(value)
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setS((cur) => ({ ...cur, [k]: v }))
  const isNew = !s.id
  const taken = codeTakenBy(students, s.student_code, s.id)
  const fam = families.find((f) => f.id === s.family_id)
  const programName = (id) => { const p = PROGRAMS.find((x) => x.id === id); return p ? (lang === 'vi' ? p.vi : p.en) : id }

  const save = async (e) => {
    e?.preventDefault()
    if (!s.full_name.trim() || taken) return
    setBusy(true)
    try { await onSave({ ...s, full_name: s.full_name.trim(), student_code: normalizeCode(s.student_code) || null }) } finally { setBusy(false) }
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
          {row(t('classGroup'), s.class_group)}
          {row(t('allergies'), s.allergies && <span className="font-semibold text-red-700">{s.allergies}</span>)}
          {row(t('dob'), s.dob)}
          {row(t('nationality'), s.nationality)}
          {row(t('family'), fam?.name)}
          {row(t('parentsEmail'), s.parents_email)}
          {row(t('parentPhone'), s.parent_phone)}
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
              <div className="sm:col-span-3">
                <span className="label">{t('studentCode')}</span>
                <div className="flex gap-1.5">
                  <input className={`input font-mono uppercase ${taken ? '!border-red-400 focus:!ring-red-200' : ''}`} value={s.student_code || ''} onChange={(e) => set('student_code')(e.target.value)} placeholder={nextStudentCode(students)} />
                  <button type="button" className="btn-secondary flex-none px-2.5" title={t('nextFreeId')} onClick={() => set('student_code')(nextStudentCode(students.filter((x) => x.id !== s.id)))}><RotateCcw size={15} /></button>
                </div>
                {taken ? <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle size={13} /> {t('idTaken', { name: taken.full_name })}</span>
                  : isNew && <span className="mt-1 block text-xs text-slate-400">{t('idAutoHint')}</span>}
              </div>
              <div className="flex items-end pb-2 sm:col-span-3">
                <Checkbox checked={s.active !== false} onChange={set('active')} label={t('enrolledToggle')} />
              </div>
            </div>
          </div>
        </Section>

        <Section title={t('sectionEnrollment')}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={t('yearGroup')}><Select value={s.level} onChange={set('level')} options={LEVELS.map((l) => ({ value: l, label: l }))} /></Field>
            <Field label={t('program')}><Select value={s.program} onChange={set('program')} options={PROGRAMS.map((p) => ({ value: p.id, label: lang === 'vi' ? p.vi : p.en }))} /></Field>
            <Field label={t('classGroup')}><TextInput value={s.class_group} onChange={set('class_group')} placeholder={s.level} /></Field>
            <Field label={t('startDate')}><TextInput type="date" value={s.start_date || ''} onChange={set('start_date')} /></Field>
            <Field label={t('enrollmentStatus')} className="sm:col-span-4"><TextInput value={s.enrollment_status} onChange={set('enrollment_status')} placeholder="Enrolled, trial week…" /></Field>
          </div>
        </Section>

        <Section title={t('sectionPersonal')}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={t('dob')} right={age != null ? `${age} ${lang === 'vi' ? 'tuổi' : 'yrs'}` : null}><TextInput type="date" value={s.dob || ''} onChange={set('dob')} /></Field>
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
              </div>
            ) : (<>
              <Field label={t('parentsEmail')}><TextInput value={s.parents_email} onChange={set('parents_email')} /></Field>
              <Field label={t('parentPhone')}><TextInput value={s.parent_phone} onChange={set('parent_phone')} /></Field>
            </>)}
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
