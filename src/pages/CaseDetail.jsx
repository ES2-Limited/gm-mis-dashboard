import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Phone, User, CalendarClock, AlertTriangle,
  ChevronsUp, ChevronRight, ClipboardList, Search, ListChecks, Scale, Send, Loader2,
  ArrowRight, Ban, Lock, Check, X, Share2,
} from 'lucide-react'
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet'
import { Card, PriorityBadge, ChannelChip } from '../components/ui'
import { fmtDate, fmtDateTime, channelLabel, inScope, isRestricted, getViewAs, domainForCategory } from '../data/mock'
import OtpGate from '../components/OtpGate'
import { getUsers } from '../data/users'
import { getMinistries, getReferralBodies, getReferralBodiesForState, getStateModel } from '../data/coverage'
import { fetchCase, caseAction } from '../data/casesApi'
import { apiGet } from '../lib/api'
import { tierName, tierEscalatesTo, statusLabel, getAppealDays, escalationTargets } from '../data/caseflow'
import { explainText } from '../lib/intelligence'
import { toast } from '../lib/toast'
import Attachments from '../components/Attachments'

const NOW_MS = Date.now()
const STATUS_TONE = {
  received: 'bg-slate-100 text-slate-600 ring-slate-200',
  acknowledged: 'bg-sky-50 text-sky-700 ring-sky-200',
  screening: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  assigned: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  under_investigation: 'bg-amber-50 text-amber-700 ring-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-300',
  escalated: 'bg-rose-50 text-rose-700 ring-rose-200',
  appealed: 'bg-violet-50 text-violet-700 ring-violet-200',
}
const StatusPill = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${STATUS_TONE[status] || STATUS_TONE.received}`}>
    {statusLabel(status)}
  </span>
)

const FLOW = [
  { id: 'received', label: 'Received' },
  { id: 'acknowledged', label: 'Acknowledged' },
  { id: 'screening', label: 'Screening' },
  { id: 'under_investigation', label: 'Investigation' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
]
const FLOW_IDS = FLOW.map(s => s.id)
const OPEN_STATUSES = ['received', 'acknowledged', 'screening', 'assigned', 'under_investigation', 'escalated', 'referred']

const ADVANCE = {
  received: { to: 'acknowledged', label: 'Acknowledge receipt' },
  acknowledged: { to: 'screening', label: 'Begin screening' },
  screening: { to: 'under_investigation', label: 'Mark Project Related' },

  assigned: { to: 'under_investigation', label: 'Start investigation' },
  under_investigation: { to: 'resolved', label: 'Mark resolved' },

  referred: { to: 'closed', label: 'Close — support handed over' },
}
const SCREENING_LABEL = { project_related: 'Project related', not_project_related: 'Not project related' }

const fmtDur = (ms) => {
  if (ms == null || ms < 0) return ''
  const mins = ms / 60000
  if (mins < 60) return `${Math.max(1, Math.round(mins))}m`
  const h = mins / 60
  if (h < 48) return `${h % 1 ? h.toFixed(1) : h.toFixed(0)}h`
  return `${(h / 24).toFixed(1)}d`
}

function statusTimeline(c) {
  const firstAt = {}
  for (const a of (c.activity || [])) {
    if (FLOW_IDS.includes(a.type) && !(a.type in firstAt)) firstAt[a.type] = new Date(a.at)
  }

  if (!firstAt.received) firstAt.received = c.createdAt instanceof Date ? c.createdAt : new Date(c.createdAt)
  return firstAt
}

function StatusStepper({ c }) {
  const [nowTs] = useState(() => Date.now())
  const firstAt = statusTimeline(c)
  const curIdx = FLOW_IDS.indexOf(c.status)
  const closed = ['resolved', 'closed'].includes(c.status)
  return (
    <Card className="p-4 mb-4 fade-up overflow-x-auto">
      <div className="flex items-center min-w-max px-1">
        {FLOW.map((s, i) => {
          const entered = !!firstAt[s.id]
          const isCurrent = c.status === s.id
          const done = entered && !isCurrent && (curIdx > i || (closed && i < FLOW_IDS.indexOf(c.status)))
          let dur = ''
          if (entered) {
            const next = FLOW.slice(i + 1).find(n => firstAt[n.id])
            if (next) dur = fmtDur(firstAt[next.id] - firstAt[s.id])
            else if (isCurrent && OPEN_STATUSES.includes(c.status)) dur = `${fmtDur(nowTs - firstAt[s.id])} so far`
          }
          return (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center text-center w-[76px]">
                <span className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold ring-2 ${
                  isCurrent ? 'bg-brand-600 text-white ring-brand-200'
                    : done ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                      : 'bg-slate-100 text-slate-400 ring-slate-200'
                }`}>
                  {done ? <Check size={14} /> : i + 1}
                </span>
                <span className={`mt-1 text-[10.5px] font-semibold leading-tight ${isCurrent ? 'text-brand-700' : entered ? 'text-slate-600' : 'text-slate-400'}`}>{s.label}</span>
                <span className="text-[9px] text-slate-400 h-3 leading-tight">{entered ? fmtDate(firstAt[s.id]) : ''}</span>
              </div>
              {i < FLOW.length - 1 && (
                <div className="flex flex-col items-center w-14 -mt-5 shrink-0">
                  <div className={`h-0.5 w-full ${curIdx > i || closed ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                  <span className="text-[9px] font-medium text-slate-400 mt-1 whitespace-nowrap h-3">{dur}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function ConfirmDialog({ cfg, onClose }) {
  const [val, setVal] = useState('')
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the field each time a new dialog opens
  useEffect(() => { setVal('') }, [cfg])
  if (!cfg) return null
  const needsInput = !!cfg.input
  const canConfirm = !needsInput || cfg.input.optional || val.trim().length > 0
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/20 max-w-sm w-full p-5 fade-up" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-slate-800">{cfg.title}</h3>
        <p className="text-[13px] text-slate-600 mt-1.5 leading-relaxed">{cfg.body}</p>
        {needsInput && (
          <textarea
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            rows={3}
            placeholder={cfg.input.placeholder || 'Reason…'}
            className="w-full mt-3 text-[13px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
          />
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-[13px] font-medium text-slate-600 px-3 py-2 rounded-md hover:bg-slate-100">Cancel</button>
          <button
            disabled={!canConfirm}
            onClick={async () => { const fn = cfg.onYes; const v = val.trim(); onClose(); await fn(v) }}
            className={`text-[13px] font-semibold text-white rounded-md px-3.5 py-2 disabled:opacity-40 ${cfg.tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-brand-700 hover:bg-brand-800'}`}>
            {cfg.confirmLabel || 'Yes, continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PersonRow({ u, selected, onPick }) {
  return (
    <button onClick={() => onPick(u.name)}
      className={`w-full text-left flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 transition-colors ${selected ? 'border-rose-300 bg-rose-50 ring-1 ring-rose-200' : 'border-slate-200 hover:bg-slate-50'}`}>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-slate-800 truncate">{u.name}</span>
        <span className="block text-[10.5px] text-slate-400 truncate">{u.specialty || u.role}</span>
      </span>
      {selected && <Check size={15} className="text-rose-600 shrink-0" />}
    </button>
  )
}

function WorkRow({ icon: Icon, label, sub, count, tone, onClick, disabled }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      className={`w-full flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}>
      <span className={`grid place-items-center h-9 w-9 rounded-md shrink-0 ${tone === 'active' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}><Icon size={16} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
          {label}
          {count > 0 && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-1.5 py-px">{count}</span>}
          {tone === 'active' && <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 rounded px-1.5 py-px">active now</span>}
        </span>
        <span className="block text-[11.5px] text-slate-400">{sub}</span>
      </span>
      <ChevronRight size={16} className="text-slate-300 shrink-0" />
    </button>
  )
}

function returnTargets(tier) {
  const out = []
  for (let t = 2; t < tier; t++) out.push(t)
  return out
}

function EscalateModal({ c, onClose, onEscalate }) {
  const model = getStateModel(c.state)
  const up = escalationTargets(c.tier, model)
  const down = returnTargets(c.tier)
  const [target, setTarget] = useState(up[0] ?? down[0])
  const [officer, setOfficer] = useState('')
  const [note, setNote] = useState('')
  const pickLevel = (t) => { setTarget(t); setOfficer('') }
  const goingUp = target > c.tier

  const [handlers, setHandlers] = useState(null)
  useEffect(() => {
    let live = true
    apiGet(`/users/officers?state=${encodeURIComponent(c.state || '')}`)
      .then(list => { if (live) setHandlers(Array.isArray(list) ? list : []) })
      .catch(() => { if (live) setHandlers([]) })
    return () => { live = false }
  }, [c.state])
  const source = (handlers && handlers.length) ? handlers : getUsers()

  const handlersAt = (tier) => source.filter(u =>
    (u.status ? u.status === 'active' : true) && u.tier === tier && (tier === 4 ? true : inScope(c.state, u.scope)))

  const lvl3 = handlersAt(3)
  const ministries = getMinistries()
  const ministryGroups = ministries.map(m => [m, lvl3.filter(u => u.community === m)])
  const orphan = lvl3.filter(u => !ministries.includes(u.community))
  if (orphan.length) ministryGroups.push(['Other', orphan])

  const flatPeople = handlersAt(target)
  const hasPeople = target === 3 ? lvl3.length > 0 : flatPeople.length > 0
  const canSubmit = note.trim().length > 0 && (!hasPeople || !!officer)

  const LevelBtn = (t) => (
    <button key={t} onClick={() => pickLevel(t)}
      className={`flex items-center gap-1.5 text-[12.5px] font-semibold rounded-md px-3 py-2 ring-1 transition-colors ${target === t ? 'bg-rose-600 text-white ring-rose-600' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'}`}>
      <span className={`h-4 w-4 rounded-full grid place-items-center text-[9px] font-bold ${target === t ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{t}</span>
      Level {t}
    </button>
  )

  return createPortal(
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/20 max-w-md w-full p-5 fade-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1 shrink-0">
          <span className="h-8 w-8 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center"><ChevronsUp size={16} /></span>
          <h3 className="text-sm font-bold text-slate-800">Move {c.code} to another level</h3>
        </div>
        <p className="text-[12.5px] text-slate-500 mb-3 shrink-0">
          Currently with <span className="font-medium text-slate-700">Level {c.tier} — {tierName(c.tier, model)}</span>. Escalate it up, or return it to a lower level. The person you choose takes control.
        </p>

        <div className="overflow-y-auto pr-0.5 flex-1 min-h-0 space-y-3">

          {up.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Escalate up</p>
              <div className="flex flex-wrap gap-2">{up.map(LevelBtn)}</div>
            </div>
          )}

          {up.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-[12px] font-semibold text-amber-800">Top of the mechanism — cannot escalate further</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Level {c.tier} ({tierName(c.tier, model)}) is the highest level {model === 2 ? 'for this state-owned (Model 2) scheme' : 'in this mechanism'}. If it can&rsquo;t be resolved here, advise the complainant to <span className="font-semibold">reach out for independent appeal / judicial review</span> — this is external to SPIN and not handled in the system.
              </p>
            </div>
          )}
          {down.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Return down to</p>
              <div className="flex flex-wrap gap-2">{down.map(LevelBtn)}</div>
            </div>
          )}
          <p className="text-[11px] text-slate-500">{goingUp ? 'Escalating to' : 'Returning to'} <span className="font-medium text-slate-700">{tierName(target, model)}</span></p>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Who takes control</p>
            <div className="space-y-2">
              {target === 3 ? (
                ministryGroups.length === 0 ? (
                  <p className="text-[11.5px] text-amber-600">No ministries configured — add them in Settings → Case Journey.</p>
                ) : ministryGroups.map(([ministry, mp]) => (
                  <div key={ministry}>
                    <p className="text-[11px] font-semibold text-slate-600 bg-slate-50 rounded px-2 py-1 mb-1">{ministry}</p>
                    {mp.length
                      ? <div className="space-y-1.5">{mp.map(u => <PersonRow key={u.id} u={u} selected={officer === u.name} onPick={setOfficer} />)}</div>
                      : <p className="text-[10.5px] text-slate-400 pl-2">No focal person in this ministry yet</p>}
                  </div>
                ))
              ) : (
                flatPeople.length
                  ? flatPeople.map(u => <PersonRow key={u.id} u={u} selected={officer === u.name} onPick={setOfficer} />)
                  : <p className="text-[11.5px] text-amber-600">No handler set at Level {target} in {c.state} yet — it will go to the Level {target} desk.</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Note <span className="text-rose-500">*</span></p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              placeholder={goingUp ? 'Why are you escalating this case?' : 'Why are you returning this case to a lower level?'}
              className="w-full text-[13px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/30 resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 shrink-0">
          <button onClick={onClose} className="text-[13px] font-medium text-slate-600 px-3 py-2 rounded-md hover:bg-slate-100">Cancel</button>
          <button onClick={() => onEscalate(target, officer, note.trim())} disabled={!canSubmit}
            title={!canSubmit ? 'Pick the person and add a note' : undefined}
            className="text-[13px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md px-3.5 py-2 disabled:opacity-40">
            {goingUp ? 'Escalate' : 'Return'} to Level {target}{officer ? ` · ${officer}` : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ReferModal({ c, onClose, onRefer }) {
  const { inState, other } = getReferralBodiesForState(c.state)
  const anyBodies = getReferralBodies().length > 0
  const [showOther, setShowOther] = useState(false)
  const [body, setBody] = useState('')
  const [type, setType] = useState('')
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [riskLevel, setRiskLevel] = useState('')
  const [safetyNote, setSafetyNote] = useState('')
  const pick = (b) => { setBody(b.name); setType(b.type || 'Other') }
  const providerBtn = (b) => (
    <button key={`${b.name}·${b.state || ''}`} onClick={() => pick(b)}
      className={`w-full text-left rounded-lg px-3 py-2 ring-1 transition-colors ${body === b.name ? 'bg-violet-50 ring-violet-300' : 'bg-white ring-slate-200 hover:bg-slate-50'}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-slate-700">{b.name}</span>
        <span className="text-[10.5px] text-slate-400 shrink-0">{b.type}</span>
      </span>
      {b.contact && <span className="block text-[11px] text-violet-600 mt-0.5">☎ {b.contact}</span>}
      {b.area && <span className="block text-[10.5px] text-slate-400">{b.area}</span>}
    </button>
  )

  const canSubmit = body.trim().length > 0 && note.trim().length > 0 && riskLevel.length > 0 && consent

  return createPortal(
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/20 max-w-md w-full p-5 fade-up flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1 shrink-0">
          <span className="h-8 w-8 rounded-md bg-violet-50 text-violet-600 flex items-center justify-center"><Share2 size={16} /></span>
          <h3 className="text-sm font-bold text-slate-800">Refer {c.code}</h3>
        </div>
        <p className="text-[12.5px] text-slate-500 mb-3 shrink-0">
          A confidential SEA/SH &amp; GBV case is handed to an external body for survivor-centred support — not escalated up the grievance ladder. Record only the minimum necessary.
        </p>

        <div className="overflow-y-auto pr-0.5 flex-1 min-h-0 space-y-3">

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Immediate safety check <span className="text-rose-500">*</span></p>
            <div className="space-y-1.5">
              {[
                { v: 'immediate_danger', label: 'Immediate danger', hint: 'Survivor is at urgent risk — arrange emergency support first' },
                { v: 'elevated', label: 'Elevated risk', hint: 'Not immediate, but heightened concern for safety' },
                { v: 'no_immediate_risk', label: 'No immediate risk', hint: 'Survivor is safe for now' },
              ].map(o => (
                <button key={o.v} onClick={() => setRiskLevel(o.v)}
                  className={`w-full text-left rounded-lg px-3 py-2 ring-1 transition-colors ${riskLevel === o.v ? (o.v === 'immediate_danger' ? 'bg-rose-50 ring-rose-300' : 'bg-violet-50 ring-violet-300') : 'bg-white ring-slate-200 hover:bg-slate-50'}`}>
                  <span className="block text-[12.5px] font-medium text-slate-700">{o.label}</span>
                  <span className="block text-[10.5px] text-slate-400">{o.hint}</span>
                </button>
              ))}
            </div>
            <textarea value={safetyNote} onChange={(e) => setSafetyNote(e.target.value)} rows={2}
              placeholder="Optional safety note — immediate needs, emergency action taken. No sensitive personal details."
              className="w-full mt-2 text-[12.5px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none" />
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Service provider in {c.state} <span className="text-rose-500">*</span></p>
            {!anyBodies ? (
              <p className="text-[11.5px] text-amber-600">No referral providers configured — add them in Settings → Case Journey.</p>
            ) : (
              <>
                {inState.length === 0 ? (
                  <p className="text-[11.5px] text-amber-600">No providers listed for {c.state} yet. Use another state's providers below, or add {c.state} providers in Settings.</p>
                ) : (
                  <div className="space-y-1.5">{inState.map(providerBtn)}</div>
                )}
                {other.length > 0 && (
                  <div className="mt-2">
                    <button onClick={() => setShowOther(v => !v)} className="text-[11.5px] font-medium text-violet-600 hover:underline">
                      {showOther ? '▾ Hide' : '▸ Show'} providers in other states ({other.length})
                    </button>
                    {showOther && <div className="space-y-1.5 mt-1.5">{other.map(providerBtn)}</div>}
                  </div>
                )}
              </>
            )}
          </div>

          <label className={`flex items-start gap-2.5 rounded-lg p-3 cursor-pointer ring-1 ${consent ? 'bg-violet-50 ring-violet-200' : 'bg-white ring-rose-200'}`}>
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
            <span className="text-[12px] text-slate-600 leading-relaxed">The survivor has given <span className="font-semibold text-slate-800">informed consent</span> to this referral. <span className="text-rose-500">*</span><span className="block text-[11px] text-slate-400">Required — no information is shared without explicit consent.</span></span>
          </label>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Referral note <span className="text-rose-500">*</span></p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              placeholder="What support is being arranged. Do not record sensitive personal details here."
              className="w-full text-[13px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 shrink-0">
          <button onClick={onClose} className="text-[13px] font-medium text-slate-600 px-3 py-2 rounded-md hover:bg-slate-100">Cancel</button>
          <button onClick={() => onRefer({ body, bodyType: type, reason: note.trim(), consent, riskLevel, safetyNote: safetyNote.trim() })} disabled={!canSubmit}
            title={!canSubmit ? 'Complete the safety check, pick a body, add a note, and confirm consent' : undefined}
            className="text-[13px] font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-md px-3.5 py-2 disabled:opacity-40">
            Refer{body ? ` to ${body}` : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ReadMore({ text, label, className = 'text-[14px] text-slate-700 leading-relaxed', threshold = 480 }) {
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState('')
  const [explaining, setExplaining] = useState(false)
  const long = (text || '').length > threshold
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length

  const explain = async () => {
    if (explaining) return
    setExplaining(true); setSummary('')
    try { setSummary(await explainText(text)) }
    catch { setSummary('Could not summarise this right now — the Insights engine may be unavailable.') }
    finally { setExplaining(false) }
  }

  return (
    <>
      <p className={`${className} whitespace-pre-wrap ${long ? 'line-clamp-5' : ''}`}>{text}</p>
      {long && (
        <button onClick={() => setOpen(true)} className="mt-1.5 text-[12.5px] font-semibold text-brand-700 hover:text-brand-800">
          Read more →
        </button>
      )}
      {open && createPortal(
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/20 max-w-2xl w-full max-h-[82vh] flex flex-col fade-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800 truncate">{label}</h3>
                <p className="text-[11px] text-slate-400">{words.toLocaleString()} words</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={explain} disabled={explaining}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-700 bg-brand-50 ring-1 ring-brand-200 rounded-md px-2.5 py-1.5 hover:bg-brand-100 disabled:opacity-50">
                  {explaining ? <Loader2 size={13} className="animate-spin" /> : <ListChecks size={13} />} Explain
                </button>
                <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-md grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
              </div>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-4">
              {(explaining || summary) && (
                <div className="rounded-lg bg-brand-50 ring-1 ring-brand-200 px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700 mb-1.5 flex items-center gap-1.5"><ListChecks size={12} /> Explanation</p>
                  {explaining
                    ? <p className="text-[12.5px] text-slate-500 inline-flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Reading the full text…</p>
                    : <p className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{summary}</p>}
                </div>
              )}
              <p className="text-[13.5px] text-slate-700 leading-relaxed whitespace-pre-wrap">{text}</p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

const labelCls = 'text-[10px] font-semibold uppercase tracking-wider text-slate-400'
const taCls = 'w-full text-[13px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none'
const inCls = 'w-full text-[13px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30'

export default function CaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/cases'))
  const [c, setC] = useState(null)
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [showEscalate, setShowEscalate] = useState(false)
  const [showRefer, setShowRefer] = useState(false)

  const [scLegacy, setScLegacy] = useState(false)
  const [scInstitution, setScInstitution] = useState('')
  const ask = (cfg) => setConfirm(cfg)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset loading on id change, then async fetch
    setLoading(true)
    fetchCase(id).then(setC).catch(() => setC(null)).finally(() => setLoading(false))
  }, [id])

  const run = async (promise, msg, tone = 'success') => {
    try {
      const updated = await promise
      setC(updated)
      if (msg) toast(msg, tone)
      return updated
    } catch (e) {
      toast(e?.message || 'Could not complete the action — try again.', 'error')
      return null
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh] text-slate-400">
      <Loader2 size={18} className="animate-spin mr-2" /> Loading case…
    </div>
  )

  if (!c) return (
    <div className="max-w-3xl mx-auto text-center py-20 text-slate-400">
      Case not found. <Link to="/cases" className="text-brand-700 font-medium">Back to cases</Link>
    </div>
  )

  const due = c.dueAt
  const overdue = !!c.slaBreached
  const notes = c.notes || []
  const correctiveActions = c.correctiveActions || []
  const appeals = c.appeals || []
  const activity = c.activity || []

  const invFilled = INV_FIELDS.filter(([k]) => c.investigation?.[k]).length
  const showInvestigation = c.status === 'under_investigation' || invFilled > 0
  const showAppeals = ['resolved', 'closed'].includes(c.status) || appeals.length > 0

  const committee = `Level ${c.tier} GRC · ${c.state}`

  const model = getStateModel(c.state)
  const atCeiling = c.tier >= (model === 2 ? 3 : 4)

  const escalations = c.escalations || []
  const entryTier = escalations.length ? escalations[0].from : c.tier
  const hasEscalated = c.tier > entryTier

  const me = getViewAs()

  const isFederal = me.isSuperAdmin || !me.scope || me.scope === 'All states'
  const myLevel = me.tier ?? (isFederal ? 4 : null)
  const isViewerRole = /M&E/i.test(me.role || '')
  const isOpen = OPEN_STATUSES.includes(c.status)
  const atMyLevel = myLevel != null && myLevel === c.tier && (isFederal || inScope(c.state, me.scope))

  const canAct = isOpen && !isViewerRole && (c.assignedTo === me.name || (atMyLevel && !c.assignedTo))

  const isRegistrar = !!me.name && (c.registeredBy || '').includes(me.name)

  const appealDays = getAppealDays()
  const appealEnd = (c.status === 'resolved' && c.resolvedAt && appealDays > 0) ? new Date(c.resolvedAt).getTime() + appealDays * 86400000 : null
  const appealOpen = appealEnd != null && NOW_MS < appealEnd
  const appealDaysLeft = appealEnd != null ? Math.ceil((appealEnd - NOW_MS) / 86400000) : 0
  const canClose = c.status === 'resolved' && !c.satisfaction && !isViewerRole && (isRegistrar || atMyLevel) && !appealOpen

  const resumeTarget = (cc) => {
    const esc = cc.escalations || []
    let stage
    for (let i = esc.length - 1; i >= 0; i--) { if (esc[i].stageBefore) { stage = esc[i].stageBefore; break } }
    if (!stage) stage = (cc.activity || []).some(a => a.type === 'under_investigation') ? 'under_investigation' : 'screening'
    return (stage === 'under_investigation' || stage === 'assigned') ? 'under_investigation' : 'screening'
  }

  const restricted = isRestricted(c.category)
  const nextStep = restricted ? null : (c.status === 'escalated'
    ? (() => { const to = resumeTarget(c); return { to, label: to === 'under_investigation' ? 'Take ownership & continue investigation' : 'Take ownership & screen' } })()
    : ADVANCE[c.status])

  const inScreening = !restricted && ['acknowledged', 'screening'].includes(c.status)

  const postScreeningOpen = !restricted && ['under_investigation', 'escalated'].includes(c.status)

  const canCloseReferred = restricted && c.status === 'referred' && canAct

  const hasGeo = c.lat != null && c.lng != null

  const body = (
    <div className="p-3 md:p-5">

      <div className="flex flex-wrap items-center gap-2.5 mb-4 fade-up">
        <button onClick={goBack} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-1.5">
          <ArrowLeft size={14} /> Back
        </button>
        <span className="h-4 w-px bg-slate-200" />
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">{c.code}</h1>
        <StatusPill status={c.status} />
        <PriorityBadge priority={c.priority} />
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200">
          Level {c.tier}
        </span>
        <ChannelChip channel={c.channel} />
      </div>

      <StatusStepper c={c} />

      {overdue && (
        <div className="mb-4 fade-up flex items-center gap-2.5 rounded-md bg-rose-50 ring-1 ring-rose-200 px-4 py-2.5">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <p className="text-[12.5px] text-rose-700">
            Past the Level {c.tier} resolution window ({due ? fmtDate(due) : '—'}). {atCeiling ? `This is the top in-system level for ${model === 2 ? 'Model 2 (SPIU)' : 'Model 1'} — the next step is ${tierEscalatesTo(c.tier, model)}.` : `Auto-escalation to ${tierEscalatesTo(c.tier, model)} is due.`}
          </p>
          {!atCeiling && canAct && (
            <button onClick={() => ask({
              title: `Escalate to Level ${c.tier + 1}?`,
              body: `${c.code} is past its Level ${c.tier} window. Escalate it to Level ${c.tier + 1} — ${tierName(c.tier + 1, model)}?`,
              confirmLabel: 'Yes, escalate',
              tone: 'danger',
              onYes: () => run(caseAction.escalate(c.id, 'sla_breach'), `Escalated to Level ${c.tier + 1}`),
            })}
              className="ml-auto shrink-0 flex items-center gap-1 text-[12px] font-semibold text-white bg-rose-600 rounded-lg px-2.5 py-1.5 hover:bg-rose-700">
              <ChevronsUp size={13} /> Escalate now
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-12 gap-3 md:gap-4 fade-up">
        <div className="col-span-12 lg:col-span-6 space-y-4">

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Complaint Record</h3>

            <p className={labelCls + ' mb-1.5'}>Officer Case Description</p>
            {c.description
              ? <ReadMore text={c.description} label="Officer Case Description" />
              : <p className="text-[14px] text-slate-400">No description recorded.</p>}

            {c.narrative && (
              <div className="rounded-md bg-slate-50 border border-slate-100 px-4 py-3.5 mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  As received · verbatim · {channelLabel(c.channel)}{c.channelDetail ? ` · ${c.channelDetail}` : ''} · {fmtDateTime(c.createdAt)}
                </p>
                <ReadMore text={`“${c.narrative}”`} label="As received — complainant's own words" className="text-[13px] text-slate-600 leading-relaxed" />
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
              <div><p className={labelCls}>Category</p><p className="text-[11px] text-slate-400">{domainForCategory(c.category)} Grievances</p><p className="text-sm font-medium text-slate-700">{c.category}</p>{c.subcategory && <p className="text-[11px] text-slate-400">{c.subcategory}</p>}</div>
              <div><p className={labelCls}>Received</p><p className="text-sm font-medium text-slate-700 mt-0.5">{fmtDate(c.createdAt)}</p></div>
              <div><p className={labelCls}>Screening</p><p className="text-sm font-medium text-slate-700 mt-0.5">{SCREENING_LABEL[c.screening] || 'Pending'}{c.legacy && <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded px-1.5 py-px align-middle"><CalendarClock size={9} /> Legacy</span>}</p></div>
              <div><p className={labelCls}>Registered by</p><p className="text-sm font-medium text-slate-700 mt-0.5">{c.registeredBy || '—'}</p></div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Case work</h3>
              {!canAct && <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-100 rounded px-2 py-0.5">View only</span>}
            </div>
            {!canAct && <p className="text-[11.5px] text-slate-400 mb-3">You are not handling this case, so case work is disabled. It is worked at Level {c.tier} — {tierName(c.tier, model)}.</p>}
            <div className="space-y-2">
              <WorkRow icon={ClipboardList} label="Notes" sub={notes.length ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : 'No notes yet'} count={notes.length} disabled={!canAct} onClick={() => setPanel('notes')} />
              {showInvestigation && (
                <WorkRow icon={Search} label="Investigation"
                  sub={`${invFilled} of ${INV_FIELDS.length} fields filled`}
                  count={invFilled}
                  tone={c.status === 'under_investigation' ? 'active' : undefined}
                  disabled={!canAct}
                  onClick={() => setPanel('investigation')} />
              )}
              <WorkRow icon={ListChecks} label="Corrective Actions" sub={correctiveActions.length ? `${correctiveActions.length} action${correctiveActions.length === 1 ? '' : 's'}` : 'None recorded'} count={correctiveActions.length} disabled={!canAct} onClick={() => setPanel('actions')} />
              {showAppeals && (
                <WorkRow icon={Scale} label="Appeals" sub={appeals.length ? `${appeals.length} appeal${appeals.length === 1 ? '' : 's'}` : 'Lodged after resolution'} count={appeals.length} disabled={!canAct} onClick={() => setPanel('appeals')} />
              )}
            </div>
          </Card>

          <Attachments c={c} />
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-4">

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Case Handling</h3>
            <div className="space-y-2.5 text-[13px]">
              <Row label="Entered at" value={
                <span className="inline-flex items-center gap-1.5">
                  Level {entryTier} — {tierName(entryTier, model)}
                  {hasEscalated && <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 rounded px-1.5 py-px">where it started</span>}
                </span>
              } />
              <Row label="Currently with" value={
                <span className="inline-flex flex-wrap items-center justify-end gap-1.5 font-medium">
                  {c.assignedTo ? <span className="text-slate-800">{c.assignedTo}</span> : null}
                  <span className={c.assignedTo ? 'text-slate-400 font-normal' : ''}>Level {c.tier} — {tierName(c.tier, model)}</span>
                  {hasEscalated && <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 ring-1 ring-rose-200 rounded px-1.5 py-px">escalated ↑</span>}
                </span>
              } />
              <Row label="Responsible body" value={committee} />
              <Row label="Resolution due" value={<span className={overdue ? 'text-rose-600 font-medium' : ''}>{due ? fmtDate(due) : '—'}</span>} />
            </div>

            {canAct ? (
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <p className={labelCls}>Workflow · next step</p>

                {inScreening ? (

                  <div className="space-y-2">

                    <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 cursor-pointer">
                      <input type="checkbox" checked={scLegacy} onChange={(e) => setScLegacy(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-amber-300 accent-amber-600" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-800"><CalendarClock size={13} /> Legacy grievance (predates SPIN)</span>
                        <span className="block text-[11px] text-amber-700">Documented and referred to the appropriate authority, not handled as a project case.</span>
                      </span>
                    </label>
                    {scLegacy && (
                      <input
                        value={scInstitution}
                        onChange={(e) => setScInstitution(e.target.value)}
                        placeholder="Institution/authority it is referred to…"
                        className="w-full text-[12.5px] rounded-md border border-amber-200 bg-white px-2.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                      />
                    )}
                    <p className="text-[11.5px] font-medium text-slate-500 pt-1">Screening — is this grievance project related?</p>
                    <button
                      onClick={() => {
                        if (scLegacy && !scInstitution.trim()) { toast('Name the institution the legacy grievance is referred to.', 'error'); return }
                        ask({
                          title: scLegacy ? 'Project related · legacy — refer & close?' : 'Mark as Project Related?',
                          body: scLegacy
                            ? `This confirms ${c.code} is project related but a legacy grievance (predates SPIN). It is referred to ${scInstitution.trim()} and closed.`
                            : `This confirms ${c.code} is within the SPIN Grievance Mechanism and moves it to Investigation. It is recorded in the case history.`,
                          confirmLabel: scLegacy ? 'Yes, refer legacy & close' : 'Yes, project related',
                          onYes: () => run(caseAction.screen(c.id, 'project_related', undefined, scLegacy, scInstitution.trim() || undefined), scLegacy ? 'Screened — project related · legacy referred out' : 'Screened — project related · moved to investigation'),
                        })
                      }}
                      className="w-full flex items-center justify-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3 py-2.5 hover:bg-brand-800">
                      <Check size={15} /> Project Related{scLegacy ? ' · refer legacy' : ''}
                    </button>
                    <button
                      onClick={() => ask({
                        title: 'Mark as Not Project Related?',
                        body: `This closes ${c.code} as outside the SPIN Grievance Mechanism. Give the reason for the record.`,
                        confirmLabel: 'Yes, not related — close',
                        tone: 'danger',
                        input: { placeholder: 'Reason this grievance is not project related…' },
                        onYes: (reason) => run(caseAction.screen(c.id, 'not_project_related', reason, scLegacy, scInstitution.trim() || undefined), 'Screened — not project related · closed', 'info'),
                      })}
                      className="w-full flex items-center justify-center gap-1.5 text-[13px] font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-3 py-2 hover:bg-slate-50">
                      <Ban size={15} /> Not Project Related
                    </button>
                  </div>
                ) : (

                  nextStep && (
                    <button
                      onClick={() => ask(nextStep.to === 'resolved' ? {
                        title: 'Mark this case resolved?',
                        body: `Record how ${c.code} was resolved. This is logged, and the case then returns to the owner to confirm and close it.`,
                        confirmLabel: 'Yes, mark resolved',
                        input: { placeholder: 'How was this grievance resolved? Describe the resolution and outcome…' },
                        onYes: (remark) => run(caseAction.status(c.id, 'resolved', remark), 'Marked resolved'),
                      } : {
                        title: 'Move this case forward?',
                        body: `This moves ${c.code} from “${statusLabel(c.status)}” to “${statusLabel(nextStep.to)}”. It is recorded in the case history and cannot be reversed.`,
                        confirmLabel: `Yes, ${nextStep.label.toLowerCase()}`,
                        onYes: () => run(caseAction.status(c.id, nextStep.to), `Moved to ${statusLabel(nextStep.to)}`),
                      })}
                      className="w-full flex items-center justify-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3 py-2.5 hover:bg-brand-800">
                      <ArrowRight size={15} /> {nextStep.label}
                    </button>
                  )
                )}

                {postScreeningOpen && (
                  <button
                    onClick={() => ask({
                      title: 'Close as Not Project Related?',
                      body: `This closes ${c.code} as outside the SPIN Grievance Mechanism. Give the reason for the record.`,
                      confirmLabel: 'Yes, close as not related',
                      tone: 'danger',
                      input: { placeholder: 'Reason this grievance is not project related…' },
                      onYes: (reason) => run(caseAction.notRelated(c.id, reason), 'Closed — not project related', 'info'),
                    })}
                    className="w-full flex items-center justify-center gap-1.5 text-[13px] font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-3 py-2 hover:bg-slate-50">
                    <Ban size={15} /> Not Project Related
                  </button>
                )}

                {restricted ? (
                  <>
                    {c.status !== 'received' && (
                      <button
                        onClick={() => setShowRefer(true)}
                        className="w-full flex items-center justify-center gap-1.5 text-[13px] font-medium text-violet-700 bg-violet-50 ring-1 ring-violet-200 rounded-md px-3 py-2 hover:bg-violet-100">
                        <Share2 size={15} /> {c.status === 'referred' ? 'Refer to another service…' : 'Refer to a service provider…'}
                      </button>
                    )}
                    {canCloseReferred && (
                      <button
                        onClick={() => ask({
                          title: 'Close this confidential case?',
                          body: `The survivor has been referred and is under external support. Closing ${c.code} records only that the referral was completed — no sensitive details are stored.`,
                          confirmLabel: 'Yes, close case',
                          input: { placeholder: 'Optional closing note (non-identifiable)…', optional: true },
                          onYes: (note) => run(caseAction.status(c.id, 'closed', (note || '').trim() || 'Referral completed — case closed'), 'Case closed — referral completed'),
                        })}
                        className="w-full flex items-center justify-center gap-1.5 text-[13px] font-medium text-slate-700 bg-white border border-slate-200 rounded-md px-3 py-2 hover:bg-slate-50">
                        <Check size={15} /> Close — referral completed
                      </button>
                    )}
                  </>
                ) : (

                  (escalationTargets(c.tier, model).length > 0 || returnTargets(c.tier).length > 0) && c.status !== 'received' && (
                    <button
                      onClick={() => setShowEscalate(true)}
                      className="w-full flex items-center justify-center gap-1.5 text-[13px] font-medium text-rose-700 bg-rose-50 ring-1 ring-rose-200 rounded-md px-3 py-2 hover:bg-rose-100">
                      <ChevronsUp size={15} /> Escalate / Return…
                    </button>
                  )
                )}
              </div>
            ) : c.status === 'resolved' ? null : (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="flex items-start gap-2 text-[12px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5">
                  <Lock size={13} className="mt-0.5 shrink-0" />
                  {OPEN_STATUSES.includes(c.status)
                    ? <span>View only. This case is being worked at <span className="font-medium text-slate-700">Level {c.tier} — {tierName(c.tier, model)}</span>{c.assignedTo ? <> by <span className="font-medium text-slate-700">{c.assignedTo}</span></> : ''}. You can review it for oversight, but only that level acts on it.</span>
                    : <span>This case is closed. It is shown here for the record.</span>}
                </p>
              </div>
            )}

            {canClose && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-[12px] text-slate-600 mb-2">Resolved — {isRegistrar ? <span>it has come back to you (the owner) to confirm it went well and close it.</span> : <span>this returns to <span className="font-medium">{c.registeredBy || 'the owner'}</span> to close, but you may close it from this level.</span>}</p>
                <p className={labelCls + ' mb-2'}>Close — how satisfied is the complainant?</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Satisfied', 'Partially satisfied', 'Not satisfied'].map(r => (
                    <button key={r} onClick={() => ask({
                      title: 'Close this case?',
                      body: `Record the complainant as “${r}” and close ${c.code}. A closed case can only be re-opened through an appeal.`,
                      confirmLabel: 'Yes, close case',
                      onYes: () => run(caseAction.satisfaction(c.id, { rating: r, comment: '' }), `Case closed — ${r}`),
                    })}
                      className="text-[12px] font-semibold text-slate-700 bg-slate-100 ring-1 ring-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-200">{r}</button>
                  ))}
                </div>
              </div>
            )}
            {c.status === 'resolved' && !c.satisfaction && !canClose && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                {appealOpen ? (
                  <p className="text-[12px] text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2.5">
                    Resolved — <span className="font-semibold">appeal window open</span>. The complainant may appeal until <span className="font-medium">{fmtDate(new Date(appealEnd))}</span> ({appealDaysLeft} day{appealDaysLeft === 1 ? '' : 's'} left). It can be closed after that.
                  </p>
                ) : (
                  <p className="text-[12px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2.5">Resolved — waiting for <span className="font-medium text-slate-700">{c.registeredBy || 'the owner'}</span> to confirm and close it.</p>
                )}
              </div>
            )}
            {c.satisfaction && (
              <p className="mt-3 text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5">Closed · complainant {c.satisfaction.rating}</p>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Complainant</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2.5 text-slate-600"><User size={15} className="text-slate-400" /> {c.complainant}</div>
              {c.phone && <div className="flex items-center gap-2.5 text-slate-600"><Phone size={15} className="text-slate-400" /> {c.phone}</div>}
              <div className="flex items-center gap-2.5 text-slate-600"><MapPin size={15} className="text-slate-400" /> {c.lga ? `${c.lga}, ` : ''}{c.state} State</div>
              <div className="flex items-center gap-2.5 text-slate-600"><CalendarClock size={15} className="text-slate-400" /> Registered {fmtDateTime(c.createdAt)}</div>
            </div>
            {c.anonymous && <p className="mt-3 text-[11px] text-violet-600 bg-violet-50 rounded-lg px-2.5 py-1.5">Complainant chose to remain anonymous.</p>}
          </Card>

          {hasGeo && (
            <Card className="overflow-hidden">
              <div className="px-5 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-slate-800">Reported Location</h3>
                <p className="text-xs text-slate-400">{c.lga ? `${c.lga} LGA, ` : ''}{c.state} State</p>
              </div>
              <div className="h-52">
                <MapContainer center={[c.lat, c.lng]} zoom={9} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                  <TileLayer attribution='&copy; OpenStreetMap &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  <CircleMarker center={[c.lat, c.lng]} radius={9} pathOptions={{ color: '#1b6541', fillColor: '#2f8a5d', fillOpacity: 0.85, weight: 2 }} />
                </MapContainer>
              </div>
            </Card>
          )}

        </div>

        <div className="col-span-12 md:col-span-12 lg:col-span-2">
          <Card className="p-4 lg:sticky lg:top-4">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 pulse-dot" />
              <h3 className="text-sm font-semibold text-slate-800">Activity</h3>
            </div>
            <p className="text-[10.5px] text-slate-400 mb-3">Live · newest first</p>
            {activity.length === 0 ? (
              <p className="text-[12px] text-slate-400">No activity yet.</p>
            ) : (
              <ol className="relative ml-1 border-l border-slate-200 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                {[...activity].reverse().map((t, i) => (
                  <li key={i} className="pl-3.5 relative">
                    <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white bg-brand-500" />
                    <p className="text-[12px] font-medium text-slate-700 leading-snug">{t.note}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                      {t.by ? <span className="font-medium text-slate-500">{t.by}</span> : 'System'}<br />{fmtDateTime(new Date(t.at))}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      {panel && createPortal(
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setPanel(null)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/20 max-w-2xl w-full max-h-[86vh] flex flex-col fade-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-bold text-slate-800">{{ notes: 'Notes', investigation: 'Investigation record', actions: 'Corrective Actions', appeals: 'Appeals' }[panel]}</h3>
              <button onClick={() => setPanel(null)} className="h-8 w-8 rounded-md grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-5">
              {panel === 'notes' && <NotesTab c={c} onUpdate={setC} />}
              {panel === 'investigation' && <InvestigationTab c={c} onUpdate={setC} />}
              {panel === 'actions' && <CorrectiveTab c={c} onUpdate={setC} />}
              {panel === 'appeals' && <AppealsTab c={c} onUpdate={setC} />}
            </div>
          </div>
        </div>,
        document.body,
      )}
      <ConfirmDialog cfg={confirm} onClose={() => setConfirm(null)} />
      {showEscalate && (
        <EscalateModal
          c={c}
          onClose={() => setShowEscalate(false)}
          onEscalate={(toTier, toOfficer, note) => {
            setShowEscalate(false)
            const verb = toTier > c.tier ? 'Escalated' : 'Returned'
            run(caseAction.escalate(c.id, note, toTier, toOfficer), `${verb} to Level ${toTier} — ${tierName(toTier, model)}${toOfficer ? ` · ${toOfficer}` : ''}`)
          }}
        />
      )}
      {showRefer && (
        <ReferModal
          c={c}
          onClose={() => setShowRefer(false)}
          onRefer={(payload) => {
            setShowRefer(false)
            run(caseAction.refer(c.id, payload), `Referred to ${payload.body}`)
          }}
        />
      )}
    </div>
  )

  if (isRestricted(c.category)) {
    return (
      <OtpGate
        purpose="case"
        caseRef={c.code}
        title={`Restricted case · ${c.code}`}
        blurb="This case is a sensitive SEA/SH disclosure. Even as the assigned handler you must accept the liability disclaimer and verify a one-time code emailed to you before the case file is shown."
      >
        {body}
      </OtpGate>
    )
  }
  return body
}

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{label}</span>
    <span className="text-[13px] text-slate-700 text-right">{value}</span>
  </div>
)

function NotesTab({ c, onUpdate }) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const notes = c.notes || []
  const submit = async () => {
    if (!body.trim() || busy) return
    setBusy(true)
    try { onUpdate(await caseAction.note(c.id, body.trim())); setBody(''); toast('Note added') }
    catch (e) { toast(e?.message || 'Could not add the note', 'error') }
    finally { setBusy(false) }
  }
  return (
    <div>
      <div className="flex gap-2 mb-4">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Add a case note (action taken, call made, observation)…" className={taCls} />
        <button onClick={submit} disabled={!body.trim() || busy} className="shrink-0 self-end flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2 hover:bg-brand-800 disabled:opacity-40">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Post
        </button>
      </div>
      {notes.length === 0 ? (
        <p className="text-[12.5px] text-slate-400 text-center py-4">No notes yet — record the first action on this case.</p>
      ) : (
        <ul className="space-y-3">
          {[...notes].reverse().map(n => (
            <li key={n.id} className="flex gap-2.5">
              <span className="h-7 w-7 shrink-0 rounded-full bg-emerald-800 text-white text-[9px] font-bold flex items-center justify-center">{(n.by || '?').split(' ').map(p => p[0]).join('').slice(0, 2)}</span>
              <div className="min-w-0">
                <p className="text-[13px] text-slate-700 leading-snug">{n.body}</p>
                <p className="text-[10.5px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span>{n.by}{n.role ? ` · ${n.role}` : ''} · {fmtDateTime(new Date(n.at))}</span>
                  {n.status && <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 rounded px-1.5 py-px">at {statusLabel(n.status)}</span>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const INV_FIELDS = [
  ['summary', 'Summary of the grievance'],
  ['actions', 'Actions undertaken during investigation'],
  ['consulted', 'Individuals consulted'],
  ['evidence', 'Evidence reviewed'],
  ['siteFindings', 'Site verification findings'],
  ['analysis', 'Analysis of issues identified'],
  ['recommendations', 'Recommendations for corrective action'],
  ['proposedResolution', 'Proposed resolution measures'],
]
function InvestigationTab({ c, onUpdate }) {
  const [form, setForm] = useState(() => {
    const base = {}; INV_FIELDS.forEach(([k]) => { base[k] = c.investigation?.[k] || '' }); return base
  })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const save = async () => {
    setBusy(true)
    try { onUpdate(await caseAction.investigation(c.id, form)); toast('Investigation record saved') }
    catch (e) { toast(e?.message || 'Could not save', 'error') }
    finally { setBusy(false) }
  }
  return (
    <div className="space-y-3">
      {c.investigation && <p className="text-[11px] text-slate-400">Last updated by {c.investigation.by} · {fmtDateTime(new Date(c.investigation.at))}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {INV_FIELDS.map(([k, label]) => (
          <label key={k} className="block">
            <span className={labelCls + ' block mb-1'}>{label}</span>
            <textarea value={form[k]} onChange={(e) => set(k, e.target.value)} rows={2} className={taCls} />
          </label>
        ))}
      </div>
      <button onClick={save} disabled={busy} className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-4 py-2 hover:bg-brand-800 disabled:opacity-40">
        {busy && <Loader2 size={14} className="animate-spin" />} Save investigation record
      </button>
    </div>
  )
}

function CorrectiveTab({ c, onUpdate }) {
  const [form, setForm] = useState({ action: '', responsible: '', dueDate: '' })
  const [busy, setBusy] = useState(false)
  const actions = c.correctiveActions || []
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const add = async () => {
    if (!form.action.trim() || busy) return
    setBusy(true)
    try { onUpdate(await caseAction.addCorrective(c.id, form)); setForm({ action: '', responsible: '', dueDate: '' }); toast('Corrective action added') }
    catch (e) { toast(e?.message || 'Could not add', 'error') }
    finally { setBusy(false) }
  }
  const toggle = async (actionId) => {
    try { onUpdate(await caseAction.toggleCorrective(c.id, actionId)) }
    catch (e) { toast(e?.message || 'Could not update', 'error') }
  }
  return (
    <div>
      {actions.length === 0 ? (
        <p className="text-[12.5px] text-slate-400 text-center py-3 mb-3">No corrective actions logged yet.</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {actions.map(a => (
            <li key={a.id} className="flex items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2">
              <input type="checkbox" checked={a.status === 'closed'} onChange={() => toggle(a.id)} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] ${a.status === 'closed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>{a.action}</p>
                <p className="text-[10.5px] text-slate-400 mt-0.5">{[a.responsible && `Owner: ${a.responsible}`, a.dueDate && `Due ${a.dueDate}`].filter(Boolean).join(' · ') || '—'}</p>
              </div>
              <span className={`shrink-0 text-[10px] font-bold uppercase ${a.status === 'closed' ? 'text-emerald-600' : 'text-amber-600'}`}>{a.status}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
        <input value={form.action} onChange={(e) => set('action', e.target.value)} placeholder="Corrective action required" className={inCls} />
        <input value={form.responsible} onChange={(e) => set('responsible', e.target.value)} placeholder="Responsible" className={inCls + ' sm:w-32'} />
        <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className={inCls + ' sm:w-36'} />
        <button onClick={add} disabled={!form.action.trim() || busy} className="text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2 hover:bg-brand-800 disabled:opacity-40">Add</button>
      </div>
    </div>
  )
}

function AppealsTab({ c, onUpdate }) {
  const [form, setForm] = useState({ grounds: '', desiredOutcome: '' })
  const [busy, setBusy] = useState(false)
  const appeals = c.appeals || []
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const submit = async () => {
    if (!form.grounds.trim() || busy) return
    setBusy(true)
    try {
      onUpdate(await caseAction.appeal(c.id, form))
      setForm({ grounds: '', desiredOutcome: '' })
      toast(`Appeal lodged — escalated to Level ${Math.min(c.tier + 1, 5)}`)
    } catch (e) { toast(e?.message || 'Could not lodge the appeal', 'error') }
    finally { setBusy(false) }
  }
  return (
    <div>
      <p className="text-[11px] text-slate-400 mb-3">An appeal may be lodged within 14 days of the outcome. Lodging an appeal escalates the case to the next tier for independent review.</p>
      {appeals.length > 0 && (
        <ul className="space-y-2 mb-4">
          {appeals.map(a => (
            <li key={a.id} className="rounded-lg border border-violet-200 bg-violet-50/40 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-violet-800">{a.ref}</span>
                <span className="text-[10.5px] text-slate-400">{fmtDateTime(new Date(a.at))}</span>
              </div>
              <p className="text-[12.5px] text-slate-600 mt-1">{a.grounds}</p>
              {a.desiredOutcome && <p className="text-[11px] text-slate-400 mt-0.5">Sought: {a.desiredOutcome}</p>}
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <textarea value={form.grounds} onChange={(e) => set('grounds', e.target.value)} rows={2} placeholder="Grounds for appeal — why the complainant is dissatisfied" className={taCls} />
        <textarea value={form.desiredOutcome} onChange={(e) => set('desiredOutcome', e.target.value)} rows={2} placeholder="Desired outcome" className={taCls} />
        <button onClick={submit} disabled={!form.grounds.trim() || busy} className="text-[13px] font-semibold text-white bg-brand-700 rounded-md px-4 py-2 hover:bg-brand-800 disabled:opacity-40">Lodge appeal &amp; escalate</button>
      </div>
    </div>
  )
}
