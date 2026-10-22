import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, Eye, LoaderCircle, Mail, RefreshCw, RotateCcw, Save } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { listTemplates, saveTemplate, listMail, mailerStatus, withAge, retryMail, openMail, gmailLink, DEFAULT_TEMPLATES, MAIL_KINDS, MAIL_STATUS } from '../lib/mail'
import { fmtMoment } from '../lib/leads'
import { useL } from '../components/newsletter/bits'
import { FamilyTab, OfficeTab, MailerLine } from '../components/mail/MailParts'
import { Card, Chip, PageHeader, SearchInput, Segmented, Spinner } from '../components/ui'

const WORDING = ['enroll_family', 'web_family', 'office']
const TABS = ['outbox', ...WORDING]
const strip = (t) => (t ? Object.fromEntries(Object.entries(t).filter(([k]) => !['updated_by', 'updated_at'].includes(k))) : t)

/** Which emails a filter shows. */
const FILTERS = [
  { id: 'all', en: 'All', vi: 'Tất cả', test: () => true },
  { id: 'family', en: 'To families', vi: 'Gửi gia đình', test: (r) => r.kind.endsWith('_family') },
  { id: 'office', en: 'Office alerts', vi: 'Thông báo văn phòng', test: (r) => r.kind.endsWith('_office') || r.kind === 'notice' },
  { id: 'newsletter', en: 'Newsletters', vi: 'Bản tin', test: (r) => r.kind === 'newsletter' || r.kind === 'test' },
  { id: 'problems', en: 'Not sent', vi: 'Chưa gửi', test: (r) => ['failed', 'skipped'].includes(r.status) },
]

/** Where in The Current an email's subject lives: the form, the website message, the issue. */
const placeOf = (r) => (r.kind.startsWith('enroll_') ? `/enrollments?form=${r.ref_id}`
  : r.kind.startsWith('web_') ? '/leads'
    : ['newsletter', 'test', 'notice'].includes(r.kind) && r.ref_id ? `/newsletter/${r.ref_id}` : null)

/**
 * Every email The Current sends by itself (supabase/updates-2026-10-22-mail.sql): the
 * outbox with whether the mailer script in admin@ is running, the wording of the two
 * thank-yous, and who gets the office alerts. ?tab= opens a tab.
 */
export default function Emails() {
  const { L, lang } = useL()
  const toast = useToast()
  const { isOffice } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'outbox'
  const [tpls, setTpls] = useState(null)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listTemplates().then((t) => { setTpls(t); setDraft(structuredClone(t)) }).catch((e) => setError(e.message))
  }, [])
  const dirty = tpls && draft && WORDING.some((k) => JSON.stringify(strip(draft[k])) !== JSON.stringify(strip(tpls[k])))
  const setTab = (t) => {
    if (dirty && WORDING.includes(tab) && t !== tab && !confirm(L('Leave without saving the wording?', 'Rời đi mà không lưu nội dung?'))) return
    if (dirty && WORDING.includes(tab)) setDraft(structuredClone(tpls))
    setParams(t === 'outbox' ? {} : { tab: t }, { replace: true })
  }
  const save = async () => {
    setSaving(true)
    try {
      const out = { ...tpls }
      for (const k of WORDING) {
        if (JSON.stringify(strip(draft[k])) !== JSON.stringify(strip(tpls[k]))) out[k] = await saveTemplate(k, draft[k])
      }
      setTpls(out); setDraft(structuredClone(out))
      toast(L('Saved. Forms from now on use the new wording.', 'Đã lưu. Các đơn từ bây giờ dùng nội dung mới.'))
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }
  const set = (key, fn) => setDraft((d) => ({ ...d, [key]: fn(structuredClone(d[key] || DEFAULT_TEMPLATES[key])) }))

  return (
    <div className="space-y-5">
      <PageHeader title={L('Emails', 'Email')}
        subtitle={L('What The Current sends by itself from admin@: a thank-you to each family who sends a form on pra.edu.vn, an alert to the office, scheduled newsletters and their tests.', 'Những email The Current tự gửi từ admin@: thư cảm ơn mỗi gia đình gửi đơn trên pra.edu.vn, thông báo cho văn phòng, bản tin đã hẹn giờ và email gửi thử.')}>
        {WORDING.includes(tab) && isOffice && <button className="btn-primary" disabled={!dirty || saving} onClick={save}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}{L('Save the wording', 'Lưu nội dung')}</button>}
      </PageHeader>
      <Segmented value={tab} onChange={setTab} options={[
        { value: 'outbox', label: L('Outbox', 'Hộp thư đi') },
        { value: 'enroll_family', label: L('Enrollment thank-you', 'Cảm ơn: đơn đăng ký') },
        { value: 'web_family', label: L('Tour and contact thank-you', 'Cảm ơn: đặt lịch, liên hệ') },
        { value: 'office', label: L('Office alerts', 'Thông báo văn phòng') },
      ]} />
      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {tab === 'outbox' ? <Outbox L={L} lang={lang} toast={toast} />
        : !draft ? (!error && <Spinner />)
          : <Card>{tab === 'office'
            ? <OfficeTab value={draft.office || DEFAULT_TEMPLATES.office} onChange={(fn) => set('office', fn)} L={L} readOnly={!isOffice} />
            : <FamilyTab k={tab} value={draft[tab] || DEFAULT_TEMPLATES[tab]} onChange={(fn) => set(tab, fn)} L={L} readOnly={!isOffice} />}</Card>}
    </div>
  )
}

/** The latest emails, newest first, and whether the mailer is checking in. Reads again every minute. */
function Outbox({ L, lang, toast }) {
  const [state, setState] = useState(null)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(100)
  const [loading, setLoading] = useState(false)
  const fetchAll = (n) => Promise.all([listMail({ limit: n }), mailerStatus().catch(() => null)])
    .then(([rows, status]) => ({ rows, status: withAge(status), error: '', full: rows.length < n }))
  const keep = (e) => (s) => ({ rows: s?.rows || [], status: s?.status || null, error: e.message })
  const load = () => {
    setLoading(true)
    return fetchAll(limit).then(setState).catch((e) => setState(keep(e))).finally(() => setLoading(false))
  }
  useEffect(() => {
    let on = true
    const go = () => fetchAll(limit).then((s) => on && setState(s)).catch((e) => on && setState(keep(e)))
    go()
    const t = setInterval(go, 60000)
    return () => { on = false; clearInterval(t) }
  }, [limit])

  if (!state) return <Spinner />
  const retry = async (r) => { try { await retryMail(r.id); toast(L('It goes within five minutes.', 'Email sẽ đi trong vòng năm phút.')); load() } catch (e) { toast.error(e.message) } }
  const see = async (r) => { try { await openMail(r.id) } catch (e) { toast.error(e.message) } }
  const needle = q.trim().toLowerCase()
  const f = FILTERS.find((x) => x.id === filter) || FILTERS[0]
  const rows = state.rows.filter((r) => f.test(r) && (!needle || [r.subject, r.to_addr, r.bcc_addr, r.error].some((v) => String(v || '').toLowerCase().includes(needle))))
  const count = (id) => state.rows.filter(FILTERS.find((x) => x.id === id).test).length
  const waiting = state.rows.filter((r) => ['ready', 'sending', 'waiting'].includes(r.status)).length

  return (
    <div className="space-y-4">
      <MailerLine status={state.status} L={L} />
      {state.error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
      <Card className="!p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <SearchInput value={q} onChange={setQ} placeholder={L('Address, subject…', 'Địa chỉ, tiêu đề…')} className="w-full sm:w-64" />
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((x) => {
              const n = x.id === 'all' ? state.rows.length : count(x.id)
              return (
                <button key={x.id} type="button" aria-pressed={filter === x.id} onClick={() => setFilter(x.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${filter === x.id ? 'bg-pra-navy text-white ring-pra-navy' : x.id === 'problems' && n ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'}`}>
                  {L(x.en, x.vi)} · {n}
                </button>
              )
            })}
          </div>
          <span className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            {waiting > 0 && <Chip tone="sky">{L(`${waiting} waiting`, `${waiting} đang chờ`)}</Chip>}
            <button type="button" className="btn-ghost text-xs" disabled={loading} onClick={() => load()}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{L('Refresh', 'Tải lại')}</button>
          </span>
        </div>
        {!rows.length
          ? <p className="p-8 text-center text-sm text-slate-400">{state.rows.length ? L('No emails match.', 'Không có email nào khớp.') : L('No emails yet. They show here as forms arrive and newsletters are scheduled.', 'Chưa có email nào. Email sẽ hiện ở đây khi có đơn gửi đến hoặc bản tin được hẹn giờ.')}</p>
          : (
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => {
                const st = MAIL_STATUS[r.status] || MAIL_STATUS.ready
                const place = placeOf(r)
                const when = r.status === 'sent' ? r.sent_at : ['ready', 'waiting'].includes(r.status) ? r.send_at : r.created_at
                return (
                  <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Chip tone={st.tone}>{L(st.en, st.vi)}</Chip>
                        <span className="text-xs font-semibold text-slate-500">{L(MAIL_KINDS[r.kind]?.en, MAIL_KINDS[r.kind]?.vi)}</span>
                        <span className="text-xs text-slate-400">{['ready', 'waiting'].includes(r.status) && new Date(when) > new Date() ? L(`goes ${fmtMoment(when, lang)}`, `gửi ${fmtMoment(when, lang)}`) : fmtMoment(when, lang)}</span>
                      </div>
                      <div className="truncate font-semibold text-slate-800">{r.subject || '—'}</div>
                      <div className="truncate text-xs text-slate-500">{[r.to_addr, r.bcc_addr && `Bcc ${r.bcc_addr}`].filter(Boolean).join(' · ')}</div>
                      {r.error && r.status !== 'sent' && <div className="text-xs text-red-700">{r.error}</div>}
                    </div>
                    <div className="flex flex-none flex-wrap gap-1.5">
                      {place && <Link className="btn-ghost text-xs" to={place}><ArrowUpRight size={14} />{L('Open', 'Mở')}</Link>}
                      {r.subject && <button className="btn-ghost text-xs" onClick={() => see(r)}><Eye size={14} />{L('See', 'Xem')}</button>}
                      {r.message_id && <a className="btn-ghost text-xs" href={gmailLink(r.message_id)} target="_blank" rel="noreferrer"><Mail size={14} />Gmail</a>}
                      {['failed', 'skipped'].includes(r.status) && r.subject && <button className="btn-secondary text-xs" onClick={() => retry(r)}><RotateCcw size={14} />{L('Send again', 'Gửi lại')}</button>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        {!state.full && <div className="border-t border-slate-100 p-3 text-center"><button className="btn-ghost text-sm" onClick={() => setLimit((n) => n + 200)}>{L('Show older emails', 'Xem email cũ hơn')}</button></div>}
      </Card>
    </div>
  )
}
