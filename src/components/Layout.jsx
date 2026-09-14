import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { FileText, Users, Settings, LogOut, Home, Database, ClipboardList, GraduationCap, CalendarCheck } from 'lucide-react'
import { useT } from '../lib/i18n'
import { auth, dbMode } from '../lib/db'
import { useData } from '../lib/DataContext'
import { useAuth } from '../lib/AuthContext'

export default function Layout() {
  const { t, lang, setLang } = useT()
  const navigate = useNavigate()
  const data = useData()
  const { isHead, isOffice, displayName, me } = useAuth()

  const item = (to, Icon, label, end = false) => (
    <NavLink to={to} end={end}
      className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-pra-blue text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
      <Icon size={18} /> <span className="hidden sm:inline">{label}</span>
    </NavLink>
  )

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
          <NavLink to="/" className="mr-2 flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Palm River Academy" className="h-9" />
          </NavLink>
          <nav className="flex flex-1 items-center gap-1">
            {item('/', Home, t('home'), true)}
            {isOffice && item('/invoices', FileText, t('invoices'))}
            {item('/reports', ClipboardList, t('reports'))}
            {item('/students', Users, t('students'))}
            {isHead && item('/teachers', GraduationCap, t('teachers'))}
            {item('/attendance', CalendarCheck, t('attendance'))}
            {isOffice && item('/settings', Settings, t('settings'))}
          </nav>
          {me && <span className="hidden max-w-[160px] truncate text-xs font-semibold text-slate-500 md:inline" title={me.email}>{displayName}</span>}
          <div className="ml-1 flex overflow-hidden rounded-lg border border-slate-300 text-xs font-bold">
            <button className={`px-2.5 py-1.5 ${lang === 'en' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`} onClick={() => setLang('en')}>EN</button>
            <button className={`px-2.5 py-1.5 ${lang === 'vi' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`} onClick={() => setLang('vi')}>VI</button>
          </div>
          {auth.enabled && (
            <button className="btn-ghost" title={t('logout')} onClick={async () => { await auth.signOut(); navigate('/login') }}><LogOut size={18} /></button>
          )}
        </div>
        {dbMode === 'local' && (
          <div className="bg-amber-50 px-4 py-1 text-center text-xs font-semibold text-amber-800"><Database size={12} className="mr-1 inline" />{t('localMode')}</div>
        )}
        {data?.error && <div className="bg-red-50 px-4 py-1 text-center text-xs font-semibold text-red-700">{t('errorLoad')} {data.error}</div>}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
