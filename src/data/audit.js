

import { apiGet, apiPost } from '../lib/api'

export const AUDIT_ACTIONS = {
  login: 'Signed in',
  logout: 'Signed out',
  access_restricted: 'Opened restricted (SEA/SH) area',
  view_restricted_case: 'Viewed restricted case',
  otp_issued: 'Access code issued',
  insights_used: 'Used Insights',
  insights_denied: 'Insights access blocked (out of scope)',
  access_denied: 'Page access blocked (no permission)',
  register_case: 'Registered case',
  case_created: 'Registered case',
  case_assigned: 'Assigned case',
  case_escalated: 'Escalated case',
  case_status: 'Changed case status',
  export_cases: 'Exported case register (CSV)',
  export_report: 'Exported report',
  user_created: 'Created user',
  user_updated: 'Updated user',
  user_suspended: 'Suspended user',
  user_reactivated: 'Reactivated user',
  user_removed: 'Removed user',
  coverage_saved: 'Updated project coverage',
}

export async function logEvent(action, { target, detail, severity, label } = {}) {
  try {
    return await apiPost('/audit', {
      action,
      label: label || AUDIT_ACTIONS[action] || action,
      target,
      detail,
      severity,
    })
  } catch { return null }
}

export async function fetchAudit({ action, q, highOnly } = {}) {
  const params = new URLSearchParams()
  if (action) params.set('action', action)
  if (q) params.set('q', q)
  if (highOnly) params.set('highOnly', 'true')
  const qs = params.toString()
  return apiGet(`/audit${qs ? `?${qs}` : ''}`)
}
