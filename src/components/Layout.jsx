import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FileText, Users, Settings, LogOut, Home, Database, ClipboardList, GraduationCap, CalendarCheck, CalendarDays, KeyRound, ChevronDown, Eye, Images, Sprout, Briefcase, Megaphone, FileSignature, FileCheck, BookOpen, ListTodo } from 'lucide-react'
import { useT } from '../lib/i18n'
import { auth, dbMode } from '../lib/db'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import { ACCESS_ROLES } from '../data/staff'
import { Avatar, Chip, Field, Modal, TextInput } from './ui'

// The top row. Home, Students, Attendance and To-Do (office accounts) stand alone;
// everything else sits in a group (Teaching for everyone, Office and Outreach for
// office accounts), and a group's pages show as a second row of tabs while you are in it.
// A group with one page you can see is shown as that page. A new page (the
// newsletter, say) goes into a group's `pages` and the top row stays as it is.
const NAV = [
  { to: '/', icon: Home, label: 'home', end: true },
  { to: '/students', icon: Users, label: 'students' },
  { to: '/attendance', icon: CalendarCheck, label: 'attendance' },
  { to: '/todo', icon: ListTodo, label: 'todoNav', who: 'office' },
  { id: 'teaching', icon: BookOpen, label: 'navTeaching', pages: [
    { to: '/reports', icon: ClipboardList, label: 'reportsNav', who: 'all' },
    { to: '/schedule', icon: CalendarDays, label: 'schedule', who: 'all' },
    { to: '/assessments', icon: FileCheck, label: 'asNav', who: 'all' },
  ] },
  { id: 'office', icon: Briefcase, label: 'navOffice', pages: [
    { to: '/invoices', icon: FileText, label: 'invoices', who: 'office' },
    { to: '/leads', icon: Sprout, label: 'leadsNav', who: 'office' },
    { to: '/enrollments', icon: FileSignature, label: 'enrollNav', who: 'office' },
  ] },
  { id: 'outreach', icon: Megaphone, label: 'navOutreach', pages: [
    { to: '/photos', icon: Images, label: 'photos', who: 'office' },
  ] },
  { id: 'setup', icon: Settings, label: 'navSetup', iconOnly: true, pages: [
    { to: '/settings', icon: Settings, label: 'settings', who: 'office' },
    { to: '/teachers', icon: GraduationCap, label: 'teachers', who: 'head' },
  ] },
]
const under = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`)

// A group opens on the page you last used in it.
const LAST_KEY = 'pra-admin-nav-last'
const readLast = () => { try { return JSON.parse(localStorage.getItem(LAST_KEY)) || {} } catch { return {} } }

export default function Layout() {
  const { t, lang, setLang } = useT()
  const navigate = useNavigate()
  const data = useData()
  const { isHead, isOffice, displayName, me, viewAs, setViewAs } = useAuth()
  const [menu, setMenu] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const { pathname } = useLocation()
  const navRef = useRef(null)
  const headerRef = useRef(null)

  const can = { all: true, office: isOffice, head: isHead }
  const nav = NAV.map((n) => (n.pages ? { ...n, pages: n.pages.filter((p) => can[p.who]) } : n)).filter((n) => (n.pages ? n.pages.length : can[n.who || 'all']))
  const group = nav.find((n) => n.pages?.length > 1 && n.pages.some((p) => under(pathname, p.to)))
  const last = readLast()

  useEffect(() => {
    const g = NAV.find((n) => n.pages?.some((p) => under(pathname, p.to)))
    if (!g) return
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ ...readLast(), [g.id]: g.pages.find((p) => under(pathname, p.to)).to })) } catch { /* ignore */ }
  }, [pathname])

  // The header is taller inside a group; pages with their own sticky parts sit below it using --header-h.
  useEffect(() => {
    const el = headerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // On phones the nav scrolls sideways; keep the current page's icon in view.
  // Re-checked when the nav narrows or role-only links and the account menu appear.
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const reveal = () => {
      const active = nav.querySelector('[aria-current]')
      if (!active) return
      const left = active.offsetLeft - nav.offsetLeft
      if (left < nav.scrollLeft || left + active.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = left - 8
    }
    reveal()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(reveal) : null
    ro?.observe(nav)
    return () => ro?.disconnect()
  }, [pathname, isOffice, isHead, !!me]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menu])

  const tab = (on, iconOnly) => `flex flex-none items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold transition-colors ${iconOnly ? 'ml-auto' : ''} ${on ? 'bg-pra-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`
  const inner = (Icon, label, iconOnly) => <><Icon size={18} /> <span className={iconOnly ? 'sr-only' : 'hidden lg:inline'}>{label}</span></>
  const item = (n) => {
    if (!n.pages || n.pages.length === 1) {
      const p = n.pages ? n.pages[0] : n
      return <NavLink key={p.to} to={p.to} end={p.end} title={t(p.label)} className={({ isActive }) => tab(isActive, n.iconOnly)}>{inner(p.icon, t(p.label), n.iconOnly)}</NavLink>
    }
    const to = (n.pages.find((p) => under(pathname, p.to)) || n.pages.find((p) => p.to === last[n.id]) || n.pages[0]).to
    return <Link key={n.id} to={to} title={t(n.label)} aria-current={group === n ? 'true' : undefined} className={tab(group === n, n.iconOnly)}>{inner(n.icon, t(n.label), n.iconOnly)}</Link>
  }
  const role = ACCESS_ROLES[me?.access] || ACCESS_ROLES.viewer

  return (
    <div className="min-h-screen">
      <header ref={headerRef} className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
          <nav ref={navRef} className="-mx-1 no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1 sm:gap-1">
            {nav.map(item)}
          </nav>
          <div className="hidden flex-none overflow-hidden rounded-lg border border-slate-300 text-xs font-bold sm:flex">
            <button className={`px-2 py-1.5 ${lang === 'en' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`} onClick={() => setLang('en')}>EN</button>
            <button className={`px-2 py-1.5 ${lang === 'vi' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`} onClick={() => setLang('vi')}>VI</button>
          </div>
          {me && (
            <div className="relative flex-none">
              <button type="button" className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-slate-100" aria-expanded={menu} onClick={(e) => { e.stopPropagation(); setMenu((v) => !v) }}>
                <Avatar name={me.name} size={30} />
                <span className="hidden max-w-[120px] truncate text-left text-xs leading-tight xl:block">
                  <span className="block font-semibold text-slate-700">{displayName}</span>
                  <span className="block text-slate-400">{lang === 'vi' ? role.label_vi : role.label}</span>
                </span>
                <ChevronDown size={14} className="hidden text-slate-400 sm:block" />
              </button>
              {menu && (
                <div className="modal-in absolute right-0 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="text-xs text-slate-400">{t('signedInAs')}</div>
                    <div className="truncate text-sm font-semibold text-slate-800">{me.email || displayName}</div>
                    <div className="mt-1.5"><Chip tone={role.tone}>{lang === 'vi' ? role.label_vi : role.label}</Chip></div>
                    <p className="mt-1.5 text-xs text-slate-500">{role.summary}</p>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm sm:hidden">
                    <span className="text-slate-600">{t('language')}</span>
                    <div className="seg"><button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button><button type="button" aria-pressed={lang === 'vi'} onClick={() => setLang('vi')}>VI</button></div>
                  </div>
                  {auth.enabled && <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50" onClick={() => { setMenu(false); setPwOpen(true) }}><KeyRound size={16} className="text-slate-500" /> {t('changePassword')}</button>}
                  {auth.enabled && <button className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50" onClick={async () => { await auth.signOut(); navigate('/login') }}><LogOut size={16} /> {t('logout')}</button>}
                  {dbMode === 'local' && <ViewAsPicker teachers={data?.teachers || []} viewAs={viewAs} setViewAs={(v) => { setViewAs(v); setMenu(false); navigate('/') }} />}
                </div>
              )}
            </div>
          )}
        </div>
        {group && (
          <div className="border-t border-slate-100">
            <nav aria-label={t(group.label)} className="no-scrollbar mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4">
              <span className="mr-2 flex-none text-[11px] font-bold uppercase tracking-wider text-slate-400">{t(group.label)}</span>
              {group.pages.map((p) => (
                <NavLink key={p.to} to={p.to}
                  className={({ isActive }) => `-mb-px flex flex-none items-center gap-1.5 border-b-2 px-2.5 py-2 text-sm font-semibold transition-colors ${isActive ? 'border-pra-blue text-pra-blue' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  <p.icon size={15} /> {t(p.label)}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
        {dbMode === 'local' && (
          <div className="bg-amber-50 px-4 py-1 text-center text-xs font-semibold text-amber-800">
            <Database size={12} className="mr-1 inline" />{t('localMode')}
            {viewAs && <> · <Eye size={12} className="mx-1 inline" />Previewing as {displayName} ({ACCESS_ROLES[me?.access]?.label}) <button className="ml-1 underline" onClick={() => { setViewAs(''); navigate('/') }}>stop</button></>}
          </div>
        )}
        {data?.error && <div className="bg-red-50 px-4 py-1 text-center text-xs font-semibold text-red-700">{t('errorLoad')} {data.error}</div>}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      {pwOpen && <ChangePassword onClose={() => setPwOpen(false)} t={t} />}
    </div>
  )
}

// Offline mode only: see the app the way a given teacher would.
function ViewAsPicker({ teachers, viewAs, setViewAs }) {
  return (
    <div className="border-t border-slate-100 px-4 py-3">
      <div className="mb-1 text-xs font-semibold text-slate-500">Preview as (offline only)</div>
      <select className="input !py-1 text-xs" value={viewAs} onChange={(e) => setViewAs(e.target.value)}>
        <option value="">Offline admin (everything)</option>
        {teachers.map((tr) => <option key={tr.id} value={tr.email}>{tr.name} · {tr.email}</option>)}
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
