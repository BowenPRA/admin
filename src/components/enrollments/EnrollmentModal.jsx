import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ExternalLink, Lock, Paperclip, Trash2, Undo2, UserPlus } from 'lucide-react'
import { db } from '../../lib/db'
import { fmtDay, fmtMoment, personName } from '../../lib/leads'
import {
  STUDENT_FIELDS, PARENT_FIELDS, PERSON_FIELDS, SCHOOL_FIELDS, DOC_KINDS, BACKGROUND_QUESTIONS, HEALTH_QUESTIONS, CONSENT, ID_FIELDS,
  showValue, birthdayLine, yesNo, isYes, placeOf,
} from '../../lib/enrollment'
import { Chip, Modal } from '../ui'
import { onChecklist } from '../../lib/onboarding'
import NewStudentChecklist from '../students/NewStudentChecklist'

function Section({ title, icon: Icon, children }) {
  return (
    <fieldset className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      <legend className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-pra-navy">{Icon && <Icon size={13} />}{title}</legend>
      {children}
    </fieldset>
  )
}

/** Label and answer on one line; an empty answer is a dash, so a skipped question is seen as skipped. */
function Row({ label, children }) {
  return (
    <div className="grid grid-cols-1 gap-x-3 py-1 text-sm sm:grid-cols-[11rem_1fr]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-slate-800">{children || <span className="text-slate-300">—</span>}</dd>
    </div>
  )
}

function Answer({ value, kind, lang }) {
  const text = showValue(value, kind, lang)
  if (!text) return null
  if (kind === 'email') return <a href={`mailto:${text}`} className="text-pra-blue hover:underline">{text}</a>
  if (kind === 'phone') return <a href={`tel:${text.replace(/\s+/g, '')}`} className="text-pra-blue hover:underline">{text}</a>
  return text
}

function Fields({ fields, value, lang }) {
  const i = lang === 'vi' ? 1 : 0
  return <dl>{fields.map(([key, label, kind]) => <Row key={key} label={label[i]}><Answer value={value?.[key]} kind={kind} lang={lang} /></Row>)}</dl>
}

function People({ people, fields, title, lang }) {
  if (!people?.length) return <p className="text-sm text-slate-400">—</p>
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {people.map((p, n) => (
        <div key={n} className="rounded-xl border border-slate-200 p-3">
          {title && <div className="mb-1 text-xs font-semibold text-slate-500">{title(n + 1)}</div>}
          <Fields fields={fields.filter(([k]) => k in p)} value={p} lang={lang} />
        </div>
      ))}
    </div>
  )
}

function YesNoList({ questions, answers, lang }) {
  const i = lang === 'vi' ? 1 : 0
  return (
    <dl>
      {questions.map(([key, label]) => (
        <Row key={key} label={label[i]}>
          {answers?.[key] && (isYes(answers[key]) ? <Chip tone="amber">{yesNo(answers[key], lang)}</Chip> : <span className="text-slate-600">{yesNo(answers[key], lang)}</span>)}
        </Row>
      ))}
    </dl>
  )
}

/** ID numbers, documents and the signature. Office accounts only, like the page itself. */
function PrivatePart({ id, studentName, t, lang }) {
  const [state, setState] = useState(null)
  useEffect(() => {
    let on = true
    // The documents are in a private folder: each gets a link that works for an hour.
    db.enrollments.private(id)
      .then(async (row) => ({ row, urls: await db.enrollments.fileUrls((row?.files || []).map((f) => f.path).filter(Boolean)).catch(() => ({})) }))
      .then((s) => on && setState(s))
      .catch(() => on && setState({ row: null, urls: {} }))
    return () => { on = false }
  }, [id])
  if (!state) return <p className="text-sm text-slate-400">…</p>
  const p = state.row
  if (!p) return <p className="text-sm text-slate-500">{t('enPrivateNone')}</p>
  const i = lang === 'vi' ? 1 : 0
  const ids = p.ids || {}
  const files = Array.isArray(p.files) ? p.files : []
  const signature = String(p.signature || '')
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-1 text-xs font-semibold text-slate-500">{studentName}</div>
          <dl>
            <Row label={t('enBirthPlace')}>{ids.student?.place_of_birth}</Row>
            <Row label={ID_FIELDS[0][1][i]}>{ids.student?.id_number}</Row>
          </dl>
        </div>
        {(ids.parents || []).map((par, n) => (
          <div key={n} className="rounded-xl border border-slate-200 p-3">
            <div className="mb-1 text-xs font-semibold text-slate-500">{par.name || t('enParentN', { n: n + 1 })}</div>
            <Fields fields={ID_FIELDS} value={par} lang={lang} />
          </div>
        ))}
      </div>
      <div>
        <div className="label">{t('enFiles')}</div>
        {files.length === 0 ? <p className="text-sm text-slate-400">{t('enNoFiles')}</p> : (
          <>
            <ul className="space-y-1 text-sm">
              {files.map((f) => (
                <li key={f.path} className="flex items-center gap-1.5">
                  <Paperclip size={13} className="shrink-0 text-slate-400" />
                  {DOC_KINDS[f.kind] && <span className="shrink-0 text-slate-500">{DOC_KINDS[f.kind][i]}:</span>}
                  {state.urls[f.path]
                    ? <a href={state.urls[f.path]} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 break-all text-pra-blue hover:underline">{f.name || f.path}<ExternalLink size={12} className="shrink-0 opacity-60" /></a>
                    : <span className="break-all text-slate-700">{f.name || f.path}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-slate-500">{t('enFilesHint')}</p>
          </>
        )}
      </div>
      <div>
        <div className="label">{t('enSignature')}</div>
        {signature.startsWith('data:image/')
          ? <img src={signature} alt={t('enSignature')} className="max-h-28 rounded-lg border border-slate-200 bg-white p-2" />
          : <p className="text-sm text-slate-400">—</p>}
      </div>
    </div>
  )
}

/**
 * One enrollment form, every answer. Nothing here is edited: it is what the
 * parent sent. `onCheck(e, checked)`, `onMakeStudent(e)` and `onDelete(e)`
 * return promises.
 */
export default function EnrollmentModal({ value: e, student, isSuper, onClose, onCheck, onMakeStudent, onDelete, checklist, t, lang }) {
  const [busy, setBusy] = useState(false)
  const run = async (fn) => { setBusy(true); try { await fn() } finally { setBusy(false) } }
  const d = e.data || {}
  const i = lang === 'vi' ? 1 : 0
  const place = placeOf(e)
  const consent = CONSENT[e.photo_consent]
  const subtitle = [
    t('enReceivedOn', { date: fmtMoment(e.submitted_at || e.created_at, lang) }),
    e.checked_at && t('enCheckedBy', { name: personName(e.checked_by, lang) || '?', date: fmtDay(e.checked_at, lang) }),
  ].filter(Boolean).join(' · ')

  return (
    <Modal open wide onClose={onClose} title={e.student_name} subtitle={subtitle}
      footer={<>
        {isSuper && <button type="button" className="btn-danger mr-auto" disabled={busy} onClick={() => run(() => onDelete(e))}><Trash2 size={16} /> {t('delete')}</button>}
        {place === 'none'
          ? <button type="button" className="btn-secondary" disabled={busy} onClick={() => run(() => onMakeStudent(e))}><UserPlus size={16} /> {t('enMakeStudent')}</button>
          : <Link to={`/students?student=${e.student_id}`} className="btn-secondary">{t('enOpenStudent')}</Link>}
        {e.checked_at
          ? <button type="button" className="btn-ghost" disabled={busy} onClick={() => run(() => onCheck(e, false))}><Undo2 size={16} /> {t('enUncheck')}</button>
          : <button type="button" className="btn-primary" disabled={busy} onClick={() => run(() => onCheck(e, true))}><Check size={16} /> {t('enMarkChecked')}</button>}
      </>}>
      <div className="space-y-5">
        {/* The form's student on the new-student checklist; with no student yet, the one step is to add them. */}
        {checklist && (place === 'none' || (student && onChecklist(student))) && (
          <NewStudentChecklist student={place === 'none' ? {} : student} ctx={checklist.ctx} me={checklist.me} t={t} lang={lang}
            onChanged={checklist.onChanged} onMakeStudent={() => run(() => onMakeStudent(e))} />
        )}
        <Section title={t('enSecStudent')}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Chip tone={place === 'added' ? 'green' : place === 'linked' ? 'sky' : 'slate'}>{t(place === 'added' ? 'enAdded' : place === 'linked' ? 'enLinked' : 'enNoStudent')}</Chip>
            {student && <span className="text-xs text-slate-500">{[student.student_code, student.level, t(student.status === 'pending' ? 'pending' : student.status === 'inactive' ? 'inactive' : 'active')].filter(Boolean).join(' · ')}</span>}
          </div>
          <dl>
            <Row label={t('enApplying')}>{e.applying_for}</Row>
            {STUDENT_FIELDS.map(([key, label, kind]) => (
              <Row key={key} label={label[i]}>{key === 'dob' ? birthdayLine(d.student?.dob, lang) : <Answer value={d.student?.[key]} kind={kind} lang={lang} />}</Row>
            ))}
          </dl>
        </Section>

        <Section title={t('enSecParents')}>
          <People people={d.parents} fields={PARENT_FIELDS} title={(n) => t('enParentN', { n })} lang={lang} />
        </Section>

        <Section title={t('enSecEmergency')}>
          <People people={d.emergency} fields={PERSON_FIELDS} lang={lang} />
        </Section>

        <Section title={t('enSecPickup')}>
          <People people={d.pickup} fields={PERSON_FIELDS} lang={lang} />
        </Section>

        <Section title={t('enSecEducation')}>
          <dl>
            <Row label={t('enSchools')}>
              {d.schools?.length > 0 && (
                <ul className="space-y-1.5">
                  {d.schools.map((s, n) => (
                    <li key={n}>
                      <div className="font-semibold">{s.name || '—'}</div>
                      <div className="text-slate-600">{SCHOOL_FIELDS.filter(([k]) => s[k]).map(([k, label]) => `${label[i]}: ${s[k]}`).join(' · ')}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Row>
            {/* Forms sent before 2 October 2026 had one language answer for all the schools. */}
            {d.school_language && <Row label={t('enSchoolLang')}>{d.school_language}</Row>}
          </dl>
          <YesNoList questions={BACKGROUND_QUESTIONS} answers={d.background} lang={lang} />
          <dl><Row label={t('enExplain')}>{d.background?.explain && <span className="whitespace-pre-wrap">{d.background.explain}</span>}</Row></dl>
        </Section>

        <Section title={t('enSecHealth')}>
          <YesNoList questions={HEALTH_QUESTIONS} answers={d.health} lang={lang} />
          <dl>
            <Row label={t('enExplain')}>{d.health?.explain && <span className="whitespace-pre-wrap">{d.health.explain}</span>}</Row>
            <Row label={t('enAllergies')}>{d.health?.allergies && <span className="whitespace-pre-wrap font-semibold">{d.health.allergies}</span>}</Row>
          </dl>
        </Section>

        <Section title={t('enSecConsent')}>
          {consent ? (
            <div className="flex flex-wrap items-start gap-2 text-sm">
              <Chip tone={e.photo_consent === 'private' ? 'red' : 'green'}>{lang === 'vi' ? consent.vi : consent.en}</Chip>
              <span className="min-w-0 flex-1 text-slate-600">{consent.hint[i]}</span>
            </div>
          ) : <p className="text-sm text-slate-400">—</p>}
          <dl className="mt-2"><Row label={t('enTerms')}>{d.terms}</Row></dl>
        </Section>

        <Section title={t('enSecPrivate')} icon={Lock}>
          <PrivatePart id={e.id} studentName={e.student_name} t={t} lang={lang} />
        </Section>
      </div>
    </Modal>
  )
}
