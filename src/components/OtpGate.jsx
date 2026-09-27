import { useState } from 'react'
import { ShieldAlert, Mail, Loader2, KeyRound, ArrowRight } from 'lucide-react'
import { Card } from './ui'
import { requestOtp, verifyOtp, hasOtpGrant, setOtpGrant } from '../lib/otp'

export default function OtpGate({ purpose, caseRef, title, blurb, children }) {
  const [unlocked, setUnlocked] = useState(() => hasOtpGrant(purpose, caseRef))
  const [step, setStep] = useState('disclaimer')
  const [agreed, setAgreed] = useState(false)
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (unlocked) return children

  const sendCode = async () => {
    if (!agreed || busy) return
    setBusy(true); setError('')
    try {
      const r = await requestOtp(purpose, caseRef)
      setSentTo(r.email || 'your email')
      setStep('code')
    } catch (e) {
      setError(e.message || 'Could not send the access code. Try again.')
    } finally { setBusy(false) }
  }

  const verify = async () => {
    if (code.trim().length < 6 || busy) return
    setBusy(true); setError('')
    try {
      const r = await verifyOtp(purpose, code.trim(), caseRef)
      setOtpGrant(purpose, caseRef, r.grantMinutes || 30)
      setUnlocked(true)
    } catch (e) {
      setError(e.message || 'That code was not accepted.')
    } finally { setBusy(false) }
  }

  return (
    <div className="p-3 md:p-5">
      <Card className="max-w-md mx-auto mt-8 overflow-hidden border-t-4 border-t-violet-500">
        <div className="p-7">
          <div className="h-12 w-12 rounded-md bg-violet-50 flex items-center justify-center mb-4">
            <ShieldAlert size={22} className="text-violet-600" />
          </div>
          <h2 className="text-base font-bold text-slate-900">{title || 'Protected area'}</h2>
          <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">
            {blurb || 'This area holds sensitive information. Access is identity-verified and every view is recorded.'}
          </p>

          {step === 'disclaimer' && (
            <div className="mt-5">
              <label className="flex items-start gap-2.5 rounded-md bg-violet-50/60 ring-1 ring-violet-100 p-3.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-violet-600"
                />
                <span className="text-[12.5px] text-slate-600 leading-relaxed">
                  I acknowledge that I am <span className="font-semibold text-slate-800">personally accountable and liable</span> for
                  every piece of information I view during this session, and that my access is logged to the audit trail.
                </span>
              </label>
              {error && <p className="mt-3 text-[12px] text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">{error}</p>}
              <button
                onClick={sendCode}
                disabled={!agreed || busy}
                className="mt-4 w-full flex items-center justify-center gap-2 text-[13px] font-semibold text-white bg-violet-600 rounded-md px-4 py-2.5 hover:bg-violet-700 disabled:opacity-40"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                {busy ? 'Sending code…' : 'Email me an access code'}
              </button>
            </div>
          )}

          {step === 'code' && (
            <div className="mt-5">
              <p className="text-[12.5px] text-slate-500 flex items-center gap-1.5">
                <Mail size={13} className="text-violet-500" /> A 6-digit code was sent to <span className="font-semibold text-slate-700">{sentTo}</span>
              </p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && verify()}
                inputMode="numeric"
                autoFocus
                placeholder="••••••"
                className="mt-3 w-full text-center text-2xl font-bold tracking-[0.5em] rounded-md border border-slate-200 bg-white px-3 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
              />
              {error && <p className="mt-3 text-[12px] text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-3 py-2">{error}</p>}
              <button
                onClick={verify}
                disabled={code.length < 6 || busy}
                className="mt-4 w-full flex items-center justify-center gap-2 text-[13px] font-semibold text-white bg-violet-600 rounded-md px-4 py-2.5 hover:bg-violet-700 disabled:opacity-40"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                {busy ? 'Verifying…' : 'Unlock'}
              </button>
              <button
                onClick={() => { setStep('disclaimer'); setCode(''); setError('') }}
                className="mt-2.5 w-full text-[12px] font-medium text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1"
              >
                Didn’t get it? Start over <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
