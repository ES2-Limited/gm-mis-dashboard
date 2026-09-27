import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Filter, Download, Plus, AlertTriangle, Loader2, Clock, ArrowRight, UserCircle } from 'lucide-react'
import { Card, StatusBadge, PriorityBadge, ChannelChip, Select } from '../components/ui'
import { STATES, CHANNELS, fmtDate, isOpen, statusLabel, channelLabel, channelParent, getViewAs, isRestricted } from '../data/mock'
import { fetchCases } from '../data/casesApi'
import { fetchCategoryNames } from '../data/taxonomyApi'
import { currentPermissions } from '../lib/rbac'
import { openRegisterCase } from '../lib/registerCase'
import { logEvent } from '../data/audit'
import { toast } from '../lib/toast'

const PAGE_SIZE = 14
const NOW_TS = Date.now()
const DAY = 86400000
const fmtSince = (ms) => {
  const mins = ms / 60000
  if (mins < 60) return `${Math.max(1, Math.round(mins))}m`
  const h = mins / 60
  if (h < 24) return `${Math.round(h)}h`
  return `${Math.round(h / 24)}d`
}

function CaseCard({ c }) {
  const overdue = c.slaBreached && isOpen(c)
  const daysLeft = c.dueAt ? Math.ceil((new Date(c.dueAt).getTime() - NOW_TS) / DAY) : null
  const dueSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 3
  const age = fmtSince(NOW_TS - new Date(c.createdAt).getTime())
  const accent = overdue ? 'border-l-rose-500' : dueSoon ? 'border-l-amber-400' : 'border-l-brand-500'
  const slaTone = overdue ? 'bg-rose-50 text-rose-700' : dueSoon ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'
  const slaText = overdue ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} overdue — act now`
    : daysLeft === 0 ? 'Due today' : daysLeft != null ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'No deadline'

  return (
    <Link to={`/cases/${c.id}`} className={`group block rounded-xl border border-l-4 bg-white p-4 transition hover:shadow-md hover:border-slate-300 ${accent} ${overdue ? 'border-rose-200' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-brand-700">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500 pulse-dot" /> Waiting for you
        </span>
        <StatusBadge status={c.status} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-brand-700 text-[13px]">{c.code}</span>
        <ArrowRight size={14} className="text-slate-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition" />
      </div>
      <p className="text-[13px] font-semibold text-slate-800 mt-1.5 truncate">{c.complainant}</p>
      <p className="text-[12px] text-slate-500 truncate">{c.category}{c.subcategory ? ` · ${c.subcategory}` : ''}</p>
      <p className="text-[11.5px] text-slate-400 mt-0.5 truncate">{c.lga ? `${c.lga}, ` : ''}{c.state}</p>

      <div className={`mt-3 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${slaTone}`}>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
          {overdue ? <AlertTriangle size={12} /> : <Clock size={12} />} {slaText}
        </span>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <PriorityBadge priority={c.priority} />
          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200 rounded-full px-1.5 py-0.5">L{c.tier}</span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-2.5 text-[10.5px] text-slate-400">
        <span>Open {age}</span>
        {c.registeredBy && <span className="inline-flex items-center gap-1 truncate"><UserCircle size={11} className="shrink-0" /> {c.registeredBy}</span>}
      </div>
    </Link>
  )
}

const QUICK = [
  { id: '', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'breached', label: 'Past SLA' },
  { id: 'under_investigation', label: 'Under Investigation' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
]

export default function Cases() {
  const me = getViewAs()
  const perms = currentPermissions(me)
  const hasAll = perms.includes('cases_all')
  const canIntake = perms.includes('case_intake')
  const [sp] = useSearchParams()
  const requested = sp.get('view') || (hasAll ? 'all' : 'mine')

  const view = (requested === 'all' && !hasAll) ? 'mine' : requested
  const [allCases, setAllCases] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [quick, setQuick] = useState('')
  const [state, setState] = useState('')
  const [category, setCategory] = useState('')
  const [channel, setChannel] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    fetchCases().then(setAllCases).catch(() => {}).finally(() => setLoading(false))
    fetchCategoryNames().then(setCategories).catch(() => {})
  }, [])

  const VIEW_LABEL = { mine: 'My Cases', history: 'My History', all: 'All Cases' }
  const viewCases = useMemo(() => {
    const federal = me.isSuperAdmin || !me.scope || me.scope === 'All states'
    const lvl = me.tier ?? (federal ? 4 : null)
    const inMyScope = (c) => federal || c.state === me.scope
    const onDesk = (c) => isOpen(c) && (c.assignedTo === me.name || (lvl != null && lvl === c.tier && inMyScope(c)))
    const acted = (c) => (c.registeredBy || '').includes(me.name) || c.assignedTo === me.name || (c.activity || []).some(a => a.by === me.name)

    if (view === 'mine') return allCases.filter(onDesk)
    if (view === 'history') return allCases.filter(c => acted(c) && !onDesk(c))
    return allCases.filter(c => !isRestricted(c.category))
  }, [allCases, view, me.name, me.scope, me.tier, me.isSuperAdmin])

  const counts = useMemo(() => ({
    '': viewCases.length,
    open: viewCases.filter(isOpen).length,
    breached: viewCases.filter(c => c.slaBreached && isOpen(c)).length,
    under_investigation: viewCases.filter(c => c.status === 'under_investigation').length,
    resolved: viewCases.filter(c => c.status === 'resolved').length,
    closed: viewCases.filter(c => c.status === 'closed').length,
  }), [viewCases])

  const filtered = useMemo(() => viewCases.filter(c =>
    (!quick ||
      (quick === 'open' ? isOpen(c) :
       quick === 'breached' ? (c.slaBreached && isOpen(c)) :
       c.status === quick)) &&
    (!state || c.state === state) &&
    (!category || c.category === category) &&
    (!channel || channelParent(c.channel) === channel) &&
    (!q || c.code.toLowerCase().includes(q.toLowerCase()) || (c.complainant || '').toLowerCase().includes(q.toLowerCase()))
  ), [viewCases, quick, state, category, channel, q])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const reset = (fn) => (v) => { fn(v); setPage(0) }

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const head = ['Code', 'Complainant', 'Phone', 'Category', 'Sub-group', 'State', 'LGA', 'Channel', 'Priority', 'Status', 'Assigned To', 'Registered By', 'Received', 'Due', 'SLA Breached']
    const lines = filtered.map(c => [
      c.code, c.complainant, c.phone, c.category, c.subcategory || '', c.state, c.lga,
      channelLabel(c.channel), c.priority, statusLabel(c.status),
      c.assignedTo || '', c.registeredBy || '', fmtDate(c.createdAt), fmtDate(c.dueAt),
      c.slaBreached && isOpen(c) ? 'Yes' : 'No',
    ].map(esc).join(','))
    const blob = new Blob([[head.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `spin-grm-cases-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    logEvent('export_cases', { target: `${filtered.length} records` })
    toast(`Exported ${filtered.length} cases to CSV`)
  }

  return (
    <div className="p-3 md:p-5 space-y-3 md:space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3 fade-up">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">{VIEW_LABEL[view] || 'Case Register'}</h1>
            {view === 'all' && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">Report · view only</span>}
          </div>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            {filtered.length} {filtered.length === 1 ? 'case' : 'cases'}
            {view === 'mine' ? ' on your desk now' : view === 'history' ? ' you have acted on (off your desk)' : ' in your scope'}
            {' · switch via the Cases menu'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md px-3.5 py-2 hover:bg-slate-50">
            <Download size={14} /> Export CSV
          </button>
          {canIntake && (
            <button onClick={openRegisterCase} className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2 hover:bg-brand-800">
              <Plus size={14} /> Register Case
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 fade-up">
        {QUICK.map(s => (
          <button
            key={s.id}
            onClick={() => reset(setQuick)(quick === s.id ? '' : s.id)}
            className={`flex items-center gap-1.5 text-[12px] font-semibold rounded-full px-3.5 py-1.5 ring-1 ring-inset transition-all ${
              quick === s.id
                ? 'bg-brand-700 text-white ring-brand-700'
                : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300 hover:text-slate-900'
            }`}
          >
            {s.id === 'breached' && <AlertTriangle size={11} className={quick === s.id ? 'text-white' : 'text-rose-500'} />}
            {s.label}
            <span className={`text-[10px] font-bold rounded-full px-1.5 py-px ${quick === s.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
              {counts[s.id]}
            </span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden fade-up">

        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <Filter size={14} className="text-slate-400 ml-1" />
          <input
            value={q}
            onChange={(e) => reset(setQ)(e.target.value)}
            placeholder="Search code or name…"
            className="text-[13px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 w-52 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <Select value={state} onChange={reset(setState)} options={STATES.map(s => s.name)} allLabel="All states" />
          <Select value={category} onChange={reset(setCategory)} options={categories} allLabel="All categories" />
          <Select value={channel} onChange={reset(setChannel)} options={CHANNELS} allLabel="All touch points" />
        </div>

        {view === 'mine' ? (
          <div className="p-4">
            {rows.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">
                {loading ? <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Loading…</span>
                  : allCases.length === 0 ? 'No grievances yet.'
                  : 'Nothing on your desk right now — escalate, return or new cases will appear here.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {rows.map(c => <CaseCard key={c.id} c={c} />)}
              </div>
            )}
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50/70 border-y border-slate-200">
                <th className="px-5 py-2 font-semibold">Case</th>
                <th className="px-3 py-2 font-semibold">Complainant</th>
                <th className="px-3 py-2 font-semibold">Category</th>
                <th className="px-3 py-2 font-semibold">Location</th>
                <th className="px-3 py-2 font-semibold">Channel</th>
                <th className="px-3 py-2 font-semibold">Priority</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Assigned</th>
                <th className="px-5 py-2 font-semibold text-right">Received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(c => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-2.5 whitespace-nowrap">
                    <Link to={`/cases/${c.id}`} className="font-semibold text-brand-700 hover:underline text-xs">{c.code}</Link>
                    {c.slaBreached && isOpen(c) && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-rose-500 align-middle" title="SLA breached" />}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 text-xs whitespace-nowrap">{c.complainant}</td>
                  <td className="px-3 py-2.5 text-slate-600 text-xs">
                    {c.category}
                    {c.subcategory && <span className="block text-[10.5px] text-slate-400">{c.subcategory}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">{c.lga}, {c.state}</td>
                  <td className="px-3 py-2.5"><ChannelChip channel={c.channel} detail={c.channelDetail} /></td>
                  <td className="px-3 py-2.5"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs whitespace-nowrap">{c.assignedTo || <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-2.5 text-right text-xs text-slate-400 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-400">
                  {loading ? (
                    <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Loading cases…</span>
                  ) : allCases.length === 0 ? (
                    'No grievances yet — they will appear here as they come in through the channels.'
                  ) : 'No cases match these filters.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}

        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>Page {page + 1} of {pages} · {filtered.length} cases</span>
          <div className="flex gap-1.5">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium disabled:opacity-40 hover:bg-slate-50"
            >Previous</button>
            <button
              disabled={page >= pages - 1}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium disabled:opacity-40 hover:bg-slate-50"
            >Next</button>
          </div>
        </div>
      </Card>
    </div>
  )
}
