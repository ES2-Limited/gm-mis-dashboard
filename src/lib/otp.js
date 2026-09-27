

import { apiPost } from './api'

export const requestOtp = (purpose, caseRef) => apiPost('/otp/request', { purpose, caseRef })
export const verifyOtp = (purpose, code, caseRef) => apiPost('/otp/verify', { purpose, code, caseRef })

const grantKey = (purpose, caseRef) => `spin.otp.${purpose}.${caseRef || '_'}`

export function hasOtpGrant(purpose, caseRef) {
  try {
    const exp = Number(sessionStorage.getItem(grantKey(purpose, caseRef)))
    return !!exp && Date.now() < exp
  } catch { return false }
}

export function setOtpGrant(purpose, caseRef, minutes) {
  try { sessionStorage.setItem(grantKey(purpose, caseRef), String(Date.now() + minutes * 60000)) } catch { /* ignore */ }
}
