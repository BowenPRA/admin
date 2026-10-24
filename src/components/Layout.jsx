import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FileText, Users, Settings, LogOut, Home, Database, ClipboardList, GraduationCap, CalendarCheck, CalendarDays, KeyRound, ChevronsUpDown, Eye, Images, Sprout, FileSignature, FileCheck, BookMarked, ListTodo, Newspaper, Shapes, Menu, X, ChevronsLeft, ChevronsRight, Mail, Signature, ChartColumn } from 'lucide-react'
import { useT } from '../lib/i18n'
import { auth, dbMode } from '../lib/db'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { academicCalendar } from '../lib/newsletter/calendarFeed'
import { runsEca } from '../lib/eca'
import { ACCESS_ROLES, hasLogin } from '../data/staff'
import { Avatar, Chip, Field, Modal, TextInput } from './ui'

// The menu down the left. The first pages stand alone; the rest sit under a heading
// (Teaching for everyone, Office and Outreach for office accounts, Setup at the foot),
// so every page you can open is always in view. A section with no page you can see is
// left out. A new page (the newsletter, say) goes into a section's `pages`.
// On a phone or a tablet the same menu slides in from the menu button at the top.
const NAV = [
  { id: 'main', pages: [
    { to: '/', icon: Home, label: 'homeNav', end: true },
    { to: '/students', icon: Users, label: 'students' },
    { to: '/attendance', icon: CalendarCheck, label: 'attendance' },
    // ECAs: the office, and teachers who run an ECA this term.
    { to: '/eca', icon: Shapes, label: 'ecaNav', who: 'eca' },
    { to: '/todo', icon: ListTodo, label: 'todoNav', who: 'office' },
  ] },
  { id: 'teaching', label: 'navTeaching', pages: [
    { to: '/reports', icon: ClipboardList, label: 'reportsNav' },
    { to: '/schedule', icon: CalendarDays, label: 'schedule' },
    { to: '/assessments', icon: FileCheck, label: 'asNav' },
    // Teachers write their class corner here; the office has the Newsletter under Outreach.
    { to: '/newsletter', icon: Newspaper, label: 'nlNav', who: 'teacher' },
  ] },
  { id: 'office', label: 'navOffice', pages: [
    { to: '/invoices', icon: FileText, label: 'invoices', who: 'office' },
    { to: '/leads', icon: Sprout, label: 'leadsNav', who: 'office' },
    { to: '/enrollments', icon: FileSignature, label: 'enrollNav', who: 'office' },
    // What The Current emails by itself: the outbox, the thank-you wording, the office alerts.
    { to: '/emails', icon: Mail, label: 'emailsNav', who: 'office' },
  ] },
  { id: 'outreach', label: 'navOutreach', pages: [
    { to: '/photos', icon: Images, label: 'photos', who: 'office' },
    { to: '/newsletter', icon: Newspaper, label: 'nlNav', who: 'office' },
    // Visitors to pra.edu.vn, from Cloudflare Web Analytics (supabase/functions/web-stats).
    { to: '/website', icon: ChartColumn, label: 'webNav', who: 'office' },
  ] },
  { id: 'setup', label: 'navSetup', foot: true, pages: [
    { to: '/settings', icon: Settings, label: 'settings', who: 'office' },
    // Everyone's signatures for office accounts and head teachers; a teacher signs their own.
    { to: '/signatures', icon: Signature, label: 'sigNav', who: 'staff' },
    { to: '/teachers', icon: GraduationCap, label: 'teachers', who: 'head' },
    { to: '/handbook', icon: BookMarked, label: 'handbookNav', who: 'office' },
  ] },
]
const under = (pathname, to) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`))

// On a laptop the menu can shrink to a strip of icons. Each device remembers the choice;
// until one is made, the menu starts narrow on screens under 1100 pixels.
const NARROW_KEY = 'pra-admin-nav-narrow'
const readNarrow = () => { try { const v = localStorage.getItem(NARROW_KEY); return v === null ? null : v === '1' } catch { return null } }
const ROOMY = '(min-width: 1100px)'
const WIDE_NAV = '240px'
const NARROW_NAV = '72px'

// From 8:00 to 9:00 on a class day (Monday to Friday, and not a day off on the academic
// calendar), Attendance in the menu glows so the morning register is not forgotten.
// It goes by the clock of the computer or phone, so it starts and stops without a reload.
const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function useRegisterHour() {
  const [now, setNow] = useState(() => new Date())
  const [offDays, setOffDays] = useState(null)
  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = setInterval(tick, 30000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])
  const hour = now.getDay() >= 1 && now.getDay() <= 5 && now.getHours() === 8
  // The calendar is only fetched inside the hour; until it is in, nothing glows.
  useEffect(() => {
    if (hour && !offDays) academicCalendar().then((events) => setOffDays(events.filter((e) => e.tag === 'off')))
  }, [hour, offDays])
  const day = localIso(now)
  return hour && !!offDays && !offDays.some((e) => day >= e.iso && day <= (e.end || e.iso))
}

export default function Layout() {
  const { t, lang, setLang } = useT()
  const navigate = useNavigate()
  const data = useData()
  const { isHead, isOffice, displayName, me, viewAs, setViewAs } = useAuth()
  const [menu, setMenu] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [tip, setTip] = useState(null)
  const [narrowPref, setNarrowPref] = useState(readNarrow)
  const [roomy, setRoomy] = useState(() => typeof window === 'undefined' || window.matchMedia(ROOMY).matches)
  const { pathname } = useLocation()
  const headerRef = useRef(null)
  const closeRef = useRef(null)
  const openRef = useRef(null)

  const can = { all: true, office: isOffice, head: isHead, teacher: !isOffice, eca: isOffice || isHead || runsEca(data.eca, me?.email), staff: isOffice || isHead || !!me?.linked }
  const nav = NAV.map((s) => ({ ...s, pages: s.pages.filter((p) => can[p.who || 'all']) })).filter((s) => s.pages.length)
  const current = nav.flatMap((s) => s.pages).find((p) => under(pathname, p.to))
  const narrow = narrowPref ?? !roomy
  const registerHour = useRegisterHour()
  const role = ACCESS_ROLES[me?.access] || ACCESS_ROLES.viewer
  const roleLabel = lang === 'vi' ? role.label_vi : role.label

  useEffect(() => {
    const m = window.matchMedia(ROOMY)
    const f = () => setRoomy(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])

  const toggleNarrow = () => {
    const v = !narrow
    setNarrowPref(v)
    setTip(null)
    setMenu(false)
    try { localStorage.setItem(NARROW_KEY, v ? '1' : '0') } catch { /* ignore */ }
  }

  // A new page closes the phone menu, the account menu and any label left showing.
  const [seenPath, setSeenPath] = useState(pathname)
  if (seenPath !== pathname) { setSeenPath(pathname); setDrawer(false); setMenu(false); setTip(null) }

  // The browser tab shows the page you are on.
  const title = current && current.to !== '/' ? `${t(current.label)} · ${t('appName')}` : `${t('appName')} · Palm River Academy`
  useEffect(() => { document.title = title }, [title])

  // Pages with their own sticky parts sit below the header using --header-h. On a laptop
  // the header holds only the amber or red band, when there is one, so it is often 0.
  useEffect(() => {
    const el = headerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // On a short screen the menu scrolls; keep the current page in view.
  useEffect(() => {
    document.querySelectorAll('nav[data-side-nav]').forEach((list) => {
      const a = list.querySelector('[aria-current="page"]')
      if (!a) return
      const r = a.getBoundingClientRect()
      const n = list.getBoundingClientRect()
      if (r.top < n.top || r.bottom > n.bottom) list.scrollTop += r.top - n.top - (n.height - r.height) / 2
    })
  }, [pathname, narrow, drawer, isOffice, isHead])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  // The phone menu: Escape closes it, the page behind does not scroll, focus goes back to the button.
  useEffect(() => {
    if (!drawer) return
    closeRef.current?.focus()
    const opener = openRef.current
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(false) }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', onKey); opener?.focus() }
  }, [drawer])

  // In the narrow menu each icon names itself when pointed at or tabbed to.
  const tipFor = (rail, label) => {
    if (!rail) return {}
    const show = (e) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ label, top: r.top + r.height / 2 }) }
    const hide = () => setTip(null)
    return { 'aria-label': label, onMouseEnter: show, onFocus: show, onMouseLeave: hide, onBlur: hide }
  }

  // A small amber dot with a ripple: the register is due.
  const ping = (cls) => (
    <span className={`pointer-events-none absolute flex h-2.5 w-2.5 ${cls}`}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75 motion-reduce:animate-none" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
    </span>
  )

  const link = (p, rail) => {
    // Attendance during the register hour: amber and pulsing until you open it, then the
    // usual blue with the "by 9:00" tag still showing.
    const due = registerHour && p.to === '/attendance'
    const label = due ? `${t(p.label)} · ${t('navRegisterBy')}` : t(p.label)
    return (
      <NavLink to={p.to} end={p.end} {...tipFor(rail, label)} title={due && !rail ? t('navRegisterTip') : undefined}
        className={({ isActive }) => `group relative flex h-9 items-center gap-3 rounded-lg text-sm font-semibold transition-colors ${rail ? 'justify-center' : 'px-3'} ${isActive ? 'bg-pra-blue/10 text-pra-navy' : due ? 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-300 hover:bg-amber-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
        {({ isActive }) => (<>
          {isActive && <span className={`absolute inset-y-1.5 w-[3px] rounded-r-full bg-pra-blue ${rail ? '-left-2' : '-left-3'}`} />}
          {due && !isActive && <span className="nav-nudge pointer-events-none absolute inset-0 rounded-lg" />}
          <p.icon size={18} strokeWidth={isActive || due ? 2.25 : 2} className={`flex-none ${isActive ? 'text-pra-blue' : due ? 'text-amber-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
          {!rail && <span className="truncate">{t(p.label)}</span>}
          {due && !rail && <span className={`ml-auto flex-none rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${isActive ? 'bg-pra-blue/15 text-pra-navy' : 'bg-amber-500 text-white'}`}>{t('navRegisterBy')}</span>}
          {due && rail && !isActive && ping('right-2.5 top-1.5')}
        </>)}
      </NavLink>
    )
  }

  const langSwitch = (
    <div className="grid flex-1 grid-cols-2 rounded-lg bg-slate-100 p-0.5 text-xs font-bold" role="group" aria-label={t('language')}>
      {[['en', 'English'], ['vi', 'Tiếng Việt']].map(([k, label]) => (
        <button key={k} type="button" aria-pressed={lang === k} onClick={() => setLang(k)}
          className={`rounded-md py-1.5 transition-colors ${lang === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{label}</button>
      ))}
    </div>
  )

  const railButton = 'flex h-9 w-full items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900'

  const account = (rail) => me && (
    <div className="relative">
      <button type="button" aria-expanded={menu} aria-haspopup="menu" {...tipFor(rail && !menu, displayName)}
        className={`flex w-full items-center gap-2.5 rounded-xl transition-colors hover:bg-slate-100 ${menu ? 'bg-slate-100' : ''} ${rail ? 'justify-center p-1.5' : 'px-2 py-1.5'}`}
        onClick={(e) => { e.stopPropagation(); setTip(null); setMenu((v) => !v) }}>
        <Avatar name={me.name} size={32} />
        {!rail && (<>
          <span className="min-w-0 flex-1 text-left leading-tight">
            <span className="block truncate text-sm font-semibold text-slate-800">{displayName}</span>
            <span className="block truncate text-xs text-slate-400">{roleLabel}</span>
          </span>
          <ChevronsUpDown size={15} className="flex-none text-slate-400" />
        </>)}
      </button>
      {menu && (
        <div role="menu" className={`modal-in absolute z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ${rail ? 'bottom-0 left-full ml-3 w-64' : 'inset-x-0 bottom-full mb-2'}`} onClick={(e) => e.stopPropagation()}>
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-xs text-slate-400">{t('signedInAs')}</div>
            <div className="truncate text-sm font-semibold text-slate-800">{me.email || displayName}</div>
            <div className="mt-1.5"><Chip tone={role.tone}>{roleLabel}</Chip></div>
            <p className="mt-1.5 text-xs text-slate-500">{role.summary}</p>
          </div>
          {auth.enabled && <button role="menuitem" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50" onClick={() => { setMenu(false); setPwOpen(true) }}><KeyRound size={16} className="text-slate-500" /> {t('changePassword')}</button>}
          {auth.enabled && <button role="menuitem" className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50" onClick={async () => { await auth.signOut(); navigate('/login') }}><LogOut size={16} /> {t('logout')}</button>}
          {dbMode === 'local' && <ViewAsPicker teachers={data?.teachers || []} viewAs={viewAs} setViewAs={(v) => { setViewAs(v); setMenu(false); navigate('/') }} />}
        </div>
      )}
    </div>
  )

  // The menu itself: the same for the laptop side bar (wide or narrow) and the phone drawer.
  const sidebar = (rail, inDrawer) => (
    <div className="flex h-full flex-col">
      <div className="h-[3px] flex-none bg-gradient-to-r from-pra-green via-pra-lime to-pra-sky" />
      <div className={`flex h-16 flex-none items-center ${rail ? 'justify-center' : 'gap-2 pl-4 pr-3'}`}>
        <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-lg" {...tipFor(rail, t('homeNav'))}>
          <Mark size={34} />
          {!rail && (
            <span className="min-w-0 leading-tight">
              <span className="block text-base font-black tracking-tight text-slate-800">{t('appName')}</span>
              <span className="block truncate text-[11px] font-semibold text-slate-400">Palm River Academy</span>
            </span>
          )}
        </Link>
        {inDrawer && (
          <button ref={closeRef} type="button" className="ml-auto flex h-9 w-9 flex-none items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={t('navClose')} onClick={() => setDrawer(false)}><X size={20} /></button>
        )}
      </div>
      <nav data-side-nav aria-label={t('navMain')} className={`nav-scroll flex flex-1 flex-col overflow-y-auto pb-3 ${rail ? 'px-2' : 'px-3'}`}>
        {nav.map((s, i) => (
          <div key={s.id} className={`${s.foot ? 'mt-auto' : ''} ${!i ? 'pt-1' : rail ? 'pt-2' : 'pt-3.5'}`}>
            {s.label && (rail
              ? <div className="mx-auto mb-2 h-px w-6 bg-slate-200" />
              : <div className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{t(s.label)}</div>)}
            <ul className="space-y-0.5">{s.pages.map((p) => <li key={p.to}>{link(p, rail)}</li>)}</ul>
          </div>
        ))}
      </nav>
      <div className={`flex-none border-t border-slate-200 ${rail ? 'space-y-1 px-2 py-2' : 'space-y-2 p-3'}`}>
        {rail ? (
          <button type="button" className={railButton} onClick={() => setLang(lang === 'en' ? 'vi' : 'en')} {...tipFor(true, lang === 'en' ? 'Tiếng Việt' : 'English')}>
            <span className="rounded border border-slate-300 px-1 text-[11px] font-black">{lang.toUpperCase()}</span>
          </button>
        ) : <div className="flex">{langSwitch}</div>}
        {account(rail)}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen lg:pl-[var(--nav-w)] print:!pl-0" style={{ '--nav-w': narrow ? NARROW_NAV : WIDE_NAV }}>
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[var(--nav-w)] border-r border-slate-200 bg-white lg:block">
        {sidebar(narrow, false)}
        <button type="button" onClick={toggleNarrow} title={t(narrow ? 'navWide' : 'navNarrow')} aria-label={t(narrow ? 'navWide' : 'navNarrow')}
          className="absolute -right-3 top-[23px] flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:border-pra-sky hover:text-pra-blue">
          {narrow ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      </aside>
      {tip && narrow && (
        <div className="no-print pointer-events-none fixed z-[60] hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-lg lg:block" style={{ left: `calc(${NARROW_NAV} + 6px)`, top: tip.top }}>
          {tip.label}
        </div>
      )}
      {drawer && (
        <div className="no-print fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('navMain')}>
          <div className="fade-in absolute inset-0 bg-slate-900/40" onClick={() => setDrawer(false)} />
          <aside className="drawer-in absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white shadow-2xl">
            {sidebar(false, true)}
          </aside>
        </div>
      )}
      <header ref={headerRef} className="no-print sticky top-0 z-40">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 bg-white/90 px-2 backdrop-blur lg:hidden">
          <button ref={openRef} type="button" className="relative flex h-10 w-10 flex-none items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100" aria-label={registerHour && !under(pathname, '/attendance') ? `${t('navOpen')}. ${t('navRegisterDot')}` : t('navOpen')} aria-expanded={drawer} onClick={() => setDrawer(true)}>
            <Menu size={22} />
            {registerHour && !under(pathname, '/attendance') && ping('right-1.5 top-1.5')}
          </button>
          <Link to="/" className="flex-none" aria-label={t('homeNav')}><Mark size={28} /></Link>
          <div className="min-w-0 flex-1 truncate pl-1 text-[15px] font-bold text-slate-800">{current && current.to !== '/' ? t(current.label) : t('appName')}</div>
        </div>
        {dbMode === 'local' && (
          <div className="bg-amber-50 px-4 py-1 text-center text-xs font-semibold text-amber-800">
            <Database size={12} className="mr-1 inline" />{t('localMode')}
            {viewAs && <> · <Eye size={12} className="mx-1 inline" />Previewing as {displayName} ({ACCESS_ROLES[me?.access]?.label}) <button className="ml-1 underline" onClick={() => { setViewAs(''); navigate('/') }}>stop</button></>}
          </div>
        )}
        {data?.error && <div className="bg-red-50 px-4 py-1 text-center text-xs font-semibold text-red-700">{t('errorLoad')} {data.error}</div>}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
        <Outlet />
      </main>
      {pwOpen && <ChangePassword onClose={() => setPwOpen(false)} t={t} />}
    </div>
  )
}

/** PRA's palm fronds over the river, from the logo, for the corner of the menu. */
function Mark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="flex-none">
      <rect width="64" height="64" rx="16" fill="#eef6fd" />
      <g transform="translate(-1 -3)">
        <path d="M30 44 C 14 40, 8 26, 14 12 C 12 28, 20 38, 34 40 Z" fill="#6f9f2f" />
        <path d="M30 40 C 22 34, 20 24, 26 16 C 24 28, 28 34, 36 38 Z" fill="#8dc63f" />
        <path d="M6 48 C 18 40, 30 40, 40 46 C 48 50, 54 48, 60 44 C 54 54, 44 58, 34 54 C 24 50, 16 50, 6 56 Z" fill="#1a7bc4" />
      </g>
    </svg>
  )
}

// Offline mode only: see the app the way a given teacher would.
function ViewAsPicker({ teachers, viewAs, setViewAs }) {
  return (
    <div className="border-t border-slate-100 px-4 py-3">
      <div className="mb-1 text-xs font-semibold text-slate-500">Preview as (offline only)</div>
      <select className="input !py-1 text-xs" value={viewAs} onChange={(e) => setViewAs(e.target.value)}>
        <option value="">Offline admin (everything)</option>
        {teachers.filter(hasLogin).map((tr) => <option key={tr.id} value={tr.email}>{tr.name} · {tr.email}</option>)}
      </select>
    </div>
  )
}

function ChangePassword({ onClose, t }) {
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = pw.length >= 8 && pw === pw2
  const submit = async (e) => {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    try { await auth.changePassword(pw); toast(t('passwordChanged')); onClose() } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={t('changePassword')}
      footer={<><button type="button" className="btn-secondary" onClick={onClose}>{t('cancel')}</button><button type="submit" form="pw-form" className="btn-primary" disabled={!ok || busy}>{busy ? t('saving') : t('save')}</button></>}>
      <form id="pw-form" onSubmit={submit} className="space-y-3">
        <Field label={t('newPassword')} hint="At least 8 characters."><TextInput type="password" value={pw} onChange={setPw} autoComplete="new-password" autoFocus /></Field>
        <Field label={`${t('newPassword')} (2)`} hint={pw2 && pw !== pw2 ? 'The two passwords do not match.' : null}><TextInput type="password" value={pw2} onChange={setPw2} autoComplete="new-password" /></Field>
      </form>
    </Modal>
  )
}
