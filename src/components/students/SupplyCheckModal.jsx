import { useState } from 'react'
import { ExternalLink, FilePen, ListTodo, Users } from 'lucide-react'
import { Modal, Field, TextInput, Segmented } from '../ui'
import { db } from '../../lib/db'
import { createDraft, getToken, gmailConfigured, openComposeWindow, SENDER } from '../../lib/gmail'
import { supplyRecipients, supplyEmail, supplyTodo, HIEN } from '../../lib/supplyCheck'
import { setStep, ChecklistSetupError } from '../../lib/onboarding'
import { todosError } from '../../lib/todos'
import { dayText } from '../../lib/studentDates'

/**
 * The supply check for a new student: shows the email first, then saves it as a Gmail
 * draft for the office to send (the app never sends), adds a To-Do for Hien, and ticks
 * the line on the checklist. `onDone(row)` gets the student as saved.
 */
export default function SupplyCheckModal({ student, teachers, me, onClose, onDone, t, lang: uiLang }) {
  const who = supplyRecipients(student, teachers)
  const sender = me?.name && me.name !== 'Offline admin' ? me.name : ''
  const [lang, setLang] = useState('en')
  const first = supplyEmail(student, { lang, teachers: who.teachers, sender })
  const [to, setTo] = useState(who.to.join(', '))
  const [subject, setSubject] = useState(first.subject)
  const [text, setText] = useState(first.text)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const todo = supplyTodo(student, { teachers: who.teachers, by: me?.email, giver: me?.name })

  // Switching language writes the email again in that language.
  const pickLang = (l) => { const m = supplyEmail(student, { lang: l, teachers: who.teachers, sender }); setLang(l); setSubject(m.subject); setText(m.text) }

  const go = async () => {
    if (!to.trim()) { setErr(t('sendToRequired')); return }
    setBusy(true); setErr('')
    try {
      let draft = null
      if (gmailConfigured) {
        await getToken()
        draft = await createDraft({ to: to.trim(), subject, text })
      } else openComposeWindow({ to: to.trim(), subject, text })
      // The draft is made: from here on, whatever fails is said afterwards, and the window
      // closes, so pressing again does not make a second draft.
      const problems = []
      let task = null
      try { task = await db.todos.save(todo) } catch (e) { problems.push(t('supplyTodoFailed', { error: todosError(e) })) }
      let saved = null
      try { saved = await setStep(db, student, 'supply', true, me?.email, { draft: draft?.id || '', todo: task?.number || '', to: to.trim() }) } catch (e) { problems.push(e instanceof ChecklistSetupError ? t('checklistSetup') : e.message) }
      await onDone?.(saved, { draft, task, problems })
      onClose()
    } catch (e) { setErr(e.message || String(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open wide onClose={onClose} title={t('supplyTitle', { name: student.nickname || student.full_name })} subtitle={t('supplySub')}
      footer={<>
        <button type="button" className="btn-secondary" onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="btn-primary" onClick={go} disabled={busy}>
          {gmailConfigured ? <FilePen size={16} /> : <ExternalLink size={16} />} {busy ? t('saving') : gmailConfigured ? t('supplyGo') : t('supplyGoCompose')}
        </button>
      </>}>
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-700"><Users size={13} /> {t('supplyWho', { level: student.level })}</div>
          {who.teachers.length
            ? <div>{who.teachers.map((x) => `${x.name} (${x.email})`).join(', ')}, Hien ({HIEN})</div>
            : <div className="font-semibold text-amber-700">{t('supplyNoTeachers', { level: student.level })}</div>}
          <div className="mt-1 text-slate-500">{t('supplyWhoHint')}</div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{t('supplyLang')}</span>
          <Segmented value={lang} onChange={pickLang} options={[{ value: 'en', label: 'English' }, { value: 'vi', label: 'Tiếng Việt' }]} />
        </div>
        <div className="grid gap-3">
          <Field label={t('sendTo')} hint={t('sendToHint')}><TextInput value={to} onChange={setTo} /></Field>
          <Field label={t('subject')}><TextInput value={subject} onChange={setSubject} /></Field>
          <Field label={t('body')}><textarea className="input text-sm" rows={11} value={text} onChange={(e) => setText(e.target.value)} /></Field>
        </div>
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          <ListTodo size={15} className="mt-0.5 flex-none text-sky-600" />
          <div>
            <div className="font-semibold">{t('supplyTodoLine')}</div>
            <div>{todo.title}</div>
            <div className="text-sky-700">{t('supplyTodoDue', { date: dayText(todo.due_date, uiLang) })}</div>
          </div>
        </div>
        <p className="text-xs text-slate-500">{t('supplyNeverSends', { from: SENDER })}</p>
        {!gmailConfigured && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{t('supplyNoGmail')}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
        {uiLang === 'vi' && lang === 'en' && <p className="text-xs text-slate-400">{t('supplyLangHint')}</p>}
      </div>
    </Modal>
  )
}
