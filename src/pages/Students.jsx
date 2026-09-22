import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UserPlus, Users, ClipboardList, ChevronUp, ChevronDown, MoreHorizontal, BadgeCheck, Mail, Phone, Pencil, AlertTriangle, IdCard, FileSpreadsheet } from 'lucide-react'
import { db } from '../lib/db'
import { exportStudentList } from '../lib/exportExcel'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { LEVELS, PROGRAMS } from '../lib/fees'
import { photoSrc } from '../lib/report/photo'
import { proposeFamilies, familyNameFor, looksVietnamese, emailsOf } from '../lib/families'
import { normalizeCode, needsCodeUpdate, nextStudentCode } from '../lib/studentIds'
import { Card, Checkbox, Empty, Spinner, Avatar, Segmented, SearchInput, PageHeader, Menu } from '../components/ui'
import StudentModal from '../components/students/StudentModal'
import FamilyModal from '../components/students/FamilyModal'
import { blankStudent, ageOf, blankFamily, contactsOf, familyMissingContact, isEnrolled, isPending, isPast, statusOf } from '../lib/studentRecords'

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
const levelIndex = (l) => { const i = LEVELS.indexOf(l); return i < 0 ? 99 : i }
// Sorts S0007 before S0120, and BLE / missing IDs after the S numbers.
const codeKey = (c) => { const m = normalizeCode(c).match(/^([A-Z]+)(\d+)$/); return m ? `${m[1] === 'S' ? 0 : 1}${m[1]}${m[2].padStart(6, '0')}` : `9${c || ''}` }

function SortTh({ col, sort, onSort, children, className = '' }) {
  const active = sort.col === col
  return (
    <th className={`th ${className}`} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="group inline-flex items-center gap-0.5 uppercase hover:text-slate-800" onClick={() => onSort(col)}>
        {children}
        {active ? (sort.dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronUp size={13} className="opacity-0 group-hover:opacity-40" />}
      </button>
    </th>
  )
}

export default function Students() {
  const { t, lang } = useT()
  const toast = useToast()
  const { loading, students, families, fees, refresh } = useData()
  const { isOffice } = useAuth()
  const canEdit = isOffice
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'families' ? 'families' : 'students'
  const setTab = (v) => setParams(v === 'families' ? { tab: v } : {}, { replace: true })

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('active')
  const [level, setLevel] = useState('')
  const [program, setProgram] = useState('')
  const [noFamily, setNoFamily] = useState(false)
  const [missingContact, setMissingContact] = useState(false)
  const [sort, setSort] = useState({ col: 'level', dir: 'asc' })
  const [editing, setEditing] = useState(null)
  const [editingFam, setEditingFam] = useState(null)
  const [busy, setBusy] = useState(false)
  const rosterInput = useRef(null)

  const famById = useMemo(() => Object.fromEntries(families.map((f) => [f.id, f])), [families])
  const kidsByFamily = useMemo(() => {
    const m = {}
    students.forEach((s) => { if (s.family_id) (m[s.family_id] ||= []).push(s) })
    return m
  }, [students])
  const programName = (id) => { const p = PROGRAMS.find((x) => x.id === id); return p ? (lang === 'vi' ? p.vi : p.en).replace(/ Program$| Pathway$/, '') : id }

  const counts = useMemo(() => ({
    active: students.filter(isEnrolled).length,
    pending: students.filter(isPending).length,
    past: students.filter(isPast).length,
  }), [students])
  const toConvert = useMemo(() => students.filter(needsCodeUpdate), [students])
  const withoutId = useMemo(() => students.filter((s) => !isPast(s) && !s.student_code), [students])

  // The 'past' tab is the 'inactive' status; the other two match it by name.
  const inStatus = (s) => status === 'all' || statusOf(s) === (status === 'past' ? 'inactive' : status)
  const rows = useMemo(() => {
    const needle = norm(q)
    const list = students
      .filter(inStatus)
      .filter((s) => !level || s.level === level)
      .filter((s) => !program || s.program === program)
      .filter((s) => !noFamily || !s.family_id)
      .filter((s) => !needle || norm(`${s.full_name} ${s.nickname} ${famById[s.family_id]?.name || ''} ${s.level} ${s.student_code} ${normalizeCode(s.student_code)} ${s.class_group}`).includes(needle))
    const dir = sort.dir === 'asc' ? 1 : -1
    const byName = (a, b) => (a.full_name || '').localeCompare(b.full_name || '')
    const cmp = {
      code: (a, b) => codeKey(a.student_code).localeCompare(codeKey(b.student_code)),
      name: byName,
      level: (a, b) => levelIndex(a.level) - levelIndex(b.level) || byName(a, b),
      age: (a, b) => (b.dob || '9999').localeCompare(a.dob || '9999'),
      program: (a, b) => (a.program || '').localeCompare(b.program || '') || byName(a, b),
      family: (a, b) => (famById[a.family_id]?.name || '~').localeCompare(famById[b.family_id]?.name || '~') || byName(a, b),
    }[sort.col] || byName
    return [...list].sort((a, b) => cmp(a, b) * dir)
  }, [students, q, status, level, program, noFamily, famById, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  const famRows = useMemo(() => {
    const needle = norm(q)
    // A family follows its children: enrolled if any child is, otherwise pending
    // if any child is waiting to start. A family with no children left is past.
    const famStatus = (f) => {
      const kids = kidsByFamily[f.id] || []
      return kids.some(isEnrolled) ? 'active' : kids.some(isPending) ? 'pending' : 'past'
    }
    return families
      .filter((f) => status === 'all' || famStatus(f) === status)
      .filter((f) => !missingContact || familyMissingContact(f, kidsByFamily[f.id]))
      .filter((f) => !needle || norm(`${f.name} ${f.email} ${f.phone} ${(kidsByFamily[f.id] || []).map((k) => `${k.full_name} ${k.nickname} ${k.student_code}`).join(' ')} ${contactsOf(f, kidsByFamily[f.id]).map((c) => c.name).join(' ')}`).includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [families, kidsByFamily, q, status, missingContact])

  const filtersOn = !!(q || level || program || noFamily || missingContact)
  const clearFilters = () => { setQ(''); setLevel(''); setProgram(''); setNoFamily(false); setMissingContact(false) }
  const onSort = (col) => setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))

  const run = async (fn) => {
    setBusy(true)
    try { await fn() } catch (e) { toast.error(e.message || String(e)) } finally { setBusy(false) }
  }

  // ---- students ----
  const saveStudent = async (s) => {
    try {
      let familyId = s.family_id || null
      if (familyId === '__new') {
        const fam = await db.families.save({ name: familyNameFor([s]), email: emailsOf(s).join(', '), phone: s.parent_phone || '', language: looksVietnamese([s]) ? 'vi' : 'en', notes: '', contacts: [] })
        familyId = fam.id
      }
      await db.students.save({ ...s, family_id: familyId, dob: s.dob || null })
      await refresh()
      setEditing(null)
      toast(t('studentSaved', { name: s.nickname || s.full_name }))
    } catch (e) { toast.error(e.message) }
  }
  const removeStudent = async (s) => {
    if (!confirm(t('confirmDeleteStudent', { name: s.full_name }))) return
    await run(async () => { await db.students.remove(s.id); await refresh(); setEditing(null); toast(t('deletedName', { name: s.full_name })) })
  }
  const assignFamily = (s, familyId) => run(async () => {
    let fid = familyId || null
    if (familyId === '__new') {
      const fam = await db.families.save({ name: familyNameFor([s]), email: emailsOf(s).join(', '), phone: s.parent_phone || '', language: looksVietnamese([s]) ? 'vi' : 'en', notes: '', contacts: [] })
      fid = fam.id
    }
    await db.students.save({ ...s, family_id: fid })
    await refresh()
  })
  const convertCodes = () => run(async () => {
    // Skips a student whose new ID another student already has (shown as a duplicate in the form).
    const taken = new Set(students.map((s) => s.student_code))
    const rows = toConvert.map((s) => ({ ...s, student_code: normalizeCode(s.student_code) })).filter((s) => !taken.has(s.student_code))
    await db.students.saveMany(rows)
    await refresh()
    toast(t('idsConverted', { n: rows.length }))
  })
  const assignMissingIds = () => run(async () => {
    const pool = [...students]
    const rows = [...withoutId].sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || a.full_name.localeCompare(b.full_name)).map((s) => {
      const row = { ...s, student_code: nextStudentCode(pool) }
      pool.push(row)
      return row
    })
    await db.students.saveMany(rows)
    await refresh()
    toast(t('idsAssigned', { n: rows.length }))
  })
  // Adds students from the office roster file that are not here yet (matched by
  // student ID, then by full name) and fills in blank details. The file is
  // private/roster.json on the office computer (scripts/build_roster.py writes it
  // from the student workbook). It is read in this browser only: children's
  // details never become part of the public site.
  const loadRoster = async (file) => {
    let roster
    try {
      roster = JSON.parse(await file.text())
      if (!Array.isArray(roster) || !roster.length || !roster.every((r) => r && typeof r.full_name === 'string' && r.full_name.trim())) throw new Error()
    } catch { toast.error(t('rosterFileBad')); return }
    const out = []
    let added = 0, updated = 0
    for (const r of roster) {
      const code = normalizeCode(r.student_code)
      const existing = students.find((s) => (code && normalizeCode(s.student_code) === code) || norm(s.full_name) === norm(r.full_name))
      // The roster is the office's list of students already in class, so these
      // come in active rather than pending.
      if (!existing) { out.push({ ...blankStudent(), ...r, student_code: code, is_new: false, q4_full: false, status: 'active' }); added++; continue }
      const patch = {}
      for (const [k, v] of Object.entries(r)) if (v && !existing[k]) patch[k] = k === 'student_code' ? code : v
      // An earlier roster had these two a column out: emails under address, the address under phone.
      if ((existing.address || '').includes('@')) patch.address = r.address
      const bare = (v) => norm(v).replace(/[^\p{L}\p{N}]+/gu, '')
      if (existing.parent_phone && bare(existing.parent_phone) === bare(r.address)) patch.parent_phone = r.parent_phone
      if (Object.keys(patch).length) { out.push({ ...existing, ...patch }); updated++ }
    }
    if (!out.length) { toast.info(t('rosterUpToDate')); return }
    if (!confirm(t('rosterConfirm', { added, updated }))) return
    run(async () => { await db.students.saveMany(out); await refresh(); toast(t('rosterDone', { added, updated })) })
  }
  const buildFamilies = () => {
    const { create, attach } = proposeFamilies(students, families)
    if (!create.length && !attach.length) { toast.info(t('buildFamiliesNone')); return }
    const lines = [...create.map((c) => `• ${c.name} (${c.language.toUpperCase()}): ${c.names.join(', ')}`), ...attach.map((a) => `• → ${a.familyName}: ${a.names.join(', ')}`)]
    if (!confirm(`${t('buildFamiliesConfirm')}\n\n${lines.join('\n')}`)) return
    run(async () => {
      const updates = []
      for (const c of create) {
        const fam = await db.families.save({ name: c.name, email: c.email, phone: c.phone, language: c.language, notes: '', contacts: [] })
        c.studentIds.forEach((id) => updates.push({ ...students.find((s) => s.id === id), family_id: fam.id }))
      }
      attach.forEach((a) => a.studentIds.forEach((id) => updates.push({ ...students.find((s) => s.id === id), family_id: a.familyId })))
      await db.students.saveMany(updates)
      await refresh()
      toast(t('familiesBuilt'))
    })
  }

  // The students listed right now (status tab, filters, search and sort) as an Excel file.
  const exportList = () => run(async () => {
    const label = [status === 'all' ? 'All students' : status === 'active' ? 'Enrolled' : status === 'pending' ? 'Pending' : 'Past', level, program && programName(program)].filter(Boolean).join(' · ')
    await exportStudentList({ list: rows, students, families, label, schoolYear: fees?.schoolYear })
    toast(t('exportStudentListDone', { n: rows.length }))
  })

  // ---- families ----
  const saveFamily = async (f) => {
    try { await db.families.save(f); await refresh(); setEditingFam(null); toast(t('familySaved', { name: f.name })) } catch (e) { toast.error(e.message) }
  }
  const removeFamily = async (f) => {
    if (!confirm(t('confirmDeleteFamily', { name: f.name }))) return
    await run(async () => {
      const kids = kidsByFamily[f.id] || []
      if (kids.length) await db.students.saveMany(kids.map((k) => ({ ...k, family_id: null })))
      await db.families.remove(f.id); await refresh(); setEditingFam(null); toast(t('deletedName', { name: f.name }))
    })
  }

  if (loading) return <Spinner />

  const familyOptions = [
    { value: '', label: `— ${t('noFamily')} —` },
    { value: '__new', label: t('newFamilyOption') },
    ...[...families].sort((a, b) => a.name.localeCompare(b.name)).map((f) => ({ value: f.id, label: f.name })),
  ]
  const levelCounts = students.filter(inStatus).reduce((m, s) => { m[s.level] = (m[s.level] || 0) + 1; return m }, {})
  const grouped = sort.col === 'level'

  return (
    <div className="space-y-5">
      <PageHeader title={tab === 'families' ? t('families') : t('students')}
        subtitle={`${t('studentsCount', { n: counts.active })} ${t('enrolled').toLowerCase()} · ${t('familiesCount', { n: families.length })}`}>
        {canEdit && (
          <Menu label={t('more')} icon={MoreHorizontal} items={[
            { label: t('loadRoster'), icon: ClipboardList, onClick: () => rosterInput.current?.click(), disabled: busy, hint: lang === 'vi' ? 'Chọn private/roster.json để thêm học sinh còn thiếu' : 'Pick private/roster.json to add anyone missing' },
            { label: t('buildFamilies'), icon: Users, onClick: buildFamilies, disabled: busy, hint: lang === 'vi' ? 'Theo email / điện thoại phụ huynh chung' : 'Match siblings by shared parent email or phone' },
            { label: t('addFamily'), icon: Users, onClick: () => setEditingFam(blankFamily()) },
            { label: t('exportStudentList'), icon: FileSpreadsheet, onClick: exportList, disabled: busy || !rows.length, hint: t('exportStudentListHint', { n: rows.length }) },
          ]} />
        )}
        {canEdit && <input ref={rosterInput} type="file" accept=".json,application/json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) loadRoster(f) }} />}
        {canEdit && <button className="btn-primary" onClick={() => setEditing(blankStudent(students))}><UserPlus size={16} /> {t('addStudent')}</button>}
      </PageHeader>

      {canEdit && toConvert.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <IdCard size={18} className="flex-none text-sky-600" />
          <span className="flex-1">{t('convertIdsText', { n: toConvert.length })}</span>
          <button className="btn-primary !py-1.5" disabled={busy} onClick={convertCodes}>{t('convertIds')}</button>
        </div>
      )}
      {canEdit && toConvert.length === 0 && withoutId.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={18} className="flex-none text-amber-600" />
          <span className="flex-1">{t('missingIdsText', { n: withoutId.length })} <span className="text-amber-700">{withoutId.slice(0, 4).map((s) => s.nickname || s.full_name).join(', ')}{withoutId.length > 4 ? '…' : ''}</span></span>
          <button className="btn-secondary !py-1.5" disabled={busy} onClick={assignMissingIds}>{t('assignIds')}</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'students', label: t('students') }, { value: 'families', label: t('families') }]} />
        <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
        <Segmented value={status} onChange={setStatus} options={[
          { value: 'active', label: `${t('enrolled')}${tab === 'students' ? ` · ${counts.active}` : ''}` },
          { value: 'pending', label: `${t('pending')}${tab === 'students' ? ` · ${counts.pending}` : ''}` },
          { value: 'past', label: `${t('past')}${tab === 'students' ? ` · ${counts.past}` : ''}` },
          { value: 'all', label: t('all') },
        ]} />
      </div>

      <Card className="!p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <SearchInput value={q} onChange={setQ} placeholder={tab === 'students' ? (lang === 'vi' ? 'Tên, mã, gia đình…' : 'Name, ID, family…') : t('search')} className="w-full sm:w-64" />
          {tab === 'students' ? (<>
            <select className="input w-auto" value={level} onChange={(e) => setLevel(e.target.value)} aria-label={t('yearGroup')}>
              <option value="">{t('allYearGroups')}</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}{levelCounts[l] ? ` (${levelCounts[l]})` : ''}</option>)}
            </select>
            <select className="input w-auto" value={program} onChange={(e) => setProgram(e.target.value)} aria-label={t('program')}>
              <option value="">{t('allPrograms')}</option>
              {PROGRAMS.map((p) => <option key={p.id} value={p.id}>{lang === 'vi' ? p.vi : p.en}</option>)}
            </select>
            {canEdit && <Checkbox checked={noFamily} onChange={setNoFamily} label={t('withoutFamily')} className="px-1" />}
          </>) : (
            <Checkbox checked={missingContact} onChange={setMissingContact} label={t('missingContact')} className="px-1" />
          )}
          {filtersOn && <button className="btn-ghost text-xs" onClick={clearFilters}>{t('clearFilters')}</button>}
          <span className="ml-auto text-xs text-slate-400">{tab === 'students' ? t('studentsCount', { n: rows.length }) : t('familiesCount', { n: famRows.length })}</span>
        </div>

        {tab === 'students' ? (
          rows.length === 0 ? <div className="p-4"><Empty text={students.length ? t('noMatches') : t('noData')} /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60">
                  <tr>
                    <SortTh col="code" sort={sort} onSort={onSort} className="pl-4">ID</SortTh>
                    <SortTh col="name" sort={sort} onSort={onSort}>{t('student')}</SortTh>
                    <SortTh col="level" sort={sort} onSort={onSort}>{t('yearGroup')}</SortTh>
                    <SortTh col="age" sort={sort} onSort={onSort} className="hidden md:table-cell">{t('age')}</SortTh>
                    <SortTh col="program" sort={sort} onSort={onSort} className="hidden md:table-cell">{t('program')}</SortTh>
                    <SortTh col="family" sort={sort} onSort={onSort} className="hidden lg:table-cell">{t('family')}</SortTh>
                    <th className="th hidden sm:table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, i) => {
                    const age = ageOf(s.dob)
                    const header = grouped && (i === 0 || rows[i - 1].level !== s.level)
                    const code = s.student_code
                    return [
                      header && (
                        <tr key={`h-${s.level}`} className="bg-slate-50/80">
                          <td colSpan={7} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-pra-navy">{s.level || '—'} <span className="font-semibold text-slate-400">· {rows.filter((r) => r.level === s.level).length}</span></td>
                        </tr>
                      ),
                      <tr key={s.id} onClick={() => setEditing({ ...blankStudent(), ...s })}
                        className={`cursor-pointer border-t border-slate-100 transition-colors hover:bg-sky-50/50 ${isPast(s) ? 'text-slate-400' : ''}`}>
                        <td className="td pl-4">
                          {code ? <span className={`code ${needsCodeUpdate(s) ? '!bg-sky-50 !text-sky-700' : ''}`} title={needsCodeUpdate(s) ? `→ ${normalizeCode(code)}` : undefined}>{code}</span>
                            : <span className="text-xs text-amber-600">{t('noId')}</span>}
                        </td>
                        <td className="td">
                          <div className="flex items-center gap-2.5">
                            <Avatar src={photoSrc(s.photo)} name={s.full_name} size={32} className={isPast(s) ? 'opacity-60' : ''} />
                            <div className="min-w-0">
                              <div className={`truncate font-semibold ${isPast(s) ? '' : 'text-slate-800'}`}>{s.full_name}</div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                {s.nickname && <span>“{s.nickname}”</span>}
                                {s.allergies && <span className="rounded bg-red-50 px-1 text-[10px] font-semibold text-red-700" title={s.allergies}>{lang === 'vi' ? 'dị ứng' : 'allergy'}</span>}
                                <span className="md:hidden">{age != null ? `${age}y` : ''}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="td whitespace-nowrap">{s.level}{s.class_group && s.class_group !== s.level && <div className="text-xs text-slate-400">{s.class_group}</div>}</td>
                        <td className="td hidden text-slate-500 md:table-cell">{age ?? '—'}</td>
                        <td className="td hidden whitespace-nowrap text-slate-600 md:table-cell">{programName(s.program)}</td>
                        <td className="td hidden min-w-[190px] lg:table-cell" onClick={(e) => canEdit && e.stopPropagation()}>
                          {canEdit ? (
                            <select className={`input !py-1 text-xs ${s.family_id ? '' : '!border-amber-300 text-amber-700'}`} value={s.family_id || ''} disabled={busy} onChange={(e) => assignFamily(s, e.target.value)} aria-label={t('family')}>
                              {familyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          ) : <span className="text-slate-600">{famById[s.family_id]?.name || '—'}</span>}
                        </td>
                        <td className="td hidden whitespace-nowrap pr-4 text-right text-xs sm:table-cell">
                          {isPending(s) && <span className="chip mr-1 bg-amber-100 text-amber-700">{t('pending').toLowerCase()}</span>}
                          {s.is_new && <span className="chip mr-1 bg-green-100 text-green-800">{lang === 'vi' ? 'mới' : 'new'}</span>}
                          {s.legacy && <span className="chip mr-1 bg-purple-100 text-purple-800">legacy</span>}
                          {s.q4_full && <span className="chip bg-slate-100 text-slate-600" title={t('q4Full')}>Q4</span>}
                        </td>
                      </tr>,
                    ]
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          famRows.length === 0 ? <div className="p-4"><Empty text={families.length ? t('noMatches') : t('noData')} /></div> : (
            <ul className="divide-y divide-slate-100">
              {famRows.map((f) => {
                const kids = [...(kidsByFamily[f.id] || [])].sort((a, b) => levelIndex(a.level) - levelIndex(b.level))
                const contacts = contactsOf(f, kids)
                const missing = familyMissingContact(f, kids)
                return (
                  <li key={f.id} className="grid gap-3 px-4 py-3 hover:bg-slate-50/60 md:grid-cols-[1.1fr_1.4fr_1.6fr_auto]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-semibold text-slate-800">{f.name}<span className="code uppercase">{f.language || 'en'}</span></div>
                      {missing && <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-600"><AlertTriangle size={12} /> {t('missingContact')}</div>}
                      {f.notes && <div className="mt-0.5 truncate text-xs text-slate-400" title={f.notes}>{f.notes}</div>}
                    </div>
                    <div className="flex flex-wrap content-start gap-1.5">
                      {kids.length ? kids.map((k) => (
                        <button key={k.id} type="button" onClick={() => setEditing({ ...blankStudent(), ...k })}
                          className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white py-0.5 pl-0.5 pr-2 text-xs hover:border-pra-blue ${isPast(k) ? 'opacity-50' : ''}`}>
                          <Avatar src={photoSrc(k.photo)} name={k.full_name} size={20} />
                          <span className="font-semibold text-slate-700">{k.nickname || k.full_name.split(' ')[0]}</span>
                          <span className="text-slate-400">{k.level?.replace('Year ', 'Y')}</span>
                        </button>
                      )) : <span className="text-xs text-slate-400">—</span>}
                    </div>
                    <div className="space-y-0.5 text-xs text-slate-600">
                      {contacts.slice(0, 3).map((c, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-x-3">
                          {(c.name || c.relation) && <span className="font-semibold text-slate-700">{c.name}{c.relation ? <span className="font-normal text-slate-400"> · {c.relation}</span> : ''}</span>}
                          {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-pra-blue"><Mail size={11} />{c.email}</a>}
                          {c.phone && <span className="inline-flex items-center gap-1"><Phone size={11} />{c.phone}</span>}
                        </div>
                      ))}
                      {contacts.length > 3 && <div className="text-slate-400">+{contacts.length - 3}</div>}
                    </div>
                    {canEdit && (
                      <div className="flex items-start gap-1 md:justify-end">
                        <button className="btn-ghost px-2 text-xs text-pra-blue" onClick={() => setEditing({ ...blankStudent(students), family_id: f.id, parents_email: f.email || '', parent_phone: f.phone || '' })}><UserPlus size={15} /> <span className="hidden xl:inline">{t('addChild')}</span></button>
                        <button className="btn-ghost px-2" onClick={() => setEditingFam({ ...blankFamily(), ...f })} aria-label={t('edit')}><Pencil size={15} /></button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )
        )}
      </Card>

      {!canEdit && <p className="flex items-center gap-1.5 text-xs text-slate-400"><BadgeCheck size={14} /> {t('viewOnly')}</p>}

      {editing && (
        <StudentModal key={editing.id || 'new'} value={editing} onClose={() => setEditing(null)} onSave={saveStudent} onDelete={removeStudent}
          students={students} families={families} canEdit={canEdit} t={t} lang={lang} />
      )}
      {editingFam && (
        <FamilyModal key={editingFam.id || 'new-family'} value={editingFam} onClose={() => setEditingFam(null)} onSave={saveFamily} onDelete={removeFamily}
          kids={kidsByFamily[editingFam.id] || []} t={t} />
      )}
    </div>
  )
}
