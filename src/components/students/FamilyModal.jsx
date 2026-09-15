import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Field, TextInput, Select, Modal } from '../ui'
import { blankFamily, contactsOf } from '../../lib/studentRecords'

const blankContact = () => ({ name: '', relation: '', email: '', phone: '' })

export default function FamilyModal({ value, onClose, onSave, onDelete, kids = [], t }) {
  const [f, setF] = useState(() => ({ ...blankFamily(), ...value, contacts: contactsOf(value, kids).length ? contactsOf(value, kids) : [blankContact()] }))
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF((cur) => ({ ...cur, [k]: v }))
  const setContact = (i, k) => (v) => setF((cur) => ({ ...cur, contacts: cur.contacts.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }))
  // Stored in English whatever the screen language; unknown old values stay selectable.
  const relationOptions = (cur) => {
    const opts = [{ value: '', label: '—' }, ...['Mother', 'Father', 'Guardian', 'Other'].map((r) => ({ value: r, label: t(r.toLowerCase()) }))]
    return cur && !opts.some((o) => o.value === cur) ? [...opts, { value: cur, label: cur }] : opts
  }

  const save = async (e) => {
    e?.preventDefault()
    if (!f.name.trim()) return
    const contacts = f.contacts.map((c) => ({ ...c, email: c.email.trim(), phone: c.phone.trim(), name: c.name.trim() })).filter((c) => c.name || c.email || c.phone)
    // `email` / `phone` stay filled in because invoices are sent to family.email.
    const email = [...new Set(contacts.map((c) => c.email.toLowerCase()).filter((x) => x.includes('@')))].join(', ')
    const phone = contacts.filter((c) => c.phone).map((c) => (c.relation ? `${c.relation}: ${c.phone}` : c.phone)).join(' | ')
    setBusy(true)
    try { await onSave({ ...f, name: f.name.trim(), contacts, email, phone }) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} wide title={f.id ? f.name : t('addFamily')} subtitle={kids.length ? kids.map((k) => k.nickname || k.full_name).join(', ') : null}
      footer={(<>
        {f.id && onDelete && <button type="button" className="btn-ghost mr-auto text-red-600 hover:bg-red-50" onClick={() => onDelete(f)}><Trash2 size={16} /> {t('delete')}</button>}
        <button type="button" className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button type="submit" form="family-form" className="btn-primary" disabled={busy || !f.name.trim()}>{busy ? t('saving') : t('save')}</button>
      </>)}>
      <form id="family-form" onSubmit={save} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label={t('familyName')} className="sm:col-span-3"><TextInput value={f.name} onChange={set('name')} autoFocus={!f.id} required /></Field>
          <Field label={t('preferredLang')}><Select value={f.language || 'en'} onChange={set('language')} options={[{ value: 'en', label: t('english') }, { value: 'vi', label: t('vietnamese') }]} /></Field>
        </div>
        <div>
          <div className="label">{t('contacts')}</div>
          <div className="space-y-2">
            {f.contacts.map((c, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-2.5 sm:grid-cols-[1.3fr_0.8fr_1.5fr_1.2fr_auto]">
                <TextInput value={c.name} onChange={setContact(i, 'name')} placeholder={t('fullName')} aria-label={t('fullName')} />
                <Select value={c.relation || ''} onChange={setContact(i, 'relation')} options={relationOptions(c.relation)} aria-label={t('relation')} />
                <TextInput type="email" value={c.email} onChange={setContact(i, 'email')} placeholder={t('email')} aria-label={t('email')} />
                <TextInput value={c.phone} onChange={setContact(i, 'phone')} placeholder={t('phone')} aria-label={t('phone')} />
                <button type="button" className="btn-ghost justify-center px-2 text-slate-400 hover:text-red-600" onClick={() => setF((cur) => ({ ...cur, contacts: cur.contacts.filter((_, j) => j !== i) }))} aria-label={t('delete')}><X size={16} /></button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary mt-2 text-xs" onClick={() => setF((cur) => ({ ...cur, contacts: [...cur.contacts, blankContact()] }))}><Plus size={14} /> {t('addContact')}</button>
        </div>
        <Field label={t('notes')}><TextInput value={f.notes} onChange={set('notes')} /></Field>
      </form>
    </Modal>
  )
}
