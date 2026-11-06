import { useEffect, useState } from 'react'
import { KeyRound, Lock, LockOpen, UserPlus } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { useData } from '../../lib/DataContext'
import { fmtDay } from '../../lib/leads'
import { allClasses, inLessonsPilot, useL } from '../../lib/lessons'
import { canHaveLogin, canManageStudent, classForStudent, learnError, makeLogins, notSetUp, resetPin, setLoginActive, signOutWarning, studentLogin } from '../../lib/learn'
import { useToast } from '../../lib/toast'
import CardsWaiting from './CardsWaiting'

/**
 * The student's PRA Learn login, in the student window: the login name and whether it works,
 * and Reset code / Disable / Enable, or Make login. Shown to office, head teachers and the
 * student's teachers only. Make login and Reset code show the card to print.
 * `framed` adds its own rule and heading (the teachers' read-only student window).
 */
export default function LearnLoginLine({ student, framed = false }) {
  const { L, lang } = useL()
  const toast = useToast()
  const { me, isOffice } = useAuth()
  const { teachers } = useData()
  const [acc, setAcc] = useState(undefined) // undefined = loading, null = none
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cards, setCards] = useState([])
  const [printed, setPrinted] = useState(false)
  // PRA Learn logins belong to the Lessons pilot for now (LESSONS_PILOT in lib/lessons.js).
  const allowed = !!student?.id && inLessonsPilot(me?.email) && canManageStudent(me, student)
  const name = (student?.nickname || '').trim() || (student?.first_name || '').trim() || student?.full_name

  useEffect(() => {
    if (!allowed) return undefined
    let on = true
    studentLogin(student.id).then((a) => on && setAcc(a)).catch((e) => { if (on) { setAcc(null); setError(notSetUp(e) ? 'setup' : learnError(e)) } })
    return () => { on = false }
  }, [allowed, student?.id])
  if (!allowed) return null
  if (error === 'setup') return isOffice ? <p className="text-sm text-slate-400">{L('PRA Learn logins are not set up yet.', 'Tài khoản PRA Learn chưa được thiết lập.')}</p> : null

  const run = async (fn) => { setBusy(true); try { await fn() } catch (e) { toast.error(learnError(e)) } finally { setBusy(false) } }
  const showCard = (username, pin) => { setCards([{ student_id: student.id, name, username, pin, group: student.level || '' }]); setPrinted(false) }
  const make = () => run(async () => {
    const cls = classForStudent(me, student, allClasses(teachers))
    if (!cls) throw new Error(L('No class to make the login through.', 'Không có lớp để tạo tài khoản.'))
    const res = await makeLogins(cls, [student.id])
    const m = res.made?.find((x) => x.student_id === student.id)
    if (!m) throw new Error(res.failed?.[0]?.reason || L('No login was made.', 'Chưa tạo được tài khoản.'))
    showCard(m.username, m.pin)
    setAcc(await studentLogin(student.id))
  })
  const reset = () => {
    if (!confirm(L(`Reset ${name}'s secret code to their student number and sign them out of every device?`, `Đặt lại mã bí mật của ${name} về số học viên và đăng xuất em khỏi mọi thiết bị?`))) return
    run(async () => {
      const res = await resetPin(student.id)
      showCard(res.username, res.pin)
      const w = signOutWarning(res, 'reset', L)
      if (w) toast.error(w)
      setAcc(await studentLogin(student.id))
    })
  }
  const toggle = () => {
    const on = !acc.active
    if (!on && !confirm(L(`Disable ${name}'s login? They are signed out and cannot sign in until it is enabled again. Their work is kept.`, `Khóa tài khoản của ${name}? Em sẽ bị đăng xuất và không đăng nhập được cho đến khi mở khóa. Bài đã làm vẫn được giữ.`))) return
    run(async () => {
      const res = await setLoginActive(student.id, on)
      const w = on ? '' : signOutWarning(res, 'disable', L)
      if (w) toast.error(w)
      setAcc(await studentLogin(student.id))
    })
  }

  return (
    <div className={framed ? 'mt-4 space-y-3 border-t border-slate-100 pt-4' : 'space-y-3'}>
      {framed && <div className="text-xs font-bold uppercase tracking-wider text-pra-navy">{L('PRA Learn login', 'Tài khoản PRA Learn')}</div>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {acc === undefined ? <span className="text-slate-400">…</span>
          : error ? <span className="text-red-600">{error}</span>
            : acc ? (<>
              <span className="font-mono text-[15px] font-bold text-sky-800">{acc.username}</span>
              {acc.active ? <span className="chip bg-green-100 text-green-800">{L('Has a login', 'Đã có tài khoản')}</span> : <span className="chip bg-stone-200 text-stone-700">{L('Disabled', 'Đã khóa')}</span>}
              <span className="text-xs text-slate-500">{L(`Code set ${fmtDay(acc.pin_set_at, lang)}${acc.pin_set_by ? ` by ${acc.pin_set_by}` : ''}`, `Đặt mã ngày ${fmtDay(acc.pin_set_at, lang)}${acc.pin_set_by ? `, bởi ${acc.pin_set_by}` : ''}`)}</span>
              <span className="ml-auto flex gap-1.5">
                <button type="button" className="btn-secondary px-2.5 py-1 text-xs" disabled={busy || !acc.active} onClick={reset}><KeyRound size={13} /> {L('Reset code', 'Đặt lại mã')}</button>
                <button type="button" className="btn-ghost px-2.5 py-1 text-xs" disabled={busy} onClick={toggle}>{acc.active ? <><Lock size={13} /> {L('Disable', 'Khóa')}</> : <><LockOpen size={13} /> {L('Enable', 'Mở khóa')}</>}</button>
              </span>
            </>) : (<>
              <span className="text-slate-500">{L('No login yet.', 'Chưa có tài khoản.')}</span>
              {canHaveLogin(student) && <button type="button" className="btn-secondary ml-auto px-2.5 py-1 text-xs" disabled={busy} onClick={make}><UserPlus size={13} /> {busy ? L('Making…', 'Đang tạo…') : L('Make login', 'Tạo tài khoản')}</button>}
            </>)}
      </div>
      <CardsWaiting cards={cards} printed={printed} onPrinted={() => setPrinted(true)} onDone={() => setCards([])} compact />
    </div>
  )
}
