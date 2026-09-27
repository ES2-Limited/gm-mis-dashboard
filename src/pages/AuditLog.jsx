import { useEffect, useState } from 'react'
import { ScrollText, Search, ShieldAlert, Loader2 } from 'lucide-react'
import { fetchAudit, AUDIT_ACTIONS } from '../data/audit'

const fmt = (iso) => {
  const d = new Date(iso)
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const initials = (name = '') => name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

export default function AuditLog() {
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [highOnly, setHighOnly] = useState(false)

  useEffect(() => {
    fetchAudit().then(setAll).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = all.filter(e =>
    (!action || e.action === action) &&
    (!highOnly || e.severity === 'high') &&
    (!q || [e.actor, e.role, e.label, e.target, e.detail, e.scope, e.ip].join(' ').toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div className="p-3 md:p-5 space-y-3 md:space-y-4">
      <div className="fade-up flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ScrollText size={18} className="text-brand-700" /> Audit Log
          </h1>
          <p className="text-[12.5px] text-slate-500 mt-0.5">Sign-ins, restricted-data access, exports and account changes</p>
        </div>
        <span className="text-[11px] font-medium text-slate-500">{filtered.length} of {all.length} events</span>
      </div>

      <div className="fade-up flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search user, action, detail…"
            className="w-full pl-8 pr-3 py-2 text-[13px] rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="text-[13px] rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">All actions</option>
          {Object.entries(AUDIT_ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button
          onClick={() => setHighOnly(v => !v)}
          className={`flex items-center gap-1.5 text-[12.5px] font-semibold rounded-md px-3 py-2 ring-1 ring-inset transition-colors ${
            highOnly ? 'bg-rose-50 text-rose-700 ring-rose-300' : 'bg-white text-slate-500 ring-slate-200 hover:text-slate-700'
          }`}
        >
          <ShieldAlert size={14} /> Sensitive only
        </button>
      </div>

      <div className="fade-up bg-white rounded-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50/70 border-y border-slate-200">
                <th className="px-5 py-2.5 font-semibold">When</th>
                <th className="px-3 py-2.5 font-semibold">User</th>
                <th className="px-3 py-2.5 font-semibold">Action</th>
                <th className="px-3 py-2.5 font-semibold">Detail</th>
                <th className="px-3 py-2.5 font-semibold">Scope</th>
                <th className="px-5 py-2.5 font-semibold">IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${e.severity === 'high' ? 'bg-rose-50/30' : ''}`}>
                  <td className="px-5 py-3 text-[12px] text-slate-500 whitespace-nowrap tabular-nums">{fmt(e.at)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-full bg-emerald-800 text-white text-[9px] font-bold flex items-center justify-center shrink-0">{initials(e.actor)}</span>
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-slate-800 leading-tight truncate">{e.actor}</p>
                        <p className="text-[10.5px] text-slate-400 leading-tight">{e.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 whitespace-nowrap">
                      <span className={`h-1.5 w-1.5 rounded-full ${e.severity === 'high' ? 'bg-rose-500' : 'bg-slate-300'}`} />
                      {e.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-slate-500">
                    {e.target && <span className="font-medium text-slate-600">{e.target}</span>}
                    {e.target && e.detail && <span className="text-slate-300"> · </span>}
                    {e.detail}
                    {!e.target && !e.detail && <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-slate-500 whitespace-nowrap">{e.scope}</td>
                  <td className="px-5 py-3 text-[11.5px] text-slate-400 whitespace-nowrap tabular-nums">{e.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading
          ? <p className="text-center text-xs text-slate-400 py-10 flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading audit trail…</p>
          : filtered.length === 0 && <p className="text-center text-xs text-slate-400 py-10">No events recorded yet</p>}
      </div>

      <p className="text-[11px] text-slate-400">Audit entries are append-only. In production this log is immutable and stored server-side.</p>
    </div>
  )
}
