import { statusLabel, channelLabel } from '../data/mock'

export function Card({ className = '', children }) {
  return (
    <div className={`bg-white rounded-md border border-slate-200 ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between px-5 pt-4 pb-1">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

const STATUS_STYLES = {
  received: 'bg-slate-50 text-slate-600 ring-slate-200',
  acknowledged: 'bg-sky-50 text-sky-700 ring-sky-200',
  assigned: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  under_review: 'bg-amber-50 text-amber-700 ring-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-50 text-slate-500 ring-slate-200',
  reopened: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium ring-1 ring-inset whitespace-nowrap ${STATUS_STYLES[status] || 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
      {statusLabel(status)}
    </span>
  )
}

const PRIORITY_STYLES = {
  high: 'bg-rose-50 text-rose-700 ring-rose-200',
  medium: 'bg-amber-50 text-amber-700 ring-amber-200',
  low: 'bg-slate-50 text-slate-600 ring-slate-200',
}

export function PriorityBadge({ priority }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-medium capitalize ring-1 ring-inset ${PRIORITY_STYLES[priority]}`}>
      {priority}
    </span>
  )
}

export function ChannelChip({ channel, detail }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 text-[10.5px] font-medium ring-1 ring-inset ring-slate-200 whitespace-nowrap">
      {channelLabel(channel)}{detail ? <span className="text-slate-400 font-normal">&nbsp;·&nbsp;{detail}</span> : null}
    </span>
  )
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

export function Select({ value, onChange, options, allLabel }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
    >
      {allLabel && <option value="">{allLabel}</option>}
      {options.map((o) =>
        typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.id} value={o.id}>{o.label}</option>
      )}
    </select>
  )
}
