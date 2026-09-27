import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card } from './ui'
import { PARAM_DEFS } from '../lib/reportEngine'

const PALETTE = ['#2f8a5d', '#0ea5e9', '#f59e0b', '#8b5cf6', '#f43f5e', '#14b8a6', '#6366f1', '#f97316']

export function ParamBar({ spec, values, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {spec.parameters.map(p => {
        const def = PARAM_DEFS[p.id]
        if (!def) return null
        return (
          <label key={p.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            {def.label}
            <select
              value={values[p.id] ?? p.default ?? ''}
              onChange={(e) => onChange(p.id, e.target.value)}
              className="text-[13px] font-medium normal-case tracking-normal rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              {p.id !== 'days' && <option value="">All</option>}
              {def.options().map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
        )
      })}
    </div>
  )
}

function ChartSection({ s }) {
  if (s.chart === 'line') {
    return (
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={s.data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="rptRec" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2f8a5d" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#2f8a5d" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
            <Area type="monotone" dataKey="received" name="Received" stroke="#2f8a5d" strokeWidth={2} fill="url(#rptRec)" />
            <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#0ea5e9" strokeWidth={2} fill="transparent" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }
  if (s.chart === 'bar') {
    return (
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={s.data} margin={{ top: 8, right: 12, left: -20, bottom: 0 }} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} angle={-28} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            {s.split ? (
              <>
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
                <Bar dataKey="open" name="Open" stackId="a" fill="#2f8a5d" />
                <Bar dataKey="closed" name="Resolved / Closed" stackId="a" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              </>
            ) : (
              <Bar dataKey="count" name="Cases" fill="#2f8a5d" radius={[4, 4, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={s.data} dataKey="count" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={3} strokeWidth={0}>
            {s.data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={9} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function ReportView({ result }) {
  return (
    <div className="space-y-4">
      {result.sections.map((s, i) => {
        if (s.type === 'kpis') {
          return (
            <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {s.items.map(k => (
                <Card key={k.id} className="px-4 py-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
                  <p className={`text-xl font-bold tracking-tight mt-1 ${k.id === 'breached' ? 'text-rose-600' : 'text-slate-900'}`}>{k.value}</p>
                </Card>
              ))}
            </div>
          )
        }
        if (s.type === 'chart') {
          return (
            <Card key={i} className="p-5 pb-3">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">{s.title}</h3>
              {s.data.length ? <ChartSection s={s} /> : <p className="text-sm text-slate-400 py-8 text-center">No data for the selected filters.</p>}
            </Card>
          )
        }
        if (s.type === 'table') {
          return (
            <Card key={i} className="overflow-hidden">
              <h3 className="text-sm font-semibold text-slate-800 px-5 pt-4 pb-2">{s.title}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-400 border-y border-slate-100">
                      {s.header.map(h => <th key={h} className="px-4 py-2.5 font-semibold first:pl-5 last:pr-5">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map(r => (
                      <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        {r.cells.map((c, j) => (
                          <td key={j} className={`px-4 py-2.5 text-xs first:pl-5 last:pr-5 ${j === 0 ? 'font-semibold text-brand-700' : 'text-slate-600'}`}>{c}</td>
                        ))}
                      </tr>
                    ))}
                    {s.rows.length === 0 && (
                      <tr><td colSpan={s.header.length} className="px-5 py-8 text-center text-sm text-slate-400">No matching cases.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        }
        if (s.type === 'narrative') {
          return (
            <Card key={i} className="p-5 border-l-4 border-l-brand-600">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Executive Summary</p>
              <p className="text-sm text-slate-600 leading-relaxed">{s.text}</p>
            </Card>
          )
        }
        return null
      })}
    </div>
  )
}
