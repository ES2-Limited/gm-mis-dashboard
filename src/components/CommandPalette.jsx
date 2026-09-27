import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, LayoutDashboard, FolderOpen, MapPin, Lightbulb, FileBarChart2,
  Settings, CornerDownLeft, Plus,
} from 'lucide-react'
import { CASES, getViewAs } from '../data/mock'
import { currentPermissions } from '../lib/rbac'
import { openRegisterCase } from '../lib/registerCase'
import { StatusBadge } from './ui'

const PAGES = [
  { label: 'Overview', to: '/', icon: LayoutDashboard, module: 'overview' },
  { label: 'Cases', to: '/cases', icon: FolderOpen, module: 'cases' },
  { label: 'Register Case', to: '/cases/new', icon: Plus, module: 'case_intake' },
  { label: 'Locations', to: '/map', icon: MapPin, module: 'locations' },
  { label: 'Insights', to: '/insights', icon: Lightbulb, module: 'insights' },
  { label: 'Reports', to: '/reports', icon: FileBarChart2, module: 'reports' },
  { label: 'Settings', to: '/settings', icon: Settings, module: 'settings' },
]

export default function CommandPalette({ open, onClose }) {
  if (!open) return null
  return <Palette onClose={onClose} />
}

function Palette({ onClose }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const allowed = currentPermissions(getViewAs())
    const pages = PAGES
      .filter(p => allowed.includes(p.module))
      .filter(p => !needle || p.label.toLowerCase().includes(needle))
      .map(p => ({ kind: 'page', ...p }))
    const cases = needle.length < 2 ? [] : CASES
      .filter(c =>
        c.code.toLowerCase().includes(needle) ||
        c.complainant.toLowerCase().includes(needle) ||
        c.category.toLowerCase().includes(needle) ||
        c.state.toLowerCase().includes(needle) ||
        c.lga.toLowerCase().includes(needle)
      )
      .slice(0, 8)
      .map(c => ({ kind: 'case', ...c }))
    return [...(needle.length >= 2 ? cases : []), ...pages].slice(0, 12)
  }, [q])

  const go = (r) => {
    onClose()
    if (r.kind === 'page' && r.to === '/cases/new') { openRegisterCase(); return }
    navigate(r.kind === 'page' ? r.to : `/cases/${r.id}`)
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[index]) { e.preventDefault(); go(results[index]) }
    else if (e.key === 'Escape') onClose()
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center pt-[14vh]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-xl mx-4 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/20 overflow-hidden fade-up"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 border-b border-slate-100">
          <Search size={16} className="text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setIndex(0) }}
            onKeyDown={onKey}
            placeholder="Search cases, complainants, states… or jump to a page"
            className="flex-1 py-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
          />
          <kbd className="text-[9px] font-semibold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-[22rem] overflow-y-auto py-2">
          {results.map((r, i) => (
            <button
              key={r.kind === 'page' ? r.to : r.id}
              onClick={() => go(r)}
              onMouseEnter={() => setIndex(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${i === index ? 'bg-slate-50' : ''}`}
            >
              {r.kind === 'page' ? (
                <>
                  <r.icon size={15} className="text-slate-400 shrink-0" />
                  <span className="text-[13px] font-medium text-slate-700">{r.label}</span>
                  <span className="ml-auto text-[10px] text-slate-300 uppercase tracking-wider font-semibold">Page</span>
                </>
              ) : (
                <>
                  <span className="text-xs font-bold text-brand-700 shrink-0 w-40 truncate">{r.code}</span>
                  <span className="text-[12px] text-slate-600 truncate flex-1">{r.complainant} · {r.category} · {r.lga}, {r.state}</span>
                  <StatusBadge status={r.status} />
                </>
              )}
              {i === index && <CornerDownLeft size={13} className="text-slate-300 shrink-0" />}
            </button>
          ))}
          {results.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-400">No matches for “{q}”.</p>
          )}
        </div>
      </div>
    </div>
  )
}
