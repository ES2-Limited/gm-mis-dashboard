import { useEffect, useState } from 'react'
import {
  Smartphone, Loader2, RefreshCw, AlertTriangle, MapPinOff, KeyRound, Plus,
  Copy, X, Check, Download, Wifi, ShieldCheck, ArrowLeft, ArrowRight, ChevronRight,
} from 'lucide-react'
import {
  fetchDevices, fetchActivationCodes, issueActivationCode, revokeActivationCode, fetchOfficersForState,
} from '../data/devicesApi'
import { activeStateNames } from '../data/coverage'
import { getAuth } from '../lib/auth'
import { currentPermissions } from '../lib/rbac'
import { getViewAs } from '../data/mock'
import { toast } from '../lib/toast'
import Pager from '../components/Pager'

const DAY = 86400000
const PAGE = 10
const daysSince = (d) => (d ? Math.floor((Date.now() - d.getTime()) / DAY) : Infinity)
const since = (d) => {
  if (!d) return 'never'
  const m = Math.floor((Date.now() - d.getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
const fmt = (d) =>
  d ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const initials = (n = '') => n.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
function downloadCsv(name, head, rows) {
  const body = rows.map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob([[head.map(esc).join(','), body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
const inDateRange = (d, from, to) => {
  if (!from && !to) return true
  const t = d ? d.getTime() : null
  if (from && (t == null || t < new Date(`${from}T00:00:00`).getTime())) return false
  if (to && (t == null || t > new Date(`${to}T23:59:59`).getTime())) return false
  return true
}
const inputCls = 'text-[12.5px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30'
const statusOfWith = (d, threshold) => {
  const days = daysSince(d.lastSeenAt)
  if (days <= 1) return 'online'
  if (days <= threshold) return 'quiet'
  return 'silent'
}
const STATE_PILL = {
  online: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  quiet: 'bg-amber-50 text-amber-700 ring-amber-200',
  silent: 'bg-rose-50 text-rose-700 ring-rose-200',
}
const STATE_LABEL = { online: 'Online', quiet: 'Quiet', silent: 'Silent' }

export default function Devices() {
  const [devices, setDevices] = useState([])
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState('stats')
  const [addOpen, setAddOpen] = useState(false)
  const [threshold, setThreshold] = useState(10)

  const load = () => {
    setRefreshing(true)
    return Promise.all([
      fetchDevices().then(setDevices).catch(() => {}),
      fetchActivationCodes().then(setCodes).catch(() => {}),
    ]).finally(() => { setLoading(false); setRefreshing(false) })
  }
  useEffect(() => { load() }, [])

  const me = getAuth() || getViewAs() || {}
  const national = !me.scope || me.scope === 'All states'
  const canIssue = me.isSuperAdmin || currentPermissions(me).includes('settings')

  const online = devices.filter((d) => statusOfWith(d, threshold) === 'online').length
  const silent = devices.filter((d) => statusOfWith(d, threshold) === 'silent').length
  const synced = devices.filter((d) => d.lastSyncAt).length
  const pendingCodes = codes.filter((c) => c.status === 'pending').length

  const reportingStates = new Set(devices.map((d) => d.state).filter((s) => s && s !== 'All states'))
  const expectedStates = national ? activeStateNames() : (me.scope ? [].concat(me.scope) : [])
  const silentStates = expectedStates.filter((s) => !reportingStates.has(s))

  return (
    <div className="p-3 md:p-5 space-y-3 md:space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {view !== 'stats' && (
            <button onClick={() => setView('stats')} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-2">
              <ArrowLeft size={14} /> Overview
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Smartphone size={18} className="text-brand-700" />
              {view === 'devices' ? 'All Devices' : view === 'codes' ? 'Activation Codes' : 'Field Devices'}
            </h1>
            <p className="text-[12.5px] text-slate-400 mt-0.5">
              {view === 'devices' ? 'Every provisioned phone and when it last reached the server.'
                : view === 'codes' ? 'Provision a phone to one officer — the phone then locks to that account.'
                : 'Fleet at a glance — check-in health and states that have gone quiet.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md px-2.5 py-2 hover:bg-slate-50">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          {canIssue && (
            <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2 hover:bg-brand-800">
              <Plus size={14} /> Add device
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-10 flex items-center justify-center text-slate-400 text-[13px] gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</div>
      ) : view === 'stats' ? (
        <StatsView
          devices={devices} codes={codes} national={national} threshold={threshold} setThreshold={setThreshold}
          online={online} silent={silent} synced={synced} pendingCodes={pendingCodes}
          silentStates={silentStates} canIssue={canIssue}
          onViewDevices={() => setView('devices')} onViewCodes={() => setView('codes')}
        />
      ) : view === 'devices' ? (
        <DevicesTable devices={devices} national={national} me={me} threshold={threshold} />
      ) : (
        <CodesTable codes={codes} reload={load} onAdd={() => setAddOpen(true)} />
      )}

      {addOpen && <IssueModal national={national} me={me} onClose={() => setAddOpen(false)} onIssued={() => { setAddOpen(false); load() }} />}
    </div>
  )
}

function StatsView({ devices, codes, national, threshold, setThreshold, online, silent, synced, pendingCodes, silentStates, canIssue, onViewDevices, onViewCodes }) {
  const total = devices.length
  const quiet = devices.filter((d) => statusOfWith(d, threshold) === 'quiet').length
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0)

  const byState = Object.entries(devices.reduce((m, d) => { const k = d.state || '—'; m[k] = (m[k] || 0) + 1; return m }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxState = Math.max(1, ...byState.map(([, n]) => n))

  const Stat = ({ label, value, tone, icon: Icon }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        {Icon && <Icon size={15} className={tone || 'text-slate-300'} />}
      </div>
      <p className={`text-2xl font-bold mt-1 ${tone || 'text-slate-800'}`}>{value}</p>
    </div>
  )

  return (
    <div className="space-y-3 md:space-y-4">

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="Phones" value={total} icon={Smartphone} tone="text-slate-800" />
        <Stat label="Reporting (≤24h)" value={online} icon={Wifi} tone="text-emerald-600" />
        <Stat label="Ever synced data" value={synced} icon={ShieldCheck} tone="text-brand-700" />
        <Stat label={`Silent (>${threshold}d)`} value={silent} icon={silent ? AlertTriangle : undefined} tone={silent ? 'text-rose-600' : 'text-slate-800'} />
        <Stat label="States not reporting" value={silentStates.length} icon={silentStates.length ? MapPinOff : undefined} tone={silentStates.length ? 'text-rose-600' : 'text-slate-800'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Fleet status</h3>
            <span className="text-[11px] text-slate-400">flag silent after
              <select value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="ml-1.5 text-[11px] rounded border border-slate-200 bg-white px-1 py-0.5">
                {[3, 7, 10, 14, 30].map((n) => <option key={n} value={n}>{n}d</option>)}
              </select>
            </span>
          </div>
          {total === 0 ? (
            <p className="text-[12.5px] text-slate-300 py-6 text-center">No phones checked in yet.</p>
          ) : (
            <>
              <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
                <div className="bg-emerald-500" style={{ width: `${pct(online)}%` }} />
                <div className="bg-amber-400" style={{ width: `${pct(quiet)}%` }} />
                <div className="bg-rose-500" style={{ width: `${pct(silent)}%` }} />
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-[12px]">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Online <b className="text-slate-700">{online}</b></span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Quiet <b className="text-slate-700">{quiet}</b></span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Silent <b className="text-slate-700">{silent}</b></span>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Devices by state</h3>
          {byState.length === 0 ? (
            <p className="text-[12.5px] text-slate-300 py-6 text-center">No devices to chart yet.</p>
          ) : (
            <div className="space-y-2">
              {byState.map(([s, n]) => (
                <div key={s} className="flex items-center gap-3">
                  <span className="text-[12px] text-slate-600 w-24 truncate">{s}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-brand-500 rounded-full" style={{ width: `${(n / maxState) * 100}%` }} /></div>
                  <span className="text-[12px] font-semibold text-slate-700 w-6 text-right">{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {silentStates.length > 0 && (
        <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3.5">
          <p className="text-[12.5px] font-semibold text-rose-700 flex items-center gap-1.5"><MapPinOff size={14} /> {silentStates.length} active state{silentStates.length > 1 ? 's have' : ' has'} no reporting phone</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {silentStates.map((s) => <span key={s} className="text-[12px] font-medium text-rose-700 bg-white ring-1 ring-rose-200 rounded-md px-2 py-1">{s}</span>)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={onViewDevices} className="group text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-brand-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="h-9 w-9 rounded-lg bg-brand-50 text-brand-700 grid place-items-center"><Smartphone size={17} /></span>
            <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-600" />
          </div>
          <h3 className="text-[14px] font-bold text-slate-800 mt-3">All Devices</h3>
          <p className="text-[11.5px] text-slate-500 mt-0.5">{devices.length} provisioned {devices.length === 1 ? 'phone' : 'phones'} — full list, filters, export.</p>
        </button>
        {canIssue && (
          <button onClick={onViewCodes} className="group text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-brand-300 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between">
              <span className="h-9 w-9 rounded-lg bg-brand-50 text-brand-700 grid place-items-center"><KeyRound size={17} /></span>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-brand-600" />
            </div>
            <h3 className="text-[14px] font-bold text-slate-800 mt-3">Activation Codes</h3>
            <p className="text-[11.5px] text-slate-500 mt-0.5">{codes.length} issued{pendingCodes ? ` · ${pendingCodes} pending` : ''} — provision & manage phones.</p>
          </button>
        )}
      </div>
    </div>
  )
}

function DevicesTable({ devices, national, me, threshold }) {
  const [stateFilter, setStateFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [stateFilter, from, to])

  const filtered = devices
    .filter((d) => (!stateFilter || d.state === stateFilter))
    .filter((d) => inDateRange(d.lastSeenAt, from, to))
    .slice()
    .sort((a, b) => (b.lastSeenAt?.getTime() || 0) - (a.lastSeenAt?.getTime() || 0))
  const paged = filtered.slice((page - 1) * PAGE, page * PAGE)

  const exportAll = () => {
    downloadCsv('spin-field-devices',
      ['Officer', 'Email', 'Role', 'State', 'LGA', 'Platform', 'App version', 'First seen', 'Last check-in', 'Last data sync', 'Heartbeats', 'Status'],
      filtered.map((d) => [d.userName, d.userEmail, d.role, d.state, d.lga, d.platform, d.appVersion, fmt(d.firstSeenAt), fmt(d.lastSeenAt), fmt(d.lastSyncAt), d.heartbeats, STATE_LABEL[statusOfWith(d, threshold)]]))
    toast(`Exported ${filtered.length} devices`)
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">Filter</span>
        {national && (
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className={inputCls}>
            <option value="">All states</option>
            {activeStateNames().map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <label className="text-[12px] text-slate-500">From</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        <label className="text-[12px] text-slate-500">To</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        {(from || to) && <button onClick={() => { setFrom(''); setTo('') }} className="text-[12px] text-slate-400 hover:text-slate-600">clear</button>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Devices <span className="text-slate-400 font-normal">· {filtered.length}</span></h3>
          <button onClick={exportAll} disabled={!filtered.length} className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-40"><Download size={13} /> Export CSV</button>
        </div>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-slate-400">No phones match. A device appears the first time its officer signs in after activation.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="px-3.5 py-2.5">Officer</th><th className="px-3.5 py-2.5">State</th><th className="px-3.5 py-2.5">Device</th>
                    <th className="px-3.5 py-2.5">Last check-in</th><th className="px-3.5 py-2.5">Last data sync</th><th className="px-3.5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((d) => {
                    const st = statusOfWith(d, threshold)
                    return (
                      <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="h-7 w-7 shrink-0 rounded-full bg-brand-50 text-brand-700 grid place-items-center text-[10px] font-bold">{initials(d.userName) || '—'}</span>
                            <div className="min-w-0"><p className="font-semibold text-slate-700 truncate">{d.userName || 'Unknown'}</p><p className="text-[11px] text-slate-400 truncate">{d.role || d.userEmail || ''}</p></div>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600">{d.state || '—'}{d.lga ? <span className="text-slate-400"> · {d.lga}</span> : null}</td>
                        <td className="px-3.5 py-2.5 text-slate-500"><span className="capitalize">{d.platform || '—'}</span>{d.appVersion ? <span className="text-slate-400"> · v{d.appVersion}</span> : null}</td>
                        <td className="px-3.5 py-2.5 text-slate-600" title={fmt(d.lastSeenAt)}>{since(d.lastSeenAt)}</td>
                        <td className="px-3.5 py-2.5 text-slate-600" title={fmt(d.lastSyncAt)}>{since(d.lastSyncAt)}</td>
                        <td className="px-3.5 py-2.5"><span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 ring-1 ${STATE_PILL[st]}`}><span className={`h-1.5 w-1.5 rounded-full ${st === 'online' ? 'bg-emerald-500' : st === 'quiet' ? 'bg-amber-500' : 'bg-rose-500'}`} />{STATE_LABEL[st]}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  )
}

function CodesTable({ codes, reload, onAdd }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [from, to])

  const statusPill = (s) => ({
    pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    activated: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    revoked: 'bg-slate-100 text-slate-500 ring-slate-200',
  }[s] || 'bg-slate-100 text-slate-500 ring-slate-200')
  const revoke = async (id) => {
    try { await revokeActivationCode(id); toast('Code revoked'); reload() }
    catch (e) { toast(e.message || 'Could not revoke', 'error') }
  }
  const filtered = codes.filter((c) => inDateRange(c.createdAt, from, to))
  const paged = filtered.slice((page - 1) * PAGE, page * PAGE)
  const exportAll = () => {
    downloadCsv('spin-activation-codes',
      ['Code', 'Officer', 'Email', 'State', 'Status', 'Device', 'Issued by', 'Issued', 'Activated'],
      filtered.map((c) => [c.code, c.userName, c.userEmail, c.state, c.status, c.deviceId, c.issuedBy, fmt(c.createdAt), fmt(c.activatedAt)]))
    toast(`Exported ${filtered.length} codes`)
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">Issued</span>
        <label className="text-[12px] text-slate-500">From</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        <label className="text-[12px] text-slate-500">To</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        {(from || to) && <button onClick={() => { setFrom(''); setTo('') }} className="text-[12px] text-slate-400 hover:text-slate-600">clear</button>}
        <button onClick={onAdd} className="ml-auto flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-brand-700 rounded-md px-3 py-1.5 hover:bg-brand-800"><Plus size={13} /> Add device</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Codes <span className="text-slate-400 font-normal">· {filtered.length}</span></h3>
          <button onClick={exportAll} disabled={!filtered.length} className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-40"><Download size={13} /> Export CSV</button>
        </div>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-[12.5px] text-slate-400">No activation codes yet. Click <span className="font-semibold">Add device</span> to provision a phone.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="px-3.5 py-2.5">Code</th><th className="px-3.5 py-2.5">Officer</th><th className="px-3.5 py-2.5">State</th>
                    <th className="px-3.5 py-2.5">Status</th><th className="px-3.5 py-2.5">Issued</th><th className="px-3.5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-3.5 py-2.5 font-mono text-[15px] font-bold tracking-wider text-slate-800">{c.code}</td>
                      <td className="px-3.5 py-2.5"><span className="font-semibold text-slate-700">{c.userName || '—'}</span><span className="block text-[11px] text-slate-400">{c.userEmail}</span></td>
                      <td className="px-3.5 py-2.5 text-slate-600">{c.state || '—'}</td>
                      <td className="px-3.5 py-2.5"><span className={`inline-flex items-center text-[11px] font-semibold rounded-full px-2 py-0.5 ring-1 capitalize ${statusPill(c.status)}`}>{c.status}</span></td>
                      <td className="px-3.5 py-2.5 text-slate-500" title={`by ${c.issuedBy || ''}`}>{fmt(c.createdAt)}</td>
                      <td className="px-3.5 py-2.5 text-right">{c.status !== 'revoked' && <button onClick={() => revoke(c.id)} className="text-[11.5px] font-medium text-rose-600 hover:text-rose-700">Revoke</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  )
}

function IssueModal({ national, me, onClose, onIssued }) {
  const [stateSel, setStateSel] = useState(national ? '' : me.scope)
  const [officers, setOfficers] = useState([])
  const [userId, setUserId] = useState('')
  const [maxOffline, setMaxOffline] = useState(10)
  const [loadingOff, setLoadingOff] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [issued, setIssued] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!stateSel) { setOfficers([]); return }
    setLoadingOff(true)
    fetchOfficersForState(stateSel)
      .then((list) => setOfficers(list.filter((o) => o.scope !== 'All states')))
      .catch(() => setOfficers([]))
      .finally(() => setLoadingOff(false))
  }, [stateSel])

  const submit = async () => {
    if (!userId) return
    setIssuing(true)
    try { setIssued(await issueActivationCode(userId, maxOffline)) }
    catch (e) { toast(e.message || 'Could not issue code', 'error') }
    finally { setIssuing(false) }
  }
  const copy = () => { navigator.clipboard?.writeText(issued.code); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const fld = 'w-full text-[13px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30'

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><KeyRound size={16} className="text-brand-700" /> Add device</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>
        </div>
        {issued ? (
          <div className="mt-3">
            <p className="text-[12.5px] text-slate-500">Give this code to <span className="font-semibold text-slate-700">{issued.userName || issued.userEmail}</span>. They enter it on the app before signing in — the phone then locks to their account.</p>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-4">
              <span className="font-mono text-3xl font-bold tracking-[0.3em] text-brand-800">{issued.code}</span>
              <button onClick={copy} className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 hover:text-brand-800">{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
            </div>
            <button onClick={onIssued} className="mt-4 w-full text-[13px] font-semibold text-white bg-brand-700 rounded-md py-2.5 hover:bg-brand-800">Done</button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-[12px] text-slate-500">{national ? 'Choose the state, then the officer this phone belongs to.' : `Issuing for ${me.scope} officers.`}</p>
            {national && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">State</label>
                <select value={stateSel} onChange={(e) => { setStateSel(e.target.value); setUserId('') }} className={`${fld} mt-1`}>
                  <option value="">Select state…</option>
                  {activeStateNames().map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Officer</label>
              <select value={userId} onChange={(e) => setUserId(e.target.value)} disabled={!stateSel || loadingOff} className={`${fld} mt-1 disabled:opacity-50`}>
                <option value="">{!stateSel ? 'Select a state first' : loadingOff ? 'Loading…' : (officers.length ? 'Select officer…' : 'No officers in this state')}</option>
                {officers.map((o) => <option key={o.id} value={o.id}>{o.name} — {o.role}{o.lga ? ` · ${o.lga}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Max time offline</label>
              <select value={maxOffline} onChange={(e) => setMaxOffline(Number(e.target.value))} className={`${fld} mt-1`}>
                {[1, 3, 5, 7, 10, 14, 30, 60].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'day' : 'days'}</option>)}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">The phone locks itself if it stays offline longer than this and must reconnect.</p>
            </div>
            <button onClick={submit} disabled={!userId || issuing} className="w-full flex items-center justify-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md py-2.5 hover:bg-brand-800 disabled:opacity-40">
              {issuing ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Generate code
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
