import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import {
  ArrowUpRight, AlertTriangle, MapPin, Activity, ChevronRight,
  Inbox, Clock, Loader2, UserCheck, Layers, ArrowRight, CheckCircle2,
} from 'lucide-react'
import { Card, CardHeader, StatusBadge, PriorityBadge, ChannelChip } from '../components/ui'
import { STATES, CHANNELS, fmtDate, isOpen, channelParent } from '../data/mock'
import { fetchCases } from '../data/casesApi'
import { fetchCategoryNames } from '../data/taxonomyApi'
import { getAuth } from '../lib/auth'

const BRAND = ['#2f8a5d', '#0ea5e9', '#f59e0b', '#8b5cf6', '#f43f5e', '#6366f1', '#14b8a6']
const DAY = 86400000
const NOW = new Date()

const RANGES = [
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: 'all', label: 'All time', days: null },
]
const STATUS_OPTS = [
  { id: '', label: 'All statuses' },
  { id: 'received', label: 'Received' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'under_investigation', label: 'Under investigation' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
]

function Spark({ data, color }) {
  return (
    <div className="h-9 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, bottom: 0, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={`sp${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} fill={`url(#sp${color.slice(1)})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

const selectCls = 'text-[12px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500'

function FitToData({ points, enabled }) {
  const map = useMap()
  useEffect(() => {
    if (!enabled || !points.length) return
    const lats = points.map(p => p.lat), lngs = points.map(p => p.lng)
    map.fitBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]], { padding: [34, 34], maxZoom: 9 })
  }, [points, enabled, map])
  return null
}

export default function Dashboard() {
  const me = getAuth() || {}
  const national = me.isSuperAdmin || !me.scope || me.scope === 'All states'
  const isManager = me.isSuperAdmin || /admin/i.test(me.role || '') || national
  const myName = me.name || ''

  const firstName = (myName.trim().split(/\s+/)[0]) || 'there'
  const hour = NOW.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const initials = (myName.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('') || 'U').toUpperCase()
  const levelLabel = me.tier ? `Level ${me.tier}` : (national ? 'Federal' : null)
  const scopeChip = national ? 'All states' : me.scope

  const [allCases, setAllCases] = useState([])
  const [categoryList, setCategoryList] = useState([])
  const [loading, setLoading] = useState(true)

  const [range, setRange] = useState('90')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [channel, setChannel] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [mineOnly, setMineOnly] = useState(!isManager)

  useEffect(() => {
    fetchCases().then(setAllCases).catch(() => {}).finally(() => setLoading(false))
    fetchCategoryNames().then(setCategoryList).catch(() => {})
  }, [])

  const rangeDays = RANGES.find(r => r.id === range)?.days

  const scopedCases = useMemo(
    () => national ? allCases : allCases.filter(c => c.state === me.scope),
    [allCases, national, me.scope],
  )

  const view = useMemo(() => scopedCases.filter(c =>
    (!rangeDays || (NOW - c.createdAt) <= rangeDays * DAY) &&
    (!status || c.status === status) &&
    (!category || c.category === category) &&
    (!channel || channelParent(c.channel) === channel) &&
    (!stateFilter || c.state === stateFilter) &&
    (!mineOnly || (c.assignedTo && c.assignedTo === myName))
  ), [scopedCases, rangeDays, status, category, channel, stateFilter, mineOnly, myName])

  const k = useMemo(() => {
    const open = view.filter(isOpen)
    const resolved = view.filter(c => c.resolutionDays != null)
    const breached = view.filter(c => c.slaBreached && isOpen(c))
    const mine = scopedCases.filter(c => c.assignedTo === myName && isOpen(c))
    const dueSoon = open.filter(c => c.dueAt && c.dueAt > NOW && (c.dueAt - NOW) <= 7 * DAY)
    return {
      total: view.length,
      open: open.length,
      breached: breached.length,
      resolved: resolved.length,
      avgRes: resolved.length ? resolved.reduce((a, c) => a + c.resolutionDays, 0) / resolved.length : 0,
      resolutionRate: view.length ? Math.round((resolved.length / view.length) * 100) : 0,
      mine: mine.length,
      dueSoon: dueSoon.length,
    }
  }, [view, scopedCases, myName])

  const weekly = (filter) => {
    const out = []
    for (let w = 7; w >= 0; w--) {
      const start = new Date(NOW.getTime() - (w + 1) * 7 * DAY)
      const end = new Date(NOW.getTime() - w * 7 * DAY)
      out.push({ v: view.filter(c => filter(c, start, end)).length })
    }
    return out
  }
  const sparks = useMemo(() => ({
    received: weekly((c, s, e) => c.createdAt >= s && c.createdAt < e),
    resolved: weekly((c, s, e) => c.resolvedAt && c.resolvedAt >= s && c.resolvedAt < e),
    breached: weekly((c, s, e) => c.slaBreached && c.dueAt && c.dueAt >= s && c.dueAt < e),
  }), [view]) // eslint-disable-line react-hooks/exhaustive-deps

  const trend = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1)
      const next = new Date(NOW.getFullYear(), NOW.getMonth() - i + 1, 1)
      months.push({
        name: d.toLocaleDateString('en-NG', { month: 'short' }),
        received: view.filter(c => c.createdAt >= d && c.createdAt < next).length,
        resolved: view.filter(c => c.resolvedAt && c.resolvedAt >= d && c.resolvedAt < next).length,
      })
    }
    return months
  }, [view])

  const breakdown = useMemo(() => {
    const keyOf = national ? (c => c.state) : (c => c.lga || '—')
    const m = {}
    view.forEach(c => {
      const key = keyOf(c) || '—'
      m[key] = m[key] || { name: key, open: 0, closed: 0 }
      isOpen(c) ? m[key].open++ : m[key].closed++
    })
    return Object.values(m).sort((a, b) => (b.open + b.closed) - (a.open + a.closed)).slice(0, 12)
  }, [view, national])

  const byChannel = useMemo(() =>
    CHANNELS.map(ch => ({ name: ch.label, value: view.filter(c => channelParent(c.channel) === ch.id).length }))
      .filter(d => d.value > 0),
  [view])

  const byCategory = useMemo(() => {
    const m = {}
    view.forEach(c => { m[c.category] = (m[c.category] || 0) + 1 })
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6)
  }, [view])

  const byTier = useMemo(() => {
    const names = { 1: 'L1 Community', 2: 'L2 State PIU', 3: 'L3 Ministries', 4: 'L4 FPMU' }
    return [1, 2, 3, 4].map(t => ({ name: names[t], count: view.filter(c => c.tier === t).length }))
  }, [view])

  const attention = useMemo(() =>
    view.filter(c => c.slaBreached && isOpen(c)).sort((a, b) => a.dueAt - b.dueAt).slice(0, 6),
  [view])

  const myQueue = useMemo(() =>
    scopedCases.filter(c => c.assignedTo === myName && isOpen(c))
      .sort((a, b) => (a.dueAt || Infinity) - (b.dueAt || Infinity)).slice(0, 6),
  [scopedCases, myName])

  const action = useMemo(() => {
    const lvl = me.tier ?? (national ? 4 : null)
    const onDesk = (c) => isOpen(c) && (c.assignedTo === myName || (lvl != null && lvl === c.tier))
    const myOpen = scopedCases.filter(onDesk)
    const myOverdue = myOpen.filter(c => c.slaBreached || (c.dueAt && c.dueAt < NOW))
    const myDueSoon = myOpen.filter(c => c.dueAt && c.dueAt >= NOW && (c.dueAt - NOW) <= 7 * DAY)
    const scopeBreaches = scopedCases.filter(c => c.slaBreached && isOpen(c))
    return { myOpen: myOpen.length, myOverdue: myOverdue.length, myDueSoon: myDueSoon.length, scopeBreaches: scopeBreaches.length }
  }, [scopedCases, myName, me.tier, national])

  const recent = useMemo(() =>
    [...view].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
  [view])

  const mapped = useMemo(() => view.filter(c => c.lat != null && c.lng != null), [view])

  const scopeLabel = national ? 'National view' : `${me.scope} · State view`
  const title = national ? 'National Grievance Pulse'
    : `${me.scope} Grievance Desk${me.community ? ` · ${me.community}` : ''}`

  if (loading) {
    return (
      <div className="p-5 flex items-center justify-center h-[60vh] text-slate-400">
        <Loader2 size={18} className="animate-spin mr-2" /> Loading dashboard…
      </div>
    )
  }

  const hasAction = action.myOpen > 0 || (isManager && action.scopeBreaches > 0)

  return (
    <div className="p-3 md:p-5 space-y-3 md:space-y-4">

      <div className="flex flex-col lg:flex-row lg:items-stretch gap-3 md:gap-4 fade-up">

        <div className="flex items-center gap-3.5 rounded-md bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] px-5 py-4 lg:w-[360px] shrink-0">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-white flex items-center justify-center text-base font-bold shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-[17px] font-bold tracking-tight text-slate-900 truncate">{greeting}, {firstName}</h1>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[10.5px] font-semibold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">{me.role || 'User'}</span>
              {levelLabel && <span className="text-[10.5px] font-semibold text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200 rounded-full px-2 py-0.5">{levelLabel}</span>}
              <span className="text-[10.5px] font-semibold text-sky-700 bg-sky-50 ring-1 ring-sky-200 rounded-full px-2 py-0.5 inline-flex items-center gap-1"><MapPin size={10} />{scopeChip}</span>
            </div>
          </div>
        </div>

        {hasAction ? (
          <Link
            to={action.myOpen > 0 ? '/cases?view=mine' : '/cases?view=all'}
            className="group flex items-center gap-4 flex-1 rounded-md border px-5 py-4 transition-colors bg-amber-50/70 border-amber-200 hover:bg-amber-50"
          >
            <span className="h-11 w-11 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </span>
            <div className="min-w-0 flex-1">
              {action.myOpen > 0 ? (
                <>
                  <p className="text-[14px] font-bold text-slate-800">
                    {action.myOpen} {action.myOpen === 1 ? 'case is' : 'cases are'} waiting for your action
                  </p>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    {action.myOverdue > 0 && <span className="font-semibold text-rose-600">{action.myOverdue} past deadline</span>}
                    {action.myOverdue > 0 && action.myDueSoon > 0 && ' · '}
                    {action.myDueSoon > 0 && <span className="text-amber-700">{action.myDueSoon} due within 7 days</span>}
                    {action.myOverdue === 0 && action.myDueSoon === 0 && 'Assigned to you and still open'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[14px] font-bold text-slate-800">{action.scopeBreaches} {action.scopeBreaches === 1 ? 'case has' : 'cases have'} breached SLA in your scope</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">These need to be reassigned or escalated</p>
                </>
              )}
            </div>
            <span className="hidden sm:inline-flex items-center gap-1 text-[12px] font-semibold text-amber-800 whitespace-nowrap">
              {action.myOpen > 0 ? 'Open my cases' : 'Review'} <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-4 flex-1 rounded-md border border-emerald-200 bg-emerald-50/60 px-5 py-4">
            <span className="h-11 w-11 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <p className="text-[14px] font-bold text-slate-800">You’re all caught up</p>
              <p className="text-[12px] text-slate-500 mt-0.5">Nothing is waiting for your action right now</p>
            </div>
          </div>
        )}
      </div>

      <div className="relative overflow-hidden rounded-md bg-white border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] fade-up">
        <div className="relative px-6 pt-5 pb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold tracking-tight text-slate-900">{title}</h1>
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded-full px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-dot" /> Live
              </span>
            </div>
            <p className="text-[12.5px] text-slate-500 mt-1">
              {scopeLabel} · {isManager ? 'Manager dashboard' : 'Officer dashboard'} · {scopedCases.length} cases in your scope · {fmtDate(NOW)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-0 divide-x divide-slate-100 rounded-md bg-slate-50/60 ring-1 ring-slate-200/70">
            {[
              { label: mineOnly ? 'My open cases' : 'Open cases', value: k.open, spark: sparks.received, color: '#22774e', sub: `${k.total} in view` },
              { label: 'Resolution rate', value: `${k.resolutionRate}%`, spark: sparks.resolved, color: '#0284c7', sub: `${k.avgRes.toFixed(1)}d avg` },
              { label: 'SLA breaches', value: k.breached, spark: sparks.breached, color: '#e11d48', sub: 'need action' },
            ].map(c => (
              <div key={c.label} className="flex flex-1 min-w-[150px] items-center gap-3 px-5 py-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{c.label}</p>
                  <p className="text-xl font-bold tracking-tight" style={{ color: c.color }}>{c.value}</p>
                  <p className="text-[10px] text-slate-400">{c.sub}</p>
                </div>
                <Spark data={c.spark} color={c.color} />
              </div>
            ))}
          </div>
        </div>

        <div className="relative border-t border-slate-100 px-6 py-2.5 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">
            <Activity size={12} className="text-emerald-600" /> Filter
          </span>
          <select value={range} onChange={e => setRange(e.target.value)} className={selectCls}>
            {RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className={selectCls}>
            {STATUS_OPTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls}>
            <option value="">All categories</option>
            {categoryList.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={channel} onChange={e => setChannel(e.target.value)} className={selectCls}>
            <option value="">All touch points</option>
            {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          {national && (
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)} className={selectCls}>
              <option value="">All states</option>
              {STATES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
          )}
          <button
            onClick={() => setMineOnly(m => !m)}
            className={`flex items-center gap-1.5 text-[12px] font-semibold rounded-md px-2.5 py-1.5 ring-1 ring-inset transition-colors ${
              mineOnly ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300'
            }`}
          >
            <UserCheck size={13} /> Assigned to me{k.mine ? ` · ${k.mine}` : ''}
          </button>
        </div>
      </div>

      {!isManager && (
        <div className="grid grid-cols-12 gap-3 md:gap-4">
          {[
            { label: 'Assigned to me', value: k.mine, icon: Inbox, tone: 'text-brand-700 bg-brand-50', to: '/cases' },
            { label: 'Due within 7 days', value: k.dueSoon, icon: Clock, tone: 'text-amber-600 bg-amber-50', to: '/cases' },
            { label: 'Past SLA (mine)', value: myQueue.filter(c => c.slaBreached).length, icon: AlertTriangle, tone: 'text-rose-600 bg-rose-50', to: '/cases' },
          ].map(s => (
            <Card key={s.label} className="col-span-12 sm:col-span-4 p-4 flex items-center gap-3 fade-up">
              <span className={`h-10 w-10 rounded-md flex items-center justify-center ${s.tone}`}><s.icon size={18} /></span>
              <div>
                <p className="text-2xl font-bold text-slate-900 leading-none">{s.value}</p>
                <p className="text-[11px] text-slate-400 mt-1">{s.label}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-12 gap-3 md:gap-4">
        <Card className="col-span-12 xl:col-span-5 pb-2 fade-up">
          <CardHeader title="Caseload Trend" subtitle="Received vs resolved · last 6 months" />
          <div className="h-60 px-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 12, right: 14, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f8a5d" stopOpacity={0.25} /><stop offset="100%" stopColor="#2f8a5d" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.2} /><stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
                <Area type="monotone" dataKey="received" name="Received" stroke="#2f8a5d" strokeWidth={2} fill="url(#gRec)" />
                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#0ea5e9" strokeWidth={2} fill="url(#gRes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="col-span-12 md:col-span-7 xl:col-span-4 overflow-hidden fade-up relative">
          <div className="absolute top-0 left-0 right-0 z-[1000] px-5 pt-3.5 pb-6 bg-gradient-to-b from-white via-white/85 to-transparent pointer-events-none">
            <div className="flex items-center justify-between pointer-events-auto">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><MapPin size={14} className="text-emerald-600" /> Grievance Map</h3>
                <p className="text-[11px] text-slate-400">{mapped.length} geo-tagged · red = past SLA</p>
              </div>
              <Link to="/map" className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-full px-2.5 py-1 flex items-center gap-1">Expand <ArrowUpRight size={11} /></Link>
            </div>
          </div>
          <div className="h-72">
            <MapContainer center={national ? [9.9, 8.2] : [10.5, 8.0]} zoom={national ? 5 : 6} zoomControl={false} scrollWheelZoom={false} dragging={false} doubleClickZoom={false} attributionControl={false} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
              <FitToData points={mapped} enabled={!national} />
              {mapped.map(c => (
                <CircleMarker key={c.id} center={[c.lat, c.lng]} radius={3.5}
                  pathOptions={{ color: 'transparent', fillColor: c.slaBreached && isOpen(c) ? '#f43f5e' : isOpen(c) ? '#2f8a5d' : '#94a3b8', fillOpacity: 0.7 }} />
              ))}
            </MapContainer>
          </div>
        </Card>

        <Card className="col-span-12 md:col-span-5 xl:col-span-3 pb-2 fade-up">
          <CardHeader title="Touch Points" subtitle="Where grievances come in" />
          <div className="h-60 relative">
            {byChannel.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-[12px] text-slate-300">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byChannel} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                    {byChannel.map((_, i) => <Cell key={i} fill={BRAND[i % BRAND.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10.5 }} iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none -mt-7">
              <div className="text-center"><div className="text-lg font-bold text-slate-900">{k.total}</div><div className="text-[9px] text-slate-400 uppercase tracking-wider">cases</div></div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-3 md:gap-4">
        <Card className="col-span-12 xl:col-span-6 pb-2 fade-up">
          <CardHeader
            title={national ? 'Caseload by State' : `Caseload by LGA · ${me.scope}`}
            subtitle="Open vs resolved"
            action={<Link to="/map" className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">Map view <ArrowUpRight size={12} /></Link>}
          />
          <div className="h-64 px-2">
            {breakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[12px] text-slate-300">No cases in this view yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdown} margin={{ top: 8, right: 12, left: -20, bottom: 0 }} barSize={15}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} angle={-28} textAnchor="end" height={44} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#64748b', fillOpacity: 0.14 }} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="open" name="Open" stackId="a" fill="#2f8a5d" />
                  <Bar dataKey="closed" name="Resolved / Closed" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-3 p-5 fade-up">
          <h3 className="text-sm font-semibold text-slate-800 mb-3.5">Top Categories</h3>
          {byCategory.length === 0 ? (
            <p className="text-[12px] text-slate-300 py-8 text-center">No cases yet</p>
          ) : (
            <div className="space-y-3">
              {byCategory.map((c, i) => {
                const max = byCategory[0].count || 1
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-[11.5px] mb-1">
                      <span className="text-slate-600 font-medium truncate pr-2">{c.name}</span>
                      <span className="text-slate-400 font-semibold">{c.count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(c.count / max) * 100}%`, background: BRAND[i % BRAND.length] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {isManager && (
            <>
              <h3 className="text-sm font-semibold text-slate-800 mt-5 mb-2 flex items-center gap-1.5"><Layers size={13} className="text-indigo-500" /> By escalation level</h3>
              <div className="flex items-end gap-1.5 h-16">
                {byTier.map((t, i) => {
                  const max = Math.max(1, ...byTier.map(x => x.count))
                  return (
                    <div key={t.name} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${t.name}: ${t.count}`}>
                      <div className="w-full rounded-t" style={{ height: `${(t.count / max) * 100}%`, minHeight: t.count ? 4 : 0, background: BRAND[i % BRAND.length] }} />
                      <span className="text-[8.5px] text-slate-400">L{i + 1}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </Card>

        <Card className="col-span-12 md:col-span-6 xl:col-span-3 overflow-hidden fade-up border-t-2 border-t-rose-400">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              {!isManager ? <><Inbox size={14} className="text-brand-600" /> My Queue</> : <><AlertTriangle size={14} className="text-rose-500" /> Needs Attention</>}
            </h3>
            <p className="text-[11px] text-slate-400">{!isManager ? 'Cases assigned to you, soonest due first' : 'Open cases past SLA, oldest first'}</p>
          </div>
          <div className="px-2 pb-2">
            {(!isManager ? myQueue : attention).map(c => (
              <Link key={c.id} to={`/cases/${c.id}`} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-slate-50 group">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.slaBreached && isOpen(c) ? 'bg-rose-500' : 'bg-brand-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-semibold text-slate-700 truncate">{c.code}</p>
                  <p className="text-[10.5px] text-slate-400 truncate">{c.category} · {c.lga || c.state}</p>
                </div>
                {c.dueAt && (
                  <span className={`text-[10px] font-bold whitespace-nowrap ${c.dueAt < NOW ? 'text-rose-500' : 'text-slate-400'}`}>
                    {c.dueAt < NOW ? `${Math.round((NOW - c.dueAt) / DAY)}d over` : `${Math.round((c.dueAt - NOW) / DAY)}d left`}
                  </span>
                )}
                <ChevronRight size={13} className="text-slate-300 group-hover:text-slate-400" />
              </Link>
            ))}
            {(!isManager ? myQueue : attention).length === 0 && (
              <p className="px-2.5 py-8 text-center text-[12px] text-slate-300">{!isManager ? 'Nothing assigned to you' : 'No breaches — all within SLA'}</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="fade-up overflow-hidden">
        <CardHeader
          title="Recent Cases"
          subtitle="Latest registered grievances in your scope"
          action={<Link to="/cases" className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">All cases <ArrowUpRight size={12} /></Link>}
        />
        <div className="overflow-x-auto mt-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-400 border-y border-slate-100">
                <th className="px-5 py-2.5 font-semibold">Case</th>
                <th className="px-3 py-2.5 font-semibold">Category</th>
                <th className="px-3 py-2.5 font-semibold">Location</th>
                <th className="px-3 py-2.5 font-semibold">Channel</th>
                <th className="px-3 py-2.5 font-semibold">Priority</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-5 py-2.5 font-semibold text-right">Received</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(c => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-2.5"><Link to={`/cases/${c.id}`} className="font-semibold text-emerald-700 hover:underline text-xs">{c.code}</Link></td>
                  <td className="px-3 py-2.5 text-slate-700 text-xs">{c.category}</td>
                  <td className="px-3 py-2.5 text-slate-500 text-xs">{c.lga ? `${c.lga}, ` : ''}{c.state}</td>
                  <td className="px-3 py-2.5"><ChannelChip channel={c.channel} /></td>
                  <td className="px-3 py-2.5"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-2.5 text-right text-xs text-slate-400">{fmtDate(c.createdAt)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">No grievances yet — they will appear here as they come in through the channels.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
