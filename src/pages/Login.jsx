import { useState } from 'react'
import { Eye, EyeOff, ArrowRight, KeyRound } from 'lucide-react'
import { login, pinLogin, setPin, rememberedAccount, forgetAccount } from '../lib/auth'

const FEATURES = [
  'Unified intake — WhatsApp, field officers, web portal and front desk',
  'Confidential by design — geo-scoped access and a restricted SEA/SH partition',
  'Automated reporting and documented M&E data interfaces',
]

export default function Login() {
  const remembered = rememberedAccount()

  const [mode, setMode] = useState(remembered?.hasPin ? 'pin' : 'password')
  const [email, setEmail] = useState(remembered?.email || '')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [pin, setPinVal] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onlyDigits = (v) => v.replace(/\D/g, '').slice(0, 4)

  const doPasswordLogin = async (e) => {
    e?.preventDefault()
    setError(''); setBusy(true)
    const res = await login(email, password)
    if (res.error) { setError(res.error); setBusy(false); return }
    if (res.user?.pinSet) { window.location.reload(); return }

    setBusy(false); setPinVal(''); setPin2(''); setMode('createPin')
  }

  const doPinLogin = async (value) => {
    setError(''); setBusy(true)
    const res = await pinLogin(email, value)
    if (res.error) { setError(res.error); setBusy(false); setPinVal(''); return }
    window.location.reload()
  }

  const doCreatePin = async (e) => {
    e?.preventDefault()
    if (pin.length !== 4) { setError('Enter a 4-digit PIN.'); return }
    if (pin !== pin2) { setError('PINs do not match.'); setPin(''); setPin2(''); return }
    setError(''); setBusy(true)
    const res = await setPin(pin)
    if (res.error) { setError(res.error); setBusy(false); return }
    window.location.reload()
  }

  const useDifferentAccount = () => {
    forgetAccount()
    setMode('password'); setEmail(''); setPassword(''); setPinVal(''); setError('')
  }

  return (
    <div className="h-full overflow-y-auto grid grid-cols-1 lg:grid-cols-2 bg-white">

      <div className="hidden lg:flex flex-col justify-between bg-[#0c3b2a] p-12">
        <div className="flex items-center gap-3.5">
          <img src="/spin-logo.jpeg" alt="SPIN Project" className="h-14 w-14 rounded-full bg-white object-contain p-0.5" />
          <div>
            <p className="text-[15px] font-bold text-white tracking-tight leading-tight">SPIN Project</p>
            <p className="text-[11.5px] text-emerald-100/60 font-medium leading-tight mt-0.5">Sustainable Power and Irrigation for Nigeria</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-[28px] font-bold text-white tracking-tight leading-snug">
            Grievance Management<br />Information System
          </h1>
          <p className="text-[13.5px] text-emerald-50/65 mt-3 leading-relaxed">
            The official register for receiving, tracking and resolving project-affected
            persons' grievances across all participating states.
          </p>
          <ul className="mt-7 space-y-3 border-l-2 border-emerald-300/25 pl-4">
            {FEATURES.map(text => (
              <li key={text} className="text-[13px] text-emerald-50/75 leading-relaxed">{text}</li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-4">
            <img src="/ministry-water.jpeg" alt="Federal Ministry of Water Resources" className="h-11 w-11 rounded-md bg-white object-contain p-0.5" />
            <img src="/world-bank.jpeg" alt="The World Bank" className="h-11 rounded-md bg-white object-contain px-2 py-1" />
          </div>
          <p className="text-[11px] text-emerald-100/45 leading-relaxed">
            Federal Ministry of Water Resources and Sanitation · Supported by the World Bank
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-8 min-w-0">
        <div className="w-full max-w-sm min-w-0 fade-up">

          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <img src="/spin-logo.jpeg" alt="SPIN Project" className="h-10 w-10 rounded-full object-contain" />
            <p className="text-sm font-bold text-slate-900">SPIN Project · Grievance MIS</p>
          </div>

          {mode === 'pin' && (
            <PinView
              title="Enter your PIN"
              subtitle={email}
              value={pin}
              busy={busy}
              error={error}
              autoSubmit
              onChange={(v) => {
                const d = onlyDigits(v)
                setPinVal(d); setError('')
                if (d.length === 4) doPinLogin(d)
              }}
              footer={
                <div className="mt-6 flex items-center justify-between text-[12.5px]">
                  <button type="button" onClick={() => { setMode('password'); setError(''); setPinVal('') }} className="text-emerald-700 font-semibold hover:underline">Use password</button>
                  <button type="button" onClick={useDifferentAccount} className="text-slate-400 hover:text-slate-600">Different account</button>
                </div>
              }
            />
          )}

          {mode === 'createPin' && (
            <form onSubmit={doCreatePin}>
              <div className="flex items-center gap-2 text-emerald-700 mb-1">
                <KeyRound size={16} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">One-time setup</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Create your PIN</h2>
              <p className="text-[13px] text-slate-500 mt-1">A 4-digit PIN to sign in quickly next time, on web and mobile.</p>

              <div className="mt-7 space-y-4">
                <PinBoxes label="New PIN" value={pin} onChange={(v) => { setPinVal(onlyDigits(v)); setError('') }} autoFocus />
                <PinBoxes label="Confirm PIN" value={pin2} onChange={(v) => { setPin2(onlyDigits(v)); setError('') }} />
                {error && <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-3.5 py-2.5">{error}</p>}
                <button type="submit" disabled={busy || pin.length !== 4 || pin2.length !== 4}
                  className="w-full flex items-center justify-center gap-2 text-[13.5px] font-semibold text-white bg-emerald-700 rounded-md py-2.5 hover:bg-emerald-800 disabled:opacity-40 transition-colors">
                  {busy ? 'Saving…' : 'Save PIN & continue'} {!busy && <ArrowRight size={15} />}
                </button>
              </div>
            </form>
          )}

          {mode === 'password' && (
            <>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Sign in</h2>
              <p className="text-[13px] text-slate-500 mt-1">Access is role-based and scoped to your assignment</p>

              <form onSubmit={doPasswordLogin} className="mt-7 space-y-4">
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@spinproject.ng"
                    autoComplete="username"
                    className="w-full text-[13.5px] rounded-md border border-slate-200 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Password</span>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full text-[13.5px] rounded-md border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                    <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>

                {error && (
                  <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-100 rounded-md px-3.5 py-2.5">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={busy || !email || !password}
                  className="w-full flex items-center justify-center gap-2 text-[13.5px] font-semibold text-white bg-emerald-700 rounded-md py-2.5 hover:bg-emerald-800 disabled:opacity-40 transition-colors"
                >
                  {busy ? 'Signing in…' : 'Sign in'} {!busy && <ArrowRight size={15} />}
                </button>

                {remembered?.hasPin && (
                  <button type="button" onClick={() => { setMode('pin'); setEmail(remembered.email); setError('') }}
                    className="w-full text-center text-[12.5px] text-emerald-700 font-semibold hover:underline">
                    Use your PIN instead
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PinView({ title, subtitle, value, onChange, busy, error, footer, autoSubmit }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-[13px] text-slate-500 mt-1">{subtitle}</p>}
      <div className="mt-8">
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••"
          maxLength={4}
          className="w-full text-center text-[34px] tracking-[0.6em] font-bold text-slate-800 rounded-lg border border-slate-200 bg-white py-4 pl-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
        />
        <div className="h-6 mt-2 text-center">
          {busy ? <span className="text-[12.5px] text-slate-400">Signing in…</span>
            : error ? <span className="text-[12px] text-rose-700">{error}</span> : null}
        </div>
        {footer}
      </div>
    </div>
  )
}

function PinBoxes({ label, value, onChange, autoFocus }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••"
        maxLength={4}
        className="w-full text-center text-[26px] tracking-[0.5em] font-bold text-slate-800 rounded-md border border-slate-200 bg-white py-2.5 pl-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
      />
    </label>
  )
}
