

import { apiPost, setToken, setRefresh } from './api'
import { setViewAs } from '../data/mock'
import { refreshUsers } from '../data/users'
import { logEvent } from '../data/audit'

const AUTH_KEY = 'spin.auth'
const EMAIL_KEY = 'spin.account.email'
const PIN_KEY = 'spin.account.pinSet'

export function getAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) } catch { return null }
}

export function rememberedAccount() {
  const email = localStorage.getItem(EMAIL_KEY)
  if (!email) return null
  return { email, hasPin: localStorage.getItem(PIN_KEY) === '1' }
}

function remember(user) {
  if (user?.email) localStorage.setItem(EMAIL_KEY, user.email)
  localStorage.setItem(PIN_KEY, user?.pinSet ? '1' : '0')
}

function establish(res) {
  const { accessToken, refreshToken, user } = res
  setToken(accessToken)
  setRefresh(refreshToken)
  localStorage.setItem(AUTH_KEY, JSON.stringify(user))
  remember(user)

  setViewAs({ name: user.name, role: user.role, scope: user.scope, lga: user.lga, community: user.community })
  return user
}

export async function login(email, password) {
  let res
  try {
    res = await apiPost('/auth/login', { email: email.trim(), password }, { auth: false })
  } catch (e) {
    return { error: e.message || 'Could not sign in. Check your connection and try again.' }
  }
  const user = establish(res)
  try { await refreshUsers() } catch { /* non-fatal */ }
  return { ok: true, user }
}

export async function pinLogin(email, pin) {
  let res
  try {
    res = await apiPost('/auth/pin-login', { email: email.trim(), pin }, { auth: false })
  } catch (e) {
    return { error: e.message || 'Could not sign in. Try again.' }
  }
  const user = establish(res)
  try { await refreshUsers() } catch { /* non-fatal */ }
  return { ok: true, user }
}

export async function setPin(pin) {
  try {
    await apiPost('/auth/set-pin', { pin })
    localStorage.setItem(PIN_KEY, '1')
    const user = getAuth()
    if (user) localStorage.setItem(AUTH_KEY, JSON.stringify({ ...user, pinSet: true }))
    return { ok: true }
  } catch (e) {
    return { error: e.message || 'Could not save your PIN. Try again.' }
  }
}

export function logout() {
  const who = getAuth()
  if (who) logEvent('logout', { actor: { name: who.name, role: who.role, scope: who.scope } })
  setToken(null)
  setRefresh(null)
  localStorage.removeItem(AUTH_KEY)
  setViewAs(null)
}

export function forgetAccount() {
  logout()
  localStorage.removeItem(EMAIL_KEY)
  localStorage.removeItem(PIN_KEY)
}
