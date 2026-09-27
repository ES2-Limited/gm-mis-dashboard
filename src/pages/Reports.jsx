import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3, FileText, FolderOpen, AlertTriangle, CheckCircle2, History,
  ChevronsUp, PieChart, Map as MapIcon, Radio, Layers, Users, Gauge,
  ShieldAlert, Download, Printer, ArrowLeft, Loader2,
} from 'lucide-react'
import { Card, CardHeader } from '../components/ui'
import {
  STATES, isOpen, isRestricted, statusLabel, channelLabel, fmtDate, domainForCategory,
} from '../data/mock'
import { fetchCases } from '../data/casesApi'
import { fetchCategoryNames } from '../data/taxonomyApi'
import { getAuth } from '../lib/auth'
import { currentPermissions } from '../lib/rbac'
import { logEvent } from '../data/audit'
import { toast } from '../lib/toast'

const DAY = 86400000
const NOW = new Date()
const RANGES = [
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: '180', label: 'Last 6 months', days: 180 },
  { id: '365', label: 'Last 12 months', days: 365 },
  { id: 'all', label: 'All time', days: null },
]
const STATUS_OPTS = ['received', 'acknowledged', 'screening', 'assigned', 'under_investigation', 'escalated', 'referred', 'resolved', 'closed']
const selectCls = 'text-[12px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500'

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0)
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const isGbv = (c) => isRestricted(c.category)

function downloadCsv(name, head, rows) {
  const body = rows.map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob([[head.map(esc).join(','), body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

function actorsOf(c) {
  const names = []
  const add = (n) => { const v = (n || '').toString().trim(); if (v && !names.includes(v)) names.push(v) }
  add(c.registeredBy)
  ;(c.activity || []).forEach((a) => add(a.by))
  ;(c.escalations || []).forEach((e) => add(e.by))
  ;(c.notes || []).forEach((n) => add(n.by))
  ;(c.referrals || []).forEach((r) => add(r.by))
  add(c.assignedTo || c.assignedOfficer)
  return names
}

const COL = {
  code: { label: 'Case', get: (c) => c.code },
  complainant: { label: 'Complainant', get: (c) => (c.anonymous ? 'Anonymous' : c.complainant || '—') },
  domain: { label: 'Domain', get: (c) => c.domain || domainForCategory(c.category) },
  category: { label: 'Category', get: (c) => c.category },
  subgroup: { label: 'Sub-group', get: (c) => c.subcategory || '' },
  state: { label: 'State', get: (c) => c.state },
  lga: { label: 'LGA', get: (c) => c.lga || '' },
  community: { label: 'Community / Site', get: (c) => c.community || '' },
  channel: { label: 'Channel', get: (c) => channelLabel(c.channel) },
  priority: { label: 'Priority', get: (c) => (c.priority || '').replace(/^./, (m) => m.toUpperCase()) },
  status: { label: 'Status', get: (c) => statusLabel(c.status) },
  level: { label: 'Level', get: (c) => `Level ${c.tier || 1}` },
  assigned: { label: 'Assigned to', get: (c) => c.assignedTo || c.assignedOfficer || '—' },
  actors: { label: 'Actors', get: (c) => actorsOf(c).join(', ') },
  referredTo: { label: 'Referred to', get: (c) => (c.referrals || []).map((r) => r.body).join(', ') },
  received: { label: 'Received', get: (c) => fmtDate(c.createdAt) },
  due: { label: 'Due', get: (c) => (c.dueAt ? fmtDate(c.dueAt) : '') },
  resolved: { label: 'Resolved', get: (c) => (c.resolvedAt ? fmtDate(c.resolvedAt) : '') },
  days: { label: 'Days to resolve', get: (c) => (c.resolutionDays ?? '') },
  pastSla: { label: 'Past SLA', get: (c) => (c.slaBreached && isOpen(c) ? 'Yes' : 'No') },
  legacy: { label: 'Legacy', get: (c) => (c.legacy ? 'Yes' : '') },
}
const REGISTER_FULL = ['code', 'complainant', 'domain', 'category', 'subgroup', 'state', 'lga', 'community', 'channel', 'priority', 'status', 'level', 'assigned', 'actors', 'received', 'due', 'resolved', 'days', 'pastSla', 'legacy']
const GBV_COLS = ['code', 'category', 'state', 'lga', 'status', 'level', 'assigned', 'referredTo', 'received', 'pastSla']

const CATALOG = [
  { group: 'Case Registers', items: [
    { id: 'all', title: 'All Cases', desc: 'The complete grievance register — every case with full detail and the actors involved.', icon: FileText, kind: 'register', columns: REGISTER_FULL, match: () => true },
    { id: 'open', title: 'Open Cases', desc: 'Cases still moving through the mechanism (not yet resolved or closed).', icon: FolderOpen, kind: 'register', columns: REGISTER_FULL, match: (c) => isOpen(c) },
    { id: 'overdue', title: 'Overdue / Past-SLA', desc: 'Open cases that have passed their resolution window and need escalation.', icon: AlertTriangle, kind: 'register', columns: REGISTER_FULL, match: (c) => c.slaBreached && isOpen(c) },
    { id: 'resolved', title: 'Resolved & Closed', desc: 'Cases that reached resolution or closure, with time-to-resolve.', icon: CheckCircle2, kind: 'register', columns: REGISTER_FULL, match: (c) => c.status === 'resolved' || c.status === 'closed' },
    { id: 'escalated', title: 'Escalated Cases', desc: 'Cases that have moved up the escalation ladder.', icon: ChevronsUp, kind: 'register', columns: REGISTER_FULL, match: (c) => c.status === 'escalated' || (c.tier || 1) > 1 },
    { id: 'legacy', title: 'Legacy Grievances', desc: 'Pre-SPIN disputes documented and referred to the appropriate authority.', icon: History, kind: 'register', columns: ['code', 'category', 'state', 'lga', 'referredTo', 'status', 'received', 'actors'], match: (c) => !!c.legacy },
  ] },
  { group: 'Analytics', items: [
    { id: 'summary', title: 'Cases Summary', desc: 'Headline analytics — totals, GBV vs non-GBV, distribution by status, domain, category and geography, and SLA health.', icon: BarChart3, kind: 'summary', match: () => true },
  ] },
  { group: 'Breakdowns', items: [
    { id: 'by-status', title: 'By Status', desc: 'Where cases sit in the workflow.', icon: Layers, kind: 'breakdown', keyHeader: 'Status', groupBy: (c) => statusLabel(c.status), match: () => true },
    { id: 'by-domain', title: 'By Domain', desc: 'Social / Environmental / Other split.', icon: PieChart, kind: 'breakdown', keyHeader: 'Domain', groupBy: (c) => c.domain || domainForCategory(c.category), match: () => true },
    { id: 'by-category', title: 'By Category', desc: 'Grievance type distribution across the 14 categories.', icon: Layers, kind: 'breakdown', keyHeader: 'Category', groupBy: (c) => c.category, match: () => true },
    { id: 'by-geo', title: 'By Geography', desc: 'Distribution by state (or LGA within a state).', icon: MapIcon, kind: 'breakdown', keyHeader: 'Location', groupBy: null, match: () => true },
    { id: 'by-channel', title: 'By Intake Channel', desc: 'How grievances reach the mechanism.', icon: Radio, kind: 'breakdown', keyHeader: 'Channel', groupBy: (c) => channelLabel(c.channel), match: () => true },
    { id: 'by-level', title: 'By Escalation Level', desc: 'Position on the 4-level governance ladder.', icon: ChevronsUp, kind: 'breakdown', keyHeader: 'Level', order: ['Level 1', 'Level 2', 'Level 3', 'Level 4'], groupBy: (c) => `Level ${c.tier || 1}`, match: () => true },
    { id: 'by-officer', title: 'Officer Workload', desc: 'Caseload per assigned officer.', icon: Users, kind: 'breakdown', keyHeader: 'Officer', groupBy: (c) => c.assignedTo || c.assignedOfficer || 'Unassigned', match: () => true },
    { id: 'sla', title: 'SLA & Resolution Performance', desc: 'Resolution rate, average time-to-resolve, within-SLA and overdue counts.', icon: Gauge, kind: 'summary', variant: 'sla', match: () => true },
  ] },
  { group: 'Confidential', gbv: true, items: [
    { id: 'gbv', title: 'GBV / SEA-SH Report', desc: 'Confidential SEA/SH & GBV register — referral-focused, minimal identifying detail. Restricted access only.', icon: ShieldAlert, kind: 'register', gbv: true, columns: GBV_COLS, match: (c) => isGbv(c) },
  ] },
]

function BreakdownTable({ keyHeader, rows }) {
  const max = Math.max(1, ...rows.map((r) => r.total))
  return rows.length === 0 ? (
    <p className="px-5 py-10 text-center text-[12.5px] text-slate-300">No cases in this view yet</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50/70 border-y border-slate-100">
            <th className="px-5 py-2 font-semibold">{keyHeader}</th>
            <th className="px-3 py-2 font-semibold text-right">Total</th>
            <th className="px-3 py-2 font-semibold text-right">Open</th>
            <th className="px-3 py-2 font-semibold text-right">Resolved</th>
            <th className="px-3 py-2 font-semibold text-right">Past SLA</th>
            <th className="px-5 py-2 font-semibold w-40">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-slate-50 hover:bg-slate-50/60">
              <td className="px-5 py-2 text-[12.5px] font-medium text-slate-700">{r.name}</td>
              <td className="px-3 py-2 text-right text-[12.5px] font-semibold text-slate-800">{r.total}</td>
              <td className="px-3 py-2 text-right text-[12.5px] text-emerald-700">{r.open}</td>
              <td className="px-3 py-2 text-right text-[12.5px] text-slate-500">{r.resolved}</td>
              <td className="px-3 py-2 text-right text-[12.5px] text-rose-600">{r.breached || ''}</td>
              <td className="px-5 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(r.total / max) * 100}%` }} />
                  </div>
                  <span className="text-[10.5px] text-slate-400 w-8 text-right">{r.share}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Reports() {
  const me = getAuth() || {}
  const national = me.isSuperAdmin || !me.scope || me.scope === 'All states'
  const canGbv = me.isSuperAdmin || currentPermissions(me).includes('restricted')

  const [allCases, setAllCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryList, setCategoryList] = useState([])
  const [openId, setOpenId] = useState(null)

  const [range, setRange] = useState('180')
  const [stateFilter, setStateFilter] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')

  useEffect(() => {
    fetchCases().then(setAllCases).catch(() => {}).finally(() => setLoading(false))
    fetchCategoryNames().then(setCategoryList).catch(() => {})
  }, [])

  const report = CATALOG.flatMap((g) => g.items).find((r) => r.id === openId) || null
  const rangeDays = RANGES.find((r) => r.id === range)?.days

  // global filters
  const filtered = useMemo(() => allCases.filter((c) =>
    (!rangeDays || (NOW - c.createdAt) <= rangeDays * DAY) &&
    (!stateFilter || c.state === stateFilter) &&
    (!category || c.category === category) &&
    (!status || c.status === status) &&
    (!priority || c.priority === priority)
  ), [allCases, rangeDays, stateFilter, category, status, priority])

  const countFor = (r) => {
    const base = r.gbv ? filtered.filter(isGbv) : filtered.filter((c) => !isGbv(c))
    return base.filter(r.match).length
  }

  const groupRows = (list, keyOf, order) => {
    const m = {}
    list.forEach((c) => {
      const key = keyOf(c) || '—'
      m[key] = m[key] || { name: key, total: 0, open: 0, resolved: 0, breached: 0 }
      m[key].total++
      if (isOpen(c)) m[key].open++; else m[key].resolved++
      if (c.slaBreached && isOpen(c)) m[key].breached++
    })
    let rows = Object.values(m).map((r) => ({ ...r, share: pct(r.total, list.length) }))
    rows = order ? rows.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name)) : rows.sort((a, b) => b.total - a.total)
    return rows
  }

  if (loading) {
    return <div className="p-5 flex items-center justify-center h-[60vh] text-slate-400"><Loader2 size={18} className="animate-spin mr-2" /> Loading reports…</div>
  }

  if (!report) {
    return (
      <div className="p-3 md:p-5 space-y-4">
        <div className="fade-up">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 size={18} className="text-brand-600" /> Reports
          </h1>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            Pick a report to generate · {national ? 'national' : `${me.scope} state`} scope · {filtered.filter((c) => !isGbv(c)).length} cases available
          </p>
        </div>

        {CATALOG.filter((g) => !g.gbv || canGbv).map((g) => (
          <div key={g.group} className="fade-up">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{g.group}</h2>
              {g.gbv && <span className="text-[9.5px] font-bold uppercase tracking-wide text-rose-600 bg-rose-50 ring-1 ring-rose-200 rounded-full px-2 py-0.5">Restricted</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {g.items.filter((r) => !r.gbv || canGbv).map((r) => {
                const Icon = r.icon
                const gbvCard = r.gbv
                return (
                  <button key={r.id} onClick={() => setOpenId(r.id)}
                    className={`group text-left rounded-xl border p-4 transition-all bg-white hover:shadow-sm ${gbvCard ? 'border-rose-200 hover:border-rose-300' : 'border-slate-200 hover:border-brand-300'}`}>
                    <div className="flex items-start justify-between">
                      <span className={`h-9 w-9 rounded-lg grid place-items-center ${gbvCard ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-700'}`}>
                        <Icon size={17} />
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">{countFor(r)} {countFor(r) === 1 ? 'case' : 'cases'}</span>
                    </div>
                    <h3 className="text-[14px] font-bold text-slate-800 mt-3">{r.title}</h3>
                    <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">{r.desc}</p>
                    <span className={`mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-semibold ${gbvCard ? 'text-rose-600' : 'text-brand-700'}`}>Open report →</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <p className="text-center text-[11px] text-slate-300 pt-1">
          GBV / SEA-SH reporting is shown only to users cleared for the confidential register.
        </p>
      </div>
    )
  }

  const base = (report.gbv ? filtered.filter(isGbv) : filtered.filter((c) => !isGbv(c)))
  const rows = base.filter(report.match)

  const exportRegister = () => {
    const cols = report.columns.map((k) => COL[k])
    downloadCsv(`spin-${report.id}`, cols.map((c) => c.label), rows.map((c) => cols.map((col) => col.get(c))))
    logEvent('export_report', { target: `${report.title} · ${rows.length} cases` })
    toast(`Exported ${rows.length} rows`)
  }

  const FilterBar = (
    <Card className="px-4 py-3 flex flex-wrap items-center gap-2 fade-up print:hidden">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">Filter</span>
      <select value={range} onChange={(e) => setRange(e.target.value)} className={selectCls}>
        {RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>
      {national && (
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className={selectCls}>
          <option value="">All states</option>
          {STATES.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
      )}
      <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
        <option value="">All categories</option>
        {categoryList.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
        <option value="">All statuses</option>
        {STATUS_OPTS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
      </select>
      <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectCls}>
        <option value="">All priorities</option>
        {['high', 'medium', 'low'].map((p) => <option key={p} value={p}>{p.replace(/^./, (m) => m.toUpperCase())}</option>)}
      </select>
    </Card>
  )

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3 fade-up">
      <div className="flex items-center gap-3">
        <button onClick={() => setOpenId(null)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-2 print:hidden">
          <ArrowLeft size={14} /> All reports
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {report.gbv && <ShieldAlert size={17} className="text-rose-600" />}{report.title}
          </h1>
          <p className="text-[12px] text-slate-500 mt-0.5">{report.desc} · {rows.length} cases · generated {fmtDate(NOW)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 print:hidden">
        <button onClick={() => window.print()} className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md px-3 py-2 hover:bg-slate-50">
          <Printer size={13} /> Print
        </button>
        {report.kind === 'register' && (
          <button onClick={exportRegister} disabled={!rows.length} className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2 hover:bg-brand-800 disabled:opacity-40">
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className="p-3 md:p-5 space-y-3 md:space-y-4">
      {header}
      {FilterBar}
      {report.kind === 'register' && <RegisterReport report={report} rows={rows} />}
      {report.kind === 'breakdown' && (
        <Card className="fade-up overflow-hidden">
          <CardHeader title={report.title} subtitle={report.desc}
            action={rows.length > 0 && (
              <button onClick={() => {
                const gb = report.id === 'by-geo' ? (national ? (c) => c.state : (c) => c.lga || '—') : report.groupBy
                const gr = groupRows(rows, gb, report.order)
                downloadCsv(`spin-${report.id}`, [report.keyHeader, 'Total', 'Open', 'Resolved', 'Past SLA', 'Share %'], gr.map((r) => [r.name, r.total, r.open, r.resolved, r.breached, r.share]))
                toast('Exported')
              }} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800">
                <Download size={12} /> CSV
              </button>
            )} />
          <BreakdownTable keyHeader={report.id === 'by-geo' ? (national ? 'State' : 'LGA') : report.keyHeader}
            rows={groupRows(rows, report.id === 'by-geo' ? (national ? (c) => c.state : (c) => c.lga || '—') : report.groupBy, report.order)} />
        </Card>
      )}
      {report.kind === 'summary' && (
        <SummaryReport rows={rows} groupRows={groupRows} national={national} canGbv={canGbv}
          gbvCount={report.gbv ? 0 : filtered.filter(isGbv).length} slaOnly={report.variant === 'sla'} />
      )}
    </div>
  )
}

function RegisterReport({ report, rows }) {
  const cols = report.columns.map((k) => COL[k])
  const preview = rows.slice(0, 250)
  const open = rows.filter(isOpen).length
  const overdue = rows.filter((c) => c.slaBreached && isOpen(c)).length
  return (
    <>
      <div className="grid grid-cols-3 gap-3 fade-up">
        {[['Cases', rows.length, 'text-slate-900'], ['Open', open, 'text-emerald-700'], ['Past SLA', overdue, 'text-rose-600']].map(([l, v, c]) => (
          <Card key={l} className="p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{l}</p><p className={`text-2xl font-bold mt-1 ${c}`}>{v}</p></Card>
        ))}
      </div>
      <Card className="fade-up overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-[12.5px] text-slate-300">No cases match this report</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50/70 border-y border-slate-100">
                  {cols.map((c) => <th key={c.label} className="px-3 py-2 font-semibold whitespace-nowrap">{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60 align-top">
                    {cols.map((col) => (
                      <td key={col.label} className={`px-3 py-2 ${col.label === 'Actors' ? 'text-slate-500 min-w-[220px]' : 'text-slate-700 whitespace-nowrap'}`}>{col.get(c) || <span className="text-slate-300">—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > preview.length && (
          <p className="px-4 py-2.5 text-[11px] text-slate-400 border-t border-slate-100">Showing first {preview.length} of {rows.length}. Export CSV for the full list.</p>
        )}
      </Card>
    </>
  )
}

function SummaryReport({ rows, groupRows, national, canGbv, gbvCount, slaOnly }) {
  const open = rows.filter(isOpen)
  const resolvedList = rows.filter((c) => c.resolutionDays != null)
  const breached = rows.filter((c) => c.slaBreached && isOpen(c))
  const withinSla = rows.length - breached.length
  const resolutionRate = pct(resolvedList.length, rows.length)
  const avgRes = resolvedList.length ? +(resolvedList.reduce((a, c) => a + c.resolutionDays, 0) / resolvedList.length).toFixed(1) : 0

  const KPIS = slaOnly
    ? [['Total', rows.length], ['Within SLA', `${pct(withinSla, rows.length)}%`], ['Past SLA', breached.length], ['Resolution rate', `${resolutionRate}%`], ['Avg resolution', `${avgRes}d`]]
    : [['Total cases', rows.length], ['Open', open.length], ['Past SLA', breached.length], ['Resolved', resolvedList.length], ['Resolution rate', `${resolutionRate}%`], ['Avg resolution', `${avgRes}d`]]

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 fade-up">
        {KPIS.map(([l, v]) => (
          <Card key={l} className="p-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{l}</p><p className="text-2xl font-bold mt-1 text-slate-900">{v}</p></Card>
        ))}
      </div>

      <Card className="p-5 fade-up">
        <div className="flex items-center gap-2 mb-3"><Gauge size={15} className="text-brand-600" /><h3 className="text-sm font-semibold text-slate-800">SLA Performance</h3></div>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-3 rounded-full bg-rose-100 overflow-hidden flex"><div className="h-full bg-emerald-500" style={{ width: `${pct(withinSla, rows.length)}%` }} /></div>
          <div className="text-right whitespace-nowrap"><span className="text-lg font-bold text-emerald-700">{pct(withinSla, rows.length)}%</span><span className="text-[11px] text-slate-400 ml-1">within SLA</span></div>
        </div>
        <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5"><AlertTriangle size={11} className="text-rose-500" /> {breached.length} open cases are past their SLA window and need escalation.</p>
      </Card>

      {!slaOnly && canGbv && (
        <Card className="p-5 fade-up">
          <div className="flex items-center gap-2 mb-3"><ShieldAlert size={15} className="text-rose-600" /><h3 className="text-sm font-semibold text-slate-800">GBV vs Non-GBV</h3></div>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden flex">
              <div className="h-full bg-rose-500" style={{ width: `${pct(gbvCount, rows.length + gbvCount)}%` }} />
            </div>
            <div className="text-right whitespace-nowrap text-[12px]">
              <span className="font-bold text-rose-600">{gbvCount}</span> <span className="text-slate-400">GBV / SEA-SH</span>
              <span className="mx-1 text-slate-300">·</span>
              <span className="font-bold text-slate-700">{rows.length}</span> <span className="text-slate-400">other</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Confidential cases are counted here but detailed only in the restricted GBV report.</p>
        </Card>
      )}

      {!slaOnly && (
        <>
          <Card className="fade-up overflow-hidden"><CardHeader title="By Status" subtitle="Where cases sit in the workflow" /><BreakdownTable keyHeader="Status" rows={groupRows(rows, (c) => statusLabel(c.status))} /></Card>
          <Card className="fade-up overflow-hidden"><CardHeader title="By Domain" subtitle="Social / Environmental / Other" /><BreakdownTable keyHeader="Domain" rows={groupRows(rows, (c) => c.domain || domainForCategory(c.category))} /></Card>
          <Card className="fade-up overflow-hidden"><CardHeader title="By Category" subtitle="Grievance type distribution" /><BreakdownTable keyHeader="Category" rows={groupRows(rows, (c) => c.category)} /></Card>
          <Card className="fade-up overflow-hidden"><CardHeader title={national ? 'By State' : 'By LGA'} subtitle="Geographic distribution" /><BreakdownTable keyHeader={national ? 'State' : 'LGA'} rows={groupRows(rows, national ? (c) => c.state : (c) => c.lga || '—')} /></Card>
        </>
      )}
    </>
  )
}
