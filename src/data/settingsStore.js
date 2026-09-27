

import { apiGet, apiPut } from '../lib/api'

let cache = {}
let loaded = false

export async function loadSettings() {
  try {
    cache = (await apiGet('/settings')) || {}
  } catch {
    cache = {}
  }
  loaded = true
  return cache
}

export const settingsLoaded = () => loaded

export function getSetting(key, fallback) {
  return key in cache && cache[key] != null ? cache[key] : fallback
}

export function setSetting(key, value) {
  cache = { ...cache, [key]: value }

  return apiPut(`/settings/${key}`, { value }).catch(() => {})
}
