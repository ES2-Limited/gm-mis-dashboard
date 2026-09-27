import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, MapPin, Lightbulb, FileBarChart2,
  Settings, Search, Radio, Sun, Moon, Share2, ShieldAlert,
  ChevronDown, LogOut, ScrollText, PlusCircle, Smartphone,
} from 'lucide-react'
import { getViewAs, scopeLabel as fmtScope, scopeStatesList } from '../data/mock'
import { fetchCases } from '../data/casesApi'
import { currentPermissions } from '../lib/rbac'
import { logout } from '../lib/auth'
import { isConfigured } from '../lib/intelligence'
import CommandPalette from './CommandPalette'
import Notifications from './Notifications'
import Toasts from './Toasts'
import RegisterCase from '../pages/RegisterCase'
import { useRegisterCaseOpen, openRegisterCase, closeRegisterCase } from '../lib/registerCase'

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/cases', label: 'Cases', icon: FolderOpen },
  { to: '/map', label: 'Locations', icon: MapPin },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
  { to: '/reports', label: 'Reports', icon: FileBarChart2 },
  { to: '/sharing', label: 'Integration', icon: Share2 },
  { to: '/devices', label: 'Field Devices', icon: Smartphone },
  { to: '/audit', label: 'Audit Log', icon: ScrollText },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const ROUTE_MODULE = {
  '/': 'overview', '/cases': 'cases', '/map': 'locations', '/insights': 'insights',
  '/reports': 'reports', '/sharing': 'sharing', '/restricted': 'restricted',
  '/devices': 'devices', '/audit': 'audit', '/settings': 'settings',
}

function navForView(view) {
  const perms = currentPermissions(view)
  return NAV_ITEMS.filter(item => perms.includes(ROUTE_MODULE[item.to]))
}

const CASE_VIEWS = [
  { to: '/cases?view=mine', label: 'My Cases', hint: 'On my desk now' },
  { to: '/cases?view=history', label: 'My History', hint: 'Cases I have treated' },
  { to: '/cases?view=all', label: 'All Cases', hint: 'Scope-wide report (view only)', module: 'cases_all' },

  { to: '/restricted', label: 'Restricted Cases', hint: 'SEA/SH & GBV · confidential', module: 'restricted', restricted: true },
]

function CasesNavItem({ active, myOpen, myOverdue, allowAll, canIntake, canRestricted }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const ref = useRef(null)
  const views = CASE_VIEWS.filter(v => {
    if (v.module === 'cases_all') return allowAll
    if (v.module === 'restricted') return canRestricted
    return true
  })
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const toggle = () => {
    if (!open && ref.current) setRect(ref.current.getBoundingClientRect())
    setOpen(o => !o)
  }
  return (
    <div ref={ref} className="shrink-0">
      <button
        onClick={toggle}
        className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] whitespace-nowrap transition-colors ${
          active ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-50'
        }`}>
        <FolderOpen size={15} strokeWidth={2} className={`shrink-0 ${active ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'}`} />
        <span>Cases</span>

        {myOpen > 0 && (
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold tabular-nums rounded-md px-1.5 py-px bg-rose-100 text-rose-700 ${myOverdue > 0 ? 'ring-1 ring-rose-300' : ''}`}>
            {myOverdue > 0 && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 pulse-dot" />}
            {myOpen}
          </span>
        )}
        <ChevronDown size={12} className={`opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && rect && createPortal(
        <div style={{ position: 'fixed', top: rect.bottom + 6, left: rect.left, zIndex: 2000 }}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-56 bg-white rounded-lg border border-slate-200 shadow-xl shadow-slate-900/10 py-1 fade-up">
          {canIntake && (
            <>
              <button onClick={() => { setOpen(false); openRegisterCase() }} className="w-full text-left flex items-center gap-2.5 px-3.5 py-2 hover:bg-brand-50 group/intake">
                <span className="h-7 w-7 rounded-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0 group-hover/intake:bg-brand-100"><PlusCircle size={15} /></span>
                <span>
                  <span className="block text-[12.5px] font-semibold text-brand-700">Register Case</span>
                  <span className="block text-[10.5px] text-slate-400">Back-office intake — log a new grievance</span>
                </span>
              </button>
              <div className="my-1 border-t border-slate-100" />
            </>
          )}
          {views.map(v => (
            <div key={v.to}>
              {v.restricted && <div className="my-1 border-t border-slate-100" />}
              <NavLink to={v.to} onClick={() => setOpen(false)} className={`flex items-center justify-between gap-2 px-3.5 py-2 ${v.restricted ? 'hover:bg-rose-50' : 'hover:bg-slate-50'}`}>
                <span className="flex items-center gap-2">
                  {v.restricted && <ShieldAlert size={14} className="text-rose-500 shrink-0" />}
                  <span>
                    <span className={`block text-[12.5px] font-medium ${v.restricted ? 'text-rose-700' : 'text-slate-700'}`}>{v.label}</span>
                    <span className="block text-[10.5px] text-slate-400">{v.hint}</span>
                  </span>
                </span>
                {v.to.includes('view=mine') && myOpen > 0 && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-rose-100 text-rose-700">
                    {myOverdue > 0 && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 pulse-dot" />}
                    {myOpen} to do
                  </span>
                )}
              </NavLink>
            </div>
          ))}
        </div>, document.body)}
    </div>
  )
}

function RoleSwitcher({ view }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const initials = view.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  const signOut = () => {
    logout()
    window.location.reload()
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 group">
        <div className="h-9 w-9 rounded-full bg-emerald-800 text-white text-[11px] font-bold flex items-center justify-center">
          {initials}
        </div>
        <ChevronDown size={13} className="text-slate-400 group-hover:text-slate-600" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/10 overflow-hidden fade-up z-[1500]">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-[12.5px] font-semibold text-slate-800">{view.name}</p>
            <p className="text-[11px] text-slate-400">{view.role} · {fmtScope(view.scope)}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-[12.5px] font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50/60 border-t border-slate-100"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function useTheme() {
  const getSystem = () =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  const [pref, setPref] = useState(() => localStorage.getItem('spin.themePref'))
  const [system, setSystem] = useState(getSystem)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setSystem(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const theme = pref || system
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setPref(next)
    localStorage.setItem('spin.themePref', next)
  }
  return [theme, toggle]
}

function RegisterCaseModal() {
  const open = useRegisterCaseOpen()
  const navigate = useNavigate()
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') closeRegisterCase() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[2300] bg-slate-900/40 backdrop-blur-sm flex">
      <div className="relative w-full h-full bg-slate-100 overflow-y-auto fade-up">
        <RegisterCase
          onClose={closeRegisterCase}
          onCreated={(c) => { closeRegisterCase(); navigate(`/cases/${c.id}`) }}
        />
      </div>
    </div>,
    document.body,
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  const [theme, toggleTheme] = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const view = getViewAs()
  const items = navForView(view)
  const perms = currentPermissions(view)
  const allowAllCases = perms.includes('cases_all')
  const canIntake = perms.includes('case_intake')
  const canRestricted = perms.includes('restricted')

  const [myOpen, setMyOpen] = useState(0)
  const [myOverdue, setMyOverdue] = useState(0)
  const myName = view.name
  useEffect(() => {
    fetchCases().then(list => {
      const federal = view.isSuperAdmin || !view.scope || view.scope === 'All states'
      const lvl = view.tier ?? (federal ? 4 : null)
      const inMyScope = (c) => federal || c.state === view.scope
      const open = (c) => !['resolved', 'closed'].includes(c.status)
      const onDesk = (c) =>
        open(c) && (c.assignedTo === myName || (lvl != null && lvl === c.tier && inMyScope(c)))
      const mine = list.filter(onDesk)
      setMyOpen(mine.length)
      setMyOverdue(mine.filter(c => c.slaBreached).length)
    }).catch(() => {})
  }, [myName, view.scope, view.tier, view.isSuperAdmin])
  const scopeLabel = scopeStatesList(view.scope).length === 0 ? 'National view' : `${fmtScope(view.scope)} only`

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const navItemClass = ({ isActive }) =>
    `group flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] whitespace-nowrap shrink-0 transition-colors ${
      isActive
        ? 'bg-emerald-50 text-emerald-700 font-semibold'
        : 'text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-50'
    }`

  return (
    <div className="flex flex-col h-full bg-slate-100">

      <header className="h-14 shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200/70 flex items-center justify-between px-4 md:px-6 sticky top-0 z-[1100]">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/spin-logo.jpeg" alt="SPIN Project" className="h-8 w-8 rounded-full object-contain shrink-0" />
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-slate-900 leading-tight tracking-tight whitespace-nowrap">SPIN Project</div>
            <div className="text-[10.5px] text-slate-400 leading-tight font-medium whitespace-nowrap">Grievance MIS</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden md:flex h-9 w-56 items-center gap-2 rounded-lg border border-slate-200 bg-white pl-3 pr-1.5 hover:border-slate-300 transition-colors"
          >
            <Search size={14} className="text-slate-400 shrink-0" />
            <span className="flex-1 text-left text-[12.5px] text-slate-400 truncate whitespace-nowrap">Search</span>
            <kbd className="shrink-0 text-[10px] font-medium text-slate-400 bg-slate-100 rounded-md px-1.5 py-0.5">⌘K</kbd>
          </button>
          <button
            onClick={() => setPaletteOpen(true)}
            className="md:hidden h-9 w-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50"
          >
            <Search size={15} />
          </button>
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="h-9 w-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          <Notifications />
          <span className="h-5 w-px bg-slate-200 mx-1" />
          <RoleSwitcher view={view} />
        </div>
      </header>

      <nav className="h-12 shrink-0 bg-white border-b border-slate-200/70 flex items-center justify-between gap-4 px-2 md:px-5 sticky top-14 z-[1090]">
        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            to === '/cases' ? (
              <CasesNavItem key={to} active={pathname.startsWith('/cases') || pathname.startsWith('/restricted')} myOpen={myOpen} myOverdue={myOverdue} allowAll={allowAllCases} canIntake={canIntake} canRestricted={canRestricted} />
            ) : (
              <NavLink key={to} to={to} end={end} className={navItemClass}>
                {({ isActive }) => (
                  <>
                    <Icon size={15} strokeWidth={2} className={`shrink-0 ${isActive ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'}`} />
                    <span>{label}</span>
                    {label === 'Insights' && (
                      <span className={`h-1.5 w-1.5 rounded-full ${isConfigured() ? 'bg-emerald-500 pulse-dot' : 'bg-slate-300'}`} />
                    )}
                  </>
                )}
              </NavLink>
            )
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3 shrink-0 pr-1">
          {scopeStatesList(view.scope).length > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 ring-1 ring-sky-200 rounded-full px-2 py-0.5">
              Geo-scoped
            </span>
          )}
          <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">{view.role} · {scopeLabel}</span>
          <span className="h-4 w-px bg-slate-200" />
          <span className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400 whitespace-nowrap" title="All channels live · synced 2 min ago">
            <Radio size={13} className="text-emerald-500 pulse-dot shrink-0" />
            Live
          </span>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        <Outlet />
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <RegisterCaseModal />
      <Toasts />
    </div>
  )
}
