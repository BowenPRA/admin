import { useMemo, useState } from 'react'
import { Pencil, Trash2, UserPlus, Users, Camera, ClipboardList, ChevronUp, ChevronDown } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { LEVELS, PROGRAMS } from '../lib/fees'
import { ROSTER } from '../data/roster'
import { resizeImage, photoSrc } from '../lib/report/photo'
import { proposeFamilies, familyNameFor, looksVietnamese, emailsOf } from '../lib/families'
import { Card, Field, TextInput, Select, Checkbox, Modal, Empty, Spinner } from '../components/ui'

// New students added by hand from now on pay a full-price Quarter 4 (q4_full);
// the roster loader turns it off for the students already enrolled.
const blankStudent = () => ({ full_name: '', nickname: '', level: 'Year 1', program: 'regular', family_id: '', legacy: false, is_new: true, q4_full: true, active: true, dob: '', nationality: '', notes: '',
  student_code: '', gender: '', class_group: '', parents_email: '', parent_phone: '', address: '', allergies: '', start_date: '', enrollment_status: '', photo: '' })
const blankFamily = () => ({ name: '', email: '', phone: '', language: 'en', notes: '' })

function SortTh({ col, cur, dir, onClick, children }) {
  const active = cur === col
  return (
    <th className="py-2 cursor-pointer select-none whitespace-nowrap" onClick={() => onClick(col)}>
      <span className="inline-flex items-center gap-0.5">
        {children}
        {active ? (dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronUp size={13} className="opacity-0 group-hover:opacity-30" />}
      </span>
    </th>
  )
}

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
        <Checkbox checked={!!value.q4_full} onChange={set('q4_full')} label={t('q4Full')} />
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
  const [sortCol, setSortCol] = useState('level')
  const [sortDir, setSortDir] = useState('asc')

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const famById = useMemo(() => Object.fromEntries(families.map((f) => [f.id, f])), [families])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = students
      .filter((s) => showInactive || s.active !== false)
      .filter((s) => !needle || `${s.full_name} ${s.nickname} ${famById[s.family_id]?.name || ''} ${s.level} ${s.student_code}`.toLowerCase().includes(needle))
    const cmp = (a, b) => {
      let va, vb
      switch (sortCol) {
        case 'name': va = a.full_name || ''; vb = b.full_name || ''; break
        case 'nickname': va = a.nickname || ''; vb = b.nickname || ''; break
        case 'level': return (LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level)) * (sortDir === 'asc' ? 1 : -1) || (a.full_name || '').localeCompare(b.full_name || '')
        case 'program': va = a.program || ''; vb = b.program || ''; break
        case 'age': { const da = a.dob ? new Date(a.dob) : null, db2 = b.dob ? new Date(b.dob) : null; return ((da || 0) - (db2 || 0)) * (sortDir === 'asc' ? -1 : 1) }
        default: va = a.full_name || ''; vb = b.full_name || ''
      }
      return va.localeCompare(vb) * (sortDir === 'asc' ? 1 : -1)
    }
    return [...filtered].sort(cmp)
  }, [students, q, showInactive, famById, sortCol, sortDir])

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
      if (!existing) { rows.push({ ...blankStudent(), ...r, is_new: false, q4_full: false }); added++; continue }
      const patch = {}
      for (const [k, v] of Object.entries(r)) if (v && !existing[k]) patch[k] = v
      if (Object.keys(patch).length) { rows.push({ ...existing, ...patch }); updated++ }
    }
    if (!rows.length) { alert('Every student in the 2026-2027 roster is already here.'); return }
    if (!confirm(`Add ${added} students and fill in details for ${updated} existing ones from the 2026-2027 roster?`)) return
    setBusy(true)
    try { await db.students.saveMany(rows); await refresh() } catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  // Put a student into a family straight from the table. '__new' makes a
  // family for that student first (named after them, language guessed from
  // the name, parent email copied across).
  const assignFamily = async (s, familyId) => {
    setBusy(true)
    try {
      let fid = familyId || null
      if (familyId === '__new') {
        const fam = await db.families.save({ name: familyNameFor([s]), email: emailsOf(s).join(', '), phone: s.parent_phone || '', language: looksVietnamese([s]) ? 'vi' : 'en', notes: '' })
        fid = fam.id
      }
      await db.students.save({ ...s, family_id: fid })
      await refresh()
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  // Group students who share a parent email / phone into families.
  const buildFamilies = async () => {
    const { create, attach } = proposeFamilies(students, families)
    if (!create.length && !attach.length) { alert(t('buildFamiliesNone')); return }
    const lines = [
      ...create.map((c) => `• ${c.name} (${c.language.toUpperCase()}): ${c.names.join(', ')}`),
      ...attach.map((a) => `• → ${a.familyName}: ${a.names.join(', ')}`),
    ]
    if (!confirm(`${t('buildFamiliesConfirm')}\n\n${lines.join('\n')}`)) return
    setBusy(true)
    try {
      const updates = []
      for (const c of create) {
        const fam = await db.families.save({ name: c.name, email: c.email, phone: c.phone, language: c.language, notes: '' })
        c.studentIds.forEach((id) => updates.push({ ...students.find((s) => s.id === id), family_id: fam.id }))
      }
      attach.forEach((a) => a.studentIds.forEach((id) => updates.push({ ...students.find((s) => s.id === id), family_id: a.familyId })))
      await db.students.saveMany(updates)
      await refresh()
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  if (loading) return <Spinner />

  const familyOptions = [
    { value: '', label: `— ${t('noFamily')} —` },
    ...families.map((f) => ({ value: f.id, label: f.name })),
    { value: '__new', label: t('newFamilyOption') },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black text-slate-800">{t('students')}</h1>
        <div className="flex-1" />
        <input className="input max-w-xs" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <Checkbox checked={showInactive} onChange={setShowInactive} label={t('inactive')} />
        {canEdit && <button className="btn-secondary" onClick={loadRoster} disabled={busy}><ClipboardList size={16} /> {t('loadRoster')}</button>}
        {canEdit && <button className="btn-secondary" onClick={buildFamilies} disabled={busy}><Users size={16} /> {t('buildFamilies')}</button>}
        {canEdit && <button className="btn-secondary" onClick={() => setEditingFam(blankFamily())}><Users size={16} /> {t('addFamily')}</button>}
        {canEdit && <button className="btn-primary" onClick={() => setEditing(blankStudent())}><UserPlus size={16} /> {t('addStudent')}</button>}
      </div>

      <Card>
        <div className="flex items-center justify-between px-1 pb-2 text-xs text-slate-400">{rows.length} student{rows.length !== 1 ? 's' : ''}</div>
        {rows.length === 0 ? <Empty text={t('noData')} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-slate-500">
                <SortTh col="name" cur={sortCol} dir={sortDir} onClick={toggleSort}>{t('fullName')}</SortTh>
                <SortTh col="nickname" cur={sortCol} dir={sortDir} onClick={toggleSort}>{t('nickname')}</SortTh>
                <SortTh col="level" cur={sortCol} dir={sortDir} onClick={toggleSort}>{t('level')}</SortTh>
                <SortTh col="age" cur={sortCol} dir={sortDir} onClick={toggleSort}>Age</SortTh>
                <SortTh col="program" cur={sortCol} dir={sortDir} onClick={toggleSort}>{t('program')}</SortTh>
                <th>{t('family')}</th><th></th><th></th>
              </tr></thead>
              <tbody>
                {rows.map((s) => {
                  const age = s.dob ? Math.floor((Date.now() - new Date(s.dob)) / 31557600000) : null
                  return (
                    <tr key={s.id} className={`border-t border-slate-100 hover:bg-slate-50 ${s.active === false ? 'opacity-50' : ''}`}>
                      <td className="py-2 font-semibold"><span className="flex items-center gap-2">{photoSrc(s.photo) ? <img src={photoSrc(s.photo)} alt="" className="h-7 w-7 rounded-full object-cover flex-none" /> : null}{s.full_name}{s.student_code && <span className="font-mono text-[10px] font-normal text-slate-400">{s.student_code}</span>}</span></td>
                      <td>{s.nickname}</td>
                      <td>{s.level}</td>
                      <td className="text-slate-500">{age != null ? age : '—'}</td>
                      <td className="text-slate-500">{(PROGRAMS.find((p) => p.id === s.program) || {})[lang === 'vi' ? 'vi' : 'en'] || s.program}</td>
                      <td className="min-w-[180px]">
                        {canEdit ? (
                          <select className={`input !py-1 text-xs ${s.family_id ? '' : 'text-amber-700 border-amber-300'}`} value={s.family_id || ''} disabled={busy} onChange={(e) => assignFamily(s, e.target.value)}>
                            {familyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (famById[s.family_id]?.name || <span className="text-slate-300">—</span>)}
                      </td>
                      <td className="text-xs whitespace-nowrap">{s.legacy && <span className="chip bg-purple-100 text-purple-800 mr-1">legacy</span>}{s.is_new && <span className="chip bg-green-100 text-green-800 mr-1">new</span>}{s.q4_full && <span className="chip bg-slate-100 text-slate-600" title={t('q4Full')}>Q4 full</span>}</td>
                      <td className="whitespace-nowrap text-right">
                        {canEdit && <button className="btn-ghost p-1.5" onClick={() => setEditing({ ...blankStudent(), ...s })}><Pencil size={15} /></button>}
                        {canEdit && <button className="btn-ghost p-1.5 text-red-500" onClick={() => removeStudent(s)}><Trash2 size={15} /></button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(() => {
        const activeFams = families.filter((f) => students.some((s) => s.family_id === f.id && s.active !== false)).sort((a, b) => a.name.localeCompare(b.name))
        const inactiveFams = families.filter((f) => !students.some((s) => s.family_id === f.id && s.active !== false)).sort((a, b) => a.name.localeCompare(b.name))
        const FamilyTable = ({ fams, dim }) => (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2">{t('parentName')}</th><th>{t('email')}</th><th>{t('phone')}</th><th>{t('students')}</th><th>{t('language')}</th><th></th></tr></thead>
            <tbody>
              {fams.map((f) => (
                <tr key={f.id} className={`border-t border-slate-100 hover:bg-slate-50 ${dim ? 'opacity-50' : ''}`}>
                  <td className="py-2 font-semibold">{f.name}</td>
                  <td className="max-w-[200px] truncate text-slate-600" title={f.email}>{f.email}</td>
                  <td className="text-slate-600">{f.phone}</td>
                  <td className="text-slate-500">{students.filter((s) => s.family_id === f.id).map((s) => s.nickname || s.full_name).join(', ')}</td>
                  <td className="uppercase text-xs">{f.language}</td>
                  <td className="whitespace-nowrap text-right">
                    {canEdit && <button className="btn-ghost p-1.5 text-pra-blue" title={t('addToFamily')} onClick={() => setEditing({ ...blankStudent(), family_id: f.id, parents_email: f.email || '' })}><UserPlus size={15} /></button>}
                    {canEdit && <button className="btn-ghost p-1.5" onClick={() => setEditingFam({ ...blankFamily(), ...f })}><Pencil size={15} /></button>}
                    {canEdit && <button className="btn-ghost p-1.5 text-red-500" onClick={() => removeFamily(f)}><Trash2 size={15} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
        return (
          <>
            <Card title={`${t('families')} — Active (${activeFams.length})`}>
              {activeFams.length === 0 ? <Empty text={t('noData')} /> : <FamilyTable fams={activeFams} />}
            </Card>
            {showInactive && inactiveFams.length > 0 && (
              <Card title={`${t('families')} — Inactive (${inactiveFams.length})`}>
                <FamilyTable fams={inactiveFams} dim />
              </Card>
            )}
          </>
        )
      })()}

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
