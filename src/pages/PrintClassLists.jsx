import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { db } from '../lib/db'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { useT, tFor } from '../lib/i18n'
import { classForYearGroup } from '../lib/schedule'
import { isEnrolled, partialFrom, contactsOf, ageOf } from '../lib/studentRecords'
import { yearGroupsOf, nameOf } from '../lib/attendanceSummary'
import { HEALTH_QUESTIONS, isYes } from '../lib/enrollment'
import { photoSrc } from '../lib/report/photo'
import { fullDate, many } from '../lib/printFormat'
import { PrintShell, Masthead, layout, usePrintLang, H, mm } from '../components/print/Sheets'

// Class lists on paper: one A4 portrait page per class with each student's photo,
// birthday, allergies and health notes, and who to call. Year groups taught as one
// class (Years 4 to 6, say) share a page. Contacts come from the family record,
// else the enrollment form, else the parent email / phone on the student; the
// form also gives emergency contacts and who may collect the child. Teachers
// print their own classes. The page carries personal data, and says so.

const ORIENT = 'portrait'
const MM = { classHead: 15, callTitle: 6.5, callRow: 4.4, callGap: 4, line: 3.7, rowMin: 14, rowPad: 3.4, maxLines: 7 }
const COLS = '13mm 47mm 40mm minmax(0,1fr)'

/** Everything printed about one student, and how tall the row is. */
function studentRow(s, { families, students, enrollments, lang }) {
  const fam = families.find((f) => f.id === s.family_id)
  const kids = fam ? students.filter((k) => k.family_id === fam.id) : [s]
  const form = enrollments.filter((e) => e.student_id === s.id).sort((a, b) => String(b.submitted_at || '').localeCompare(String(a.submitted_at || '')))[0]
  const d = form?.data || {}
  const clean = (list) => (list || []).filter((c) => c && (c.name || c.phone || c.email))
  const parents = clean(fam?.contacts?.length ? fam.contacts : d.parents?.length ? d.parents : contactsOf(fam, kids))
  const emergency = clean(d.emergency)
  const pickup = clean(d.pickup)
  const allergies = [s.allergies, d.health?.allergies].map((x) => String(x || '').trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join('; ')
  const health = HEALTH_QUESTIONS.filter(([k]) => k !== 'allergy_food' && k !== 'allergy_medication' && isYes(d.health?.[k])).map(([, l]) => l[lang === 'vi' ? 1 : 0])
  const lines = Math.min(MM.maxLines, Math.max(1, parents.length) + emergency.length + (pickup.length ? 1 : 0))
  return { s, parents, emergency, pickup, allergies, health, h: Math.max(MM.rowMin, MM.rowPad + lines * MM.line) }
}

export default function PrintClassLists() {
  const { t } = useT()
  const { loading, students, families, schedule } = useData()
  const { canAttendance, isOffice, myYearGroups, displayName } = useAuth()
  const [params, setParams] = useSearchParams()
  const { lang, setLang, setParam } = usePrintLang(params, setParams)
  const T = useMemo(() => tFor(lang), [lang])

  // Enrollment forms are for office accounts; a teacher's list goes without them.
  const [enrollments, setEnrollments] = useState(null)
  useEffect(() => {
    let alive = true
    ;(isOffice ? db.enrollments.list() : Promise.resolve([])).catch(() => []).then((rows) => alive && setEnrollments(rows))
    return () => { alive = false }
  }, [isOffice])

  const allowed = useMemo(() => yearGroupsOf(students).filter(canAttendance), [students, canAttendance])
  const group = allowed.includes(params.get('group')) ? params.get('group') : ''
  const groups = useMemo(() => (group ? [group] : allowed), [group, allowed])
  const scoped = !isOffice && !!myYearGroups
  const groupLabel = group || (scoped ? allowed.join(', ') : T('allYearGroups'))
  const classOf = (g) => (schedule ? classForYearGroup(schedule, g) : null)
  const total = students.filter((s) => isEnrolled(s) && groups.includes(s.level)).length

  const sheets = useMemo(() => {
    if (!enrollments) return []
    const ctx = { families, students, enrollments, lang }
    const blocks = [{ type: 'masthead', h: H.masthead }]
    let lastClass = null
    groups.forEach((g, i) => {
      const rows = students.filter((s) => isEnrolled(s) && s.level === g).sort((a, b) => nameOf(a).localeCompare(nameOf(b))).map((s) => studentRow(s, ctx))
      if (!rows.length) return
      const cls = classOf(g)?.key || g
      // A new class starts a new page; year groups taught together carry on.
      const fresh = i > 0 && cls !== lastClass
      lastClass = cls
      const flagged = rows.filter((r) => r.allergies || r.health.length)
      // The year group's heading (left out for one year group: the title names it) and its
      // allergy panel open the list, so they never sit at the foot of a page without it.
      const named = groups.length > 1
      const opening = (named ? MM.classHead : 0) + (flagged.length ? MM.callTitle + flagged.length * MM.callRow + MM.callGap : 0)
      blocks.push({ type: 'class', g, rows, count: rows.length, flagged, named, newSheet: fresh ? 'always' : false, min: 2, row: (r) => r.h, head: (first) => (first ? opening : 0) + H.listHead, tail: () => H.gap })
    })
    return layout(blocks, ORIENT)
  }, [enrollments, groups, students, families, lang]) // eslint-disable-line react-hooks/exhaustive-deps -- classOf reads the schedule, which only names the class

  const only = groups.length === 1 ? classOf(groups[0]) : null
  const others = only ? (only.yearGroups || []).filter((g) => g !== groups[0]) : []
  const sub = [T('classListSub'), many(T, 'nStudents', total, lang), only?.homeroom ? `${T('homeroomTeacher')}: ${only.homeroom}` : '', only?.room, others.length ? T('taughtWith', { groups: others.join(', ') }) : ''].filter(Boolean).join('  ·  ')

  return (
    <PrintShell T={T} lang={lang} setLang={setLang} orientation={ORIENT} back="/students" by={displayName}
      loading={loading || !enrollments} sheets={sheets}
      docTitle={`${T('classList')} - ${groupLabel}`}
      running={<><span className="font-bold text-pra-navy">{T('classList')}</span>  ·  {groupLabel}</>}
      footLeft={() => <span className="font-semibold text-slate-600">{T('confidentialNote')}</span>}
      controls={allowed.length > 1 && (
        <select className="input w-auto" value={group} onChange={(e) => setParam('group', e.target.value)} aria-label={t('yearGroup')}>
          <option value="">{scoped ? allowed.join(', ') : t('allYearGroups')}</option>
          {allowed.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      )}
      renderBlock={(b) => {
        if (b.type === 'masthead') return <Masthead overline={T('classList')} title={groupLabel} sub={sub} />
        if (b.type === 'class') return <ClassBlock b={b} T={T} lang={lang} cls={classOf(b.g)} />
        return null
      }} />
  )
}

/** One year group: its heading and allergy panel (on the first part only), then the students. */
function ClassBlock({ b, T, lang, cls }) {
  return (
    <div style={{ height: mm(b.h - H.gap), marginBottom: mm(H.gap) }}>
      {b.first && b.named && <ClassHead g={b.g} count={b.count} T={T} lang={lang} cls={cls} />}
      {b.first && b.flagged.length > 0 && <Callout rows={b.flagged} T={T} />}
      <Students b={b} T={T} lang={lang} />
    </div>
  )
}

function ClassHead({ g, T, lang, cls, count }) {
  const others = (cls?.yearGroups || []).filter((x) => x !== g)
  const sub = [cls?.homeroom && `${T('homeroomTeacher')}: ${cls.homeroom}`, cls?.room, others.length && T('taughtWith', { groups: others.join(', ') }), many(T, 'nStudents', count, lang)].filter(Boolean).join('  ·  ')
  return (
    <div className="flex items-stretch gap-[2.5mm]" style={{ height: mm(MM.classHead - 3), marginBottom: mm(3) }}>
      <span className="w-[1.3mm] flex-none rounded-full bg-pra-blue" />
      <div className="min-w-0">
        <div className="text-[14pt] font-black leading-tight text-pra-navy">{g}</div>
        <div className="truncate text-[7.5pt] text-slate-500">{sub}</div>
      </div>
    </div>
  )
}

/** The students a teacher must not miss: allergies and health answers, on one panel at the top. */
function Callout({ rows, T }) {
  return (
    <div className="rounded-[1.6mm] border border-red-200 bg-red-50/60 px-[3mm]" style={{ height: mm(MM.callTitle + rows.length * MM.callRow), marginBottom: mm(MM.callGap) }}>
      <div className="flex items-center text-[7pt] font-extrabold uppercase tracking-[0.08em] text-red-700" style={{ height: mm(MM.callTitle) }}>
        {T('allergiesCallout')}
      </div>
      {rows.map((r) => (
        <div key={r.s.id} className="truncate text-[7.5pt] text-slate-700" style={{ height: mm(MM.callRow), lineHeight: mm(MM.callRow) }}>
          <b className="text-slate-900">{nameOf(r.s)}</b>
          {r.allergies && <span className="font-bold text-red-700">  ·  {r.allergies}</span>}
          {r.health.length > 0 && <span className="text-amber-800">  ·  {r.health.join(', ')}</span>}
        </div>
      ))}
    </div>
  )
}

function Students({ b, T, lang }) {
  return (
    <div>
      <div className="ps-thead grid items-end" style={{ gridTemplateColumns: COLS, height: mm(H.listHead) }}>
        <span />
        <span>{T('studentCol')}{!b.first && <span className="font-normal normal-case tracking-normal text-slate-400"> · {b.g} ({T('continued')})</span>}</span>
        <span>{T('colHealth')}</span>
        <span>{T('colContacts')}</span>
      </div>
      {b.rows.map((r) => <StudentRow key={r.s.id} r={r} T={T} lang={lang} />)}
    </div>
  )
}

function StudentRow({ r, T, lang }) {
  const { s } = r
  const age = ageOf(s.dob)
  const born = s.dob ? `${fullDate(String(s.dob).slice(0, 10), lang)}${age != null ? ` (${T('ageN', { n: age })})` : ''}` : ''
  const person = (c, i, label) => (
    <div key={`${label || 'p'}${i}`} className="truncate" style={{ height: mm(MM.line), lineHeight: mm(MM.line) }}>
      {label && <span className="mr-[1mm] rounded-[0.5mm] bg-slate-100 px-[0.8mm] text-[5.5pt] font-bold uppercase tracking-[0.04em] text-slate-500">{label}</span>}
      <b className="text-slate-800">{c.name || '—'}</b>
      {c.relation && <span className="text-slate-400"> ({c.relation})</span>}
      {c.phone && <span className="font-semibold tabular-nums text-slate-800">  ·  {c.phone}</span>}
      {c.email && <span className="text-slate-400">  ·  {c.email}</span>}
    </div>
  )
  const lines = [
    ...(r.parents.length ? r.parents.map((c, i) => person(c, i)) : [<div key="none" className="font-semibold text-amber-700" style={{ height: mm(MM.line), lineHeight: mm(MM.line) }}>{T('noContact')}</div>]),
    ...r.emergency.map((c, i) => person(c, i, T('emergencyLabel'))),
    ...(r.pickup.length ? [
      <div key="pickup" className="truncate" style={{ height: mm(MM.line), lineHeight: mm(MM.line) }}>
        <span className="mr-[1mm] rounded-[0.5mm] bg-slate-100 px-[0.8mm] text-[5.5pt] font-bold uppercase tracking-[0.04em] text-slate-500">{T('pickupLabel')}</span>
        {r.pickup.map((c) => `${c.name || c.phone}${c.relation ? ` (${c.relation})` : ''}`).join(', ')}
      </div>,
    ] : []),
  ].slice(0, MM.maxLines)
  return (
    <div className="ps-row grid items-start" style={{ gridTemplateColumns: COLS, height: mm(r.h), paddingTop: mm(1.6) }}>
      <Photo s={s} />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[9pt] font-extrabold text-slate-900">{nameOf(s)}</div>
        {s.nickname && <div className="truncate text-[7pt] text-slate-500">{s.full_name}</div>}
        <div className="truncate text-[6.5pt] text-slate-400">{[s.student_code, born].filter(Boolean).join('  ·  ')}</div>
        {partialFrom(s) && <span className="mt-[0.5mm] inline-block rounded-[0.6mm] bg-amber-50 px-[0.8mm] text-[5.5pt] font-bold text-amber-700">{T('fromTime', { time: partialFrom(s) })}</span>}
      </div>
      <div className="min-w-0 pr-[1mm] text-[7pt] leading-tight">
        {r.allergies ? <div className="line-clamp-2 font-bold text-red-700">{r.allergies}</div> : null}
        {r.health.length > 0 && <div className="line-clamp-2 text-amber-800">{r.health.join(', ')}</div>}
        {!r.allergies && !r.health.length && <span className="text-slate-300">—</span>}
      </div>
      <div className="min-w-0 text-[7pt] text-slate-600">{lines}</div>
    </div>
  )
}

/** The student's photo, or their initials when there is none (or it will not load). */
function Photo({ s }) {
  const src = photoSrc(s.photo)
  const [failed, setFailed] = useState(false)
  const words = String(s.full_name || '?').trim().split(/\s+/)
  const initials = `${words[0][0]}${words.length > 1 ? words.at(-1)[0] : ''}`.toUpperCase()
  if (src && !failed) return <img src={src} alt="" onError={() => setFailed(true)} className="h-[11mm] w-[11mm] rounded-[1.5mm] object-cover" />
  return <span className="flex h-[11mm] w-[11mm] items-center justify-center rounded-[1.5mm] bg-slate-100 text-[8pt] font-bold text-slate-400">{initials}</span>
}
