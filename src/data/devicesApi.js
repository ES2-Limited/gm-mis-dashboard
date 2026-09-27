

import { apiGet, apiPost } from '../lib/api'

export async function fetchDevices() {
  const list = await apiGet('/devices')
  return (Array.isArray(list) ? list : []).map((d) => ({
    ...d,
    firstSeenAt: d.firstSeenAt ? new Date(d.firstSeenAt) : null,
    lastSeenAt: d.lastSeenAt ? new Date(d.lastSeenAt) : null,
    lastSyncAt: d.lastSyncAt ? new Date(d.lastSyncAt) : null,
  }))
}

export async function fetchActivationCodes() {
  const list = await apiGet('/devices/activation-codes')
  return (Array.isArray(list) ? list : []).map((c) => ({
    ...c,
    createdAt: c.created_at ? new Date(c.created_at) : (c.createdAt ? new Date(c.createdAt) : null),
    activatedAt: c.activatedAt ? new Date(c.activatedAt) : null,
  }))
}

export function issueActivationCode(userId, maxOfflineDays) {
  return apiPost('/devices/activation-codes', { userId, maxOfflineDays })
}

export function revokeActivationCode(id) {
  return apiPost(`/devices/activation-codes/${id}/revoke`, {})
}

export async function fetchOfficersForState(state) {
  const q = state ? `?state=${encodeURIComponent(state)}` : ''
  const list = await apiGet(`/users/officers${q}`)
  return Array.isArray(list) ? list : []
}
