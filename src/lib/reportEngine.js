

import { CASES, STATES, CATEGORIES, CHANNELS, STATUSES, TODAY, isOpen, channelLabel, statusLabel, fmtDate } from '../data/mock'
import { getSetting, setSetting } from '../data/settingsStore'

const DAY = 86400000

export const PARAM_DEFS = {
  state: { label: 'State', options: () => STATES.map(s => ({ id: s.name, label: s.name })) },
  category: { label: 'Category', options: () => CATEGORIES.map(c => ({ id: c, label: c })) },
  channel: { label: 'Channel', options: () => CHANNELS },
  status: { label: 'Status', options: () => STATUSES },
  priority: { label: 'Priority', options: () => ['high', 'medium', 'low'].map(p => ({ id: p, label: p[0].toUpperCase() + p.slice(1) })) },
  days: {
    label: 'Period',
    options: () => [
      { id: '30', label: 'Last 30 days' },
      { id: '90', label: 'Last 90 days' },
      { id: '180', label: 'Last 6 months' },
      { id: '365', label: 'Last 12 months' },
    ],
  },
}

const GROUP_FIELDS = {
  state: c => c.state,
  lga: c => `${c.lga} (${c.state})`,
  category: c => c.category,
  channel: c => channelLabel(c.channel),
  status: c => statusLabel(c.status),
  priority: c => c.priority[0].toUpperCase() + c.priority.slice(1),
}

const KPI_DEFS = {
  total: { label: 'Total cases', fmt: v => v },
  open: { label: 'Open cases', fmt: v => v },
  breached: { label: 'Past SLA', fmt: v => v },
  resolutionRate: { label: 'Resolution rate', fmt: v => `${v}%` },
  avgResolutionDays: { label: 'Avg. resolution', fmt: v => `${v} days` },
}

const TABLE_COLUMNS = {
  code: { label: 'Case', get: c => c.code },
  complainant: { label: 'Complainant', get: c => c.complainant },
  category: { label: 'Category', get: c => c.category },
  state: { label: 'State', get: c => c.state },
  lga: { label: 'LGA', get: c => c.lga },
  channel: { label: 'Channel', get: c => channelLabel(c.channel) },
  priority: { label: 'Priority', get: c => c.priority },
  status: { label: 'Status', get: c => statusLabel(c.status) },
  assignedTo: { label: 'Assigned', get: c => c.assignedTo || '—' },
  createdAt: { label: 'Received', get: c => fmtDate(c.createdAt) },
  dueAt: { label: 'Due', get: c => fmtDate(c.dueAt) },
  resolutionDays: { label: 'Days to resolve', get: c => c.resolutionDays ?? '—' },
}

export function normalizeSpec(raw) {
  if (!raw || typeof raw !== 'object') return null
  const spec = {
    name: String(raw.name || 'Untitled report').slice(0, 80),
    description: String(raw.description || '').slice(0, 240),
    parameters: [],
    sections: [],
  }

  const seen = new Set()
  for (const p of Array.isArray(raw.parameters) ? raw.parameters : []) {
    const id = p?.id
    if (PARAM_DEFS[id] && !seen.has(id)) {
      seen.add(id)
      const valid = PARAM_DEFS[id].options().some(o => o.id === String(p.default))
      spec.parameters.push({ id, default: valid ? String(p.default) : '' })
    }
  }
  if (!seen.has('days')) spec.parameters.unshift({ id: 'days', default: '180' })

  for (const s of Array.isArray(raw.sections) ? raw.sections : []) {
    if (!s || typeof s !== 'object') continue
    if (s.type === 'kpis') {
      const metrics = (Array.isArray(s.metrics) ? s.metrics : []).filter(m => KPI_DEFS[m])
      if (metrics.length) spec.sections.push({ type: 'kpis', metrics })
    } else if (s.type === 'chart') {
      const chart = ['bar', 'line', 'donut'].includes(s.chart) ? s.chart : null
      if (!chart) continue
      if (chart === 'line') {
        spec.sections.push({ type: 'chart', chart, interval: s.interval === 'week' ? 'week' : 'month', title: String(s.title || 'Trend').slice(0, 60) })
      } else if (GROUP_FIELDS[s.groupBy]) {
        spec.sections.push({ type: 'chart', chart, groupBy: s.groupBy, split: chart === 'bar' && s.split === 'openClosed', title: String(s.title || 'Breakdown').slice(0, 60) })
      }
    } else if (s.type === 'table') {
      const columns = (Array.isArray(s.columns) ? s.columns : []).filter(c => TABLE_COLUMNS[c])
      spec.sections.push({
        type: 'table',
        title: String(s.title || 'Case list').slice(0, 60),
        columns: columns.length ? columns : ['code', 'category', 'state', 'status', 'createdAt'],
        sortBy: ['createdAt', 'dueAt', 'resolutionDays'].includes(s.sortBy) ? s.sortBy : 'createdAt',
        limit: Math.min(Math.max(parseInt(s.limit) || 12, 3), 30),
        onlyBreached: !!s.onlyBreached,
      })
    } else if (s.type === 'narrative' && typeof s.text === 'string' && s.text.trim()) {
      spec.sections.push({ type: 'narrative', text: s.text.slice(0, 1200) })
    }
  }

  return spec.sections.length ? spec : null
}

export function runReport(spec, values) {
  let rows = CASES
  for (const p of spec.parameters) {
    const v = values[p.id] ?? p.default
    if (!v) continue
    if (p.id === 'days') rows = rows.filter(c => c.createdAt >= new Date(TODAY.getTime() - parseInt(v) * DAY))
    else if (p.id === 'state') rows = rows.filter(c => c.state === v)
    else if (p.id === 'category') rows = rows.filter(c => c.category === v)
    else if (p.id === 'channel') rows = rows.filter(c => c.channel === v)
    else if (p.id === 'status') rows = rows.filter(c => c.status === v)
    else if (p.id === 'priority') rows = rows.filter(c => c.priority === v)
  }

  const open = rows.filter(isOpen)
  const resolved = rows.filter(c => c.resolutionDays != null)
  const kpiValues = {
    total: rows.length,
    open: open.length,
    breached: rows.filter(c => c.slaBreached && isOpen(c)).length,
    resolutionRate: rows.length ? Math.round(((rows.length - open.length) / rows.length) * 100) : 0,
    avgResolutionDays: resolved.length ? +(resolved.reduce((a, c) => a + c.resolutionDays, 0) / resolved.length).toFixed(1) : 0,
  }

  const top = (fn) => {
    const m = new Map()
    rows.forEach(c => m.set(fn(c), (m.get(fn(c)) || 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
  }
  const daysVal = values.days ?? spec.parameters.find(p => p.id === 'days')?.default ?? '180'
  const placeholders = {
    ...kpiValues,
    topState: top(c => c.state),
    topCategory: top(c => c.category),
    topChannel: top(c => channelLabel(c.channel)),
    periodLabel: PARAM_DEFS.days.options().find(o => o.id === daysVal)?.label || 'All time',
    generatedOn: fmtDate(TODAY),
  }

  const sections = spec.sections.map(s => {
    if (s.type === 'kpis') {
      return { ...s, items: s.metrics.map(m => ({ id: m, label: KPI_DEFS[m].label, value: KPI_DEFS[m].fmt(kpiValues[m]) })) }
    }
    if (s.type === 'chart' && s.chart === 'line') {
      const span = s.interval === 'week' ? 7 * DAY : 30 * DAY
      const buckets = Math.min(Math.max(Math.ceil(parseInt(daysVal || 180) * DAY / span), 4), 12)
      const data = []
      for (let i = buckets - 1; i >= 0; i--) {
        const start = new Date(TODAY.getTime() - (i + 1) * span)
        const end = new Date(TODAY.getTime() - i * span)
        data.push({
          name: s.interval === 'week'
            ? `W${buckets - i}`
            : start.toLocaleDateString('en-NG', { month: 'short' }),
          received: rows.filter(c => c.createdAt >= start && c.createdAt < end).length,
          resolved: rows.filter(c => c.resolvedAt && c.resolvedAt >= start && c.resolvedAt < end).length,
        })
      }
      return { ...s, data }
    }
    if (s.type === 'chart') {
      const get = GROUP_FIELDS[s.groupBy]
      const m = new Map()
      rows.forEach(c => {
        const k = get(c)
        if (!m.has(k)) m.set(k, { name: k, count: 0, open: 0, closed: 0 })
        const e = m.get(k)
        e.count++; isOpen(c) ? e.open++ : e.closed++
      })
      const data = [...m.values()].sort((a, b) => b.count - a.count).slice(0, 12)
      return { ...s, data }
    }
    if (s.type === 'table') {
      let list = s.onlyBreached ? rows.filter(c => c.slaBreached && isOpen(c)) : rows
      list = [...list].sort((a, b) => (b[s.sortBy] ?? 0) - (a[s.sortBy] ?? 0)).slice(0, s.limit)
      return {
        ...s,
        header: s.columns.map(c => TABLE_COLUMNS[c].label),
        rows: list.map(c => ({ id: c.id, cells: s.columns.map(col => TABLE_COLUMNS[col].get(c)) })),
      }
    }
    if (s.type === 'narrative') {
      const text = s.text.replace(/\{\{(\w+)\}\}/g, (_, k) => placeholders[k] ?? `{{${k}}}`)
      return { ...s, text }
    }
    return s
  })

  return { sections, kpiValues, placeholders, matched: rows.length }
}

const BUILTINS = [
  {
    id: 'builtin-monthly-summary',
    source: 'builtin',
    createdAt: 'System template',
    spec: {
      name: 'Monthly GRM Summary',
      description: 'Caseload health for the selected period — volumes, trend, state breakdown and intake channels.',
      parameters: [{ id: 'days', default: '30' }, { id: 'state', default: '' }],
      sections: [
        { type: 'kpis', metrics: ['total', 'open', 'resolutionRate', 'avgResolutionDays', 'breached'] },
        { type: 'chart', chart: 'line', interval: 'week', title: 'Weekly trend — received vs resolved' },
        { type: 'chart', chart: 'bar', groupBy: 'state', split: true, title: 'Caseload by state' },
        { type: 'chart', chart: 'donut', groupBy: 'channel', title: 'Intake channels' },
        { type: 'narrative', text: 'During {{periodLabel}}, the mechanism registered {{total}} grievances of which {{open}} remain open. The resolution rate stands at {{resolutionRate}} with an average time-to-resolution of {{avgResolutionDays}} days. {{topState}} recorded the highest volume, {{topCategory}} was the most frequent category, and {{topChannel}} was the dominant intake channel. {{breached}} open cases are past their SLA and require escalation. Generated {{generatedOn}}.' },
      ],
    },
  },
  {
    id: 'builtin-sla-compliance',
    source: 'builtin',
    createdAt: 'System template',
    spec: {
      name: 'SLA Compliance Report',
      description: 'Where service-level commitments are being missed — breach counts and the overdue case list.',
      parameters: [{ id: 'days', default: '90' }, { id: 'state', default: '' }, { id: 'priority', default: '' }],
      sections: [
        { type: 'kpis', metrics: ['total', 'open', 'breached', 'avgResolutionDays'] },
        { type: 'chart', chart: 'bar', groupBy: 'state', split: true, title: 'Open vs closed by state' },
        { type: 'table', title: 'Cases past SLA', columns: ['code', 'category', 'state', 'priority', 'assignedTo', 'dueAt'], sortBy: 'dueAt', limit: 15, onlyBreached: true },
        { type: 'narrative', text: 'Of {{total}} cases in {{periodLabel}}, {{breached}} open cases have exceeded their resolution SLA. Escalation focus: {{topState}} ({{topCategory}} dominant). Generated {{generatedOn}}.' },
      ],
    },
  },
  {
    id: 'builtin-category-deepdive',
    source: 'builtin',
    createdAt: 'System template',
    spec: {
      name: 'Category Deep-dive',
      description: 'Drill into a single grievance category — where it occurs, how it arrives, how fast it resolves.',
      parameters: [{ id: 'category', default: 'Land Acquisition & Resettlement' }, { id: 'days', default: '180' }, { id: 'state', default: '' }],
      sections: [
        { type: 'kpis', metrics: ['total', 'open', 'resolutionRate', 'avgResolutionDays'] },
        { type: 'chart', chart: 'line', interval: 'month', title: 'Monthly trend' },
        { type: 'chart', chart: 'bar', groupBy: 'state', split: true, title: 'Distribution by state' },
        { type: 'table', title: 'Recent cases', columns: ['code', 'state', 'lga', 'channel', 'status', 'createdAt'], sortBy: 'createdAt', limit: 10 },
        { type: 'narrative', text: '{{total}} cases were registered in this category during {{periodLabel}}, concentrated in {{topState}}. {{open}} remain open with an average resolution time of {{avgResolutionDays}} days. Generated {{generatedOn}}.' },
      ],
    },
  },
]

function customReports() { return getSetting('reports', []) }

export function getLibrary() {
  return [...customReports(), ...BUILTINS]
}

export function getReport(id) {
  return getLibrary().find(r => r.id === id) || null
}

export function saveReport(spec, prompt) {
  const entry = {
    id: `rpt-${Date.now().toString(36)}`,
    source: 'generated',
    createdAt: new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }),
    prompt: prompt || '',
    spec,
  }
  setSetting('reports', [entry, ...customReports()])
  return entry
}

export function deleteReport(id) {
  setSetting('reports', customReports().filter(r => r.id !== id))
}

export function defaultValues(spec) {
  return Object.fromEntries(spec.parameters.map(p => [p.id, p.default ?? '']))
}
