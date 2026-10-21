import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarRange, Check, CheckCheck, ChevronRight, Clock, MessageSquare, Pencil, Plane, Plus, Printer, Trash2, UserPlus, Users } from 'lucide-react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { photoSrc } from '../lib/report/photo'
import { tripOn, statusOn, TRAVEL } from '../lib/travel'
import { LEVELS } from '../lib/fees'
import { hasLogin } from '../data/staff'
import {
  WEEKDAYS, weekdayName, blankTerm, blankActivity, sortTerms, currentTerm, useOffDays, sessionDates, defaultSession, nextSession,
  yearGroupsText, levelsBetween, timeText, activityName, teacherName, sameEmail, activitiesOf, membersOf, memberFlags, otherActivities,
  candidates, todayLocal,
} from '../lib/eca'
import { Avatar, Card, Empty, Field, Modal, PageHeader, SearchInput, Segmented, Spinner, TextArea, TextInput } from '../components/ui'

// ECAs, the after-class activities. One page: the term's activities as cards; open one for
// its register (one mark per student per session), its list of students and a summary.
// The office and the head set up terms and activities; they and the teacher who runs an
// activity change its list and take its register. Kept apart from daily attendance.

const STATUSES = [
  { key: 'present', on: 'bg-green-600 text-white border-green-600', soft: 'bg-green-100 text-green-800', stripe: 'shadow-[inset_4px_0_0_#16a34a]' },
  { key: 'late', on: 'bg-amber-500 text-white border-amber-500', soft: 'bg-amber-100 text-amber-800', stripe: 'shadow-[inset_4px_0_0_#f59e0b]' },
  { key: 'absent', on: 'bg-red-600 text-white border-red-600', soft: 'bg-red-100 text-red-700', stripe: 'shadow-[inset_4px_0_0_#dc2626]' },
]
const STATUS = Object.fromEntries(STATUSES.map((s) => [s.key, s]))
// Each weekday has its own colour on the cards, so Monday's and Wednesday's ECAs are told apart at a glance.
const DAY_TONE = { 1: 'border-l-sky-500', 2: 'border-l-violet-500', 3: 'border-l-green-500', 4: 'border-l-amber-500', 5: 'border-l-rose-500' }
const nameOf = (s) => s.nickname || s.full_name || ''
const dayLabel = (iso, lang, long = false) => {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' })
}
const rangeText = (term, lang) => (term ? `${dayLabel(term.from_date, lang)} – ${dayLabel(term.to_date, lang)}` : '')

export default function Ecas() {
  const { t } = useT()
  const { loading, eca } = useData()
  const [params] = useSearchParams()
  const id = params.get('activity')
  const activity = id ? eca.activities.find((a) => a.id === id) : null
  if (loading) return <Spinner />
  if (id && !activity) return <div className="space-y-4"><BackLink /><Empty text={t('noData')} /></div>
  return activity ? <ActivityView key={activity.id} activity={activity} /> : <Overview />
}

function BackLink({ term }) {
  const { t } = useT()
  return <Link to={term ? `/eca?term=${term}` : '/eca'} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> {t('ecaAllEcas')}</Link>
}

// ---------------------------------------------------------------------------
// The term's activities

function Overview() {
  const { t, lang } = useT()
  const { eca, students, teachers, fees } = useData()
  const { isOffice, isHead, me } = useAuth()
  const manage = isOffice || isHead
  const [params, setParams] = useSearchParams()
  const terms = sortTerms(eca.terms)
  const term = terms.find((x) => x.id === params.get('term')) || currentTerm(eca.terms)
  const offDays = useOffDays()
  const [termModal, setTermModal] = useState(null) // a term row being edited, or a blank one
  const [activityModal, setActivityModal] = useState(null)
  const today = todayLocal()
  const list = term ? activitiesOf(eca, term.id) : []
  // A teacher's own activities first.
  const shown = [...list].sort((a, b) => sameEmail(b.teacher_email, me?.email) - sameEmail(a.teacher_email, me?.email))

  // What the office should look at: Nursery, the wrong year group, half day, two activities, left.
  const checks = manage ? list.flatMap((a) => membersOf(eca, a.id, students)
    .map(({ m, s }) => ({ a, s, flags: memberFlags(s, a, { eca, day: today }).filter((f) => f !== 'ecaFlagHalfDay' || m.status !== 'waiting') }))
    .filter((x) => x.flags.length)) : []

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader title={t('ecaTitle')} subtitle={term ? [term.name, rangeText(term, lang), timeText(term, lang)].filter(Boolean).join(' · ') : ''}>
        {terms.length > 1 && (
          <select className="input w-auto" value={term?.id || ''} onChange={(e) => setParams({ term: e.target.value }, { replace: true })} aria-label={t('ecaTerm')}>
            {terms.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.school_year}</option>)}
          </select>
        )}
        {term && list.length > 0 && <Link className="btn-secondary" to={`/print/eca?term=${term.id}`}><Printer size={16} /> {t('ecaPrintAll')}</Link>}
        {manage && term && <button className="btn-secondary" onClick={() => setTermModal(term)}><Pencil size={15} /> {t('ecaEditTerm')}</button>}
        {manage && <button className="btn-primary" onClick={() => setTermModal(blankTerm(fees?.schoolYear || term?.school_year, term))}><Plus size={16} /> {t('ecaNewTerm')}</button>}
      </PageHeader>

      {!eca.ready && manage && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('ecaSetup')}</p>}
      {term?.note && <p className="text-sm text-slate-600"><Clock size={14} className="mr-1 inline text-slate-400" />{term.note}</p>}

      {!term ? <Empty text={`${t('ecaNoTerms')} ${manage ? t('ecaNoTermsOffice') : ''}`} /> : (<>
        {!list.length && <Empty text={t('ecaNoActivities')} />}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((a) => {
            const people = membersOf(eca, a.id, students)
            const joined = people.filter((x) => x.m.status === 'joined').length
            const waiting = people.length - joined
            const sessions = sessionDates(a, term, offDays)
            const next = nextSession(sessions, today)
            const mine = sameEmail(a.teacher_email, me?.email)
            return (
              <Link key={a.id} to={`/eca?activity=${a.id}`} className={`card group flex flex-col border-l-4 p-4 transition-colors hover:border-pra-blue ${DAY_TONE[a.weekday] || 'border-l-slate-300'}`}>
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {weekdayName(a.weekday, lang)} · {timeText(term, lang)}
                  {mine && <span className="ml-auto rounded-full bg-pra-blue px-2 py-0.5 text-[10px] tracking-normal text-white">{t('ecaYours')}</span>}
                </div>
                <div className="mt-1 text-lg font-black leading-tight text-slate-800">{activityName(a, lang)}</div>
                {lang !== 'vi' && a.name_vi && <div className="text-xs text-slate-400">{a.name_vi}</div>}
                <div className="mt-2 space-y-0.5 text-sm text-slate-600">
                  <div>{teacherName(a.teacher_email, teachers) || '—'} · {yearGroupsText(a.year_groups, lang)}</div>
                  <div className="flex items-center gap-1.5"><Users size={14} className="text-slate-400" /> {t('ecaCount', { n: joined })}{waiting > 0 && <span className="text-amber-700"> · {t('ecaWaitingN', { n: waiting })}</span>}</div>
                  <div className="flex items-center gap-1.5 text-slate-500"><CalendarRange size={14} className="text-slate-400" /> {offDays ? `${t('ecaSessions', { n: sessions.length })} · ${next ? t('ecaNext', { date: dayLabel(next, lang) }) : t('ecaFinished')}` : '…'}</div>
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-pra-blue group-hover:underline">{t('ecaOpen')} <ChevronRight size={15} /></span>
              </Link>
            )
          })}
          {manage && (
            <button type="button" onClick={() => setActivityModal(blankActivity(term.id))} className="flex min-h-[9rem] items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-pra-blue hover:text-pra-blue">
              <Plus size={16} /> {t('ecaAddActivity')}
            </button>
          )}
        </div>

        {checks.length > 0 && (
          <Card title={t('ecaChecksTitle')} subtitle={t('ecaChecksSub')}>
            <ul className="divide-y divide-slate-100 text-sm">
              {checks.map(({ a, s, flags }) => (
                <li key={`${a.id}-${s.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2">
                  <span className="font-semibold text-slate-800">{nameOf(s)}</span><span className="text-xs text-slate-400">{s.level}</span>
                  <span className="text-slate-500">· {activityName(a, lang)}</span>
                  <Flags flags={flags} s={s} a={a} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </>)}

      {termModal && <TermModal term={termModal} terms={terms} onClose={() => setTermModal(null)} onSaved={(id) => setParams({ term: id }, { replace: true })} />}
      {activityModal && <ActivityModal activity={activityModal} onClose={() => setActivityModal(null)} />}
    </div>
  )
}

/** The flags on a student, as small chips. */
function Flags({ flags, s, a }) {
  const { t, lang } = useT()
  const { eca } = useData()
  return flags.map((f) => (
    <span key={f} className={`chip !text-[11px] ${f === 'ecaFlagNursery' || f === 'ecaFlagLeft' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
      {f === 'ecaFlagTwo' ? t('ecaFlagTwo', { names: otherActivities(s, a, eca).map((x) => activityName(x, lang)).join(', ') }) : t(f)}
    </span>
  ))
}

// ---------------------------------------------------------------------------
// Setting up terms and activities (office and head)

function TermModal({ term, terms, onClose, onSaved }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { eca, refreshEca } = useData()
  const isNew = !term.id
  const [f, setF] = useState(term)
  const [copyFrom, setCopyFrom] = useState(() => (isNew ? terms[0]?.id || '' : ''))
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const count = isNew ? 0 : activitiesOf(eca, term.id).length
  const ok = f.name.trim() && f.from_date && f.to_date && f.to_date >= f.from_date && f.start_time && f.end_time

  const save = async () => {
    setBusy(true)
    try {
      const row = await db.eca.terms.save({ ...f, name: f.name.trim(), note: (f.note || '').trim() || null })
      // A new term can start with the last one's activities (not their students).
      if (isNew && copyFrom) {
        for (const a of activitiesOf(eca, copyFrom)) {
          const copy = { ...a, term_id: row.id }
          delete copy.id; delete copy.created_at; delete copy.updated_at
          await db.eca.activities.save(copy)
        }
      }
      await refreshEca()
      toast(t('ecaSaved'))
      onSaved?.(row.id)
      onClose()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!confirm(t('ecaDeleteTermConfirm', { name: term.name, n: count }))) return
    setBusy(true)
    try { await db.eca.terms.remove(term.id); await refreshEca(); onClose() } catch (e) { toast.error(e.message); setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? t('ecaNewTerm') : t('ecaEditTerm')}
      footer={<>
        {!isNew && <button className="btn-ghost mr-auto text-red-600" disabled={busy} onClick={remove}><Trash2 size={15} /> {t('ecaDeleteTerm')}</button>}
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" disabled={!ok || busy} onClick={save}>{t('save')}</button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('ecaTermName')} hint={t('ecaTermNameHint')}><TextInput value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label={t('ecaSchoolYear')}><TextInput value={f.school_year || ''} onChange={set('school_year')} /></Field>
        <Field label={t('ecaFrom')}><input type="date" className="input" value={f.from_date || ''} onChange={(e) => set('from_date')(e.target.value)} /></Field>
        <Field label={t('ecaTo')}><input type="date" className="input" value={f.to_date || ''} onChange={(e) => set('to_date')(e.target.value)} /></Field>
        <Field label={t('ecaStart')}><input type="time" className="input" value={f.start_time || ''} onChange={(e) => set('start_time')(e.target.value)} /></Field>
        <Field label={t('ecaEnd')}><input type="time" className="input" value={f.end_time || ''} onChange={(e) => set('end_time')(e.target.value)} /></Field>
        <Field className="sm:col-span-2" label={t('ecaNote')} hint={t('ecaNoteHint')}><TextInput value={f.note || ''} onChange={set('note')} /></Field>
        {isNew && terms.length > 0 && (
          <Field className="sm:col-span-2" label={t('ecaCopyFrom')} hint={t('ecaCopyHint')}>
            <select className="input" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              <option value="">{t('ecaCopyNone')}</option>
              {terms.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.school_year} ({activitiesOf(eca, x.id).map((a) => activityName(a, lang)).join(', ') || '—'})</option>)}
            </select>
          </Field>
        )}
      </div>
    </Modal>
  )
}

function ActivityModal({ activity, onClose, onRemoved }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { eca, teachers, refreshEca } = useData()
  const isNew = !activity.id
  const [f, setF] = useState(activity)
  const groups = f.year_groups || []
  const [fromLevel, setFromLevel] = useState(() => LEVELS.find((l) => groups.includes(l)) || '')
  const [toLevel, setToLevel] = useState(() => { const last = [...LEVELS].reverse().find((l) => groups.includes(l)); return last && last !== LEVELS.at(-1) ? last : '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }))
  const staff = teachers.filter((x) => hasLogin(x) && x.active !== false).sort((a, b) => String(a.name).localeCompare(String(b.name)))
  const yearGroups = fromLevel ? levelsBetween(fromLevel, toLevel) : []
  const people = isNew ? 0 : (eca.members || []).filter((m) => m.activity_id === activity.id).length
  const ok = f.name.trim() && f.weekday

  const save = async () => {
    setBusy(true)
    try {
      await db.eca.activities.save({ ...f, name: f.name.trim(), name_vi: (f.name_vi || '').trim() || null, teacher_email: f.teacher_email || null, year_groups: yearGroups, weekday: Number(f.weekday) })
      await refreshEca()
      toast(t('ecaSaved'))
      onClose()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!confirm(t('ecaDeleteActivityConfirm', { name: activityName(activity, lang), n: people }))) return
    setBusy(true)
    try { await db.eca.activities.remove(activity.id); await refreshEca(); onClose(); onRemoved?.() } catch (e) { toast.error(e.message); setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={isNew ? t('ecaAddActivity') : t('ecaEditActivity')}
      footer={<>
        {!isNew && <button className="btn-ghost mr-auto text-red-600" disabled={busy} onClick={remove}><Trash2 size={15} /> {t('ecaDeleteActivity')}</button>}
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" disabled={!ok || busy} onClick={save}>{t('save')}</button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('ecaActivityName')}><TextInput value={f.name} onChange={set('name')} autoFocus /></Field>
        <Field label={t('ecaActivityNameVi')}><TextInput value={f.name_vi || ''} onChange={set('name_vi')} /></Field>
        <Field label={t('ecaDay')}>
          <select className="input" value={f.weekday} onChange={(e) => set('weekday')(Number(e.target.value))}>
            {WEEKDAYS.map((w) => <option key={w.n} value={w.n}>{lang === 'vi' ? w.vi : w.en}</option>)}
          </select>
        </Field>
        <Field label={t('ecaTeacher')}>
          <select className="input" value={f.teacher_email || ''} onChange={(e) => set('teacher_email')(e.target.value)}>
            <option value="">{t('ecaNoTeacher')}</option>
            {staff.map((x) => <option key={x.id} value={x.email}>{x.title ? `${x.title} ` : ''}{x.name}</option>)}
          </select>
        </Field>
        <Field label={t('ecaYearsFrom')}>
          <select className="input" value={fromLevel} onChange={(e) => setFromLevel(e.target.value)}>
            <option value="">{t('ecaAnyYear')}</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
        <Field label={t('ecaYearsTo')}>
          <select className="input" value={toLevel} disabled={!fromLevel} onChange={(e) => setToLevel(e.target.value)}>
            <option value="">{t('ecaAndUp')}</option>
            {LEVELS.filter((l) => !fromLevel || LEVELS.indexOf(l) >= LEVELS.indexOf(fromLevel)).map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </Field>
        <p className="text-xs text-slate-500 sm:col-span-2">{t('ecaOpenTo', { groups: yearGroupsText(yearGroups, lang) })}</p>
        <Field label={t('ecaRoom')}><TextInput value={f.room || ''} onChange={set('room')} /></Field>
        <Field className="sm:col-span-2" label={t('ecaDescription')}><TextArea rows={3} value={f.description || ''} onChange={set('description')} /></Field>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// One activity: register, students, summary

function ActivityView({ activity }) {
  const { t, lang } = useT()
  const { eca, students, teachers } = useData()
  const { isOffice, isHead, me } = useAuth()
  const manage = isOffice || isHead
  const canRun = manage || sameEmail(activity.teacher_email, me?.email)
  const term = eca.terms.find((x) => x.id === activity.term_id)
  const offDays = useOffDays()
  const sessions = useMemo(() => (offDays ? sessionDates(activity, term, offDays) : null), [activity, term, offDays])
  const list = membersOf(eca, activity.id, students)
  const [tab, setTab] = useState(() => (list.length ? 'register' : 'students'))
  const [edit, setEdit] = useState(false)
  const teacher = teacherName(activity.teacher_email, teachers)

  const tabs = [{ value: 'register', label: t('ecaRegister') }, { value: 'students', label: `${t('ecaStudents')} · ${list.filter((x) => x.m.status === 'joined').length}` }, { value: 'summary', label: t('ecaSummary') }]
  return (
    <div className="space-y-4 sm:space-y-5">
      <BackLink term={activity.term_id} />
      <PageHeader title={activityName(activity, lang)}
        subtitle={[weekdayName(activity.weekday, lang), timeText(term, lang), teacher, yearGroupsText(activity.year_groups, lang), activity.room].filter(Boolean).join(' · ')}>
        <Link className="btn-secondary" to={`/print/eca?activity=${activity.id}`}><Printer size={16} /> {t('ecaPrint')}</Link>
        {manage && <button className="btn-secondary" onClick={() => setEdit(true)}><Pencil size={15} /> {t('ecaEditActivity')}</button>}
      </PageHeader>
      {activity.description && <p className="max-w-3xl text-sm text-slate-600">{activity.description}</p>}
      <Segmented className="flex w-full sm:inline-flex sm:w-auto [&>button]:flex-1 [&>button]:whitespace-nowrap [&>button]:py-2 sm:[&>button]:py-1" value={tab} onChange={setTab} options={tabs} />
      {!sessions ? <Spinner /> : tab === 'register'
        ? <Register activity={activity} list={list} sessions={sessions} canRun={canRun} teacher={teacher} />
        : tab === 'students' ? <StudentList activity={activity} list={list} canRun={canRun} />
        : <Summary activity={activity} list={list} sessions={sessions} />}
      {edit && <ActivityModal activity={activity} onClose={() => setEdit(false)} />}
    </div>
  )
}

function Register({ activity, list, sessions, canRun, teacher }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { displayName } = useAuth()
  const { travel: trips } = useData()
  const today = todayLocal()
  const [day, setDay] = useState(() => defaultSession(sessions, today))
  const key = `${activity.id}|${day}`
  // This session's marks (student_id -> row) and the day's PRA register (student_id -> status).
  const [loaded, setLoaded] = useState({ key: null, marks: {}, pra: {} })
  const marks = loaded.key === key ? loaded.marks : null
  const [noteOpen, setNoteOpen] = useState({})
  const [noteDraft, setNoteDraft] = useState({})
  const kids = list.filter((x) => x.m.status === 'joined').map((x) => x.s)

  useEffect(() => {
    if (!day) return
    let alive = true
    Promise.all([db.eca.attendance.list({ activity_id: activity.id, date: day }), db.attendance.list({ date: day }).catch(() => [])])
      .then(([rows, daily]) => alive && setLoaded({
        key: `${activity.id}|${day}`,
        marks: Object.fromEntries(rows.map((r) => [r.student_id, r])),
        pra: Object.fromEntries(daily.map((r) => [r.student_id, r.status])),
      }))
      .catch((e) => { toast.error(e.message); if (alive) setLoaded({ key: `${activity.id}|${day}`, marks: {}, pra: {} }) })
    return () => { alive = false }
  }, [activity.id, day]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!sessions.length) return <Empty text={t('ecaNoSessions')} />
  // Absent from PRA that day (marked absent, or away on a trip): shown, and left out of "everyone present".
  const awayFromPra = (s) => {
    const st = statusOn(loaded.pra?.[s.id] ? { status: loaded.pra[s.id] } : null, tripOn(trips, s.id, day))
    return st === 'absent' || st === TRAVEL ? st : null
  }
  const applyMarks = (fn) => setLoaded((cur) => (cur.key === key ? { ...cur, marks: fn(cur.marks) } : cur))

  const save = async (rows) => {
    const before = Object.fromEntries(rows.map((r) => [r.student_id, marks[r.student_id]]))
    const full = rows.map((r) => ({ activity_id: activity.id, date: day, taken_by: displayName, ...r }))
    applyMarks((m) => { const n = { ...m }; full.forEach((r) => { n[r.student_id] = { ...(m[r.student_id] || {}), ...r } }); return n })
    try {
      const saved = await db.eca.attendance.mark(full)
      applyMarks((m) => { const n = { ...m }; saved.forEach((r) => { n[r.student_id] = r }); return n })
      return true
    } catch (e) {
      applyMarks((m) => { const n = { ...m }; rows.forEach((r) => { if (before[r.student_id]) n[r.student_id] = before[r.student_id]; else delete n[r.student_id] }); return n })
      toast.error(e.message)
      return false
    }
  }
  // Tapping the chosen status again takes the mark off.
  const clear = async (s) => {
    const row = marks[s.id]
    applyMarks((m) => { const n = { ...m }; delete n[s.id]; return n })
    try { if (row?.id) await db.eca.attendance.clear(row.id) } catch (e) { applyMarks((m) => ({ ...m, [s.id]: row })); toast.error(e.message) }
  }
  const setStatus = (s, status) => {
    if (marks[s.id]?.status === status) return clear(s)
    const note = !marks[s.id] ? (noteDraft[s.id] || '').trim() : ''
    return save([{ student_id: s.id, status, ...(note ? { note } : {}) }])
  }
  const saveNote = (s) => {
    if (!marks[s.id]) return
    const note = (noteDraft[s.id] ?? marks[s.id].note ?? '').trim()
    if (note === (marks[s.id].note || '')) return
    save([{ student_id: s.id, status: marks[s.id].status, note: note || null }])
  }
  const markRest = async () => {
    const open = kids.filter((s) => !marks[s.id])
    const away = open.filter(awayFromPra)
    const rest = open.filter((s) => !awayFromPra(s))
    if (rest.length && await save(rest.map((s) => ({ student_id: s.id, status: 'present' })))) toast(t('ecaSaved'))
    if (away.length) toast.info(t('ecaLeftUnmarked', { names: away.map(nameOf).join(', ') }))
  }

  const counts = STATUSES.reduce((m, st) => ({ ...m, [st.key]: marks ? kids.filter((s) => marks[s.id]?.status === st.key).length : 0 }), {})
  const unmarked = marks ? kids.filter((s) => !marks[s.id]).length : 0
  const index = sessions.indexOf(day)

  return (
    <div className="space-y-3 pb-24 sm:space-y-4 sm:pb-0">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:gap-1.5 sm:px-0">
        {sessions.map((d) => {
          const on = d === day
          return (
            <button key={d} type="button" aria-pressed={on} onClick={() => setDay(d)}
              className={`flex h-10 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-semibold sm:h-auto sm:px-3 sm:py-1 ${on ? 'border-pra-blue bg-pra-blue text-white' : d === today ? 'border-pra-blue text-pra-blue' : d > today ? 'border-slate-200 bg-white text-slate-400' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}>
              {dayLabel(d, lang)}
            </button>
          )
        })}
      </div>
      <p className="text-sm font-semibold text-slate-600">{dayLabel(day, lang, true)} · {t('ecaSessionN', { n: index + 1, total: sessions.length })}{day > today && <span className="font-normal text-slate-400"> · {t('ecaFuture')}</span>}</p>
      {!canRun && <p className="text-sm text-slate-500">{t('ecaNotYours', { teacher: teacher || '—' })}</p>}

      <Card className="!p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-3 py-3 sm:gap-2 sm:px-4">
          {STATUSES.map((st) => <span key={st.key} className={`chip ${st.soft} ${counts[st.key] ? '' : 'opacity-60'}`}>{t(st.key)} · {counts[st.key]}</span>)}
          {unmarked > 0 && <span className="chip bg-slate-100 text-slate-600">{t('notMarked')} · {unmarked}</span>}
          {canRun && <button className="btn-green ml-auto hidden !py-1.5 text-xs sm:inline-flex" disabled={!marks || !unmarked} onClick={markRest}><CheckCheck size={15} /> {t('markAllPresent')}</button>}
        </div>
        {!marks ? <Spinner /> : !kids.length ? <div className="p-4"><Empty text={t('ecaEmptyList')} /></div> : (
          <ul className="divide-y divide-slate-100">
            {kids.map((s) => {
              const m = marks[s.id]
              const away = awayFromPra(s)
              const showNote = noteOpen[s.id] || !!m?.note
              return (
                <li key={s.id} className={`px-3 py-3 sm:px-4 sm:py-2.5 ${m ? STATUS[m.status]?.stripe || '' : 'bg-amber-50/40'}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
                    <Avatar src={photoSrc(s.photo)} name={s.full_name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-slate-800">{nameOf(s)} <span className="text-xs font-normal text-slate-400">{s.level}</span></div>
                      <div className="truncate text-xs text-slate-500">{s.nickname ? s.full_name : ''}</div>
                      {away && <div className={`flex items-center gap-1 text-xs font-semibold ${away === TRAVEL ? 'text-violet-700' : 'text-red-700'}`}>{away === TRAVEL && <Plane size={12} />}{away === TRAVEL ? t('traveling') : t('ecaAbsentDay')}</div>}
                    </div>
                    <button type="button" aria-pressed={showNote} className={`relative grid h-11 w-11 flex-none place-items-center rounded-lg sm:order-last sm:h-9 sm:w-9 ${showNote ? 'text-pra-blue' : 'text-slate-400 hover:text-slate-600'}`} title={t('addNote')} aria-label={t('addNote')}
                      onClick={() => setNoteOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}>
                      <MessageSquare size={18} />
                      {m?.note && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-pra-blue sm:right-1 sm:top-1" />}
                    </button>
                    <div className="grid basis-full grid-cols-3 gap-1.5 sm:flex sm:basis-auto sm:gap-1" role="group" aria-label={s.full_name}>
                      {STATUSES.map((st) => {
                        const on = m?.status === st.key
                        return (
                          <button key={st.key} type="button" aria-pressed={on} disabled={!canRun} onClick={() => setStatus(s, st.key)}
                            className={`h-11 touch-manipulation select-none rounded-lg border px-0.5 text-xs font-bold transition active:scale-95 disabled:cursor-default disabled:active:scale-100 min-[350px]:text-[13px] sm:h-9 sm:min-w-[4.5rem] sm:px-2 sm:text-sm ${on ? st.on : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'}`}>
                            {t(st.key)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {showNote && (
                    <div className="mt-2.5 sm:ml-[52px] sm:mt-2">
                      <input className="input text-base sm:text-xs" placeholder={t('addNote')} disabled={!canRun} value={noteDraft[s.id] ?? m?.note ?? ''} enterKeyHint="done"
                        onChange={(e) => setNoteDraft((d) => ({ ...d, [s.id]: e.target.value }))} onBlur={() => saveNote(s)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      {marks && kids.some((s) => marks[s.id]?.taken_by) && (
        <p className="text-xs text-slate-400">{t('takenBy', { name: [...new Set(kids.map((s) => marks[s.id]?.taken_by).filter(Boolean))].join(', ') })}</p>
      )}

      {/* Phones: the bulk action stays under the thumb. */}
      {canRun && marks && kids.length > 0 && (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
          {unmarked > 0
            ? <button type="button" className="btn-green h-12 w-full justify-center text-sm" onClick={markRest}><CheckCheck size={18} /> {t('markAllPresent')}</button>
            : <div className="flex h-12 items-center justify-center gap-2 rounded-lg bg-green-50 text-sm font-bold text-green-800"><Check size={18} /> {t('allMarked', { total: kids.length })}</div>}
        </div>
      )}
    </div>
  )
}

function StudentList({ activity, list, canRun }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { eca, refreshEca } = useData()
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState({})
  const today = todayLocal()

  const run = async (fn) => { setBusy(true); try { await fn(); await refreshEca() } catch (e) { toast.error(e.message) } finally { setBusy(false) } }
  const setStatus = (m, status) => run(() => db.eca.members.patch(m.id, { status }))
  const remove = (m, s) => confirm(t('ecaRemoveConfirm', { name: nameOf(s), activity: activityName(activity, lang) })) && run(() => db.eca.members.remove(m.id))
  const saveNote = (m) => {
    const note = (notes[m.id] ?? m.note ?? '').trim()
    if (note !== (m.note || '')) run(() => db.eca.members.patch(m.id, { note: note || null }))
  }

  return (
    <div className="space-y-3">
      {canRun && <button className="btn-primary" onClick={() => setAdding(true)}><UserPlus size={16} /> {t('ecaAddStudents')}</button>}
      <Card className="!p-0 overflow-hidden">
        {!list.length ? <div className="p-4"><Empty text={t('ecaEmptyList')} /></div> : (
          <ul className="divide-y divide-slate-100">
            {list.map(({ m, s }) => {
              const flags = memberFlags(s, activity, { eca, day: today }).filter((f) => f !== 'ecaFlagHalfDay' || m.status !== 'waiting')
              return (
                <li key={m.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 ${m.status === 'waiting' ? 'bg-amber-50/50' : ''}`}>
                  <Avatar src={photoSrc(s.photo)} name={s.full_name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-800">{nameOf(s)}</span>
                      <span className="text-xs text-slate-400">{s.level}</span>
                      {m.status === 'waiting' && <span className="chip !text-[11px] bg-amber-100 text-amber-800">{t('ecaWaiting')}</span>}
                      <Flags flags={flags} s={s} a={activity} />
                    </div>
                    <div className="truncate text-xs text-slate-500">{s.nickname ? s.full_name : ''}{s.allergies ? <span className="font-semibold text-red-700"> · {s.allergies}</span> : null}</div>
                    {canRun
                      ? <input className="input mt-1.5 !py-1 text-xs" placeholder={t('ecaNoteFor')} value={notes[m.id] ?? m.note ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [m.id]: e.target.value }))} onBlur={() => saveNote(m)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                      : m.note && <div className="text-xs text-slate-600">{m.note}</div>}
                  </div>
                  {canRun && (
                    <div className="flex flex-none items-center gap-1">
                      <button className="btn-ghost !px-2 text-xs" disabled={busy} onClick={() => setStatus(m, m.status === 'waiting' ? 'joined' : 'waiting')}>{m.status === 'waiting' ? t('ecaToJoined') : t('ecaToWaiting')}</button>
                      <button className="btn-ghost !px-2 text-red-600" disabled={busy} title={t('ecaRemove')} aria-label={t('ecaRemove')} onClick={() => remove(m, s)}><Trash2 size={15} /></button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      {adding && <AddStudents activity={activity} onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddStudents({ activity, onClose }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { eca, students, refreshEca } = useData()
  const [q, setQ] = useState('')
  const [others, setOthers] = useState(false)
  const [picked, setPicked] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const { fit, other } = useMemo(() => candidates(students, activity, eca), [students, activity, eca])
  const match = (s) => !q.trim() || `${s.nickname || ''} ${s.full_name || ''} ${s.student_code || ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .includes(q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''))
  const toggle = (id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const today = todayLocal()

  const add = async () => {
    setBusy(true)
    try {
      const chosen = students.filter((s) => picked.has(s.id))
      // Half-day students go on the waiting list, as the sign-up form says.
      await db.eca.members.add(chosen.map((s) => ({ activity_id: activity.id, student_id: s.id, status: memberFlags(s, activity, { eca }).includes('ecaFlagHalfDay') ? 'waiting' : 'joined' })))
      await refreshEca()
      toast(t('ecaAdded', { n: chosen.length }))
      onClose()
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const row = (s) => {
    const flags = memberFlags(s, activity, { eca, day: today })
    return (
      <li key={s.id}>
        <label className="flex cursor-pointer items-center gap-3 px-1 py-2 hover:bg-slate-50">
          <input type="checkbox" className="h-4 w-4 flex-none" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
          <Avatar src={photoSrc(s.photo)} name={s.full_name} size={30} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5"><span className="font-semibold text-slate-800">{nameOf(s)}</span><span className="text-xs text-slate-400">{s.level}</span><Flags flags={flags} s={s} a={activity} /></span>
            {s.nickname && <span className="block truncate text-xs text-slate-500">{s.full_name}</span>}
          </span>
        </label>
      </li>
    )
  }
  const fitShown = fit.filter(match)
  const otherShown = other.filter(match)

  return (
    <Modal open onClose={onClose} title={t('ecaAddStudents')} subtitle={`${activityName(activity, lang)} · ${yearGroupsText(activity.year_groups, lang)}`}
      footer={<>
        <button className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button className="btn-primary" disabled={!picked.size || busy} onClick={add}><UserPlus size={15} /> {t('ecaAddN', { n: picked.size })}</button>
      </>}>
      <div className="space-y-3">
        <SearchInput value={q} onChange={setQ} placeholder={t('ecaSearch')} autoFocus />
        {!fit.length && !other.length ? <Empty text={t('ecaNoneToAdd')} /> : (<>
          {fitShown.length > 0 ? <ul className="divide-y divide-slate-100">{fitShown.map(row)}</ul> : <p className="text-sm text-slate-400">{t('ecaNoneToAdd')}</p>}
          {other.length > 0 && (
            <div className="border-t border-slate-100 pt-2">
              <button type="button" className="text-sm font-semibold text-slate-500 hover:text-slate-800" onClick={() => setOthers((o) => !o)}>{others ? t('ecaHideOthers') : t('ecaShowOthers', { n: other.length })}</button>
              {(others || q.trim()) && otherShown.length > 0 && (<>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-700">{t('ecaOthersTitle')}</p>
                <ul className="divide-y divide-slate-100">{otherShown.map(row)}</ul>
              </>)}
            </div>
          )}
        </>)}
      </div>
    </Modal>
  )
}

function Summary({ activity, list, sessions }) {
  const { t, lang } = useT()
  const toast = useToast()
  const { students } = useData()
  const [rows, setRows] = useState(null)
  const today = todayLocal()
  useEffect(() => {
    let alive = true
    db.eca.attendance.list({ activity_id: activity.id }).then((r) => alive && setRows(r)).catch((e) => { toast.error(e.message); if (alive) setRows([]) })
    return () => { alive = false }
  }, [activity.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows) return <Spinner />
  const held = sessions.filter((d) => d <= today)
  const markOf = (sid, d) => rows.find((r) => r.student_id === sid && r.date === d)
  // Everyone on the list, and anyone marked who has since come off it.
  const onList = list.filter((x) => x.m.status === 'joined').map((x) => x.s)
  const gone = [...new Set(rows.map((r) => r.student_id))].filter((id) => !onList.some((s) => s.id === id)).map((id) => students.find((s) => s.id === id)).filter(Boolean)
  const glyph = { present: '✓', late: lang === 'vi' ? 'T' : 'L', absent: lang === 'vi' ? 'V' : 'A' }
  const tone = { present: 'text-green-700', late: 'text-amber-600', absent: 'font-bold text-red-700' }
  const line = (s, off) => {
    const came = held.filter((d) => ['present', 'late'].includes(markOf(s.id, d)?.status)).length
    return (
      <tr key={s.id} className="border-t border-slate-100">
        <td className="td pl-4"><span className={`font-semibold ${off ? 'text-slate-400' : 'text-slate-800'}`}>{nameOf(s)}</span> <span className="text-xs text-slate-400">{off ? t('ecaOffList') : s.level}</span></td>
        {sessions.map((d) => { const st = markOf(s.id, d)?.status; return <td key={d} className={`td text-center tabular-nums ${st ? tone[st] : 'text-slate-300'}`} title={markOf(s.id, d)?.note || undefined}>{st ? glyph[st] : d <= today ? '·' : ''}</td> })}
        <td className="td pr-4 text-right font-bold tabular-nums text-slate-700">{came}/{held.length}</td>
      </tr>
    )
  }
  return (
    <div className="space-y-2">
      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/60"><tr>
            <th className="th pl-4">{t('student')}</th>
            {sessions.map((d) => <th key={d} className={`th whitespace-nowrap text-center ${d > today ? 'text-slate-300' : ''}`}>{dayLabel(d, lang).replace(/^\S+\s/, '')}</th>)}
            <th className="th pr-4 text-right">{t('ecaCame')}</th>
          </tr></thead>
          <tbody>{onList.map((s) => line(s, false))}{gone.map((s) => line(s, true))}</tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-400">{t('ecaSummaryHint')}</p>
    </div>
  )
}
