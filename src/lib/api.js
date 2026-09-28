

const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const TOKEN_KEY = 'spin.token'
const REFRESH_KEY = 'spin.refresh'

export const getToken = () => localStorage.getItem(TOKEN_KEY) || ''
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))
export const getRefresh = () => localStorage.getItem(REFRESH_KEY) || ''
export const setRefresh = (t) => (t ? localStorage.setItem(REFRESH_KEY, t) : localStorage.removeItem(REFRESH_KEY))

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

let refreshing = null
async function tryRefresh() {
  const rt = getRefresh()
  if (!rt) return false
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        })
        if (!res.ok) return false
        const data = await res.json()
        if (!data?.accessToken) return false
        setToken(data.accessToken)
        if (data.refreshToken) setRefresh(data.refreshToken)
        return true
      } catch {
        return false
      }
    })()
  }
  const ok = await refreshing
  refreshing = null
  return ok
}

export async function api(path, opts = {}) {
  const { method = 'GET', body, auth = true, _retry = false } = opts
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {

    if (res.status === 401 && auth && !_retry) {
      const ok = await tryRefresh()
      if (ok) return api(path, { ...opts, _retry: true })
    }
    const message = data?.message
      ? Array.isArray(data.message) ? data.message.join(', ') : data.message
      : `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }
  return data
}

export const apiGet = (p) => api(p)
export const apiPost = (p, body, opts) => api(p, { method: 'POST', body, ...opts })
export const apiPatch = (p, body) => api(p, { method: 'PATCH', body })
export const apiPut = (p, body) => api(p, { method: 'PUT', body })
export const apiDelete = (p) => api(p, { method: 'DELETE' })
