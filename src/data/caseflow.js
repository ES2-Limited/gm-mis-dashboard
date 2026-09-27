

import { TODAY, GOVERNANCE_TIERS, getViewAs, updateCase } from './mock'
import { getSetting, setSetting } from './settingsStore'

const TO_CASE_STATUS = {
  received: 'received', acknowledged: 'acknowledged', screening: 'acknowledged',
  assigned: 'assigned', under_investigation: 'under_review', resolved: 'resolved',
  closed: 'closed', escalated: 'under_review', appealed: 'reopened',
}
const DAY = 86400000
const now = () => new Date().toISOString()
const actor = () => { const v = getViewAs(); return { name: v.name, role: v.role } }
const truncate = (s, n = 64) => (s.length > n ? `${s.slice(0, n)}…` : s)

const TIER_DEFAULTS = { 1: 7, 2: 14, 3: 20, 4: 30 }
export function getTierDays() { return { ...TIER_DEFAULTS, ...(getSetting('tierDays', {}) || {}) } }
export function setTierDays(v) { setSetting('tierDays', v) }

const APPEAL_DAYS_DEFAULT = 14
export function getAppealDays() { const n = getSetting('appealDays', APPEAL_DAYS_DEFAULT); return Number.isFinite(n) ? n : APPEAL_DAYS_DEFAULT }
export function setAppealDays(n) { setSetting('appealDays', Math.max(0, parseInt(n) || 0)) }

function startLevels() { return getSetting('startLevels', {}) }
export function getStartLevel(category) { return startLevels()[category] || 1 }
export function setStartLevel(category, level) {
  setSetting('startLevels', { ...startLevels(), [category]: level })
}

export const JOURNEY_STAGES = [
  { id: 'received', label: 'Received', note: 'Captured via any channel' },
  { id: 'acknowledged', label: 'Acknowledged', note: 'Within 3 working days' },
  { id: 'screening', label: 'Screened', note: 'Eligibility checked (≤5 days)' },
  { id: 'assigned', label: 'Assigned', note: 'Routed to the responsible desk' },
  { id: 'under_investigation', label: 'Investigated', note: 'Within tier timeline' },
  { id: 'resolved', label: 'Resolved', note: 'Outcome + corrective actions' },
  { id: 'closed', label: 'Closed', note: 'After satisfaction survey' },
]

export const CASE_STATUS = [
  { id: 'received', label: 'Received' },
  { id: 'acknowledged', label: 'Acknowledged' },
  { id: 'screening', label: 'Screening' },
  { id: 'assigned', label: 'Assigned' },
  { id: 'under_investigation', label: 'Under Investigation' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'referred', label: 'Referred' },
  { id: 'appealed', label: 'Appealed' },
]
export const statusLabel = (id) => CASE_STATUS.find(s => s.id === id)?.label || id

const REASON_LABEL = {
  sla_breach: 'tier resolution time elapsed',
  appeal: 'complainant appeal',
  complexity: 'complexity requires higher tier',
  expedited: 'high-priority expedited',
  manual: 'manual escalation',
}

const _flow = {}
function readAll() { return _flow }
function writeAll(o) { Object.assign(_flow, o) }

function defaultFlow(c) {
  const created = (c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt)).toISOString()
  return {
    tier: getStartLevel(c.category),
    tierSince: created,
    status: c.status,
    assignedOfficer: c.assignedTo || null,
    screening: null,
    notes: [],
    investigation: null,
    correctiveActions: [],
    appeals: [],
    escalations: [],
    activity: [],
    satisfaction: null,
    autoDone: false,
  }
}

export function getFlow(c) {
  const stored = readAll()[c.id]
  return { ...defaultFlow(c), ...(stored || {}) }
}

function save(c, patch, event) {
  const all = readAll()
  const prev = all[c.id] || defaultFlow(c)
  const next = { ...prev, ...patch }
  if (event) next.activity = [...(prev.activity || []), { ...event, at: now(), ...actor() }]
  all[c.id] = next
  writeAll(all)

  updateCase(c.id, { status: TO_CASE_STATUS[next.status] || next.status, assignedTo: next.assignedOfficer })
  return next
}

export const tierName = (level, model = 1) => {
  if (level === 2) {
    return model === 2
      ? 'State Project Implementation Unit (SPIU)'
      : 'State-Level GRC (RBDA)'
  }
  return GOVERNANCE_TIERS.find(g => g.level === level)?.name || `Level ${level}`
}
export const tierEscalatesTo = (level, model = 1) => {
  if (model === 2) {
    if (level === 2) return 'State Sector Ministries & Agencies'
    if (level === 3) return 'Independent Appeal (external)'
  }
  return GOVERNANCE_TIERS.find(g => g.level === level)?.escalatesTo || '—'
}

export const maxTierFor = (model = 1) => (model === 2 ? 3 : 4)

export const escalationTargets = (tier, model = 1) => {
  if (tier === 1) return [2]
  if (model === 2) return tier === 2 ? [3] : []
  if (tier === 2) return [3, 4]
  if (tier === 3) return [4]
  return []
}

export function tierDueDate(flow) {
  const max = getTierDays()[flow.tier]
  return max ? new Date(new Date(flow.tierSince).getTime() + max * DAY) : null
}

export function isOverdue(c) {
  const flow = getFlow(c)
  if (['resolved', 'closed'].includes(flow.status)) return false
  const due = tierDueDate(flow)
  return due ? TODAY > due : false
}

export function caseHistory(c) {
  const flow = getFlow(c)
  const created = c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt)
  return [
    { type: 'received', at: created.toISOString(), note: 'Grievance received and registered', name: c.registeredBy || 'Intake desk' },
    ...flow.activity,
  ].sort((a, b) => new Date(a.at) - new Date(b.at))
}

export function addNote(c, body) {
  const text = (body || '').trim()
  if (!text) return getFlow(c)
  const flow = getFlow(c)
  const note = { id: `n-${Date.now().toString(36)}`, body: text, ...actor(), at: now() }
  return save(c, { notes: [...flow.notes, note] }, { type: 'note', note: `Note: “${truncate(text)}”` })
}

export function assignCase(c, officerName) {
  return save(c, { assignedOfficer: officerName, status: 'assigned' }, { type: 'assigned', note: `Assigned to ${officerName}` })
}

export function setStatus(c, statusId) {
  return save(c, { status: statusId }, { type: statusId, note: `Status set to ${statusLabel(statusId)}` })
}

export function setScreening(c, outcome) {
  const map = { eligible: 'Eligible for SPIN GM', referred: 'Referred to another institution', rejected: 'Not project-related — closed' }
  return save(c, {
    screening: outcome,
    status: outcome === 'eligible' ? 'assigned' : 'closed',
  }, { type: 'screening', note: `Screening outcome: ${map[outcome]}` })
}

export function escalateCase(c, reason = 'manual') {
  const flow = getFlow(c)
  if (flow.tier >= 4) return flow
  const from = flow.tier, to = flow.tier + 1
  const esc = { id: `e-${Date.now().toString(36)}`, from, to, reason, ...actor(), at: now() }
  return save(c, {
    tier: to,
    tierSince: now(),
    status: 'escalated',
    assignedOfficer: null,
    autoDone: reason === 'sla_breach' ? true : flow.autoDone,
    escalations: [...flow.escalations, esc],
  }, { type: 'escalated', note: `Escalated to Level ${to} — ${tierName(to)} (${REASON_LABEL[reason]})` })
}

export function autoEscalateIfDue(c) {
  const flow = getFlow(c)
  if (!flow.autoDone && flow.tier < 4 && isOverdue(c)) return escalateCase(c, 'sla_breach')
  return flow
}

export function saveInvestigation(c, data) {
  return save(c, {
    investigation: { ...data, ...actor(), at: now() },
    status: 'under_investigation',
  }, { type: 'investigation', note: 'Investigation record saved' })
}

export function addCorrectiveAction(c, action) {
  const flow = getFlow(c)
  const item = { id: `ca-${Date.now().toString(36)}`, ...action, status: 'open', completedAt: null }
  return save(c, { correctiveActions: [...flow.correctiveActions, item] }, { type: 'corrective', note: `Corrective action: ${truncate(action.action)}` })
}

export function toggleCorrectiveAction(c, id) {
  const flow = getFlow(c)
  const correctiveActions = flow.correctiveActions.map(a =>
    a.id === id ? { ...a, status: a.status === 'open' ? 'closed' : 'open', completedAt: a.status === 'open' ? now() : null } : a
  )
  return save(c, { correctiveActions })
}

export function addAppeal(c, data) {
  const flow = getFlow(c)
  const ref = `APL-${(c.code || '').replace(/[^0-9]/g, '').slice(-4) || '0001'}-${flow.appeals.length + 1}`
  const appeal = { id: `a-${Date.now().toString(36)}`, ref, grounds: data.grounds, desiredOutcome: data.desiredOutcome, ...actor(), at: now(), decision: null }
  save(c, { appeals: [...flow.appeals, appeal] }, { type: 'appealed', note: `Appeal ${ref} submitted` })
  return escalateCase(c, 'appeal')
}

export function recordSatisfaction(c, rating, comment) {
  return save(c, {
    satisfaction: { rating, comment, ...actor(), at: now() },
    status: 'closed',
  }, { type: 'closed', note: `Closed — complainant ${rating}` })
}
