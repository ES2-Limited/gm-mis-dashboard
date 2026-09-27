

import { apiGet, apiPost, apiPatch } from '../lib/api'

const DAY = 86400000

export function mapCase(c) {
  return {
    ...c,
    createdAt: new Date(c.createdAt),
    dueAt: c.dueAt ? new Date(c.dueAt) : null,
    resolvedAt: c.resolvedAt ? new Date(c.resolvedAt) : null,
    assignedTo: c.assignedOfficer || null,
    slaBreached: !!c.overdue,
    resolutionDays: c.resolvedAt
      ? Math.max(0, Math.round((new Date(c.resolvedAt) - new Date(c.createdAt)) / DAY))
      : null,
  }
}

export async function fetchCases(params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v))
  const qs = new URLSearchParams(clean).toString()
  const list = await apiGet(`/cases${qs ? `?${qs}` : ''}`)
  return list.map(mapCase)
}

export async function fetchCase(id) {
  return mapCase(await apiGet(`/cases/${id}`))
}

export async function fetchRestrictedCases() {
  const list = await apiGet('/cases?restricted=true')
  return list.map(mapCase)
}

export const transcribeAudio = (payload) => apiPost('/transcribe', payload)

export const translateText = (payload) => apiPost('/translate', payload)

export const fetchCaseStats = () => apiGet('/cases/stats')
export const createCase = (dto) => apiPost('/cases', dto).then(mapCase)

export const caseAction = {
  status: (id, status, note) => apiPatch(`/cases/${id}/status`, { status, note }).then(mapCase),
  assign: (id, officer) => apiPatch(`/cases/${id}/assign`, { officer }).then(mapCase),
  screen: (id, decision, reason, legacy, legacyReferral) => apiPost(`/cases/${id}/screening`, { decision, reason, legacy, legacyReferral }).then(mapCase),
  notRelated: (id, reason) => apiPost(`/cases/${id}/not-related`, { reason }).then(mapCase),
  escalate: (id, reason = 'manual', toTier, toOfficer) => apiPost(`/cases/${id}/escalate`, { reason, toTier, toOfficer }).then(mapCase),
  refer: (id, { body, bodyType, reason, consent, riskLevel, safetyNote }) => apiPost(`/cases/${id}/refer`, { body, bodyType, reason, consent, riskLevel, safetyNote }).then(mapCase),
  note: (id, body) => apiPost(`/cases/${id}/notes`, { body }).then(mapCase),
  investigation: (id, data) => apiPost(`/cases/${id}/investigation`, data).then(mapCase),
  addCorrective: (id, dto) => apiPost(`/cases/${id}/corrective-actions`, dto).then(mapCase),
  toggleCorrective: (id, actionId) => apiPatch(`/cases/${id}/corrective-actions/${actionId}/toggle`).then(mapCase),
  appeal: (id, dto) => apiPost(`/cases/${id}/appeals`, dto).then(mapCase),
  satisfaction: (id, dto) => apiPost(`/cases/${id}/satisfaction`, dto).then(mapCase),
}
