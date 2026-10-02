import { useState } from 'react'
import { Archive, ArchiveRestore, Mail, Trash2 } from 'lucide-react'
import { OFFICE_ACCOUNTS } from '../../data/staff'
import { STAGES, LEAD_PROGRAMS, SOURCES, stageOf, personName, fmtDay, emailsOf, byWaiting } from '../../lib/leads'
import { Field, TextInput, NumberInput, Select, TextArea, Modal } from '../ui'
import { WebMessage } from './WebMessages'

function Section({ title, children }) {
  return (
    <fieldset className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      {title && <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-pra-navy">{title}</legend>}
      {children}
    </fieldset>
  )
}

/**
 * Add or edit one family. `onSave(row)` gets the whole row for a new family and
 * only the changed fields (plus id) for an existing one, so two people editing
 * different things do not undo each other. `onArchive(row, changed)` gets the
 * row as it was opened and the fields changed in the form, so archiving keeps
 * what was just typed. All handlers return promises.
 */
export default function LeadModal({ value, leads, messages = [], onClose, onSave, onArchive, onDelete, t, lang }) {
  const [s, setS] = useState(value)
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setS((cur) => ({ ...cur, [k]: v }))
  const isNew = !s.id
  // Two parents can each have an address: "a@x.com, b@y.com". Either one marks the family as already here.
  const emails = emailsOf(s.email)
  const email = emails.join(', ')
  const dupe = leads.find((l) => l.id !== s.id && emailsOf(l.email).some((e) => emails.includes(e))) || null
  const badEmail = emails.find((e) => !/^[^@]+@[^@]+\.[^@]+$/.test(e))
  const emailHint = dupe ? t('ldEmailTaken', { name: dupe.family }) : badEmail ? t('ldEmailBad', { email: badEmail }) : ''
  const opts = (list) => [{ value: '', label: t('ldNotSet') }, ...list.map((x) => ({ value: x.id, label: lang === 'vi' ? x.vi : x.en }))]
  const hint = (x) => x?.hint?.[lang === 'vi' ? 1 : 0]

  const run = async (fn) => { setBusy(true); try { await fn() } finally { setBusy(false) } }
  const row = { ...s, family: s.family.trim(), email }
  const changed = Object.fromEntries(Object.entries(row).filter(([k, v]) => (v ?? '') !== (value[k] ?? '')))
  const invalid = !s.family.trim() || !!emailHint
  const save = (e) => {
    e?.preventDefault()
    if (invalid) return
    if (isNew) return run(() => onSave(row))
    if (!Object.keys(changed).length) return onClose()
    return run(() => onSave({ id: s.id, ...changed }))
  }

  const stamp = !isNew && [
    s.created_at && s.created_by && t('ldAddedBy', { name: personName(s.created_by, lang), date: fmtDay(s.created_at, lang) }),
    s.updated_at && s.updated_by && t('ldChangedBy', { name: personName(s.updated_by, lang), date: fmtDay(s.updated_at, lang) }),
  ].filter(Boolean).join(', ')

  return (
    <Modal open wide onClose={onClose} title={isNew ? t('ldAdd') : s.family} subtitle={stamp || null}
      footer={<>
        {!isNew && <button type="button" className="btn-danger mr-auto" disabled={busy} onClick={() => run(() => onDelete(s))}><Trash2 size={16} /> {t('delete')}</button>}
        {!isNew && (
          <button type="button" className="btn-secondary" disabled={busy || (invalid && Object.keys(changed).length > 0)} onClick={() => run(() => onArchive(value, changed))}>
            {s.archived ? <><ArchiveRestore size={16} /> {t('ldRestore')}</> : <><Archive size={16} /> {t('ldArchive')}</>}
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button type="submit" form="lead-form" className="btn-primary" disabled={busy || invalid}>{busy ? t('saving') : t('save')}</button>
      </>}>
      <form id="lead-form" onSubmit={save} className="space-y-5">
        <Section>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('ldFamilyName')} hint={t('ldFamilyHint')}><TextInput value={s.family} onChange={set('family')} autoFocus={isNew} required /></Field>
            <Field label={t('email')} hint={emailHint ? <span className="text-red-600">{emailHint}</span> : null}
              right={email && !emailHint ? <a href={`mailto:${emails.join(',')}`} className="inline-flex items-center gap-1 text-pra-blue hover:underline"><Mail size={12} /> {t('email')}</a> : null}>
              <TextInput inputMode="email" autoComplete="off" value={s.email} onChange={set('email')} />
            </Field>
            <Field label={t('phone')}><TextInput type="tel" value={s.phone} onChange={set('phone')} /></Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_7rem]">
            <Field label={t('ldChildrenField')} hint={t('ldChildrenHint')}><TextInput value={s.children} onChange={set('children')} /></Field>
            <Field label={t('ldKids')}><NumberInput value={s.kids} onChange={set('kids')} min={0} max={9} /></Field>
          </div>
        </Section>

        <Section title={t('ldSecInterest')}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('program')} hint={hint(LEAD_PROGRAMS.find((p) => p.id === s.program))}><Select value={s.program} onChange={set('program')} options={opts(LEAD_PROGRAMS)} /></Field>
            <Field label={t('ldTiming')} hint={t('ldTimingHint')}><TextInput value={s.timing} onChange={set('timing')} /></Field>
            <Field label={t('ldSource')} hint={s.source === 'website' ? t('ldWebsiteHint') : null}><Select value={s.source} onChange={set('source')} options={opts(SOURCES)} /></Field>
            <Field label={t('ldColFirst')}><TextInput type="date" value={s.first_contact} onChange={set('first_contact')} /></Field>
          </div>
        </Section>

        <Section title={t('ldSecProgress')}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('ldColStage')} hint={hint(stageOf(s.stage))}>
              <Select value={s.stage} onChange={set('stage')} options={STAGES.map((x) => ({ value: x.id, label: lang === 'vi' ? x.vi : x.en }))} />
            </Field>
            <Field label={t('ldTour')}><TextInput type="date" value={s.tour_date} onChange={set('tour_date')} /></Field>
            <Field label={t('ldOwner')}>
              <Select value={s.owner} onChange={set('owner')} options={[
                { value: '', label: t('ldNobody') },
                ...OFFICE_ACCOUNTS.map((a) => ({ value: a.email, label: a.name })),
                ...(s.owner && !OFFICE_ACCOUNTS.some((a) => a.email === s.owner) ? [{ value: s.owner, label: personName(s.owner, lang) }] : []),
              ]} />
            </Field>
            <Field label={t('ldFollowUp')} hint={t('ldFollowUpHint')}><TextInput type="date" value={s.follow_up} onChange={set('follow_up')} /></Field>
          </div>
          <Field label={t('ldColNext')} hint={t('ldNextHint')} className="mt-3"><TextInput value={s.next_step} onChange={set('next_step')} /></Field>
        </Section>

        <Section title={t('notes')}>
          <Field hint={t('ldNotesHint')}><TextArea rows={3} value={s.notes} onChange={set('notes')} /></Field>
        </Section>

        {messages.length > 0 && (
          <Section title={t('ldSecWeb')}>
            <ul className="space-y-3">
              {[...messages].sort(byWaiting).map((m) => <li key={m.id}><WebMessage m={m} t={t} lang={lang} /></li>)}
            </ul>
          </Section>
        )}
      </form>
    </Modal>
  )
}
