import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/db'
import { useT } from '../lib/i18n'
import { Field, TextInput } from '../components/ui'

export default function Login() {
  const { t } = useT()
  const navigate = useNavigate()
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      await auth.signIn(id, pw)
      navigate('/')
    } catch (ex) {
      setErr(ex.message || 'Login failed')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Palm River Academy" className="mx-auto mb-6 h-14" />
        <h1 className="mb-6 text-center text-xl font-bold">{t('appName')}</h1>
        <Field label={t('email')} className="mb-3"><TextInput value={id} onChange={setId} autoFocus autoComplete="username" /></Field>
        <Field label={t('password')} className="mb-5"><TextInput value={pw} onChange={setPw} type="password" autoComplete="current-password" /></Field>
        {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
        <button className="btn-primary w-full justify-center" disabled={busy}>{t('login')}</button>
      </form>
    </div>
  )
}
