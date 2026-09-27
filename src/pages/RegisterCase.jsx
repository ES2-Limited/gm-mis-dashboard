import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, ScanText, RefreshCw, ShieldAlert, Save, MessageSquareText, CheckCircle2, Loader2, MapPin, X, Languages, UserCog,
  Keyboard, Camera, Check, ShieldCheck, FileX2, CalendarClock, Phone, HeartHandshake, AlertTriangle,
} from 'lucide-react'
import { Card } from '../components/ui'
import { STATES, getViewAs, DOMAINS, domainForCategory, isRestricted } from '../data/mock'
import { isCoverageConfigured, activeStateNames, activeLgas, sitesInState, getStateModel, getReferralAuthorities, getReferralBodiesForState } from '../data/coverage'
import { fetchTaxonomy } from '../data/taxonomyApi'
import { createCase, translateText, caseAction } from '../data/casesApi'
import { getAuth } from '../lib/auth'
import { canAccess } from '../lib/rbac'
import { logEvent } from '../data/audit'
import { classifyGrievance, isConfigured } from '../lib/intelligence'

function resolveCoverage(value, state) {
  if (!value || value === 'STATE' || value === 'ALL') return { lga: '', community: '' }
  const toks = value.split(',').map(s => s.trim()).filter(Boolean)
  if (toks.length === 1) {
    const t = toks[0]
    if (t.startsWith('LGA:')) return { lga: t.slice(4), community: '' }
    const siteName = t.startsWith('SITE:') ? t.slice(5) : t
    const site = sitesInState(state).find(s => s.name === siteName)
    if (site) return { lga: site.lga, community: site.name }
  }
  return { lga: '', community: '' }
}

function officerContext() {
  const me = getAuth() || getViewAs() || {}
  const national = !me.scope || me.scope === 'All states'
  const state = national ? '' : me.scope
  const cov = national ? { lga: '', community: '' } : resolveCoverage(me.community, state)
  return {
    national,
    state,
    lga: cov.lga || (national ? '' : (me.lga || '')),
    community: cov.community,
    fullyLocated: !national && !!cov.community,
  }
}

function Field({ label, suggested, children }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
        {label}
        {suggested && (
          <span className="text-[9px] font-bold normal-case tracking-normal text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded-full px-1.5 py-px">
            suggested
          </span>
        )}
      </span>
      {children}
    </label>
  )
}

const inputCls = 'w-full text-[12.5px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500'

const SPEECH_LANGS = [
  { code: 'en', label: 'English / Pidgin' },
  { code: 'yo', label: 'Yoruba' },
  { code: 'ha', label: 'Hausa' },
  { code: 'ig', label: 'Igbo' },
]

function PhotoCapture({ onText }) {
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [err, setErr] = useState('')
  const inputRef = useRef(null)

  const handle = async (file) => {
    if (!file) return
    setErr(''); setPreview(URL.createObjectURL(file)); setBusy(true); setProgress(0)
    try {
      const Tesseract = await import('tesseract.js')
      const { data } = await Tesseract.recognize(file, 'eng', {
        logger: (m) => { if (m.status === 'recognizing text') setProgress(Math.round((m.progress || 0) * 100)) },
      })
      const text = (data?.text || '').replace(/\s+\n/g, '\n').trim()
      if (text) onText(text)
      else setErr('No readable text found in the image — type it instead.')
    } catch {
      setErr('Could not read the image. Type the complaint instead.')
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 mb-2 space-y-2">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      <div className="flex items-center gap-2">
        <button onClick={() => inputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-brand-700 rounded-md px-3 py-1.5 hover:bg-brand-800 disabled:opacity-50">
          <Camera size={14} /> Snap / upload photo
        </button>
        {busy && <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500"><Loader2 size={13} className="animate-spin" /> Reading text… {progress}%</span>}
      </div>
      {preview && (
        <div className="flex items-start gap-2">
          <img src={preview} alt="complaint" className="h-16 w-16 object-cover rounded-md border border-slate-200 shrink-0" />
          <p className="text-[10.5px] text-slate-400">Extracted text drops into the narrative below — review and correct it. The photo itself is not stored.</p>
        </div>
      )}
      {err && <p className="text-[11.5px] text-amber-700">{err}</p>}
      {!preview && !busy && <p className="text-[10.5px] text-slate-400">Snap a written complaint or letter; the text is extracted automatically.</p>}
    </div>
  )
}

export default function RegisterCase({ onClose, onCreated, confidentialStart = false }) {
  const navigate = useNavigate()
  const asModal = !!onClose
  const officer = officerContext()
  const [narrative, setNarrative] = useState('')
  const [form, setForm] = useState(() => ({

    complainant: '', phone: '', anonymous: false, channel: 'back_office', channelDetail: '',
    state: officer.state, lga: officer.lga, community: officer.community,
    domain: '', category: '', subcategory: '', priority: 'medium', description: '',

    screening: 'project_related', notRelatedReason: '', legacy: false, legacyReferral: '',
  }))
  const [step, setStep] = useState(1)
  const [captureMode, setCaptureMode] = useState('type')
  const [spokenLang, setSpokenLang] = useState('en')
  const LANG_LABEL = { en: 'English / Pidgin', yo: 'Yoruba', ha: 'Hausa', ig: 'Igbo' }
  const appendNarrative = (t) => setNarrative(p => (p ? `${p.trim()} ${t}` : t))
  const [suggested, setSuggested] = useState(new Set())
  const [analysis, setAnalysis] = useState(null)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [sensitive, setSensitive] = useState(confidentialStart)
  const [gbv, setGbv] = useState({ risk: '', safetyNote: '', consent: null, body: '', bodyType: '', reason: '', scope: 'in' })
  const [gbvStep, setGbvStep] = useState('safety')
  const [gbvResult, setGbvResult] = useState(null)
  const [gbvCode, setGbvCode] = useState('')
  const sg = (k, v) => setGbv(g => ({ ...g, [k]: v }))
  const openConfidential = () => { setGbv({ risk: '', safetyNote: '', consent: null, body: '', bodyType: '', reason: '', scope: 'in' }); setGbvStep('safety'); setGbvResult(null); setError(''); setSensitive(true) }
  const closeConfidential = () => { setSensitive(false); setGbvStep('safety'); setGbvResult(null) }

  const triggerConfidential = () => { if (asModal) { onClose?.(); navigate('/cases/confidential') } else openConfidential() }

  const registrar = getAuth() || getViewAs() || {}
  const registrarLevel = registrar.tier ? `Level ${registrar.tier}` : (officer.national ? 'Federal' : null)

  const entryLevel = /Community Grievance Focal/i.test(registrar.role || '') ? 1 : 2

  const [categories, setCategories] = useState([])
  useEffect(() => { fetchTaxonomy().then(setCategories).catch(() => {}) }, [])

  const canRestricted = canAccess(registrar, 'restricted')
  const catNames = categories.map(c => c.name)
  const visibleCats = (list) => canRestricted ? list : list.filter(c => !isRestricted(c.name))
  const catByName = (n) => categories.find(c => c.name === n)

  const catDomain = (c) => (c ? (c.domain || domainForCategory(c.name)) : '')
  const domainsInUse = DOMAINS.filter(d => categories.some(c => catDomain(c) === d))
  const catsInDomain = (d) => categories.filter(c => catDomain(c) === d)
  const subgroupsOf = (n) => catByName(n)?.subgroups || []

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    setSuggested(s => { const n = new Set(s); n.delete(k); return n })
  }

  const analyse = async () => {
    if (!narrative.trim() || analysing) return
    setAnalysing(true); setError(''); setAnalysis(null)
    try {

      let spitchEnglish = ''
      if (spokenLang && spokenLang !== 'en') {
        try {
          const t = await translateText({ text: narrative, source: spokenLang, target: 'en' })
          if (t?.text) spitchEnglish = t.text
        } catch { /* fall back to LLM translation below */ }
      }

      const r = await classifyGrievance(spitchEnglish || narrative)
      const translation = spitchEnglish || r.translation || ''
      const language = spokenLang !== 'en' ? LANG_LABEL[spokenLang] : (r.language || '')

      setAnalysis({ language, translation, reason: r.reason || '', confidence: r.confidence || '', sensitive: !!r.sensitive })

      if (r.sensitive) return
      const next = { ...form }
      const marks = new Set()
      if (catNames.includes(r.category)) { next.category = r.category; next.domain = catDomain(catByName(r.category)); next.subcategory = ''; marks.add('domain'); marks.add('category') }
      if (['low', 'medium', 'high'].includes(r.priority)) { next.priority = r.priority; marks.add('priority') }

      if (officer.national && stateNames.includes(r.state)) { next.state = r.state; marks.add('state') }
      if (officer.national && r.lga) { next.lga = String(r.lga); marks.add('lga') }
      if (r.summary) { next.description = String(r.summary); marks.add('description') }
      setForm(next); setSuggested(marks)
    } catch (e) {
      setError(
        e.message === 'NOT_CONFIGURED' ? 'Classification needs the Insights engine — fill the form manually or configure it in Settings.' :
        e.message === 'INVALID_KEY' ? 'The access key was rejected. Update it in Settings.' :
        'Could not analyse the narrative. Fill the form manually or try again.'
      )
    } finally { setAnalysing(false) }
  }

  const details = form.description.trim() || narrative.trim()

  const projectHandling = form.screening === 'project_related' && !form.legacy
  const missing = [
    !form.anonymous && !form.complainant.trim() ? 'Full name' : null,
    projectHandling && !form.domain ? 'Grievance domain' : null,
    projectHandling && !form.category ? 'Category' : null,
    !form.state ? 'State' : null,
    !details && projectHandling ? 'Grievance details (narrative or description)' : null,
    form.screening === 'not_project_related' && !form.notRelatedReason.trim() ? 'Reason (not project related)' : null,
    form.legacy && !form.legacyReferral.trim() ? 'Legacy referral authority' : null,
  ].filter(Boolean)
  const valid = missing.length === 0

  const save = async () => {
    if (!valid || saving) return
    setSaving(true); setError('')
    try {
      const c = await createCase({

        category: form.category || ((form.screening === 'not_project_related' || form.legacy) ? 'Other' : form.category),
        subcategory: form.subcategory || undefined,
        state: form.state,
        lga: form.lga || undefined,
        community: form.community || undefined,

        description: details || (form.screening === 'not_project_related' ? (form.notRelatedReason.trim() || 'Not project related') : (form.legacy ? 'Legacy grievance (predates SPIN)' : details)),
        narrative: narrative.trim() || undefined,
        priority: form.priority,
        channel: form.channel,
        channelDetail: form.channelDetail || undefined,
        anonymous: form.anonymous,
        complainant: form.anonymous ? undefined : form.complainant.trim(),
        phone: form.anonymous ? undefined : (form.phone.trim() || undefined),

        screening: form.screening,
        screeningReason: form.screening === 'not_project_related' ? form.notRelatedReason.trim() : undefined,
        legacy: form.legacy,
        legacyReferral: form.legacy ? form.legacyReferral.trim() : undefined,
      })
      logEvent('register_case', { target: c.code })
      if (onCreated) onCreated(c)
      else navigate(`/cases/${c.id}`)
    } catch (e) {
      setError(e.message || 'Could not register the case. Check the form and try again.')
      setSaving(false)
    }
  }

  const gbvCategory = form.category && isRestricted(form.category)
    ? form.category
    : (categories.find(c => isRestricted(c.name))?.name || 'SEA/SH & GBV')

  const recordConfidential = async ({ withReferral }) => {
    if (saving) return
    setSaving(true); setError('')
    try {
      const c = await createCase({
        category: gbvCategory,
        state: form.state,
        anonymous: true,
        priority: gbv.risk === 'immediate_danger' ? 'high' : 'medium',
        screening: 'project_related',
      })
      logEvent('register_case', { target: c.code })
      setGbvCode(c.code)

      if (withReferral && gbv.consent === true && gbv.body) {
        try {
          await caseAction.refer(c.id, {
            body: gbv.body,
            bodyType: gbv.bodyType || undefined,
            reason: gbv.reason.trim() || 'Confidential SEA/SH & GBV survivor referral',
            consent: true,
            riskLevel: gbv.risk,
            safetyNote: gbv.safetyNote.trim() || undefined,
          })
          setGbvResult('referred')
        } catch {
          setGbvResult('routed')
        }
      } else {
        setGbvResult('routed')
      }
    } catch (e) {
      setError(e.message || 'Could not record the confidential referral. Try again.')
      setSaving(false)
    }
  }

  const covOn = isCoverageConfigured()
  const stateNames = covOn ? activeStateNames() : STATES.map(s => s.name)
  const stateLgas = covOn ? activeLgas(form.state) : (STATES.find(s => s.name === form.state)?.lgas || [])
  const lgaOptions = form.lga && !stateLgas.includes(form.lga) ? [form.lga, ...stateLgas] : stateLgas

  const siteOptions = form.lga ? sitesInState(form.state).filter(s => s.lga === form.lga).map(s => s.name) : []

  if (sensitive) {
    const stateForDir = form.state
    const needState = !stateForDir
    const { inState, other } = getReferralBodiesForState(stateForDir)
    const providers = gbv.scope === 'other' ? other : inState
    const selectedProvider = providers.find(p => p.name === gbv.body) || null
    const urgent = gbv.risk === 'immediate_danger'
    const noProviders = inState.length === 0 && other.length === 0

    if (gbvResult) {
      const referred = gbvResult === 'referred'
      return (
        <div className="p-3 md:p-5 space-y-3 md:space-y-4">

          <div className="flex items-center gap-3 fade-up">
            {asModal ? (
              <button onClick={onClose} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-1.5">
                <ArrowLeft size={14} /> Close
              </button>
            ) : (
              <Link to="/cases" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-1.5">
                <ArrowLeft size={14} /> Cases
              </Link>
            )}
            <span className="h-4 w-px bg-slate-200" />
            <div className="flex-1">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Register Case</h1>
              <p className="text-[12px] text-slate-500">Back-office intake — record a new grievance</p>
            </div>
          </div>
          <Card className="overflow-hidden fade-up">
            <div className="p-5 md:p-7">
              <div className="h-12 w-12 rounded-md bg-emerald-50 flex items-center justify-center mb-4">
                <CheckCircle2 size={22} className="text-emerald-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900">
                {referred ? 'Confidential referral recorded' : 'Routed to the SEA/SH focal person'}
              </h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                {referred
                  ? <>Case <span className="font-semibold text-slate-700">{gbvCode}</span> has been referred to <span className="font-semibold text-slate-700">{gbv.body}</span>. The immediate safety check and the survivor&rsquo;s informed consent are on file.</>
                  : <>A confidential case <span className="font-semibold text-slate-700">{gbvCode}</span> has been routed to the designated SEA/SH focal person, who will complete the referral to a service provider (§5.10.2).</>}
              </p>
              <p className="text-[12px] text-slate-400 mt-3 leading-relaxed bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                Only minimal, non-identifiable information was recorded — no name, narrative, or personal details (Framework §5.10.1). Nothing was placed on the standard register.
              </p>
              {asModal ? (
                <button onClick={onClose} className="inline-flex mt-6 items-center gap-1.5 text-sm font-semibold text-white bg-brand-700 rounded-md px-4 py-2 hover:bg-brand-800">Done</button>
              ) : (
                <Link to="/cases" className="inline-flex mt-6 items-center gap-1.5 text-sm font-semibold text-white bg-brand-700 rounded-md px-4 py-2 hover:bg-brand-800">Back to cases</Link>
              )}
            </div>
          </Card>
        </div>
      )
    }

    const steps = gbv.consent === false
      ? [{ k: 'safety', label: 'Safety' }, { k: 'consent', label: 'Consent' }, { k: 'record', label: 'Record' }]
      : [{ k: 'safety', label: 'Safety' }, { k: 'consent', label: 'Consent' }, { k: 'refer', label: 'Referral' }, { k: 'record', label: 'Record' }]
    const cur = steps.some(s => s.k === gbvStep) ? gbvStep : 'consent'
    const curIdx = steps.findIndex(s => s.k === cur)
    const goBack = () => setGbvStep(steps[Math.max(0, curIdx - 1)].k)
    const goNext = () => setGbvStep(steps[Math.min(steps.length - 1, curIdx + 1)].k)
    const nextDisabled =
      cur === 'safety' ? (needState || !gbv.risk) :
      cur === 'consent' ? gbv.consent === null :
      cur === 'refer' ? (!gbv.body || !gbv.reason.trim()) : false
    const riskLabel = { immediate_danger: 'Immediate danger', elevated: 'Elevated risk', none: 'No immediate risk' }[gbv.risk] || '—'

    return (
      <div className="p-3 md:p-5 space-y-3 md:space-y-4">

        <div className="flex items-center gap-3 fade-up">
          {asModal ? (
            <button onClick={onClose} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-1.5">
              <ArrowLeft size={14} /> Close
            </button>
          ) : (
            <Link to="/cases" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-1.5">
              <ArrowLeft size={14} /> Cases
            </Link>
          )}
          <span className="h-4 w-px bg-slate-200" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Register Case</h1>
            <p className="text-[12px] text-slate-500">Back-office intake — record a new grievance</p>
          </div>
          {asModal && (
            <button onClick={onClose} className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 rounded-md bg-violet-50 border border-violet-200 px-4 py-2.5 fade-up">
          <span className="h-8 w-8 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0">
            <ShieldAlert size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Confidential SEA/SH &amp; GBV pathway</p>
            <p className="text-[12px] text-slate-600">Survivor-centered referral &amp; support — not an investigation (§5.10.2). Minimal, non-identifiable information only.</p>
          </div>
          <button onClick={closeConfidential} className="text-[11.5px] font-medium text-violet-700 hover:text-violet-900 bg-white border border-violet-200 rounded-md px-2.5 py-1.5 shrink-0">
            Not sensitive — standard intake
          </button>
        </div>

        <div className="flex items-center gap-3 fade-up">
          {steps.map((s, i) => (
            <div key={s.k} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className={`h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold ${cur === s.k ? 'bg-violet-600 text-white' : i < curIdx ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'}`}>
                  {i < curIdx ? <Check size={14} /> : i + 1}
                </span>
                <span className={`text-[12.5px] font-semibold ${i <= curIdx ? 'text-slate-700' : 'text-slate-400'}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && <span className="h-px w-8 bg-slate-200" />}
            </div>
          ))}
        </div>

        <Card className="overflow-hidden fade-up">
          <div className="p-4 md:p-5 min-h-[280px]">

            {cur === 'safety' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-[15px] font-bold text-slate-800">Immediate safety check</h2>
                  <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed">First, ensure privacy and calm. Assess whether the survivor is in immediate danger or needs emergency support before anything else (§5.10.1).</p>
                </div>
                {(needState || officer.national) && (
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">State <span className="text-rose-500">*</span></p>
                    <select value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value }))} className={inputCls}>
                      <option value="">Select the survivor&rsquo;s state…</option>
                      {stateNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">Needed to find a service provider near the survivor.</p>
                  </div>
                )}
                <div className="space-y-2">
                  {[
                    { v: 'immediate_danger', label: 'Immediate danger', hint: 'Urgent risk — emergency support needed now' },
                    { v: 'elevated', label: 'Elevated risk', hint: 'Not immediate, but heightened concern for safety' },
                    { v: 'none', label: 'No immediate risk', hint: 'Survivor is safe for now' },
                  ].map(o => (
                    <button key={o.v} onClick={() => sg('risk', o.v)}
                      className={`w-full text-left rounded-xl px-4 py-3 ring-1 transition-colors ${gbv.risk === o.v ? (o.v === 'immediate_danger' ? 'bg-rose-50 ring-rose-300' : 'bg-violet-50 ring-violet-300') : 'bg-white ring-slate-200 hover:bg-slate-50'}`}>
                      <span className="text-[13.5px] font-semibold text-slate-800">{o.label}</span>
                      <span className="block text-[11.5px] text-slate-400 mt-0.5">{o.hint}</span>
                    </button>
                  ))}
                </div>
                {urgent && (
                  <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-3">
                    <AlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
                    <p className="text-[12.5px] text-rose-700 leading-relaxed">
                      <span className="font-semibold">Prioritise safety first.</span> Arrange emergency support (security, police, or medical) before continuing. Provide calm, non-judgmental first-line support.
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Safety note <span className="normal-case font-normal text-slate-400">(optional)</span></p>
                  <textarea value={gbv.safetyNote} onChange={(e) => sg('safetyNote', e.target.value)} rows={2}
                    placeholder="Immediate needs or emergency action taken. No sensitive personal details."
                    className={`${inputCls} resize-none`} />
                </div>
              </div>
            )}

            {cur === 'consent' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-[15px] font-bold text-slate-800">Informed consent</h2>
                  <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed">Explain the available services and referral options. No information is shared without explicit consent, and the survivor must not be pressured — they retain full autonomy over whether to be referred (§5.10.2).</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => sg('consent', true)}
                    className={`text-left rounded-xl px-4 py-4 ring-1 transition-colors ${gbv.consent === true ? 'bg-violet-50 ring-violet-300' : 'bg-white ring-slate-200 hover:bg-slate-50'}`}>
                    <span className="h-9 w-9 rounded-lg bg-violet-100 text-violet-700 grid place-items-center mb-2"><HeartHandshake size={18} /></span>
                    <span className="block text-[13.5px] font-semibold text-slate-800">Consent given</span>
                    <span className="block text-[11.5px] text-slate-400 mt-0.5">Survivor agrees to be referred to a service provider.</span>
                  </button>
                  <button onClick={() => sg('consent', false)}
                    className={`text-left rounded-xl px-4 py-4 ring-1 transition-colors ${gbv.consent === false ? 'bg-slate-100 ring-slate-300' : 'bg-white ring-slate-200 hover:bg-slate-50'}`}>
                    <span className="h-9 w-9 rounded-lg bg-slate-100 text-slate-500 grid place-items-center mb-2"><ShieldAlert size={18} /></span>
                    <span className="block text-[13.5px] font-semibold text-slate-800">Consent declined</span>
                    <span className="block text-[11.5px] text-slate-400 mt-0.5">Survivor does not want a referral now. It is routed to the focal person for support.</span>
                  </button>
                </div>
              </div>
            )}

            {cur === 'refer' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-[15px] font-bold text-slate-800">Confidential referral</h2>
                  <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed">Refer the survivor directly and discreetly to an appropriate GBV service provider — for medical care, psychosocial support, legal aid, shelter, or protection (§5.10.1).</p>
                </div>
                {noProviders ? (
                  <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3.5 py-3">No referral providers are configured{stateForDir ? ` for ${stateForDir}` : ''}. Add them in Settings → Case Journey, or continue to route the case to the focal person, who will complete the referral.</p>
                ) : (
                  <>
                    {other.length > 0 && (
                      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                        {[{ id: 'in', label: `In ${stateForDir || 'state'} (${inState.length})` }, { id: 'other', label: `Other states (${other.length})` }].map(t => (
                          <button key={t.id} onClick={() => sg('scope', t.id)} className={`text-[11.5px] font-semibold rounded-md px-3 py-1 ${gbv.scope === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>{t.label}</button>
                        ))}
                      </div>
                    )}
                    <div>
                      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Service provider <span className="text-rose-500">*</span></p>
                      <select value={gbv.body} onChange={(e) => { const p = providers.find(x => x.name === e.target.value); setGbv(g => ({ ...g, body: e.target.value, bodyType: p?.type || '' })) }} className={inputCls}>
                        <option value="">Refer to a service provider…</option>
                        {providers.map(p => <option key={`${p.name}-${p.state || ''}`} value={p.name}>{p.name}{p.type ? ` — ${p.type}` : ''}</option>)}
                      </select>
                      {selectedProvider && (selectedProvider.contact || selectedProvider.area) && (
                        <div className="mt-2 text-[11.5px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 space-y-0.5">
                          {selectedProvider.area && <p><span className="font-semibold text-slate-600">Area:</span> {selectedProvider.area}</p>}
                          {selectedProvider.contact && <p className="flex items-start gap-1.5"><Phone size={12} className="text-slate-400 mt-0.5 shrink-0" /> {selectedProvider.contact}</p>}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Referral note <span className="text-rose-500">*</span></p>
                      <textarea value={gbv.reason} onChange={(e) => sg('reason', e.target.value)} rows={3}
                        placeholder="Service needed — medical, psychosocial, legal aid, shelter, child protection, security. No sensitive personal details."
                        className={`${inputCls} resize-none`} />
                    </div>
                  </>
                )}
              </div>
            )}

            {cur === 'record' && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-[15px] font-bold text-slate-800">Record &amp; close</h2>
                  <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed">Only this minimal, non-identifiable confirmation is stored — no name, narrative, or personal details (§5.10.1). The case is filed confidentially and routed to the SEA/SH focal person.</p>
                </div>
                <dl className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-[12.5px]">
                  {[
                    { t: 'Filed under', v: gbvCategory },
                    { t: 'State', v: stateForDir || '—' },
                    { t: 'Safety check', v: riskLabel },
                    { t: 'Consent', v: gbv.consent === true ? 'Given' : gbv.consent === false ? 'Declined' : '—' },
                    ...(gbv.consent === true && gbv.body ? [{ t: 'Referred to', v: gbv.body }] : []),
                    ...(gbv.consent === true && gbv.reason.trim() ? [{ t: 'Referral note', v: gbv.reason.trim() }] : []),
                  ].map(row => (
                    <div key={row.t} className="flex items-start gap-3 px-4 py-2.5">
                      <dt className="w-28 shrink-0 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 pt-0.5">{row.t}</dt>
                      <dd className="text-slate-700 font-medium">{row.v}</dd>
                    </div>
                  ))}
                </dl>
                {gbv.consent === true && !gbv.body && (
                  <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3.5 py-2.5">No provider was selected — the case will be routed to the focal person to complete the referral.</p>
                )}
                {error && <p className="text-[12px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3.5 py-2.5">{error}</p>}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-4 md:px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
            {curIdx === 0 ? (
              <span />
            ) : (
              <button onClick={goBack} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-2">
                <ArrowLeft size={14} /> Back
              </button>
            )}
            {cur === 'record' ? (
              <button
                onClick={() => recordConfidential({ withReferral: gbv.consent === true })}
                disabled={saving || needState || !gbv.risk}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-violet-600 rounded-md px-5 py-2.5 hover:bg-violet-700 disabled:opacity-40">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <HeartHandshake size={15} />}
                {saving ? 'Recording…' : gbv.consent === true && gbv.body ? 'Record referral & close' : 'Route to focal person'}
              </button>
            ) : (
              <button onClick={goNext} disabled={nextDisabled}
                title={nextDisabled ? (cur === 'safety' ? 'Select the state and safety level' : cur === 'consent' ? 'Choose consent given or declined' : 'Pick a provider and add a referral note') : undefined}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-violet-600 rounded-md px-5 py-2.5 hover:bg-violet-700 disabled:opacity-40">
                Continue <ArrowRight size={15} />
              </button>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-5 space-y-3 md:space-y-4">
      <div className="flex items-center gap-3 fade-up">
        {asModal ? (
          <button onClick={onClose} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-1.5">
            <ArrowLeft size={14} /> Close
          </button>
        ) : (
          <Link to="/cases" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-1.5">
            <ArrowLeft size={14} /> Cases
          </Link>
        )}
        <span className="h-4 w-px bg-slate-200" />
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Register Case</h1>
          <p className="text-[12px] text-slate-500">Back-office intake — record a new grievance</p>
        </div>
        {asModal && (
          <button onClick={onClose} className="h-8 w-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Close">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 rounded-md bg-white border border-slate-200 px-4 py-2.5 fade-up">
        <span className="h-8 w-8 rounded-full bg-brand-700 text-white flex items-center justify-center shrink-0">
          <UserCog size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Registering officer · case owner</p>
          <p className="text-[12.5px] font-semibold text-slate-800 truncate">
            {registrar.name || 'You'}
            <span className="font-normal text-slate-500"> · {registrar.role || 'Officer'}{registrarLevel ? ` · ${registrarLevel}` : ''}{registrar.scope ? ` · ${registrar.scope}` : ''}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 fade-up">
        {[{ n: 1, label: 'Capture grievance' }, { n: 2, label: 'Screening' }, { n: 3, label: 'Classify & describe' }].map((s, i) => (
          <div key={s.n} className="flex items-center gap-3">
            <button onClick={() => s.n < step && setStep(s.n)} disabled={s.n > step} className={`flex items-center gap-2 ${s.n < step ? 'cursor-pointer' : 'cursor-default'}`}>
              <span className={`h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold ${step === s.n ? 'bg-brand-700 text-white' : step > s.n ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>
                {step > s.n ? <Check size={14} /> : s.n}
              </span>
              <span className={`text-[12.5px] font-semibold ${step >= s.n ? 'text-slate-700' : 'text-slate-400'}`}>{s.label}</span>
            </button>
            {i < 2 && <span className="h-px w-8 bg-slate-200" />}
          </div>
        ))}
      </div>

      {step === 1 && (
      <div className="space-y-3 md:space-y-4 fade-up">
        <div className="grid grid-cols-12 gap-3 md:gap-4 items-start">

          <div className="col-span-12 xl:col-span-7">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <MessageSquareText size={15} className="text-slate-400" />
                <h3 className="text-[13px] font-semibold text-slate-800">Complainant Narrative</h3>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">Verbatim</span>
            </div>

            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-3">
              {[
                { id: 'type', label: 'Type', icon: Keyboard },
                { id: 'photo', label: 'Photo', icon: Camera },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setCaptureMode(m.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-semibold rounded-md py-1.5 transition-colors ${
                    captureMode === m.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <m.icon size={13} /> {m.label}
                </button>
              ))}
            </div>

            {captureMode === 'photo' && <PhotoCapture onText={appendNarrative} />}

            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={captureMode === 'type' ? 7 : 5}
              placeholder={captureMode === 'type'
                ? 'Transcribe it word-for-word, in the language they used…\n\ne.g. "Na since February dem pay everybody for our scheme but my own money never enter. Dem write my farm as 1.2 hectares but e reach 3 hectares for Kura."'
                : 'The captured text lands here — review and correct it before translating…'}
              className="w-full text-[13px] rounded-md border border-slate-200 bg-slate-50/50 px-3.5 py-3 leading-relaxed text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:bg-white resize-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
              <label className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-500">Complaint language</span>
                <select value={spokenLang} onChange={(e) => setSpokenLang(e.target.value)} className="text-[12px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-600">
                  {SPEECH_LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </label>
              <button
                onClick={analyse}
                disabled={analysing || !narrative.trim() || !isConfigured()}
                title={!isConfigured() ? 'Requires the Insights engine (Settings)' : undefined}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-4 py-2 hover:bg-brand-800 disabled:opacity-40"
              >
                {analysing ? <RefreshCw size={14} className="animate-spin" /> : <ScanText size={14} />}
                {analysing ? 'Translating…' : 'Translate & suggest'}
              </button>
            </div>

            {analysis && (
              <div className="mt-3 space-y-2.5">

                {analysis.translation && (
                  <div className="rounded-lg bg-sky-50 ring-1 ring-sky-200 px-3.5 py-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                        <Languages size={12} /> English translation
                      </p>
                      {analysis.language && (
                        <span className="text-[10px] font-semibold text-sky-700 bg-sky-100 rounded-full px-2 py-0.5">detected: {analysis.language}</span>
                      )}
                    </div>
                    <p className="text-[13.5px] font-medium text-slate-800 leading-relaxed">{analysis.translation}</p>
                  </div>
                )}

                {analysis.sensitive ? (
                  <div className="rounded-lg bg-violet-50 border border-violet-200 px-3 py-3">
                    <p className="text-[12.5px] font-bold text-violet-800 flex items-center gap-1.5">
                      <ShieldAlert size={14} /> This looks like a sensitive (SEA/SH) disclosure
                    </p>
                    <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">{analysis.reason}</p>
                    {canRestricted ? (
                      <>
                        <p className="text-[11.5px] text-slate-500 mt-1.5">
                          Read the translation above first. If you agree it is sensitive, open the confidential pathway — nothing will be recorded on the standard register. Otherwise continue normal intake.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          <button onClick={triggerConfidential} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-violet-600 rounded-md px-3 py-1.5 hover:bg-violet-700">
                            <ShieldAlert size={13} /> Open confidential pathway
                          </button>
                          <button onClick={() => setAnalysis(a => ({ ...a, sensitive: false }))} className="text-[12.5px] font-medium text-slate-500 bg-white border border-slate-200 rounded-md px-3 py-1.5 hover:bg-slate-50">
                            Not sensitive — continue intake
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-[11.5px] text-violet-700 mt-1.5 leading-relaxed">
                        Do <span className="font-semibold">not</span> record details on this form. Hand the complainant to the designated SEA/SH focal person, who handles this confidentially.
                      </p>
                    )}
                  </div>
                ) : (
                  analysis.reason && (
                    <p className="text-[12px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                      <span className="font-semibold text-slate-600">Why: </span>{analysis.reason}{analysis.confidence ? ` · confidence: ${analysis.confidence}` : ''}
                    </p>
                  )
                )}
              </div>
            )}
            {error && <p className="mt-3 text-[12px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>}
          </Card>
          </div>

          <div className="col-span-12 xl:col-span-5">
          <Card className="p-5">
            <h3 className="text-[13px] font-semibold text-slate-800 mb-3.5">Complainant</h3>
            <div className="space-y-3.5">
              <Field label="Full name">
                <input value={form.complainant} onChange={(e) => set('complainant', e.target.value)} disabled={form.anonymous} placeholder="As on the register" className={`${inputCls} disabled:opacity-50`} />
              </Field>
              <Field label="Phone">
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)} disabled={form.anonymous} placeholder="080…" className={`${inputCls} disabled:opacity-50`} />
              </Field>
              <label className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.anonymous}
                  onChange={(e) => set('anonymous', e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                />
                Complainant wishes to remain anonymous
              </label>
            </div>
          </Card>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {!(form.anonymous || form.complainant.trim()) && (
            <p className="text-[11.5px] text-amber-600 font-medium">Enter the complainant&rsquo;s name, or tick anonymous, to continue</p>
          )}
          <button
            onClick={() => setStep(2)}
            disabled={!(form.anonymous || form.complainant.trim())}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-5 py-2.5 hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed">
            Continue to screening <ArrowRight size={15} />
          </button>
        </div>
      </div>
      )}

      {step === 2 && (
        <Card className="p-4 fade-up">
          <div className="mb-4">
            <h3 className="text-[15px] font-bold text-slate-800">How should this grievance be handled?</h3>
            <p className="text-[12px] text-slate-400 mt-0.5">Screen it before it enters the mechanism — choose one to continue.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">

            <button type="button" onClick={() => set('screening', 'project_related')}
              className={`group relative text-left rounded-2xl border p-5 transition-all ${form.screening === 'project_related' ? 'border-brand-300 ring-1 ring-brand-200 bg-white' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
              <span className="absolute top-4 right-4 text-[9.5px] font-bold uppercase tracking-wide text-brand-700 border border-brand-200 rounded-full px-2 py-0.5">Within mechanism</span>
              <div className="h-11 w-11 rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100 grid place-items-center"><ShieldCheck size={20} /></div>
              <h4 className="text-[16px] font-bold text-slate-800 mt-3.5">Project Related</h4>
              <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">A grievance arising from SPIN project activities — screened, classified and handled through the mechanism.</p>
              <ul className="mt-3 space-y-1.5">
                {['Classified by domain, category & sub-group', 'Routed through the escalation ladder', 'Resolution timelines (SLA) tracked'].map(t => (
                  <li key={t} className="flex items-center gap-2 text-[11.5px] text-slate-600"><CheckCircle2 size={13} className="text-brand-600 shrink-0" /> {t}</li>
                ))}
              </ul>
              <span className="mt-3.5 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700">Continue to classification <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" /></span>
            </button>

            <button type="button" onClick={() => set('screening', 'not_project_related')}
              className={`group relative text-left rounded-2xl border p-5 transition-all ${form.screening === 'not_project_related' ? 'border-slate-300 ring-1 ring-slate-200 bg-white' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
              <span className="absolute top-4 right-4 text-[9.5px] font-bold uppercase tracking-wide text-slate-500 border border-slate-200 rounded-full px-2 py-0.5">Out of scope</span>
              <div className="h-11 w-11 rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200 grid place-items-center"><FileX2 size={20} /></div>
              <h4 className="text-[16px] font-bold text-slate-800 mt-3.5">Not Project Related</h4>
              <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">Outside the mechanism&rsquo;s mandate — recorded for the register and closed with a reason.</p>
              <ul className="mt-3 space-y-1.5">
                {['Documented on the register', 'Referred to the right body where possible', 'Closed immediately — no classification'].map(t => (
                  <li key={t} className="flex items-center gap-2 text-[11.5px] text-slate-600"><CheckCircle2 size={13} className="text-slate-400 shrink-0" /> {t}</li>
                ))}
              </ul>
              <span className="mt-3.5 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-700">Record &amp; close <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" /></span>
            </button>
          </div>

          {form.screening === 'project_related' && (
            <div className="mt-4 pt-3.5 border-t border-slate-100">
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={form.legacy} onChange={(e) => set('legacy', e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-600" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-700"><CalendarClock size={13} className="text-slate-400" /> Legacy grievance (predates SPIN)</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">A separate flag — documented and referred to the appropriate authority, not handled as a project case.</span>
                </span>
              </label>
              {form.legacy && (() => {
                const authorities = getReferralAuthorities()
                return (
                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Field label="Referred to">
                      {authorities.length === 0 ? (
                        <p className="text-[11.5px] text-amber-600">No referral authorities configured — add them in Settings → Case Journey → Referral Authorities.</p>
                      ) : (
                        <select value={form.legacyReferral} onChange={(e) => set('legacyReferral', e.target.value)} className={inputCls}>
                          <option value="">Referred to…</option>
                          {authorities.map(a => <option key={a.name} value={a.name}>{a.name}{a.type ? ` — ${a.type}` : ''}</option>)}
                        </select>
                      )}
                    </Field>
                    {officer.national && (
                      <Field label="State">
                        <select value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value, lga: '', community: '' }))} className={inputCls}>
                          <option value="">Select…</option>
                          {stateNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </Field>
                    )}
                  </div>
                )
              })()}
              <p className="mt-2 text-[11px] text-slate-400">Legacy grievances are recorded and referred out — no classification or escalation (Framework §2.2.1).</p>
            </div>
          )}

          {form.screening === 'not_project_related' && (
            <div className="mt-3.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <Field label="Reason it is not project related">
                <textarea value={form.notRelatedReason} onChange={(e) => set('notRelatedReason', e.target.value)} rows={2}
                  placeholder="Explain why this grievance falls outside the mechanism…"
                  className={`${inputCls} resize-none`} />
              </Field>
              {officer.national && (
                <div className="mt-2.5">
                  <Field label="State">
                    <select value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value, lga: '', community: '' }))} className={inputCls}>
                      <option value="">Select…</option>
                      {stateNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-2.5">
              <ArrowLeft size={14} /> Back
            </button>
            {(form.screening === 'not_project_related' || form.legacy) ? (

              <div className="flex items-center gap-3">
                {missing.length > 0 && <span className="text-[11px] text-amber-600 font-medium">Required: {missing.join(', ')}</span>}
                <button onClick={save} disabled={!valid || saving}
                  title={missing.length > 0 ? `Still needed: ${missing.join(', ')}` : undefined}
                  className={`flex items-center gap-1.5 text-[13px] font-semibold text-white rounded-md px-4 py-2.5 disabled:opacity-40 ${form.legacy ? 'bg-amber-600 hover:bg-amber-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? 'Registering…' : form.legacy ? 'Register & refer (legacy)' : 'Register & close (not related)'}
                </button>
              </div>
            ) : (
              <button onClick={() => setStep(3)}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-5 py-2.5 hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed">
                Continue to classification <ArrowRight size={15} />
              </button>
            )}
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-4 fade-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-slate-800">Classify &amp; describe</h3>
            <span className="text-[11px] text-slate-400">Editable before saving</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 items-start">

            <div className="space-y-2.5">
              <div className="grid grid-cols-1 gap-y-2.5">

              <Field label="Grievance domain" suggested={suggested.has('domain')}>
                <select
                  value={form.domain}
                  onChange={(e) => {
                    const dom = e.target.value
                    setForm(f => ({ ...f, domain: dom, category: '', subcategory: '' }))
                    setSuggested(s => { const n = new Set(s); n.delete('domain'); n.delete('category'); n.delete('subcategory'); return n })
                  }}
                  className={inputCls}
                >
                  <option value="">{categories.length ? 'Select domain…' : 'Loading…'}</option>
                  {domainsInUse.map(d => <option key={d} value={d}>{d} Grievances</option>)}
                </select>
              </Field>
              <Field label="Category" suggested={suggested.has('category')}>
                <select
                  value={form.category}
                  onChange={(e) => {
                    const cat = e.target.value
                    const meta = cat ? catByName(cat) : null
                    setForm(f => ({ ...f, category: cat, subcategory: '', priority: meta?.priority || f.priority }))
                    setSuggested(s => { const n = new Set(s); n.delete('category'); n.delete('subcategory'); n.delete('priority'); return n })

                    if (cat && isRestricted(cat)) triggerConfidential()
                  }}
                  disabled={!form.domain}
                  className={`${inputCls} disabled:opacity-50`}
                >
                  <option value="">{!form.domain ? 'Select domain first' : `Select ${form.domain} category…`}</option>
                  {(form.domain ? visibleCats(catsInDomain(form.domain)) : []).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                {form.category && catByName(form.category)?.description && (
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">{catByName(form.category).description}</p>
                )}
              </Field>
              <Field label="Sub-group">
                <select
                  value={form.subcategory}
                  onChange={(e) => set('subcategory', e.target.value)}
                  disabled={!form.category || subgroupsOf(form.category).length === 0}
                  className={`${inputCls} disabled:opacity-50`}
                >
                  <option value="">{form.category ? 'Select sub-group…' : 'Select category first'}</option>
                  {(form.category ? subgroupsOf(form.category) : []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Priority" suggested={suggested.has('priority')}>
                <div className="flex gap-1.5">
                  {['low', 'medium', 'high'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => set('priority', p)}
                      className={`flex-1 text-[12.5px] font-semibold capitalize rounded-md px-3 py-2 ring-1 ring-inset transition-colors ${
                        form.priority === p
                          ? p === 'high' ? 'bg-rose-50 text-rose-700 ring-rose-300'
                            : p === 'medium' ? 'bg-amber-50 text-amber-700 ring-amber-300'
                            : 'bg-slate-100 text-slate-700 ring-slate-300'
                          : 'bg-white text-slate-400 ring-slate-200 hover:text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </Field>
          </div>

          <div className="grid grid-cols-1 gap-y-2.5 mt-2.5">
            {officer.fullyLocated ? (
              <div>
                <Field label="Location">
                  <div className={`${inputCls} flex items-center gap-2 text-slate-600 bg-slate-50`}>
                    <MapPin size={14} className="text-slate-400" />
                    <span>{form.community}, {form.lga}, {form.state}</span>
                    <span className="ml-auto text-[10px] font-medium text-slate-400 uppercase tracking-wide">your posting</span>
                  </div>
                </Field>
              </div>
            ) : (
              <>
                <Field label="State" suggested={suggested.has('state')}>
                  {officer.national ? (
                    <select value={form.state} onChange={(e) => setForm(f => ({ ...f, state: e.target.value, lga: '', community: '' }))} className={inputCls}>
                      <option value="">Select…</option>
                      {stateNames.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  ) : (
                    <div className={`${inputCls} flex items-center gap-2 text-slate-600 bg-slate-50`}>
                      <MapPin size={14} className="text-slate-400" /><span>{form.state}</span>
                      <span className="ml-auto text-[10px] font-medium text-slate-400 uppercase tracking-wide">your state</span>
                    </div>
                  )}
                </Field>
                <Field label="LGA (optional)" suggested={suggested.has('lga')}>
                  <select value={form.lga} onChange={(e) => setForm(f => ({ ...f, lga: e.target.value, community: '' }))} disabled={!form.state} className={`${inputCls} disabled:opacity-50`}>
                    <option value="">{form.state ? 'Select…' : 'Select a state first'}</option>
                    {lgaOptions.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </Field>
                <Field label="Project / Site (optional)">
                  <select value={form.community} onChange={(e) => set('community', e.target.value)} disabled={!form.lga} className={`${inputCls} disabled:opacity-50`}>
                    <option value="">{form.lga ? (siteOptions.length ? 'Select…' : 'No sites configured for this LGA') : 'Select an LGA first'}</option>
                    {siteOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </>
            )}
          </div>

          {form.state && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 text-brand-700 ring-1 ring-brand-200 px-2 py-1 font-semibold">
                Enters at Level {entryLevel} — {entryLevel === 1 ? 'Community' : 'State PIU'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold ring-1 ${getStateModel(form.state) === 2 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-indigo-50 text-indigo-700 ring-indigo-200'}`}>
                {form.state} · Model {getStateModel(form.state)}
              </span>
              <span className="text-slate-400">
                {getStateModel(form.state) === 2 ? 'State-owned (SPIU) — escalates up to Level 3, then external appeal (no FPMU).' : 'Federal (RBDA) — escalates up to Level 4 (FPMU).'}
              </span>
            </div>
          )}

            </div>

            <div className="flex flex-col">
              <Field label="Officer Case Description" suggested={suggested.has('description')}>
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={12}
                  placeholder="The officer's professional restatement of the grievance for the case file…"
                  className={`${inputCls} resize-none leading-relaxed min-h-[240px]`}
                />
              </Field>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Restate the grievance in clear, neutral, official language for the record — <span className="text-slate-500">what happened, where, who is affected, and what the complainant is asking for.</span> Keep it factual: no opinions or conclusions. This becomes the case file's working summary.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
            <button onClick={() => setStep(2)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-2.5">
              <ArrowLeft size={14} /> Back
            </button>
            <div className="flex items-center gap-3">
              {missing.length > 0
                ? <span className="text-[11px] text-amber-600 font-medium">Required: {missing.join(', ')}</span>
                : <span className="text-[11px] text-slate-400">Registered by <span className="font-semibold text-slate-500">{registrar.name || 'You'}</span></span>}
              <button
                onClick={save}
                disabled={!valid || saving}
                title={missing.length > 0 ? `Still needed: ${missing.join(', ')}` : undefined}
                className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-4 py-2.5 hover:bg-brand-800 disabled:opacity-40"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Registering…' : form.legacy ? 'Register & refer (legacy)' : 'Register Case'}
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
