

import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api'

export const ROLES = [
  'FPMU Admin',
  'SPMU Admin',
  'Grievance Officer',
  'Community Grievance Focal Person',
  'SEA/SH Focal Person',
  'M&E Viewer',
]

export const NATIONAL_ROLES = ['FPMU Admin']

export const ROLE_LEVELS = {
  'FPMU Admin': [4],
  'SPMU Admin': [2],
  'Grievance Officer': [2, 3, 4],
  'Community Grievance Focal Person': [1],
  'SEA/SH Focal Person': [2],
  'M&E Viewer': [2, 3, 4],
}

export const FUNCTIONS = [
  'Community Grievance Focal Person',
  'State Project Coordinator',
  'Environmental Specialist',
  'Social Specialist',
  'Resettlement & Lands Officer',
  'Labour Officer',
  'Safeguards / OHS Officer',
  'Safeguards Officer',
  'Community Liaison Officer',
  'Integrity / Safeguards Officer',
  'Safeguards / Security Officer',
  'SEA/SH Focal Person (SMWA)',
  'Child Protection Focal Person',
]

export const MODULES = [
  { key: 'overview', label: 'Overview', to: '/' },
  { key: 'cases', label: 'Cases', to: '/cases' },

  { key: 'cases_all', label: 'All Cases (full register)', to: '/cases' },

  { key: 'case_intake', label: 'Register Case (back office)', to: '/cases/new' },
  { key: 'locations', label: 'Locations (map)', to: '/map' },
  { key: 'insights', label: 'Insights', to: '/insights' },
  { key: 'reports', label: 'Reports', to: '/reports' },
  { key: 'sharing', label: 'Data Sharing', to: '/sharing' },
  { key: 'devices', label: 'Field Devices', to: '/devices' },
  { key: 'restricted', label: 'Restricted (SEA/SH)', to: '/restricted' },
  { key: 'audit', label: 'Audit Log', to: '/audit' },
  { key: 'settings', label: 'Settings', to: '/settings' },
]

const ROLE_PERMISSIONS = {
  'FPMU Admin': ['overview', 'cases', 'cases_all', 'case_intake', 'locations', 'insights', 'reports', 'sharing', 'devices', 'audit', 'settings'],

  'SPMU Admin': ['overview', 'cases', 'cases_all', 'case_intake', 'locations', 'insights', 'reports', 'sharing', 'devices', 'audit', 'settings'],
  'Grievance Officer': ['overview', 'cases', 'case_intake', 'locations'],
  'Community Grievance Focal Person': ['overview', 'cases', 'case_intake', 'locations'],
  'SEA/SH Focal Person': ['overview', 'cases', 'restricted', 'locations'],
  'M&E Viewer': ['overview', 'locations', 'insights', 'reports', 'sharing', 'devices'],
}

export function defaultPermissions(role) {
  return [...(ROLE_PERMISSIONS[role] || ['overview'])]
}

const MODULE_IMPLIES = { case_intake: ['cases'], cases_all: ['cases'] }
export function withImpliedModules(perms) {
  const out = new Set(perms)
  for (const p of perms) (MODULE_IMPLIES[p] || []).forEach(i => out.add(i))
  return [...out]
}

export function userPermissions(user) {
  if (!user) return []
  if (user.isSuperAdmin) return MODULES.map(m => m.key)
  return withImpliedModules(Array.isArray(user.permissions) ? user.permissions : defaultPermissions(user.role))
}

export function can(user, moduleKey) {
  return userPermissions(user).includes(moduleKey)
}

let cache = []

function setCache(list) {
  cache = Array.isArray(list) ? list : []
}

export function getUsers() { return cache }

export async function refreshUsers() {
  const list = await apiGet('/users')
  setCache(list)
  return list
}

export async function upsertUser(user) {
  if (user.id) await apiPatch(`/users/${user.id}`, user)
  else await apiPost('/users', user)
  return refreshUsers()
}

export async function setUserStatus(id, status) {
  await apiPatch(`/users/${id}/status`, { status })
  return refreshUsers()
}

export async function removeUser(id) {
  await apiDelete(`/users/${id}`)
  return refreshUsers()
}

export function activeOfficers() {
  return getUsers().filter(u => u.status === 'active' && ['Grievance Officer', 'SPMU Admin'].includes(u.role))
}
