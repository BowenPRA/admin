import { useEffect, useState } from 'react'
import { ExternalLink, KeyRound, Lock, LockOpen, RefreshCw, UserPlus } from 'lucide-react'
import { splitSubjectKey } from '../../data/staff'
import { fmtDay } from '../../lib/leads'
import { className, useL } from '../../lib/lessons'
import { LEARN_HOST, classLink, classLogins, learnError, makeLogins, resetPin, setLoginActive, signOutWarning } from '../../lib/learn'
import { useToast } from '../../lib/toast'
import { Modal, Select, Spinner } from '../ui'
import CardsWaiting from './CardsWaiting'

function LoginChip({ login }) {
  const { L } = useL()
  if (login === 'on') return <span className="chip bg-green-100 text-green-800">{L('Has a login', 'Đã có tài khoản')}</span>
  if (login === 'off') return <span className="chip bg-stone-200 text-stone-700">{L('Disabled', 'Đã khóa')}</span>
  return <span className="chip bg-slate-100 text-slate-500">{L('No login', 'Chưa có tài khoản')}</span>
}

/**
 * Student logins for PRA Learn, for one class: who has one, make the missing ones, reset a
 * code, disable and enable, and the login cards, printed straight after.
 * `classes`: the classes the person may pick from (their own; every class for the office).
 * Only office, head teachers and the class's teachers open it (the function checks again).
 */
export default function StudentLogins({ classKey, classes = [], onClose }) {
  const { L, lang } = useL()
  const toast = useToast()
  const [cls, setCls] = useState(classKey || classes[0] || '')
  // The list as last read, for the class it was read for: another class shows the spinner until it loads.
  const [got, setGot] = useState({ cls: null, rows: null, error: '' })
  const [busy, setBusy] = useState('')
  const [cards, setCards] = useState([])
  const [printed, setPrinted] = useState(false)
  const group = splitSubjectKey(cls)[1] || ''
  const rows = got.cls === cls ? got.rows : null
  const error = got.cls === cls ? got.error : ''

  const load = (k) => classLogins(k).then((r) => ({ cls: k, rows: r, error: '' })).catch((e) => ({ cls: k, rows: [], error: learnError(e) }))
  useEffect(() => {
    if (!cls) return undefined
    let on = true
    load(cls).then((g) => on && setGot(g))
    return () => { on = false }
  }, [cls])
  const reload = () => load(cls).then(setGot)

  // New cards join any still waiting; a second card for the same child replaces the first.
  const addCards = (list) => {
    setCards((cur) => [...cur.filter((c) => !list.some((n) => n.student_id === c.student_id)), ...list.map((c) => ({ ...c, group }))])
    setPrinted(false)
  }
  const run = async (key, fn) => {
    setBusy(key)
    try { await fn() } catch (e) { toast.error(learnError(e)) } finally { setBusy('') }
  }
  const without = (rows || []).filter((r) => r.login === 'none')
  const make = (ids) => run(ids?.length === 1 ? ids[0] : 'make', async () => {
    const res = await makeLogins(cls, ids)
    if (res.made?.length) addCards(res.made)
    if (res.failed?.length) toast.error(L(`Not made: ${res.failed.map((f) => `${f.name} (${f.reason})`).join(', ')}`, `Chưa tạo được: ${res.failed.map((f) => `${f.name} (${f.reason})`).join(', ')}`))
    else if (!res.made?.length) toast(L('Everyone already has a login.', 'Tất cả học viên đã có tài khoản.'))
    await reload()
  })
  const reset = (r) => {
    if (!confirm(L(`Reset ${r.name}'s secret code to their student number and sign them out of every device?`, `Đặt lại mã bí mật của ${r.name} về số học viên và đăng xuất em khỏi mọi thiết bị?`))) return
    run(r.id, async () => {
      const res = await resetPin(r.id)
      addCards([{ student_id: r.id, name: r.name, username: res.username, pin: res.pin }])
      const w = signOutWarning(res, 'reset', L)
      if (w) toast.error(`${r.name}: ${w}`)
    })
  }
  const toggle = (r) => {
    const on = r.login === 'off'
    if (!on && !confirm(L(`Disable ${r.name}'s login? They are signed out and cannot sign in until it is enabled again. Their work is kept.`, `Khóa tài khoản của ${r.name}? Em sẽ bị đăng xuất và không đăng nhập được cho đến khi mở khóa. Bài đã làm vẫn được giữ.`))) return
    run(r.id, async () => {
      const res = await setLoginActive(r.id, on)
      const w = on ? '' : signOutWarning(res, 'disable', L)
      if (w) { toast.error(`${r.name}: ${w}`); await reload(); return }
      toast(on ? L(`${r.name}: login enabled`, `${r.name}: đã mở khóa`) : L(`${r.name}: login disabled`, `${r.name}: đã khóa`)); await reload() })
  }
  const close = () => {
    if (cards.length && !printed && !confirm(L('These cards have not been printed. Close anyway? A card can be printed again later with Reset code.', 'Các thẻ này chưa được in. Vẫn đóng? Sau này thầy cô có thể in lại thẻ bằng nút Đặt lại mã.'))) return
    onClose()
  }
  const has = (rows || []).filter((r) => r.login !== 'none').length

  return (
    <Modal open wide onClose={close} title={L('Student logins', 'Tài khoản học viên')}
      subtitle={<>{L('For PRA Learn', 'Cho PRA Learn')}, <a href={`https://${LEARN_HOST}`} target="_blank" rel="noreferrer" className="font-semibold text-pra-blue hover:underline">{LEARN_HOST}</a></>}
      footer={<button type="button" className="btn-primary" onClick={close}>{L('Close', 'Đóng')}</button>}>
      <div className="space-y-4">
        {classes.length > 1 && (
          <label className="block sm:max-w-xs">
            <span className="label">{L('Class', 'Lớp')}</span>
            <Select value={cls} onChange={(v) => { if (!cards.length || printed || confirm(L('These cards have not been printed. Switch class anyway?', 'Các thẻ này chưa được in. Vẫn đổi lớp?'))) { setCls(v); setCards([]) } }}
              options={classes.map((k) => ({ value: k, label: className(k, lang) }))} />
          </label>
        )}

        <CardsWaiting cards={cards} printed={printed} onPrinted={() => setPrinted(true)} onDone={() => setCards([])} />

        <p className="text-sm text-slate-600">
          {L(`Each student has one login for every class. A login made here works in all of ${group}'s classes. Students sign in with their nickname and their student number as a 3-digit secret code (S0024 → 024), as on the old Dashboard. Print the cards after making the logins; a lost card can be printed again with Reset code.`,
            `Mỗi học viên có một tài khoản dùng cho mọi lớp. Tài khoản tạo ở đây dùng được cho tất cả các lớp ${group}. Học viên đăng nhập bằng tên thường gọi và mã bí mật là số học viên (3 chữ số, S0024 → 024), giống Dashboard cũ. Thầy cô in thẻ sau khi tạo tài khoản; mất thẻ thì in lại bằng nút Đặt lại mã.`)}
        </p>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {!rows ? <Spinner /> : !error && (
          <section className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2.5">
              <h4 className="text-[15px] font-bold text-slate-800">{className(cls, lang)}</h4>
              <span className="text-sm text-slate-500">{L(`${has} of ${rows.length} have a login`, `${has}/${rows.length} học viên có tài khoản`)}</span>
              <span className="ml-auto flex flex-wrap gap-2">
                {without.length > 0 && (
                  <button type="button" className="btn-primary" disabled={!!busy} onClick={() => make(without.map((r) => r.id))}>
                    <UserPlus size={15} /> {busy === 'make' ? L('Making…', 'Đang tạo…') : without.length === rows.length ? L(`Make logins for all ${rows.length}`, `Tạo tài khoản cho cả ${rows.length} em`) : L(`Make logins for the ${without.length} without one`, `Tạo tài khoản cho ${without.length} em chưa có`)}
                  </button>
                )}
                <a href={classLink(cls)} target="_blank" rel="noreferrer" className="btn-secondary"><ExternalLink size={14} /> {L('Class page on PRA Learn', 'Trang lớp trên PRA Learn')}</a>
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500">{L(`No enrolled or Pending students in ${group}.`, `Không có học viên đang học hoặc đang chờ ở ${group}.`)}</p>
            ) : (
              <ul>
                {rows.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 px-3 py-2.5 last:border-0">
                    <div className="min-w-0 flex-1 basis-40">
                      <div className="truncate text-[15px] font-semibold text-slate-900">{r.name}</div>
                      {r.full_name && r.full_name !== r.name && <div className="truncate text-xs text-slate-500">{r.full_name}</div>}
                    </div>
                    <div className="w-28 flex-none font-mono text-sm font-bold text-sky-800">{r.username || <span className="font-sans font-normal text-slate-300">—</span>}</div>
                    <div className="w-32 flex-none"><LoginChip login={r.login} /></div>
                    <div className="w-32 flex-none text-xs text-slate-500">{r.login !== 'none' && (r.last_seen ? L(`Last signed in ${fmtDay(r.last_seen, lang)}`, `Đăng nhập gần nhất ${fmtDay(r.last_seen, lang)}`) : L('Not signed in yet', 'Chưa đăng nhập'))}</div>
                    <div className="ml-auto flex flex-none justify-end gap-1.5 sm:w-48">
                      {r.login === 'none' ? (
                        <button type="button" className="btn-secondary px-2.5 py-1 text-xs" disabled={!!busy} onClick={() => make([r.id])}><UserPlus size={13} /> {busy === r.id ? L('Making…', 'Đang tạo…') : L('Make login', 'Tạo tài khoản')}</button>
                      ) : (<>
                        <button type="button" className="btn-secondary px-2.5 py-1 text-xs" disabled={!!busy || r.login === 'off'} onClick={() => reset(r)} title={r.login === 'off' ? L('Enable the login first', 'Mở khóa tài khoản trước') : ''}><KeyRound size={13} /> {L('Reset code', 'Đặt lại mã')}</button>
                        <button type="button" className="btn-ghost px-2.5 py-1 text-xs" disabled={!!busy} onClick={() => toggle(r)}>
                          {r.login === 'off' ? <><LockOpen size={13} /> {L('Enable', 'Mở khóa')}</> : <><Lock size={13} /> {L('Disable', 'Khóa')}</>}
                        </button>
                      </>)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {rows && !error && (
          <button type="button" className="btn-ghost text-xs text-slate-500" onClick={reload}><RefreshCw size={13} /> {L('Refresh', 'Tải lại')}</button>
        )}
      </div>
    </Modal>
  )
}
