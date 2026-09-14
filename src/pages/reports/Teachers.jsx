import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Plus, Pencil, Trash2, KeyRound } from 'lucide-react'
import { useData } from '../../lib/DataContext'
import { useAuth } from '../../lib/AuthContext'
import { db, dbMode } from '../../lib/db'
import { hasSupabase } from '../../lib/supabaseClient'
import { LEVELS } from '../../lib/fees'
import { Card, Field, TextInput, Select, Checkbox, Modal, Empty, Spinner, Chip } from '../../components/ui'

const blank = () => ({ email: '', name: '', title: 'Mr.', role: 'teacher', subjects: [], homeroom_groups: [], active: true })

// A second, non-persisting client used only to create teacher logins. Signing
// up with the main client would replace the head teacher's own session.
function signupClient() {
  if (!hasSupabase) return null
  return createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
}

// Head teacher only: who can edit which parts of a progress report.
export default function Teachers() {
  const { teachers, reportSettings: settings, loading, refresh } = useData()
  const { isHead, refreshMe } = useAuth()
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!isHead) return <Empty text="Only the head teacher can manage teachers." />
  if (loading || !settings) return <Spinner />

  const save = async (t) => {
    setBusy(true)
    try { await db.teachers.save({ ...t, email: t.email.trim().toLowerCase() }); await refresh(); await refreshMe(); setEditing(null) }
    catch (e) { alert(e.message) } finally { setBusy(false) }
  }
  const remove = async (t) => {
    if (!confirm(`Remove ${t.name} from the teacher list? Their login (if any) stays in Supabase but loses all report editing rights.`)) return
    await db.teachers.remove(t.id); await refresh(); setEditing(null)
  }
  const subjName = (k) => (settings.subjects.find((s) => s.key === k) || { name: k }).name

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto text-2xl font-black text-slate-800">Teachers</h1>
        <button className="btn-green" onClick={() => setEditing(blank())}><Plus size={16} /> Add teacher</button>
      </div>
      <p className="text-sm text-slate-500">Each teacher signs in with the email listed here. They can edit only the learning areas ticked on their row, plus the overview, learner skills and homeroom parts of reports for their homeroom year groups. Head teachers edit everything. Office accounts with the Supabase <code>admin</code> role are head teachers automatically.</p>
      {!teachers.length ? <Empty text="No teachers yet." /> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2">Teacher</th><th>Email</th><th>Role</th><th>Can edit</th><th></th></tr></thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} className={`border-t border-slate-100 ${t.active === false ? 'opacity-50' : ''}`}>
                  <td className="py-2 font-semibold">{t.title} {t.name}</td>
                  <td className="text-slate-600">{t.email}</td>
                  <td>{t.role === 'head' ? <Chip tone="navy">Head teacher</Chip> : <Chip>Teacher</Chip>}</td>
                  <td>
                    <div className="flex flex-wrap gap-1 py-1">
                      {t.role === 'head' ? <Chip tone="green">Everything</Chip> : (<>
                        {(t.subjects || []).map((k) => <Chip key={k} tone="sky">{subjName(k)}</Chip>)}
                        {(t.homeroom_groups || []).map((g) => <Chip key={g} tone="amber">Homeroom · {g === '*' ? 'all' : g}</Chip>)}
                        {!(t.subjects || []).length && !(t.homeroom_groups || []).length && <span className="text-xs text-slate-400">view only</span>}
                      </>)}
                    </div>
                  </td>
                  <td className="text-right"><button className="btn-ghost" onClick={() => setEditing({ ...blank(), ...t })}><Pencil size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit teacher' : 'Add teacher'} wide>
        {editing && <TeacherForm value={editing} onChange={setEditing} settings={settings} onSave={() => save(editing)} onDelete={editing.id ? () => remove(editing) : null} busy={busy} />}
      </Modal>
    </div>
  )
}

function TeacherForm({ value: t, onChange, settings, onSave, onDelete, busy }) {
  const set = (k) => (v) => onChange({ ...t, [k]: v })
  const toggle = (k, item) => (on) => onChange({ ...t, [k]: on ? [...(t[k] || []), item] : (t[k] || []).filter((x) => x !== item) })
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [signupBusy, setSignupBusy] = useState(false)

  const createLogin = async () => {
    const client = signupClient()
    if (!client) { setMsg('Logins can only be created when the app is connected to Supabase.'); return }
    if (!t.email.includes('@') || pw.length < 6) { setMsg('Enter the email above and a temporary password of at least 6 characters.'); return }
    setSignupBusy(true); setMsg('')
    try {
      const { data, error } = await client.auth.signUp({ email: t.email.trim().toLowerCase(), password: pw, options: { data: { name: t.name } } })
      if (error) throw error
      if (data.user && !data.session && data.user.identities?.length === 0) setMsg('An account with this email already exists; the teacher can sign in with their existing password.')
      else if (data.user && !data.session) setMsg('Login created, but Supabase requires email confirmation. Either the teacher confirms via the email they receive, or turn off "Confirm email" under Authentication → Providers → Email.')
      else setMsg(`Login created. ${t.name} can sign in with ${t.email} and the temporary password; ask them to change it later.`)
      setPw('')
    } catch (e) { setMsg(`Could not create the login: ${e.message}. You can create it in Supabase → Authentication → Users instead, with this same email.`) }
    finally { setSignupBusy(false) }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave() }} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Title"><Select value={t.title} onChange={set('title')} options={['Mr.', 'Ms.', 'Mrs.', 'Dr.', ''].map((x) => ({ value: x, label: x || '—' }))} /></Field>
        <Field label="Name" className="sm:col-span-3"><TextInput value={t.name} onChange={set('name')} required placeholder="Alex" /></Field>
        <Field label="Sign-in email" className="sm:col-span-3" hint="Must match their login email exactly. Dashboard short-name accounts use name@science.local."><TextInput type="email" value={t.email} onChange={set('email')} required /></Field>
        <Field label="Role"><Select value={t.role} onChange={set('role')} options={[{ value: 'teacher', label: 'Teacher' }, { value: 'head', label: 'Head teacher' }]} /></Field>
      </div>
      {t.role !== 'head' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="label">Learning areas this teacher may edit</div>
            <div className="grid gap-1.5">
              {settings.subjects.map((s) => <Checkbox key={s.key} checked={(t.subjects || []).includes(s.key)} onChange={toggle('subjects', s.key)} label={`${s.name} (${s.kind})`} />)}
            </div>
          </div>
          <div>
            <div className="label">Homeroom for year groups</div>
            <p className="mb-1 text-xs text-slate-500">Grants the overview, learner skills, homeroom note and experiences parts.</p>
            <div className="grid grid-cols-2 gap-1.5">
              <Checkbox checked={(t.homeroom_groups || []).includes('*')} onChange={toggle('homeroom_groups', '*')} label="All year groups" />
              {LEVELS.map((g) => <Checkbox key={g} checked={(t.homeroom_groups || []).includes(g)} onChange={toggle('homeroom_groups', g)} label={g} />)}
            </div>
          </div>
        </div>
      )}
      <Checkbox checked={t.active !== false} onChange={set('active')} label="Active" />

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-700"><KeyRound size={16} /> Create a login for this teacher</div>
        <p className="mb-2 text-xs text-slate-500">Optional. If the teacher already has a PRA login with this email, skip this. {dbMode === 'local' && 'Not available in offline mode.'}</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Temporary password" className="min-w-[220px]"><TextInput type="text" value={pw} onChange={setPw} autoComplete="new-password" placeholder="at least 6 characters" /></Field>
          <button type="button" className="btn-secondary" disabled={signupBusy || dbMode === 'local'} onClick={createLogin}>Create login</button>
        </div>
        {msg && <p className="mt-2 text-xs text-slate-700">{msg}</p>}
      </div>

      <div className="flex items-center gap-3">
        <span className="flex-1" />
        {onDelete && <button type="button" className="btn-danger" onClick={onDelete}><Trash2 size={16} /> Remove</button>}
        <button className="btn-primary" disabled={busy}>Save teacher</button>
      </div>
    </form>
  )
}
