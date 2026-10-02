import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, AlertTriangle, Info, ClipboardCheck, Copy, PackageCheck, ExternalLink } from 'lucide-react'
import { db } from '../../lib/db'
import { useToast } from '../../lib/toast'
import { isEnrolled } from '../../lib/studentRecords'
import { checklistFor, onboardingOf, setStep, closeChecklist, parentEmails, ChecklistSetupError } from '../../lib/onboarding'
import { whoName } from '../../lib/todos'
import { fmtDay, todayIso } from '../../lib/leads'
import { familyNameFor } from '../../lib/families'
import SupplyCheckModal from './SupplyCheckModal'

const ICON = {
  done: <CheckCircle2 size={17} className="mt-0.5 flex-none text-green-600" />,
  warn: <AlertTriangle size={17} className="mt-0.5 flex-none text-amber-500" />,
  open: <Circle size={17} className="mt-0.5 flex-none text-slate-300" />,
  info: <Info size={17} className="mt-0.5 flex-none text-slate-300" />,
}
// Steps a person ticks, and the "done another way" records behind three worked-out lines.
const TICKS = { tick: true, untick: false }
const ELSEWHERE = { noFee: ['no_fee', true], undoNoFee: ['no_fee', false], invoiceElsewhere: ['invoice_elsewhere', true], undoInvoiceElsewhere: ['invoice_elsewhere', false], formElsewhere: ['form_elsewhere', true], undoFormElsewhere: ['form_elsewhere', false] }

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    const area = Object.assign(document.createElement('textarea'), { value: text })
    area.style.position = 'fixed'; area.style.opacity = '0'
    document.body.appendChild(area); area.select()
    try { return document.execCommand('copy') } finally { area.remove() }
  }
}

/**
 * The new-student checklist for one student: what is done, what is still open, and a
 * button for each step that can be done from here. `student` is the student as shown
 * (in the student window, with edits not yet saved); `record` the row as saved, which
 * ticks are written to. `ctx` = { students, families, invoices, enrollments, leads,
 * teachers, schoolYear }. `onSaved(row)` gets the student after a write here;
 * `onChanged()` reloads the page's data; `onTickFee()` ticks the New student box (in the
 * student window it is a form field, saved with Save); `onMakeStudent()` adds a pending
 * student for an enrollment form that has none.
 */
export default function NewStudentChecklist({ student, record = student, ctx, me, onSaved, onChanged, onTickFee, onMakeStudent, locked = false, t, lang }) {
  const toast = useToast()
  const [busy, setBusy] = useState('')
  const [supply, setSupply] = useState(false)
  const result = checklistFor(student, ctx, lang)
  const by = me?.email || ''

  // An enrolled student's checklist closes once everything is done, so it does not come
  // back later (when the New student box is unticked next year, say). Pending ones stay.
  // Only once invoices, forms and leads have loaded: until then their lines are left out,
  // and a checklist could look complete when it is not.
  const closing = useRef(false)
  const sourcesIn = !!(ctx?.loaded && ctx.invoices && ctx.enrollments && ctx.leads)
  const savedDone = sourcesIn && record?.id && isEnrolled(record) && onboardingOf(record) && !onboardingOf(record).closed_at && checklistFor(record, ctx, lang).complete
  useEffect(() => {
    if (!savedDone || closing.current) return
    closing.current = true
    closeChecklist(db, record, by).then((row) => { onSaved?.(row); onChanged?.() }).catch(() => { /* the database file has not run: nothing to keep */ })
  }, [savedDone]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key, fn, done) => {
    setBusy(key)
    try {
      const row = await fn()
      if (row) onSaved?.(row)
      await onChanged?.()
      if (done) toast(done)
    } catch (e) { toast.error(e instanceof ChecklistSetupError ? t('checklistSetup') : e.message || String(e)) } finally { setBusy('') }
  }
  // A link to a lead is written like a tick: a database without the column gives the row back without it.
  const linkLead = (lead) => run('lead', async () => {
    const row = await db.students.patch(record.id, { lead_id: lead.id })
    if (!('lead_id' in row)) throw new ChecklistSetupError('lead_id')
    return row
  }, t('obLeadLinked', { name: lead.family }))
  const addLead = () => run('lead', async () => {
    const fam = ctx.families.find((f) => f.id === record.family_id)
    const emails = parentEmails(record, fam, ctx.students)
    const lead = await db.leads.save({
      family: fam?.name || familyNameFor([record]), email: emails.join(', '), phone: fam?.phone || record.parent_phone || '',
      children: [record.full_name, record.dob ? `(b. ${fmtDay(record.dob)})` : ''].filter(Boolean).join(' '), kids: 1,
      program: record.program === 'global' ? 'global' : record.level === 'Nursery' ? 'nursery' : 'year', source: 'other',
      first_contact: todayIso(), stage: 'enrolled', owner: '', next_step: '', follow_up: '', archived: false,
      notes: t('obLeadAddedNote', { date: fmtDay(todayIso()) }), created_by: by, updated_by: by,
    })
    const row = await db.students.patch(record.id, { lead_id: lead.id })
    if (!('lead_id' in row)) throw new ChecklistSetupError('lead_id')
    return row
  }, t('obLeadAdded'))

  const act = (line, a) => {
    const key = `${line.id}:${a}`
    if (a in TICKS) return run(key, () => setStep(db, record, line.id, TICKS[a], by))
    if (a in ELSEWHERE) return run(key, () => setStep(db, record, ELSEWHERE[a][0], ELSEWHERE[a][1], by))
    if (a === 'supply') return setSupply(true)
    if (a === 'linkLead') return linkLead(line.lead)
    if (a === 'addLead') return addLead()
    if (a === 'makeStudent') return run(key, async () => { await onMakeStudent?.() })
    if (a === 'tickFee') {
      if (onTickFee) return onTickFee()
      return run(key, () => db.students.patch(record.id, { is_new: true }), t('obFeeTickedToast'))
    }
    if (a === 'copyEmails') {
      const fam = ctx.families.find((f) => f.id === record.family_id)
      return copyText(parentEmails(record, fam, ctx.students).join(', ')).then((ok) => (ok ? toast(t('obEmailsCopied')) : toast.error(t('copyFailed'))))
    }
  }

  const button = (line, a) => {
    const cls = 'rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-pra-blue hover:text-pra-blue disabled:opacity-50'
    const ghost = 'px-1 py-1 text-xs text-slate-400 hover:text-red-600'
    if (a === 'newInvoice') return <Link key={a} to="/invoices/new" className={cls}>{t('newInvoice')}</Link>
    if (a === 'openInvoice' && line.invoice) return <Link key={a} to={`/invoices/${line.invoice.id}`} className={cls}>{t('obOpen')}</Link>
    if (a === 'openForm' && line.form) return <Link key={a} to={`/enrollments?form=${line.form.id}`} className={cls}>{t('obOpen')}</Link>
    if (a === 'openLead' && line.lead) return <Link key={a} to={`/leads?lead=${line.lead.id}`} className={cls}>{t('obOpen')}</Link>
    const labels = {
      tick: t('obTick'), untick: t('obUntick'), supply: line.record ? t('obSupplyAgain') : t('obSupplyButton'), linkLead: t('obLinkLead'), addLead: t('obAddLead'),
      tickFee: t('obTickFee'), noFee: t('obNoFee'), undoNoFee: t('obUndo'), invoiceElsewhere: t('obInvoiceElsewhereButton'), undoInvoiceElsewhere: t('obUndo'),
      formElsewhere: t('obFormElsewhereButton'), undoFormElsewhere: t('obUndo'), copyEmails: t('obCopyEmails'), makeStudent: t('enMakeStudent'),
    }
    if (!labels[a]) return null
    const quiet = a === 'untick' || a.startsWith('undo') || (a === 'tick' && line.id === 'supply')
    const icon = a === 'supply' ? <PackageCheck size={13} className="mr-1 inline" /> : a === 'copyEmails' ? <Copy size={12} className="mr-1 inline" /> : null
    const text = a === 'tick' && line.id === 'supply' ? t('obSupplyByHand') : labels[a]
    // tickFee works on the unsaved form, so it stays on while the rest wait for Save.
    return <button key={a} type="button" className={quiet ? ghost : cls} disabled={!!busy || (locked && a !== 'tickFee')} onClick={() => act(line, a)}>{icon}{text}</button>
  }

  const open = result.lines.filter((l) => l.state === 'open')
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <ClipboardCheck size={18} className="text-pra-blue" />
        <h4 className="text-sm font-bold text-pra-navy">{t('obTitle')}</h4>
        <span className={`chip ${result.complete ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
          {result.complete ? t('obAllDone') : t('obProgress', { done: result.total - result.open, total: result.total })}
        </span>
      </div>
      {!result.complete && <p className="mb-2 text-sm text-slate-700"><span className="font-semibold">{t('obStillToDo')}</span> {open.map((l) => { const s = t(l.label); return s.charAt(0).toLowerCase() + s.slice(1) }).join(', ')}.</p>}
      {locked && <p className="mb-2 text-xs font-semibold text-sky-700">{t('obSaveFirst')}</p>}
      <ul className="divide-y divide-sky-100">
        {result.lines.map((line) => (
          <li key={line.id} className={`flex gap-2.5 py-2 ${line.state === 'info' ? 'opacity-80' : ''}`}>
            {ICON[line.state]}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={`text-sm font-semibold ${line.state === 'open' ? 'text-slate-800' : 'text-slate-700'}`}>{t(line.label)}</span>
                {line.state === 'info' && <span className="text-[11px] text-slate-400">{t('obOptional')}</span>}
                <span className="text-sm text-slate-600">{t(line.detail[0], line.detail[1]?.status ? { ...line.detail[1], status: t(line.detail[1].status).toLowerCase() } : line.detail[1])}</span>
              </div>
              {line.notes.map(([k, v], i) => <div key={i} className="text-xs font-semibold text-amber-700">{t(k, v)}</div>)}
              {line.record && <div className="text-xs text-slate-500">{t('obTickedBy', { name: whoName(line.record.by, ctx.teachers, lang) || '?', date: fmtDay(line.record.at, lang) })}</div>}
              {line.id === 'fee' && !!student.is_new && !record.is_new && <div className="text-xs font-semibold text-sky-700">{t('obNotSavedYet')}</div>}
              {line.actions.length > 0 && <div className="mt-1 flex flex-wrap items-center gap-1.5">{line.actions.map((a) => button(line, a))}</div>}
            </div>
          </li>
        ))}
      </ul>
      {result.lines.some((l) => l.id === 'form' && l.state === 'open') && (
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><ExternalLink size={12} /> {t('obFormLink')}</p>
      )}
      {/* Outside the student window's form in the page, so its buttons cannot submit that form. */}
      {supply && createPortal(
        <SupplyCheckModal student={record} teachers={ctx.teachers || []} me={me} t={t} lang={lang} onClose={() => setSupply(false)}
          onDone={async (row, { draft, task, problems }) => {
            if (row) onSaved?.(row)
            await onChanged?.()
            toast([draft ? t('supplyDrafted') : t('supplyComposed'), task && t('supplyTodoAdded', { n: task.number })].filter(Boolean).join(' '))
            if (problems?.length) toast.error(problems.join(' '))
          }} />,
        document.body,
      )}
    </div>
  )
}
