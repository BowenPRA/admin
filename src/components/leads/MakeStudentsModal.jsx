import { useMemo, useState } from 'react'
import { Plus, X, UserPlus } from 'lucide-react'
import { db } from '../../lib/db'
import { LEVELS } from '../../lib/fees'
import { suggestClass } from '../../lib/placement'
import { blankStudent } from '../../lib/studentRecords'
import { familyNameFor, looksVietnamese } from '../../lib/families'
import { childrenFromLead, emailsOf, fmtDay, todayIso, STAGES, stageOf } from '../../lib/leads'
import { startedBy } from '../../lib/onboarding'
import { Field, TextInput, Select, Modal } from '../ui'
import EmailSlip from '../EmailSlip'

const famEmails = (f) => [...emailsOf(f.email), ...(Array.isArray(f.contacts) ? f.contacts.map((c) => String(c.email || '').toLowerCase()).filter(Boolean) : [])]
const notAName = (v) => !v || /not yet known|chưa biết/i.test(v)

/**
 * Makes the pending student(s) and the family for a family on the Leads list, in one
 * step, filled in from what the lead holds. Every student keeps the lead's id, so the
 * two stay linked. A family already in The Current with one of the lead's addresses is
 * used instead of making a second one. `onDone(students)` gets the students made.
 */
export default function MakeStudentsModal({ lead, students, families, schoolYear, me, onClose, onDone, t, lang }) {
  const emails = emailsOf(lead.email)
  const existing = useMemo(() => families.filter((f) => famEmails(f).some((e) => emails.includes(e))), [families]) // eslint-disable-line react-hooks/exhaustive-deps
  const [familyId, setFamilyId] = useState(existing[0]?.id || '__new')
  const [rows, setRows] = useState(() => childrenFromLead(lead).map((c) => {
    const g = c.dob ? suggestClass({ dob: c.dob }, students, schoolYear) : null
    return { name: c.name, dob: c.dob, note: c.note, level: g?.level || (lead.program === 'nursery' ? 'Nursery' : ''), start: '' }
  }))
  const [email, setEmail] = useState(emails.join(', '))
  const [language, setLanguage] = useState('en')
  const [famName, setFamName] = useState('')
  // The family's stage once the records are made: they have agreed (Enrolled) or booked a trial.
  const [stage, setStage] = useState(['trial', 'enrolled'].includes(lead.stage) ? lead.stage : 'enrolled')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const setRow = (i, k) => (v) => setRows((cur) => cur.map((r, j) => {
    if (j !== i) return r
    const next = { ...r, [k]: v }
    // The year group follows the birthday until someone picks one.
    if (k === 'dob' && !r.levelTouched) { const g = v ? suggestClass({ dob: v }, students, schoolYear) : null; if (g) next.level = g.level }
    if (k === 'level') next.levelTouched = true
    return next
  }))
  const named = rows.filter((r) => r.name.trim())
  const defaultFamName = familyNameFor(named.length ? named.map((r) => ({ full_name: r.name.trim() })) : [{ full_name: lead.family }])
  const ready = named.length > 0 && named.every((r) => r.level)

  const make = async () => {
    if (!ready) return
    setBusy(true); setErr('')
    try {
      let fid = familyId
      const addresses = emailsOf(email)
      if (fid === '__new') {
        const parent = notAName(lead.family) ? '' : lead.family
        const contacts = (addresses.length ? addresses : ['']).map((e, i) => ({ name: i === 0 ? parent : '', relation: '', email: e, phone: i === 0 ? lead.phone || '' : '' })).filter((c) => c.name || c.email || c.phone)
        const fam = await db.families.save({
          name: famName.trim() || defaultFamName, email: addresses.join(', '), phone: lead.phone || '', language,
          notes: t('mkFamilyNote', { date: fmtDay(todayIso()) }), contacts,
        })
        fid = fam.id
      }
      // Next free S numbers, one after another.
      const pool = [...students]
      const made = named.map((r) => {
        const s = {
          ...blankStudent(pool), full_name: r.name.trim(), dob: r.dob || null, level: r.level,
          program: lead.program === 'global' ? 'global' : 'regular', family_id: fid,
          start_date: r.start || '', parents_email: addresses.join(', '), parent_phone: lead.phone || '',
          lead_id: lead.id, onboarding: startedBy(me?.email, { from: 'lead' }),
          notes: [t('mkStudentNote', { date: fmtDay(todayIso()) }), r.note].filter(Boolean).join(' '),
        }
        pool.push(s)
        return s
      })
      const saved = await db.students.saveMany(made)
      if (stage !== lead.stage || lead.archived) await db.leads.patch(lead.id, { stage, archived: false, updated_by: me?.email || null })
      await onDone(saved, { stage })
    } catch (e) { setErr(e.message || String(e)) } finally { setBusy(false) }
  }

  const stageName = (id) => (lang === 'vi' ? stageOf(id).vi : stageOf(id).en)
  return (
    <Modal open wide onClose={onClose} title={t('mkTitle', { name: lead.family })} subtitle={t('mkSub')}
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="btn-primary" disabled={busy || !ready} onClick={make}>
          <UserPlus size={16} /> {busy ? t('saving') : t(named.length === 1 ? 'mkGoOne' : 'mkGo', { n: named.length })}
        </button>
      </>}>
      <div className="space-y-5">
        <section>
          <div className="label">{t('family')}</div>
          {existing.length > 0 && (
            <div className="mb-2 space-y-1">
              {existing.map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="mk-family" checked={familyId === f.id} onChange={() => setFamilyId(f.id)} />
                  {t('mkUseFamily', { name: f.name })}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="mk-family" checked={familyId === '__new'} onChange={() => setFamilyId('__new')} />
                {t('mkNewFamily')}
              </label>
            </div>
          )}
          {familyId === '__new' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t('familyName')}><TextInput value={famName} onChange={setFamName} placeholder={defaultFamName} /></Field>
              <div>
                <Field label={t('email')} hint={t('mkEmailHint')}><TextInput value={email} onChange={setEmail} /></Field>
                <EmailSlip value={email} onFix={setEmail} t={t} className="mt-1" />
              </div>
              <Field label={t('preferredLang')}><Select value={language} onChange={setLanguage} options={[{ value: 'en', label: t('english') }, { value: 'vi', label: t('vietnamese') }]} /></Field>
            </div>
          )}
          {familyId === '__new' && looksVietnamese(named.map((r) => ({ full_name: r.name }))) && language === 'en' && <p className="mt-1 text-xs text-slate-500">{t('mkLangHint')}</p>}
        </section>

        <section>
          <div className="label">{t('mkChildren')}</div>
          {lead.children && <p className="mb-2 text-xs text-slate-500">{t('mkFromLead', { text: lead.children })}</p>}
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-2.5 sm:grid-cols-[1.6fr_1fr_1fr_1fr_auto]">
                <Field label={t('fullName')}><TextInput value={r.name} onChange={setRow(i, 'name')} autoFocus={i === 0} /></Field>
                <Field label={t('dob')}><TextInput type="date" value={r.dob} onChange={setRow(i, 'dob')} /></Field>
                <Field label={t('yearGroup')}><Select value={r.level} onChange={setRow(i, 'level')} options={[{ value: '', label: '—' }, ...LEVELS.map((l) => ({ value: l, label: l }))]} /></Field>
                <Field label={t('startDate')}><TextInput type="date" value={r.start} onChange={setRow(i, 'start')} /></Field>
                <button type="button" className="btn-ghost self-end px-2 text-slate-400 hover:text-red-600" aria-label={t('delete')} onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}><X size={16} /></button>
                {r.note && <p className="text-xs text-slate-500 sm:col-span-5">{t('mkNote', { text: r.note })}</p>}
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary mt-2 text-xs" onClick={() => setRows((cur) => [...cur, { name: '', dob: '', note: '', level: '', start: '' }])}><Plus size={14} /> {t('addChild')}</button>
          <p className="mt-2 text-xs text-slate-500">{t('mkDobHint')}</p>
          {lead.timing && <p className="text-xs text-slate-500">{t('mkTiming', { text: lead.timing })}</p>}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label={t('mkStage')} hint={t('mkStageHint', { stage: stageName(lead.stage) })}>
            <Select value={stage} onChange={setStage} options={STAGES.filter((x) => ['trial', 'enrolled'].includes(x.id)).map((x) => ({ value: x.id, label: lang === 'vi' ? x.vi : x.en }))} />
          </Field>
          <p className="self-end rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{t('mkPendingNote')}</p>
        </section>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </Modal>
  )
}
