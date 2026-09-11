import { useMemo, useState } from 'react'
import { Pencil, Trash2, UserPlus, Users } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { LEVELS, PROGRAMS } from '../lib/fees'
import { Card, Field, TextInput, Select, Checkbox, Modal, Empty, Spinner } from '../components/ui'

const blankStudent = () => ({ full_name: '', nickname: '', level: 'Year 1', program: 'regular', family_id: '', legacy: false, is_new: false, active: true, dob: '', nationality: '', notes: '' })
const blankFamily = () => ({ name: '', email: '', phone: '', language: 'en', notes: '' })

export function StudentForm({ value, onChange, families, t, lang }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v })
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t('fullName')} className="sm:col-span-2"><TextInput value={value.full_name} onChange={set('full_name')} autoFocus /></Field>
      <Field label={t('nickname')}><TextInput value={value.nickname} onChange={set('nickname')} /></Field>
      <Field label={t('family')}>
        <Select value={value.family_id || ''} onChange={set('family_id')} options={[{ value: '', label: `— ${t('noFamily')} —` }, ...families.map((f) => ({ value: f.id, label: f.name }))]} />
      </Field>
      <Field label={t('level')}><Select value={value.level} onChange={set('level')} options={LEVELS.map((l) => ({ value: l, label: l }))} /></Field>
      <Field label={t('program')}><Select value={value.program} onChange={set('program')} options={PROGRAMS.map((p) => ({ value: p.id, label: lang === 'vi' ? p.vi : p.en }))} /></Field>
      <Field label={t('dob')}><TextInput value={value.dob || ''} onChange={set('dob')} type="date" /></Field>
      <Field label={t('nationality')}><TextInput value={value.nationality || ''} onChange={set('nationality')} /></Field>
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

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black text-slate-800">{t('students')}</h1>
        <div className="flex-1" />
        <input className="input max-w-xs" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <Checkbox checked={showInactive} onChange={setShowInactive} label={t('inactive')} />
        <button className="btn-secondary" onClick={() => setEditingFam(blankFamily())}><Users size={16} /> {t('addFamily')}</button>
        <button className="btn-primary" onClick={() => setEditing(blankStudent())}><UserPlus size={16} /> {t('addStudent')}</button>
      </div>

      <Card>
        {rows.length === 0 ? <Empty text={t('noData')} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2">{t('fullName')}</th><th>{t('nickname')}</th><th>{t('level')}</th><th>{t('program')}</th><th>{t('family')}</th><th></th><th></th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className={`border-t border-slate-100 hover:bg-slate-50 ${s.active === false ? 'opacity-50' : ''}`}>
                    <td className="py-2 font-semibold">{s.full_name}</td>
                    <td>{s.nickname}</td>
                    <td>{s.level}</td>
                    <td className="text-slate-500">{(PROGRAMS.find((p) => p.id === s.program) || {})[lang === 'vi' ? 'vi' : 'en'] || s.program}</td>
                    <td>{famById[s.family_id]?.name || <span className="text-slate-300">—</span>}</td>
                    <td className="text-xs">{s.legacy && <span className="chip bg-purple-100 text-purple-800 mr-1">legacy</span>}{s.is_new && <span className="chip bg-green-100 text-green-800">new</span>}</td>
                    <td className="whitespace-nowrap text-right">
                      <button className="btn-ghost p-1.5" onClick={() => setEditing({ ...blankStudent(), ...s })}><Pencil size={15} /></button>
                      <button className="btn-ghost p-1.5 text-red-500" onClick={() => removeStudent(s)}><Trash2 size={15} /></button>
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
                    <button className="btn-ghost p-1.5" onClick={() => setEditingFam({ ...blankFamily(), ...f })}><Pencil size={15} /></button>
                    <button className="btn-ghost p-1.5 text-red-500" onClick={() => removeFamily(f)}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('edit') : t('addStudent')}>
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
