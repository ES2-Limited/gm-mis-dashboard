

import { apiGet, apiPost } from '../lib/api'

const _h = window.location.hostname
const _dev = _h === 'localhost' || _h === '127.0.0.1' || /^(10|172|192)\./.test(_h)
export const API_BASE = _dev ? 'https://spin.bayabotech.com/api' : `${window.location.origin}/api`

export async function fetchIntegrationKeys() {
  const list = await apiGet('/integration/keys')
  return (Array.isArray(list) ? list : []).map((k) => ({
    ...k,
    createdAt: k.createdAt ? new Date(k.createdAt) : null,
    lastUsedAt: k.lastUsedAt ? new Date(k.lastUsedAt) : null,
  }))
}

export function createIntegrationKey(label) {
  return apiPost('/integration/keys', { label })
}

export function revokeIntegrationKey(id) {
  return apiPost(`/integration/keys/${id}/revoke`, {})
}
