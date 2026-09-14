import { useMemo, useState } from 'react'
import { Pencil, Trash2, UserPlus, Users, Camera, ClipboardList } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { LEVELS, PROGRAMS } from '../lib/fees'
import { ROSTER } from '../data/roster'
import { resizeImage } from '../lib/report/photo'
import { Card, Field, TextInput, Select, Checkbox, Modal, Empty, Spinner } from '../components/ui'

const blankStudent = () => ({ full_name: '', nickname: '', level: 'Year 1', program: 'regular', family_id: '', legacy: false, is_new: false, active: true, dob: '', nationality: '', notes: '',
  student_code: '', gender: '', class_group: '', parents_email: '', parent_phone: '', address: '', allergies: '', start_date: '', enrollment_status: '', photo: '' })
const blankFamily = () => ({ name: '', email: '', phone: '', language: 'en', notes: '' })

export function StudentForm({ value, onChange, families, t, lang }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v })
  const photo = async (file) => { try { onChange({ ...value, photo: await resizeImage(file) }) } catch (e) { alert(e.message) } }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex items-start gap-4 sm:col-span-2">
        <label className="group relative cursor-pointer" title={t('photo')}>
          {value.photo ? <img src={value.photo} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-200" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Camera /></div>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && photo(e.target.files[0])} />
        </label>
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <Field label={t('fullName')} className="sm:col-span-2"><TextInput value={value.full_name} onChange={set('full_name')} autoFocus /></Field>
          <Field label={t('studentCode')}><TextInput value={value.student_code || ''} onChange={set('student_code')} placeholder="PAL0139" /></Field>
        </div>
      </div>
      <Field label={t('nickname')}><TextInput value={value.nickname} onChange={set('nickname')} /></Field>
      <Field label={t('family')}>
        <Select value={value.family_id || ''} onChange={set('family_id')} options={[{ value: '', label: `— ${t('noFamily')} —` }, ...families.map((f) => ({ value: f.id, label: f.name }))]} />
      </Field>
      <Field label={t('level')}><Select value={value.level} onChange={set('level')} options={LEVELS.map((l) => ({ value: l, label: l }))} /></Field>
      <Field label={t('program')}><Select value={value.program} onChange={set('program')} options={PROGRAMS.map((p) => ({ value: p.id, label: lang === 'vi' ? p.vi : p.en }))} /></Field>
      <Field label={t('dob')}><TextInput value={value.dob || ''} onChange={set('dob')} type="date" /></Field>
      <Field label={t('nationality')}><TextInput value={value.nationality || ''} onChange={set('nationality')} /></Field>
      <Field label={t('gender')}><Select value={value.gender || ''} onChange={set('gender')} options={[{ value: '', label: '—' }, { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]} /></Field>
      <Field label={t('classGroup')}><TextInput value={value.class_group || ''} onChange={set('class_group')} /></Field>
      <Field label={t('parentsEmail')}><TextInput value={value.parents_email || ''} onChange={set('parents_email')} /></Field>
      <Field label={t('parentPhone')}><TextInput value={value.parent_phone || ''} onChange={set('parent_phone')} /></Field>
      <Field label={t('address')}><TextInput value={value.address || ''} onChange={set('address')} /></Field>
      <Field label={t('allergies')}><TextInput value={value.allergies || ''} onChange={set('allergies')} /></Field>
      <div className="sm:col-span-2 flex flex-wrap gap-4">
        <Checkbox checked={value.legacy} onChange={set('legacy')} label={t('legacy')} />
        <Checkbox checked={value.is_new} onChange={set('is_new')} label={t('isNew')} />
        <Checkbox checked={value.active !== false} onChange={set('active')} label={t('active')} />
      </div>
      <Field label={t('notes')} className="sm:col-span-2"><TextInput value={value.notes || ''} onChange={set('notes')} /></Field>
    </div>
  )
}

export function FamilyForm({ value, onChange, t }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v })
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t('parentName')} className="sm:col-span-2"><TextInput value={value.name} onChange={set('name')} autoFocus /></Field>
      <Field label={t('email')}><TextInput value={value.email || ''} onChange={set('email')} type="email" /></Field>
      <Field label={t('phone')}><TextInput value={value.phone || ''} onChange={set('phone')} /></Field>
      <Field label={t('preferredLang')}><Select value={value.language || 'en'} onChange={set('language')} options={[{ value: 'en', label: t('english') }, { value: 'vi', label: t('vietnamese') }]} /></Field>
      <Field label={t('notes')}><TextInput value={value.notes || ''} onChange={set('notes')} /></Field>
    </div>
  )
}

export default function Students() {
  const { t, lang } = useT()
  const { loading, students, families, refresh } = useData()
  const { isOffice, isHead } = useAuth()
  const canEdit = isOffice || isHead
  const [q, setQ] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState(null) // student row
  const [editingFam, setEditingFam] = useState(null)
  const [busy, setBusy] = useState(false)

  const famById = useMemo(() => Object.fromEntries(families.map((f) => [f.id, f])), [families])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return students
      .filter((s) => showInactive || s.active !== false)
      .filter((s) => !needle || `${s.full_name} ${s.nickname} ${famById[s.family_id]?.name || ''} ${s.level}`.toLowerCase().includes(needle))
      .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || (a.full_name || '').localeCompare(b.full_name || ''))
  }, [students, q, showInactive, famById])

  const saveStudent = async () => {
    if (!editing.full_name.trim()) return
    setBusy(true)
    try {
      await db.students.save({ ...editing, family_id: editing.family_id || null, dob: editing.dob || null })
      await refresh(); setEditing(null)
    } finally { setBusy(false) }
  }
  const saveFamily = async () => {
    if (!editingFam.name.trim()) return
    setBusy(true)
    try { await db.families.save(editingFam); await refresh(); setEditingFam(null) } finally { setBusy(false) }
  }
  const removeStudent = async (s) => {
    if (!confirm(t('confirmDelete'))) return
    await db.students.remove(s.id); await refresh()
  }
  const removeFamily = async (f) => {
    if (!confirm(t('confirmDelete'))) return
    await db.families.remove(f.id); await refresh()
  }
  // Adds students from the built-in 2026-2027 roster that are not here yet
  // (matched by student code, then by full name) and fills in blank details
  // on the ones that are.
  const loadRoster = async () => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
    const rows = []
    let added = 0, updated = 0
    for (const r of ROSTER) {
      const existing = students.find((s) => (r.student_code && s.student_code === r.student_code) || norm(s.full_name) === norm(r.full_name))
      if (!existing) { rows.push({ ...blankStudent(), ...r, is_new: false }); added++; continue }
      const patch = {}
      for (const [k, v] of Object.entries(r)) if (v && !existing[k]) patch[k] = v
      if (Object.keys(patch).length) { rows.push({ ...existing, ...patch }); updated++ }
    }
    if (!rows.length) { alert('Every student in the 2026-2027 roster is already here.'); return }
    if (!confirm(`Add ${added} students and fill in details for ${updated} existing ones from the 2026-2027 roster?`)) return
    setBusy(true)
    try { await db.students.saveMany(rows); await refresh() } catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black text-slate-800">{t('students')}</h1>
        <div className="flex-1" />
        <input className="input max-w-xs" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <Checkbox checked={showInactive} onChange={setShowInactive} label={t('inactive')} />
        {canEdit && <button className="btn-secondary" onClick={loadRoster} disabled={busy}><ClipboardList size={16} /> {t('loadRoster')}</button>}
        {canEdit && <button className="btn-secondary" onClick={() => setEditingFam(blankFamily())}><Users size={16} /> {t('addFamily')}</button>}
        {canEdit && <button className="btn-primary" onClick={() => setEditing(blankStudent())}><UserPlus size={16} /> {t('addStudent')}</button>}
      </div>

      <Card>
        {rows.length === 0 ? <Empty text={t('noData')} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2">{t('fullName')}</th><th>{t('nickname')}</th><th>{t('level')}</th><th>{t('program')}</th><th>{t('family')}</th><th></th><th></th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className={`border-t border-slate-100 hover:bg-slate-50 ${s.active === false ? 'opacity-50' : ''}`}>
                    <td className="py-2 font-semibold"><span className="flex items-center gap-2">{s.photo ? <img src={s.photo} alt="" className="h-7 w-7 rounded-full object-cover" /> : null}{s.full_name}{s.student_code && <span className="font-mono text-[10px] font-normal text-slate-400">{s.student_code}</span>}</span></td>
                    <td>{s.nickname}</td>
                    <td>{s.level}</td>
                    <td className="text-slate-500">{(PROGRAMS.find((p) => p.id === s.program) || {})[lang === 'vi' ? 'vi' : 'en'] || s.program}</td>
                    <td>{famById[s.family_id]?.name || <span className="text-slate-300">—</span>}</td>
                    <td className="text-xs">{s.legacy && <span className="chip bg-purple-100 text-purple-800 mr-1">legacy</span>}{s.is_new && <span className="chip bg-green-100 text-green-800">new</span>}</td>
                    <td className="whitespace-nowrap text-right">
                      {canEdit && <button className="btn-ghost p-1.5" onClick={() => setEditing({ ...blankStudent(), ...s })}><Pencil size={15} /></button>}
                      {canEdit && <button className="btn-ghost p-1.5 text-red-500" onClick={() => removeStudent(s)}><Trash2 size={15} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={t('families')}>
        {families.length === 0 ? <Empty text={t('noData')} /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2">{t('parentName')}</th><th>{t('email')}</th><th>{t('phone')}</th><th>{t('students')}</th><th>{t('language')}</th><th></th></tr></thead>
            <tbody>
              {families.map((f) => (
                <tr key={f.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-2 font-semibold">{f.name}</td>
                  <td>{f.email}</td>
                  <td>{f.phone}</td>
                  <td className="text-slate-500">{students.filter((s) => s.family_id === f.id).map((s) => s.nickname || s.full_name).join(', ')}</td>
                  <td className="uppercase text-xs">{f.language}</td>
                  <td className="whitespace-nowrap text-right">
                    {canEdit && <button className="btn-ghost p-1.5" onClick={() => setEditingFam({ ...blankFamily(), ...f })}><Pencil size={15} /></button>}
                    {canEdit && <button className="btn-ghost p-1.5 text-red-500" onClick={() => removeFamily(f)}><Trash2 size={15} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('edit') : t('addStudent')} wide>
        {editing && <StudentForm value={editing} onChange={setEditing} families={families} t={t} lang={lang} />}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setEditing(null)}>{t('cancel')}</button>
          <button className="btn-primary" onClick={saveStudent} disabled={busy}>{busy ? t('saving') : t('save')}</button>
        </div>
      </Modal>

      <Modal open={!!editingFam} onClose={() => setEditingFam(null)} title={editingFam?.id ? t('edit') : t('addFamily')}>
        {editingFam && <FamilyForm value={editingFam} onChange={setEditingFam} t={t} />}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setEditingFam(null)}>{t('cancel')}</button>
          <button className="btn-primary" onClick={saveFamily} disabled={busy}>{busy ? t('saving') : t('save')}</button>
        </div>
      </Modal>
    </div>
  )
}
