import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/db'
import { useT } from '../lib/i18n'
import { useAuth } from '../lib/AuthContext'
import { useData } from '../lib/DataContext'
import { useToast } from '../lib/toast'
import { fmtMoment } from '../lib/leads'
import { placeOf, byReceived, birthdayLine, flagsOf, enrollmentError } from '../lib/enrollment'
import { Card, Checkbox, Chip, Empty, PageHeader, SearchInput, Spinner } from '../components/ui'
import EnrollmentModal from '../components/enrollments/EnrollmentModal'

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

async function fetchForms() {
  try { return { forms: await db.enrollments.list(), error: '' } } catch (e) { return { forms: [], error: enrollmentError(e) } }
}

// Enrollment forms parents have sent from pra.edu.vn. Each one arrives by
// itself (the website calls adm_enroll_submit) and adds the child as a pending
// student; here the office reads the answers and marks the form checked.
export default function Enrollments() {
  const { t, lang } = useT()
  const toast = useToast()
  const { isSuper } = useAuth()
  const { students, refresh } = useData()
  const [state, setState] = useState(null)
  const [q, setQ] = useState('')
  const [toCheck, setToCheck] = useState(false)
  const [openId, setOpenId] = useState(null)

  useEffect(() => { let on = true; fetchForms().then((s) => on && setState(s)); return () => { on = false } }, [])
  const forms = state?.forms
  const studentById = useMemo(() => Object.fromEntries((students || []).map((s) => [s.id, s])), [students])
  const put = (row) => setState((st) => ({ ...st, forms: st.forms.map((f) => (f.id === row.id ? row : f)) }))

  const needle = norm(q)
  const waiting = (forms || []).filter((f) => !f.checked_at).length
  const rows = (forms || [])
    .filter((f) => (!toCheck || !f.checked_at)
      && (!needle || [f.student_name, f.parent_name, f.parent_email, f.parent_phone, f.applying_for].some((v) => norm(v).includes(needle))))
    .sort(byReceived)
  const open = (forms || []).find((f) => f.id === openId) || null

  const check = async (f, checked) => {
    try {
      put(await db.enrollments.patch(f.id, { checked_at: checked ? new Date().toISOString() : null }))
      if (checked) setOpenId(null)
    } catch (e) { toast.error(enrollmentError(e)) }
  }
  const makeStudent = async (f) => {
    try {
      await db.enrollments.makeStudent(f.id)
      setState(await fetchForms())
      await refresh?.()
      toast(t('enMade', { name: f.student_name }))
    } catch (e) { toast.error(enrollmentError(e)) }
  }
  const remove = async (f) => {
    if (!confirm(t('enDeleteConfirm', { name: f.student_name }))) return
    try {
      await db.enrollments.remove(f.id)
      setState((st) => ({ ...st, forms: st.forms.filter((x) => x.id !== f.id) })); setOpenId(null); toast(t('deletedName', { name: f.student_name }))
    } catch (e) { toast.error(enrollmentError(e)) }
  }

  if (!forms) return <Spinner />
  const error = state.error

  return (
    <div className="space-y-5">
      <PageHeader title={t('enrollNav')} subtitle={t('enSubtitle')} />

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card className="!p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <SearchInput value={q} onChange={setQ} placeholder={t('enSearch')} className="w-full sm:w-72" />
          <Checkbox checked={toCheck} onChange={setToCheck} label={`${t('enToCheckOnly')} · ${waiting}`} className="px-1" />
          <span className="ml-auto text-xs text-slate-400">{t('enCount', { n: rows.length })}</span>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            {forms.length ? <Empty text={t('noMatches')} /> : <Empty text={t('enNone')}><p className="mt-1">{t('enNoneHint')}</p></Empty>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                  <th className="th pl-4">{t('enColStudent')}</th>
                  <th className="th hidden md:table-cell">{t('enColParent')}</th>
                  <th className="th hidden sm:table-cell">{t('enColReceived')}</th>
                  <th className="th">{t('enColStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => {
                  const place = placeOf(f)
                  const student = studentById[f.student_id]
                  const flags = flagsOf(f, lang)
                  return (
                    <tr key={f.id} className="cursor-pointer border-t border-slate-100 align-top hover:bg-slate-50" onClick={() => setOpenId(f.id)}>
                      <td className="td pl-4">
                        <div className="font-semibold text-slate-800">{f.student_name}</div>
                        <div className="text-xs text-slate-500">{[birthdayLine(f.dob, lang), student?.level].filter(Boolean).join(' · ')}</div>
                        {f.applying_for && <div className="text-xs text-slate-400">{f.applying_for}</div>}
                      </td>
                      <td className="td hidden max-w-[16rem] md:table-cell">
                        <div className="text-slate-700">{f.parent_name}</div>
                        <div className="truncate text-xs text-slate-500">{f.parent_email}</div>
                        <div className="text-xs text-slate-500">{f.parent_phone}</div>
                      </td>
                      <td className="td hidden whitespace-nowrap text-slate-700 sm:table-cell">{fmtMoment(f.submitted_at || f.created_at, lang)}</td>
                      <td className="td">
                        <div className="flex flex-wrap gap-1.5">
                          {!f.checked_at && <Chip tone="amber">{t('enToCheck')}</Chip>}
                          <Chip tone={place === 'added' ? 'green' : place === 'linked' ? 'sky' : 'slate'}>{t(place === 'added' ? 'enAdded' : place === 'linked' ? 'enLinked' : 'enNoStudent')}</Chip>
                          {f.photo_consent === 'private' && <Chip tone="red">{t('enPhotoPrivate')}</Chip>}
                        </div>
                        {(flags.length > 0 || f.data?.health?.allergies) && (
                          <div className="mt-1 max-w-[22rem] text-xs text-slate-500">
                            {[...flags, f.data?.health?.allergies && `${t('enAllergies')}: ${f.data.health.allergies}`].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <EnrollmentModal value={open} student={studentById[open.student_id]} isSuper={isSuper} onClose={() => setOpenId(null)}
          onCheck={check} onMakeStudent={makeStudent} onDelete={remove} t={t} lang={lang} />
      )}
    </div>
  )
}
