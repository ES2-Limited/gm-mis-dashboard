import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  KeyRound, Eye, EyeOff, Users, Tags, BellRing, ShieldCheck,
  Cpu, UserPlus, Pencil, Trash2, Ban, Play, Plus, X,
  Smartphone, Download, MapPin, WifiOff, Camera, Lock, Network, Share2,
  ChevronDown, ChevronRight, Loader2, Search, AlertTriangle, RefreshCw, Check,
  Route, ArrowRight, ChevronsUp, BookOpen, Layers, ShieldAlert, Scale,
} from 'lucide-react'
import { Card } from '../components/ui'
import { getApiKey, setApiKey, getModel, setModel, keyMode } from '../lib/intelligence'
import { GOVERNANCE_TIERS, STATES, getSla, setSla, scopeStatesList, scopeLabel, getViewAs, DOMAINS, domainForCategory } from '../data/mock'
import { getUsers, refreshUsers, upsertUser, setUserStatus, removeUser, ROLES, NATIONAL_ROLES, FUNCTIONS, MODULES, defaultPermissions, withImpliedModules, ROLE_LEVELS } from '../data/users'
import { fetchAllStates, fetchLgas, getCoverage, setCoverage, isCoverageConfigured, activeStateNames, activeLgas, getSites, addSite, removeSite, allSites, sitesInState, getMinistries, addMinistry, removeMinistry, getReferralBodies, addReferralBody, removeReferralBody, REFERRAL_TYPES, getReferralAuthorities, addReferralAuthority, removeReferralAuthority, REFERRAL_AUTHORITY_TYPES, getStateModels, setStateModels, getStateModel } from '../data/coverage'
import { logEvent } from '../data/audit'
import { getTierDays, setTierDays, getAppealDays, setAppealDays, JOURNEY_STAGES, tierName, tierEscalatesTo } from '../data/caseflow'
import { fetchTaxonomy, createCategory, updateCategory, deleteCategory } from '../data/taxonomyApi'
import { fetchCaseStats } from '../data/casesApi'
import { PhoneInput } from '../components/PhoneInput'
import { toast } from '../lib/toast'

const TABS = [
  { id: 'guide', label: 'How it works', icon: BookOpen },
  { id: 'users', label: 'Users & Access', icon: Users },
  { id: 'coverage', label: 'Site & Coverage', icon: MapPin },
  { id: 'fieldapp', label: 'Field App', icon: Smartphone },
  { id: 'intelligence', label: 'Insights Engine', icon: Cpu },
  { id: 'taxonomy', label: 'Grievance Categories', icon: Tags },
  { id: 'journey', label: 'Case Journey', icon: Route },
  { id: 'protection', label: 'Data Protection', icon: ShieldCheck },
]

const inputCls = 'w-full text-[13px] rounded-md border border-slate-200 bg-white px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500'

const ROLE_TONES = {
  'FPMU Admin': 'bg-violet-50 text-violet-700',
  'SPMU Admin': 'bg-sky-50 text-sky-700',
  'Grievance Officer': 'bg-emerald-50 text-emerald-700',
  'Field Officer': 'bg-amber-50 text-amber-700',
  'SEA/SH Focal Person': 'bg-rose-50 text-rose-700',
  'M&E Viewer': 'bg-slate-100 text-slate-600',
}

function GuideTab() {
  const fields = [
    { icon: KeyRound, tone: 'text-violet-600 bg-violet-50', title: 'Role', q: 'What can they open in the app?', body: 'Their login and permissions. An FPMU Admin can change settings; a Grievance Officer works cases; an M&E Viewer only views reports.', tag: 'the door key' },
    { icon: Tags, tone: 'text-amber-600 bg-amber-50', title: 'Specialism', q: 'What kind of case lands on their desk?', body: 'The topic they handle. An Environmental Specialist receives environmental grievances; a Labour Officer receives labour ones.', tag: 'the subject' },
    { icon: Layers, tone: 'text-indigo-600 bg-indigo-50', title: 'Escalation tier', q: 'Which level of the ladder do they sit on?', body: 'Their step in the 4-level structure — Level 1 community, Level 2 State PIU (SPIU), Level 3 ministries, up to Level 4 federal (FPMU). It decides who a case reaches as it climbs.', tag: 'the floor' },
  ]
  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="h-9 w-9 rounded-md bg-emerald-50 flex items-center justify-center"><BookOpen size={16} className="text-emerald-700" /></div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">The three things every user has</h3>
            <p className="text-xs text-slate-400">They look similar but answer different questions</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          {fields.map(f => (
            <div key={f.title} className="rounded-md border border-slate-200 p-3.5">
              <div className="flex items-center gap-2">
                <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${f.tone}`}><f.icon size={14} /></span>
                <span className="text-[13px] font-semibold text-slate-800">{f.title}</span>
              </div>
              <p className="text-[11.5px] font-medium text-slate-600 mt-2">{f.q}</p>
              <p className="text-[11.5px] text-slate-500 mt-1 leading-snug">{f.body}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-2">= {f.tag}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-md bg-slate-50 ring-1 ring-slate-100 px-4 py-3">
          <p className="text-[12px] font-semibold text-slate-700">Example — Aisha</p>
          <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">
            <span className="font-medium">Role:</span> Grievance Officer (works cases, can&rsquo;t change settings) ·{' '}
            <span className="font-medium">Specialism:</span> Environmental Specialist (environmental cases route to her) ·{' '}
            <span className="font-medium">Tier:</span> Level 2 (sits at the state level).
            <br />So a water-pollution case in her state, once it climbs to Level 2, lands on Aisha — because she&rsquo;s the environmental person at that level, and her role lets her work it.
          </p>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="h-9 w-9 rounded-md bg-sky-50 flex items-center justify-center"><Route size={16} className="text-sky-600" /></div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">How a grievance moves</h3>
            <p className="text-xs text-slate-400">Resolved at the lowest level; climbs only if it can&rsquo;t be</p>
          </div>
        </div>
        <ol className="mt-4 space-y-2.5">
          {[
            ['Comes in', 'A complaint is logged from any channel (field app, WhatsApp, phone, walk-in).'],
            ['Starts at the community level', 'A community focal person receives it. Simple issues are solved right here and closed — they never go further.'],
            ['Climbs to the specialist', 'If it&rsquo;s too big or technical, it moves up to the matching specialist at the state level (e.g. Environmental Specialist).'],
            ['Keeps climbing if unresolved', 'Still stuck past its time window → it auto-escalates up the ladder: State → State ministries → FPMU → independent appeal.'],
            ['Closes', 'Once resolved and the complainant is surveyed, the case is closed.'],
          ].map(([t, b], i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 h-6 w-6 rounded-full bg-sky-50 text-sky-700 text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
              <div>
                <p className="text-[13px] font-semibold text-slate-700">{t}</p>
                <p className="text-[12px] text-slate-500 leading-snug" dangerouslySetInnerHTML={{ __html: b }} />
              </div>
            </li>
          ))}
        </ol>
        <p className="text-[11px] text-slate-400 mt-3">The escalation levels and time windows are set in <span className="font-medium text-slate-500">Case Journey</span>.</p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="h-9 w-9 rounded-md bg-slate-100 flex items-center justify-center"><Layers size={16} className="text-slate-500" /></div>
          <h3 className="text-sm font-semibold text-slate-800">Quick words</h3>
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
          {[
            ['Data scope', 'Which states a user can see — one, several (regional), or all (national).'],
            ['GRC', 'Grievance Redress Committee — the group that owns a case at a given level.'],
            ['Tier / Level', 'A step on the 5-level ladder: community → state → ministries → FPMU → appeal.'],
            ['Escalation', 'Moving a case up to the next level when it isn&rsquo;t resolved in time, or on appeal.'],
            ['Restricted', 'SEA/SH & child cases — handled by a separate confidential pathway, hidden from the open register.'],
            ['Coverage', 'The states and LGAs the project actually operates in.'],
          ].map(([t, b], i) => (
            <div key={i}>
              <dt className="text-[12.5px] font-semibold text-slate-700">{t}</dt>
              <dd className="text-[12px] text-slate-500 leading-snug" dangerouslySetInnerHTML={{ __html: b }} />
            </div>
          ))}
        </dl>
      </Card>
    </div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState(getUsers)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const blank = { name: '', title: '', email: '', phone: '', role: 'Grievance Officer', specialty: '', tier: 2, scope: activeStateNames()[0] || STATES[0].name }

  useEffect(() => { refreshUsers().then(setUsers).catch(() => {}) }, [])

  const save = async () => {
    if (saving) return
    if (!editing.name.trim() || !editing.role) { toast('Name and role are required', 'error'); return }
    const email = (editing.email || '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('A valid email address is required', 'error'); return }
    if ((editing.phone || '').replace(/\D/g, '').length < 10) { toast('A valid phone number is required', 'error'); return }

    const national = NATIONAL_ROLES.includes(editing.role) || editing.tier === 4
    const oneState = scopeStatesList(editing.scope)[0] || ''
    const scope = national ? 'All states' : oneState
    if (!national && !scope) { toast('Select a state for this user', 'error'); return }
    setSaving(true)
    try {
      const list = await upsertUser({ ...editing, name: editing.name.trim(), email: editing.email.trim(), scope })
      setUsers(list)
      logEvent(editing.id ? 'user_updated' : 'user_created', { target: editing.name.trim(), detail: `${editing.role} · ${scopeLabel(scope)}` })
      toast(editing.id ? `${editing.name} updated` : `${editing.name} added — invitation sent`)
      setEditing(null)
    } catch (e) {
      toast(e.message || 'Could not save the user', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">System Users</h3>
            <p className="text-xs text-slate-400">{users.filter(u => u.status === 'active').length} active · access is scoped by role and geography</p>
          </div>
          <button
            onClick={() => setEditing({ ...blank })}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2 hover:bg-brand-800"
          >
            <UserPlus size={14} /> Add User
          </button>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50/70 border-y border-slate-200">
              <th className="px-5 py-2.5 font-semibold">User</th>
              <th className="px-3 py-2.5 font-semibold">Role</th>
              <th className="px-3 py-2.5 font-semibold">Data Scope</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-5 py-2.5 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${u.status === 'suspended' ? 'opacity-55' : ''}`}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="h-8 w-8 rounded-full bg-emerald-800 text-white text-[10px] font-bold flex items-center justify-center">
                      {u.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-slate-800 leading-tight">{u.name}</p>
                      <p className="text-[11px] text-slate-400 leading-tight">{[u.title, u.email].filter(Boolean).join(' · ') || '—'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${ROLE_TONES[u.role]}`}>{u.role}</span>
                    {u.tier && (
                      <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200 whitespace-nowrap" title="Escalation tier">
                        Tier {u.tier}
                      </span>
                    )}
                  </div>
                  {u.specialty && <p className="text-[10.5px] text-slate-400 mt-0.5">{u.specialty}</p>}
                </td>
                <td className="px-3 py-3 text-xs text-slate-600">{scopeLabel(u.scope)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${u.status === 'active' ? 'text-emerald-700' : 'text-slate-400'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {u.status === 'active' ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditing({ ...u })}
                      title="Edit"
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={async () => {
                        const next = u.status === 'active' ? 'suspended' : 'active'
                        try {
                          setUsers(await setUserStatus(u.id, next))
                          logEvent(next === 'active' ? 'user_reactivated' : 'user_suspended', { target: u.name })
                          toast(`${u.name} ${next === 'active' ? 'reactivated' : 'suspended'}`, next === 'active' ? 'success' : 'info')
                        } catch (e) { toast(e.message || 'Could not update status', 'error') }
                      }}
                      title={u.status === 'active' ? 'Suspend' : 'Reactivate'}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                    >
                      {u.status === 'active' ? <Ban size={13} /> : <Play size={13} />}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          setUsers(await removeUser(u.id))
                          logEvent('user_removed', { target: u.name })
                          toast(`${u.name} removed`, 'info')
                        } catch (e) { toast(e.message || 'Could not remove user', 'error') }
                      }}
                      title="Remove"
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      {editing && (
        <UserModal
          editing={editing}
          setEditing={setEditing}
          onSave={save}
          saving={saving}
        />
      )}
    </div>
  )
}

const FieldLabel = ({ children }) => (
  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">{children}</span>
)

function parseCoverage(value) {
  if (!value) return []
  if (value === 'ALL' || value === 'STATE') return [{ kind: 'state' }]
  return value.split(',').map(s => s.trim()).filter(Boolean).map(tok => {
    if (tok === 'STATE') return { kind: 'state' }
    if (tok.startsWith('LGA:')) return { kind: 'lga', name: tok.slice(4) }
    if (tok.startsWith('SITE:')) return { kind: 'site', name: tok.slice(5) }
    return { kind: 'site', name: tok }
  })
}
function serializeCoverage(items) {
  if (items.some(i => i.kind === 'state')) return 'STATE'
  return items.map(i => (i.kind === 'lga' ? `LGA:${i.name}` : `SITE:${i.name}`)).join(',')
}

function CoverageChip({ tag, label, sub, onRemove }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg bg-white ring-1 ring-slate-200 pl-2 pr-1.5 py-1">
      <MapPin size={13} className="text-slate-400 shrink-0" />
      <span className="leading-tight">
        <span className="block text-[12px] font-medium text-slate-700">{label}</span>
        {sub && <span className="block text-[10px] text-slate-400">{sub}</span>}
      </span>
      <span className="text-[8.5px] font-semibold tracking-wider text-slate-400 bg-slate-100 rounded px-1 py-px">{tag}</span>
      <button onClick={onRemove} className="text-slate-300 hover:text-rose-500"><X size={13} /></button>
    </span>
  )
}

function CoverageRow({ title, sub, tag, onClick }) {
  return (
    <button onClick={onClick} className="group/opt w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-brand-50/60">
      <span className="grid place-items-center w-7 h-7 rounded-md bg-slate-100 text-slate-400 shrink-0 group-hover/opt:bg-brand-100 group-hover/opt:text-brand-700 transition-colors">
        <MapPin size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] text-slate-700 truncate">{title}</span>
        <span className="block text-[10.5px] text-slate-400 truncate">{sub}</span>
      </span>
      {tag && <span className="text-[8.5px] font-semibold tracking-wider text-slate-400 bg-slate-100 rounded px-1 py-px shrink-0">{tag}</span>}
    </button>
  )
}

function CoverageSectionLabel({ children }) {
  return <div className="px-2.5 pt-2 pb-1 text-[10px] font-medium tracking-wide text-slate-400">{children}</div>
}

function CoveragePicker({ state, value, onChange }) {
  const lgas = activeLgas(state)
  const sites = sitesInState(state)
  const items = parseCoverage(value)
  const hasState = items.some(i => i.kind === 'state')
  const pickedLgas = items.filter(i => i.kind === 'lga').map(i => i.name)
  const pickedSites = items.filter(i => i.kind === 'site').map(i => i.name)

  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const commit = (next) => onChange(serializeCoverage(next))
  const ql = q.trim().toLowerCase()

  const lgaOpts = lgas
    .filter(l => !pickedLgas.includes(l) && (!ql || l.toLowerCase().includes(ql)))
    .map(l => ({ name: l, count: sites.filter(s => s.lga === l).length }))
  const siteOpts = sites
    .filter(s => !pickedSites.includes(s.name) && !pickedLgas.includes(s.lga) &&
      (!ql || s.name.toLowerCase().includes(ql) || (s.lga || '').toLowerCase().includes(ql)))
    .map(s => ({ name: s.name, lga: s.lga, id: s.id }))

  const addLga = (name) => { commit([...items.filter(i => i.kind !== 'state'), { kind: 'lga', name }]); setQ('') }
  const addSite = (name) => { commit([...items.filter(i => i.kind !== 'state'), { kind: 'site', name }]); setQ('') }
  const removeItem = (target) => commit(items.filter(i => !(i.kind === target.kind && i.name === target.name)))

  return (
    <div className="rounded-lg bg-slate-50/70 ring-1 ring-slate-100 p-3 space-y-2.5" ref={ref}>
      <FieldLabel>Coverage in {state}</FieldLabel>

      {hasState && (
        <div className="flex items-center justify-between rounded-lg bg-amber-50 ring-1 ring-amber-200 px-3 py-2">
          <span className="text-[11.5px] text-amber-800">Currently set to the entire state — narrow it to specific LGAs or sites.</span>
          <button onClick={() => commit([])} className="text-[11px] font-medium text-amber-700 hover:text-rose-500">Clear</button>
        </div>
      )}

      {(pickedLgas.length > 0 || pickedSites.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {pickedLgas.map(n => (
            <CoverageChip key={`l-${n}`} tag="LGA" label={n} sub="all sites in this LGA" onRemove={() => removeItem({ kind: 'lga', name: n })} />
          ))}
          {pickedSites.map(n => (
            <CoverageChip key={`s-${n}`} tag="SITE" label={n} onRemove={() => removeItem({ kind: 'site', name: n })} />
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search an LGA or a site…"
          className="w-full pl-9 pr-3 py-2.5 text-[12.5px] rounded-lg border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
        />
        {open && (
          <div className="absolute z-[2500] mt-1.5 w-full max-h-64 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/[0.08] p-1">
            {lgaOpts.length > 0 && (
              <>
                <CoverageSectionLabel>Local Government Areas</CoverageSectionLabel>
                {lgaOpts.slice(0, 40).map(o => (
                  <CoverageRow key={`lg-${o.name}`} title={o.name}
                    sub={o.count ? `Covers all sites in ${o.name}` : 'Covers this whole LGA'}
                    tag={o.count ? `${o.count} site${o.count === 1 ? '' : 's'}` : null}
                    onClick={() => addLga(o.name)} />
                ))}
              </>
            )}
            {siteOpts.length > 0 && (
              <>
                <CoverageSectionLabel>Project sites</CoverageSectionLabel>
                {siteOpts.slice(0, 40).map(o => (
                  <CoverageRow key={o.id} title={o.name} sub={o.lga} onClick={() => addSite(o.name)} />
                ))}
              </>
            )}
            {lgaOpts.length === 0 && siteOpts.length === 0 && (
              <p className="px-3 py-3 text-[12px] text-slate-400">
                {q ? 'No LGA or site matches that.'
                  : (sites.length === 0 && lgas.length === 0) ? `Nothing configured for ${state} yet — set it up in Site & Coverage.`
                  : 'Everything available is already covered.'}
              </p>
            )}
          </div>
        )}
      </div>
      <p className="text-[10.5px] text-slate-400">Give this officer one or more whole LGAs, or pick individual sites. Sites you don’t add stay out of their reach.</p>
    </div>
  )
}

const RESTRICTED_OTP_DEMO = '343434'

function RestrictedClearance({ demoCode, onVerify, onCancel }) {
  const LEN = 6
  const [digits, setDigits] = useState(Array(LEN).fill(''))
  const [denied, setDenied] = useState(false)
  const refs = useRef([])
  useEffect(() => { refs.current[0]?.focus() }, [])

  const attempt = (code) => {
    if (code.length < LEN) return
    if (demoCode && code === demoCode) { onVerify(); return }
    setDenied(true)
    setTimeout(() => { setDigits(Array(LEN).fill('')); setDenied(false); refs.current[0]?.focus() }, 700)
  }
  const setAt = (i, raw) => {
    const v = raw.replace(/\D/g, '').slice(-1)
    const next = [...digits]; next[i] = v; setDigits(next); setDenied(false)
    if (v && i < LEN - 1) refs.current[i + 1]?.focus()
    attempt(next.join(''))
  }
  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus()
  }
  const onPaste = (e) => {
    const p = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, LEN)
    if (!p) return
    e.preventDefault()
    const next = Array(LEN).fill('').map((_, i) => p[i] || '')
    setDigits(next); refs.current[Math.min(p.length, LEN - 1)]?.focus(); attempt(p)
  }

  return createPortal(
    <div className="fixed inset-0 z-[2600] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 fade-up" onMouseDown={onCancel}>
      <div className={`relative w-full max-w-[360px] rounded-2xl bg-white overflow-hidden shadow-2xl ring-1 ${denied ? 'ring-rose-300' : 'ring-slate-200'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="h-1 bg-gradient-to-r from-rose-500 via-rose-600 to-rose-500" />
        <button onClick={onCancel} className="absolute top-3 right-3 h-7 w-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100"><X size={15} /></button>
        <div className="px-6 pt-6 pb-5 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-rose-50 ring-1 ring-rose-200 flex items-center justify-center mb-3">
            <ShieldAlert size={22} className="text-rose-600" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-rose-600">Safeguarding clearance</p>
          <h3 className="text-[15px] font-bold text-slate-900 mt-1">Grant confidential SEA/SH access</h3>
          <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">This opens the restricted partition. Enter the one-time clearance code to authorise it.</p>

          <div className="flex justify-center gap-2 mt-5" onPaste={onPaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (refs.current[i] = el)}
                value={d}
                onChange={(e) => setAt(i, e.target.value)}
                onKeyDown={(e) => onKey(i, e)}
                inputMode="numeric"
                maxLength={1}
                className={`h-12 w-[42px] text-center text-[20px] font-bold rounded-lg border transition-colors focus:outline-none focus:ring-2 ${
                  denied ? 'border-rose-400 text-rose-600 focus:ring-rose-500/40 shake' : d ? 'border-rose-300 text-slate-900 focus:ring-rose-500/40 focus:border-rose-400' : 'border-slate-200 text-slate-900 focus:ring-rose-500/40 focus:border-rose-400'
                }`}
              />
            ))}
          </div>
          {denied
            ? <p className="text-[11.5px] font-semibold text-rose-600 mt-3">Clearance denied — incorrect code.</p>
            : demoCode && <p className="text-[10.5px] text-slate-400 mt-3">Demo clearance code <span className="font-mono font-semibold text-slate-500">{demoCode}</span> · removed in production</p>}
        </div>
        <button onClick={onCancel} className="w-full text-[12.5px] font-semibold text-slate-500 py-3 border-t border-slate-100 hover:bg-slate-50">Cancel</button>
      </div>
    </div>,
    document.body,
  )
}

function UserModal({ editing, setEditing, onSave, saving }) {
  const set = (patch) => setEditing(s => ({ ...s, ...patch }))
  const [otpOpen, setOtpOpen] = useState(false)
  const doGrantRestricted = () => {
    const cur = editing.permissions || defaultPermissions(editing.role)
    set({ permissions: [...new Set([...cur, 'restricted'])] })
    setOtpOpen(false)
    toast('Restricted (SEA/SH) clearance granted')
  }

  const allowedLevels = ROLE_LEVELS[editing.role] || []
  const national = editing.tier === 4 || NATIONAL_ROLES.includes(editing.role)
  const isLevel1 = editing.tier === 1
  const isLevel3 = editing.tier === 3
  const ministries = getMinistries()

  const adminState = scopeStatesList(getViewAs().scope)[0] || null
  const isFederalAdmin = !adminState
  const availableRoles = isFederalAdmin ? ROLES : ROLES.filter(r => r !== 'FPMU Admin' && r !== 'SPMU Admin')

  useEffect(() => {
    if (!isFederalAdmin && adminState && editing.tier !== 4 && scopeStatesList(editing.scope)[0] !== adminState) {
      set({ scope: adminState })
    }
  }, [editing.role, isFederalAdmin, adminState]) // eslint-disable-line react-hooks/exhaustive-deps

  const coverageStates = isCoverageConfigured() ? activeStateNames() : STATES.map(s => s.name)
  const currentState = scopeStatesList(editing.scope)[0] || ''
  const stateOptions = isFederalAdmin
    ? (currentState && !coverageStates.includes(currentState) ? [currentState, ...coverageStates] : coverageStates)
    : [adminState]

  return createPortal(
    <div className="fixed inset-0 z-[2400] flex justify-end" onMouseDown={() => setEditing(null)}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div
        className="relative h-full w-full max-w-md bg-white shadow-2xl slide-in-right flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{editing.id ? 'Edit user' : 'Add new user'}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{editing.id ? editing.name : 'System account scoped by role and geography'}</p>
          </div>
          <button onClick={() => setEditing(null)} className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <FieldLabel>Full name *</FieldLabel>
              <input autoFocus value={editing.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Aisha Bello" className={inputCls} />
            </label>
            <label className="block">
              <FieldLabel>Designation / title</FieldLabel>
              <input value={editing.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. State Grievance Officer" className={inputCls} />
            </label>
            <label className="block">
              <FieldLabel>Email *</FieldLabel>
              <input type="email" value={editing.email} onChange={(e) => set({ email: e.target.value })} placeholder="name@spinproject.ng" className={inputCls} />
            </label>
            <label className="block">
              <FieldLabel>Phone *</FieldLabel>
              <PhoneInput value={editing.phone || ''} onChange={(phone) => set({ phone })} />
            </label>
          </div>

          <div className="pt-1 border-t border-slate-100" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <FieldLabel>Role *</FieldLabel>
              <select
                value={editing.role}
                onChange={(e) => {
                  const role = e.target.value
                  const levels = ROLE_LEVELS[role] || []

                  const tier = levels.length ? (levels.includes(editing.tier) ? editing.tier : levels[0]) : undefined
                  set({ role, tier, scope: tier === 4 || NATIONAL_ROLES.includes(role) ? 'All states' : '', lga: '', community: '' })
                }}
                className={inputCls}
              >
                {availableRoles.map(r => <option key={r}>{r}</option>)}
              </select>
            </label>
            <label className="block">
              <FieldLabel>Specialism (handles)</FieldLabel>
              <select value={editing.specialty || ''} onChange={(e) => set({ specialty: e.target.value })} className={inputCls}>
                <option value="">— none —</option>
                {FUNCTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
          </div>
          <p className="text-[10.5px] text-slate-400 -mt-2">
            <span className="font-medium text-slate-500">Role</span> = what they can access · <span className="font-medium text-slate-500">Specialism</span> = which grievances route to them (e.g. Environmental Specialist gets environmental cases).
          </p>

          <label className="block">
            <FieldLabel>Level</FieldLabel>
            {allowedLevels.length === 0 ? (
              <div className={`${inputCls} flex items-center text-slate-400`}>Not on the grievance ladder</div>
            ) : (
              <select
                value={editing.tier ?? ''}
                onChange={(e) => { const t = e.target.value ? Number(e.target.value) : undefined; set({ tier: t, scope: t === 4 ? 'All states' : (scopeStatesList(editing.scope)[0] ? editing.scope : ''), community: '' }) }}
                disabled={allowedLevels.length <= 1}
                className={`${inputCls} disabled:opacity-70`}
              >
                {allowedLevels.map(lv => {
                  const g = GOVERNANCE_TIERS.find(t => t.level === lv)
                  return <option key={lv} value={lv}>Level {lv} — {g?.name}</option>
                })}
              </select>
            )}
            <p className="text-[10.5px] text-slate-400 mt-1">
              {allowedLevels.length === 0
                ? 'This role is oversight only — it does not sit on the escalation ladder.'
                : allowedLevels.length === 1
                  ? `${editing.role} always operates at Level ${allowedLevels[0]}.`
                  : `Which level on the ladder this person plays for ${editing.role}.`}
            </p>
          </label>

          <div>
            <FieldLabel>Data scope (state)</FieldLabel>
            {national ? (
              <div className={`${inputCls} flex items-center text-slate-400`}>National — all states (no single state)</div>
            ) : !isFederalAdmin ? (
              <div className={`${inputCls} flex items-center text-slate-700`}>{adminState} <span className="ml-1.5 text-[10px] font-bold uppercase text-sky-700">· your state</span></div>
            ) : (
              <select value={currentState} onChange={(e) => set({ scope: e.target.value, lga: '', community: '' })} className={inputCls}>
                <option value="">Select a state…</option>
                {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <p className="text-[10.5px] text-slate-400 mt-1">
              {national
                ? 'Level 4 (FPMU) and national roles cover all states.'
                : !isFederalAdmin
                  ? `As a state admin you can only add users to ${adminState}.`
                  : 'Levels 1–3 belong to exactly one state.'}
            </p>
          </div>

          {isLevel1 && currentState && (
            <CoveragePicker
              state={currentState}
              value={editing.community || ''}
              onChange={(community) => set({ community, lga: '' })}
            />
          )}

          {isLevel3 && (
            <label className="block">
              <FieldLabel>Ministry / Agency (Level 3)</FieldLabel>
              <select value={editing.community || ''} onChange={(e) => set({ community: e.target.value, lga: '' })} className={inputCls}>
                <option value="">Select a ministry / agency…</option>
                {ministries.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <p className="text-[10.5px] text-slate-400 mt-1">
                {ministries.length === 0
                  ? <>No ministries added yet — add them under <span className="font-medium text-slate-500">Case Journey → Level 3 ministries</span>.</>
                  : 'Which State Sector Ministry or Agency this Level 3 handler belongs to.'}
              </p>
            </label>
          )}

          {editing.id && (
            <label className="block">
              <FieldLabel>Status</FieldLabel>
              <select value={editing.status || 'active'} onChange={(e) => set({ status: e.target.value })} className={inputCls}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
          )}

          {(() => {
            const roleDefaults = defaultPermissions(editing.role)
            const perms = editing.permissions || roleDefaults
            const usingDefaults = !editing.permissions
            const toggle = (key) => {
              const isOn = perms.includes(key)

              if (key === 'restricted' && !isOn) { setOtpOpen(true); return }
              const next = isOn ? perms.filter(k => k !== key) : [...perms, key]
              set({ permissions: next })
            }
            const labelFor = (k) => MODULES.find(m => m.key === k)?.label || k
            return (
              <div className="pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5 mt-3">
                  <FieldLabel>Module access</FieldLabel>
                  {!usingDefaults && (
                    <button
                      type="button"
                      onClick={() => set({ permissions: undefined })}
                      className="text-[10.5px] font-semibold text-brand-700 hover:underline normal-case"
                    >
                      Reset to role defaults
                    </button>
                  )}
                </div>

                <div className="rounded-lg bg-slate-50 ring-1 ring-slate-100 px-3 py-2 mb-2">
                  <p className="text-[10.5px] text-slate-500">
                    <span className="font-semibold text-slate-600">{editing.role}</span> includes by default:
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{roleDefaults.map(labelFor).join(' · ')}</p>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {MODULES.map(m => {
                    const checked = perms.includes(m.key)

                    const impliedOn = !checked && withImpliedModules(perms).includes(m.key)
                    const on = checked || impliedOn
                    const isRoleDefault = roleDefaults.includes(m.key)
                    return (
                      <label key={m.key} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${impliedOn ? 'cursor-not-allowed' : 'cursor-pointer'} ${on ? 'border-brand-200 bg-brand-50/50' : 'border-slate-200'}`}>
                        <input type="checkbox" checked={on} disabled={impliedOn} onChange={() => toggle(m.key)} className="h-3.5 w-3.5 rounded border-slate-300 accent-emerald-600 shrink-0" />
                        <span className="text-[12px] text-slate-700 truncate flex-1 min-w-0">{m.label}</span>
                        {impliedOn
                          ? <span className="shrink-0 text-[8.5px] font-bold uppercase tracking-wide text-brand-500" title="Included automatically — required by another right you granted">auto</span>
                          : isRoleDefault
                          ? <span className="shrink-0 text-[8.5px] font-bold uppercase tracking-wide text-slate-400">role</span>
                          : checked ? <span className="shrink-0 text-[8.5px] font-bold uppercase tracking-wide text-emerald-600">added</span> : null}
                      </label>
                    )
                  })}
                </div>
                <p className="text-[10.5px] text-slate-400 mt-1.5">
                  <span className="font-medium text-slate-500">role</span> = granted by the role · <span className="font-medium text-emerald-600">added</span> = extra access you granted. Unticked modules are hidden and blocked.
                </p>
              </div>
            )
          })()}

          {editing.permissions?.includes('restricted') && (
            <div className="flex items-start gap-2 text-[11px] text-rose-600 bg-rose-50 ring-1 ring-rose-100 rounded-lg px-3 py-2">
              <Lock size={13} className="shrink-0 mt-0.5" />
              <span>This user is granted the <span className="font-semibold">Restricted (SEA/SH)</span> right — they can open the confidential safeguarding partition.</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={() => setEditing(null)} disabled={saving} className="text-[13px] font-semibold text-slate-600 rounded-md px-4 py-2 hover:bg-slate-100 disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-4 py-2 hover:bg-brand-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? (editing.id ? 'Saving…' : 'Creating…') : (editing.id ? 'Save changes' : 'Create user')}
          </button>
        </div>
      </div>

      {otpOpen && (
        <RestrictedClearance demoCode={RESTRICTED_OTP_DEMO} onVerify={doGrantRestricted} onCancel={() => setOtpOpen(false)} />
      )}
    </div>,
    document.body,
  )
}

function SiteEditor({ state, lga }) {
  const [, tick] = useState(0)
  const [form, setForm] = useState({ name: '', community: '', lat: '', lng: '' })
  const sites = getSites(state, lga)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const add = () => {
    const name = form.name.trim()
    if (!name) return
    const lat = form.lat.trim() === '' ? undefined : Number(form.lat)
    const lng = form.lng.trim() === '' ? undefined : Number(form.lng)
    if ((form.lat.trim() !== '' && !Number.isFinite(lat)) || (form.lng.trim() !== '' && !Number.isFinite(lng))) {
      toast('GPS coordinates must be numbers', 'error'); return
    }
    if (addSite(state, lga, { name, community: form.community, lat, lng })) {
      setForm({ name: '', community: '', lat: '', lng: '' }); tick(n => n + 1)
    } else {
      toast('A site with that name already exists here', 'error')
    }
  }
  const inCls = 'text-[12px] rounded-md border border-slate-200 bg-white text-slate-700 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30'
  return (
    <div className="mt-1.5 ml-6 rounded-md border border-slate-200 bg-white p-3 space-y-2.5">
      {sites.length === 0 ? (
        <p className="text-[11.5px] text-slate-400">No sites yet for {lga}.</p>
      ) : (
        <ul className="space-y-1.5">
          {sites.map(s => (
            <li key={s.id} className="flex items-start gap-2 rounded-md bg-slate-50 px-2.5 py-1.5">
              <MapPin size={13} className="text-emerald-600 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-slate-700">{s.name}</p>
                <p className="text-[10.5px] text-slate-400">
                  {[s.community && `Community: ${s.community}`, (s.lat != null && s.lng != null) && `${s.lat}, ${s.lng}`].filter(Boolean).join(' · ') || 'No extra data'}
                </p>
              </div>
              <button onClick={() => { removeSite(state, lga, s.id); tick(n => n + 1) }} className="shrink-0 text-slate-400 hover:text-rose-500" title="Remove site"><X size={13} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Site / project name *" className={`${inCls} sm:col-span-2`} />
        <input value={form.community} onChange={e => set('community', e.target.value)} placeholder="Community (optional)" className={inCls} />
        <div className="grid grid-cols-2 gap-2">
          <input value={form.lat} onChange={e => set('lat', e.target.value)} placeholder="Lat (optional)" inputMode="decimal" className={inCls} />
          <input value={form.lng} onChange={e => set('lng', e.target.value)} placeholder="Lng (optional)" inputMode="decimal" className={inCls} />
        </div>
      </div>
      <button onClick={add} disabled={!form.name.trim()} className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-brand-700 rounded-md px-3 py-1.5 hover:bg-brand-800 disabled:opacity-40">
        <Plus size={13} /> Add site
      </button>
    </div>
  )
}

function AllSitesView() {
  const [, tick] = useState(0)
  const refresh = () => tick(n => n + 1)
  const cov = getCoverage()

  const ownedState = scopeStatesList(getViewAs().scope)[0] || null
  const coveredStates = Object.keys(cov).filter(s => !ownedState || s === ownedState).sort()
  const [fState, setFState] = useState('')
  const [q, setQ] = useState('')
  const [form, setForm] = useState({ state: '', lga: '', name: '', community: '', lat: '', lng: '' })

  const sites = allSites()
    .filter(s => !ownedState || s.state === ownedState)
    .sort((a, b) => (a.state + a.lga + a.name).localeCompare(b.state + b.lga + b.name))
  const filtered = sites.filter(s =>
    (!fState || s.state === fState) &&
    (!q || [s.name, s.community, s.lga, s.state].filter(Boolean).some(v => v.toLowerCase().includes(q.toLowerCase())))
  )
  const lgaOptions = form.state ? (cov[form.state] || []) : []
  const set = (k, v) => setForm(f => ({ ...f, [k]: v, ...(k === 'state' ? { lga: '' } : {}) }))
  const add = () => {
    if (!form.state || !form.lga || !form.name.trim()) { toast('Pick a state, an LGA and enter a site name', 'error'); return }
    const lat = form.lat.trim() === '' ? undefined : Number(form.lat)
    const lng = form.lng.trim() === '' ? undefined : Number(form.lng)
    if ((form.lat.trim() !== '' && !Number.isFinite(lat)) || (form.lng.trim() !== '' && !Number.isFinite(lng))) { toast('GPS coordinates must be numbers', 'error'); return }
    if (addSite(form.state, form.lga, { name: form.name, community: form.community, lat, lng })) {
      setForm(f => ({ ...f, name: '', community: '', lat: '', lng: '' })); refresh(); toast('Site added')
    } else { toast('A site with that name already exists in that LGA', 'error') }
  }
  const selCls = 'text-[12.5px] rounded-md border border-slate-200 bg-white text-slate-700 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30'
  const inCls = 'text-[12.5px] rounded-md border border-slate-200 bg-white text-slate-700 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30'

  return (
    <div>

      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Add a project site</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <select value={form.state} onChange={e => set('state', e.target.value)} className={selCls}>
            <option value="">State…</option>
            {coveredStates.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={form.lga} onChange={e => set('lga', e.target.value)} disabled={!form.state} className={selCls + ' disabled:opacity-50'}>
            <option value="">{form.state ? 'LGA…' : 'Pick a state'}</option>
            {lgaOptions.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Site / project name *" className={inCls + ' lg:col-span-2'} />
          <input value={form.community} onChange={e => set('community', e.target.value)} placeholder="Community (optional)" className={inCls} />
          <input value={form.lat} onChange={e => set('lat', e.target.value)} placeholder="Lat (opt.)" inputMode="decimal" className={inCls} />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <input value={form.lng} onChange={e => set('lng', e.target.value)} placeholder="Lng (optional)" inputMode="decimal" className={inCls + ' w-32'} />
          <button onClick={add} disabled={!form.name.trim() || !form.state || !form.lga} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2 hover:bg-brand-800 disabled:opacity-40">
            <Plus size={14} /> Add site
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search sites, community, LGA…" className="w-60 pl-8 pr-3 py-2 text-[13px] rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
        </div>
        <select value={fState} onChange={e => setFState(e.target.value)} className={selCls}>
          <option value="">All states</option>
          {coveredStates.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-[11px] text-slate-400 ml-auto">{filtered.length} of {sites.length} sites</span>
      </div>

      <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
        {sites.length === 0 ? (
          <p className="text-center text-[12.5px] text-slate-400 py-10">No project sites yet. Add the first one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50/70 border-y border-slate-200">
                <th className="px-5 py-2 font-semibold">Site</th>
                <th className="px-3 py-2 font-semibold">State</th>
                <th className="px-3 py-2 font-semibold">LGA</th>
                <th className="px-3 py-2 font-semibold">Community</th>
                <th className="px-3 py-2 font-semibold">GPS</th>
                <th className="px-5 py-2 font-semibold w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={`${s.state}::${s.lga}::${s.id}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-5 py-2.5 font-medium text-slate-700">{s.name}</td>
                  <td className="px-3 py-2.5 text-slate-600">{s.state}</td>
                  <td className="px-3 py-2.5 text-slate-600">{s.lga}</td>
                  <td className="px-3 py-2.5 text-slate-500">{s.community || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-slate-500 tabular-nums">{s.lat != null && s.lng != null ? `${s.lat}, ${s.lng}` : <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-2.5">
                    <button onClick={() => { removeSite(s.state, s.lga, s.id); refresh() }} className="text-slate-400 hover:text-rose-500" title="Remove site"><X size={14} /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-[12.5px] text-slate-400 py-8">No sites match the filter.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function CoverageTab() {
  const [allStates, setAllStates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cov, setCov] = useState(getCoverage)
  const [models, setModels] = useState(getStateModels)
  const [lgaCache, setLgaCache] = useState({})
  const [busyState, setBusyState] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [expandedLga, setExpandedLga] = useState(null)
  const [q, setQ] = useState('')
  const [saved, setSaved] = useState(true)
  const [subTab, setSubTab] = useState('coverage')

  const load = useCallback(async () => {
    try {
      const states = await fetchAllStates()
      setAllStates(states)
      setError(null)
    } catch (e) {
      setError(e.message || 'Could not reach the states service')
    } finally {
      setLoading(false)
    }
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount; setState runs after await, not synchronously
  useEffect(() => { load() }, [load])

  const ensureLgas = async (state) => {
    if (lgaCache[state]) return lgaCache[state]
    setBusyState(state)
    try {
      const lgas = await fetchLgas(state)
      setLgaCache(c => ({ ...c, [state]: lgas }))
      return lgas
    } catch {
      toast(`Could not load LGAs for ${state}`, 'error')
      return []
    } finally { setBusyState(null) }
  }

  const toggleState = async (state) => {
    if (cov[state]) {
      setCov(c => { const n = { ...c }; delete n[state]; return n })
      if (expanded === state) setExpanded(null)
    } else {
      const lgas = await ensureLgas(state)
      setCov(c => ({ ...c, [state]: [...lgas] }))
      setExpanded(state)
    }
    setSaved(false)
  }

  const toggleExpand = async (state) => {
    if (expanded === state) { setExpanded(null); return }
    await ensureLgas(state)
    setExpanded(state)
  }

  const toggleLga = (state, lga) => {
    setCov(c => {
      const cur = c[state] || []
      const next = cur.includes(lga) ? cur.filter(l => l !== lga) : [...cur, lga]
      return { ...c, [state]: next }
    })
    setSaved(false)
  }

  const setAll = (state, on) => {
    setCov(c => ({ ...c, [state]: on ? [...(lgaCache[state] || [])] : [] }))
    setSaved(false)
  }

  const changeModel = (state, m) => {
    setModels(mm => ({ ...mm, [state]: m }))
    setSaved(false)
  }

  const save = () => {
    setCoverage(cov); setStateModels(models); setSaved(true)
    logEvent('coverage_saved', { target: `${Object.keys(cov).length} states` })
    toast('Project coverage saved')
  }

  const counts = useMemo(() => ({
    states: Object.keys(cov).length,
    lgas: Object.values(cov).reduce((n, a) => n + (a?.length || 0), 0),
  }), [cov])

  const ownedState = scopeStatesList(getViewAs().scope)[0] || null
  const filtered = allStates
    .filter(s => !ownedState || s === ownedState)
    .filter(s => s.toLowerCase().includes(q.toLowerCase()))

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Site &amp; Coverage</h3>
          <p className="text-xs text-slate-400">States, LGAs and the project sites this project operates in</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-[11px] font-medium text-slate-500">
            <span className="text-slate-700 font-semibold tabular-nums">{counts.states}</span> states ·{' '}
            <span className="text-slate-700 font-semibold tabular-nums">{counts.lgas}</span> LGAs
          </span>
          <button
            onClick={save}
            disabled={saved}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2 hover:bg-brand-800 disabled:opacity-40"
          >
            <Check size={14} /> {saved ? 'Saved' : 'Save coverage'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-5 py-2.5 border-b border-slate-100">
        {[{ id: 'coverage', label: 'Coverage (states & LGAs)' }, { id: 'sites', label: 'Project Sites' }].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`text-[12.5px] font-semibold rounded-md px-3 py-1.5 transition-colors ${subTab === t.id ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'sites' ? <AllSitesView /> : loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
          <p className="text-xs text-slate-400 mt-2">Loading states…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16">
          <AlertTriangle className="w-6 h-6 text-rose-500" />
          <p className="text-xs text-rose-600 mt-2">{error}</p>
          <button onClick={() => { setLoading(true); load() }} className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-white bg-brand-700 rounded-lg px-3 py-1.5 hover:bg-brand-800">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      ) : (
        <>
          <div className="px-5 py-3 border-b border-slate-100">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search states…"
                className="w-full pl-8 pr-3 py-2 text-[13px] rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto">
            {filtered.map(state => {
              const active = !!cov[state]
              const sel = cov[state] || []
              const lgas = lgaCache[state] || []
              const isOpen = expanded === state
              const isBusy = busyState === state
              return (
                <div key={state}>
                  <div className={`flex items-center gap-3 px-5 py-2.5 ${active ? 'bg-emerald-50/40' : ''}`}>
                    <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleState(state)}
                        className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                      />
                      <span className="text-[13px] font-medium text-slate-700">{state}</span>
                      {active && (
                        <span className="text-[11px] text-slate-400">
                          {sel.length}{lgas.length ? ` of ${lgas.length}` : ''} LGA{sel.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </label>
                    {active && (
                      <label className="flex items-center gap-1.5 shrink-0" title="Which institutional chain runs this state's grievance mechanism">
                        <span className="hidden sm:inline text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide">Model</span>
                        <select
                          value={models[state] === 2 ? 2 : 1}
                          onChange={(e) => changeModel(state, Number(e.target.value))}
                          className="text-[12px] font-medium text-slate-700 rounded-md border border-slate-200 bg-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        >
                          <option value={1}>Model 1 · RBDA / FPMU</option>
                          <option value={2}>Model 2 · State SPIU</option>
                        </select>
                      </label>
                    )}
                    {active && (
                      <button
                        onClick={() => toggleExpand(state)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                      >
                        {isBusy ? <Loader2 size={13} className="animate-spin" /> : isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {isOpen ? 'Hide' : 'LGAs'}
                      </button>
                    )}
                  </div>

                  {isOpen && active && (
                    <div className="px-5 pb-3 pt-1 bg-slate-50/50">
                      {isBusy && lgas.length === 0 ? (
                        <p className="text-[11px] text-slate-400 py-2 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Loading LGAs…</p>
                      ) : (
                        <>
                        <div className="flex items-center gap-3 mb-2">
                          <button onClick={() => setAll(state, true)} className="text-[11px] font-semibold text-brand-700 hover:underline">Select all</button>
                          <span className="text-slate-300">·</span>
                          <button onClick={() => setAll(state, false)} className="text-[11px] font-semibold text-slate-500 hover:underline">Clear</button>
                        </div>
                        <div className="space-y-0.5">
                          {lgas.map(lga => {
                            const on = sel.includes(lga)
                            const key = `${state}::${lga}`
                            const cOpen = expandedLga === key
                            const sCount = getSites(state, lga).length
                            return (
                              <div key={lga}>
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      onChange={() => toggleLga(state, lga)}
                                      className="h-3.5 w-3.5 rounded border-slate-300 accent-emerald-600"
                                    />
                                    <span className="text-[12px] text-slate-600 truncate">{lga}</span>
                                  </label>
                                  {on && (
                                    <button
                                      onClick={() => setExpandedLga(cOpen ? null : key)}
                                      className="shrink-0 flex items-center gap-0.5 text-[10.5px] font-semibold text-brand-700 hover:underline"
                                    >
                                      {sCount > 0 ? `${sCount} ${sCount === 1 ? 'site' : 'sites'}` : 'manage sites'}
                                      {cOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    </button>
                                  )}
                                </div>
                                {on && cOpen && <SiteEditor state={state} lga={lga} />}
                              </div>
                            )
                          })}
                        </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-8">No states match “{q}”</p>
            )}
          </div>

          <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-slate-100">
            Active states and their LGAs drive the Register Case pickers. Open an LGA to add the project sites under it (name, plus optional community and GPS). <span className="font-semibold text-slate-500">Model</span> sets each state's grievance chain — Model 1 (RBDA/FPMU) escalates up to the Federal level; Model 2 (State SPIU) treats FPMU as non-mandated. Reference data: nga-states-lga service.
          </p>
        </>
      )}
    </Card>
  )
}

function FieldAppTab() {
  return (
    <div className="grid grid-cols-12 gap-3 md:gap-4 items-start">
      <Card className="col-span-12 xl:col-span-7 p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="h-9 w-9 rounded-md bg-emerald-50 flex items-center justify-center">
            <Smartphone size={16} className="text-emerald-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">SPIN Field Collection</h3>
            <p className="text-xs text-slate-400">Offline-first grievance intake for field officers · Android</p>
          </div>
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700">
            v1.0
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { icon: WifiOff, title: 'Works offline', desc: 'Records save to the device and upload when network returns' },
            { icon: MapPin, title: 'GPS at collection', desc: 'Position captured at the point of intake with accuracy' },
            { icon: Camera, title: 'Evidence capture', desc: 'Photos and voice notes attached to each record' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-md border border-slate-100 bg-slate-50/50 p-3.5">
              <Icon size={16} className="text-emerald-700 mb-2" />
              <p className="text-[12.5px] font-semibold text-slate-700">{title}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a
            href="/downloads/spin-field-collection-5.apk"
            download
            className="flex items-center gap-2 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-4 py-2.5 hover:bg-brand-800"
          >
            <Download size={15} /> Download APK (Android)
          </a>
          <span className="text-[11px] text-slate-400">Direct install · field devices are provisioned outside app stores</span>
        </div>
      </Card>

      <Card className="col-span-12 xl:col-span-5 p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Installing on a field device</h3>
        <ol className="space-y-2.5">
          {[
            'Download the APK on the device (or transfer via USB / SHAREit).',
            'Open the file — allow “Install from this source” when Android asks.',
            'Open the app, select the officer\'s provisioned profile and sign in with the issued PIN.',
            'The device code is assigned automatically — case codes are unique offline.',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-slate-600 leading-relaxed">
              <span className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-700 text-[10.5px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 leading-relaxed">
          Demo profiles use PIN <span className="font-mono font-semibold text-slate-500">2026</span>. In production,
          officers and PINs are provisioned from Users &amp; Access.
        </p>
      </Card>
    </div>
  )
}

function IntelligenceTab() {
  const [key, setKey] = useState(getApiKey())
  const [model, setModelState] = useState(getModel())
  const [show, setShow] = useState(false)

  const save = () => {
    setApiKey(key)
    setModel(model)
    toast('Insights engine configuration saved')
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="h-9 w-9 rounded-md bg-emerald-50 flex items-center justify-center">
          <Cpu size={16} className="text-emerald-700" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Insights Engine</h3>
          <p className="text-xs text-slate-400">Used by Insights, report authoring and intake classification</p>
        </div>
        <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${keyMode() === 'custom' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {keyMode() === 'custom' ? 'Custom key active' : 'Managed · active'}
        </span>
      </div>

      <p className="mt-3 text-[12px] text-slate-500 bg-emerald-50/60 border border-emerald-100 rounded-md px-3.5 py-2.5 leading-relaxed">
        A managed service credential is active by default — Insights, report authoring and intake
        classification work out of the box. Entering a key below overrides it for this browser only.
      </p>

      <div className="mt-4 grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5 mb-1.5">
            <KeyRound size={13} /> Override key (optional)
          </label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              className={`${inputCls} pr-10 font-mono`}
            />
            <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">Stored locally in this browser only. Leave empty to keep using the managed credential.</p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Analysis profile</label>
          <select value={model} onChange={(e) => setModelState(e.target.value)} className={inputCls}>
            <option value="deepseek-chat">Standard (deepseek-chat)</option>
            <option value="deepseek-reasoner">Deep analysis (deepseek-reasoner)</option>
          </select>
        </div>
      </div>

      <button onClick={save} className="mt-4 text-sm font-semibold text-white bg-brand-700 rounded-md px-4 py-2 hover:bg-brand-800">
        Save Configuration
      </button>
    </Card>
  )
}

function PriorityPill({ p }) {
  const cls = p === 'high' ? 'text-rose-700 bg-rose-50 ring-rose-200'
    : p === 'medium' ? 'text-amber-700 bg-amber-50 ring-amber-200'
    : 'text-slate-600 bg-slate-100 ring-slate-200'
  return (
    <span className={`text-[9.5px] font-bold uppercase tracking-wide ring-1 rounded-full px-1.5 py-px ${cls}`}>
      {p} priority
    </span>
  )
}

function SubgroupEditor({ cat, onChange }) {
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)
  const subs = cat.subgroups || []

  const add = async () => {
    const v = val.trim()
    if (!v || busy) return
    if (subs.some(s => s.toLowerCase() === v.toLowerCase())) { toast('That sub-group already exists', 'error'); return }
    setBusy(true)
    try { await updateCategory(cat.id, { subgroups: [...subs, v] }); setVal(''); setOpen(false); await onChange(); toast(`Sub-group “${v}” added`) }
    catch (e) { toast(e.message || 'Could not add the sub-group', 'error') }
    finally { setBusy(false) }
  }
  const remove = async (s) => {
    try { await updateCategory(cat.id, { subgroups: subs.filter(x => x !== s) }); await onChange() }
    catch (e) { toast(e.message || 'Could not remove the sub-group', 'error') }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
      {subs.map(s => (
        <span key={s} className="inline-flex items-center gap-1 text-[10.5px] font-medium rounded-md px-2 py-0.5 text-slate-600 bg-slate-100">
          {s}
          <button onClick={() => remove(s)} className="text-slate-400 hover:text-rose-500" title="Remove sub-group">
            <X size={10} />
          </button>
        </span>
      ))}
      {open ? (
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setOpen(false); setVal('') } }}
            placeholder="Sub-group name…"
            className="text-[11px] rounded-md border border-slate-200 bg-white px-2 py-0.5 w-36 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button onClick={add} className="text-[10.5px] font-semibold text-brand-700 hover:text-brand-800">Add</button>
          <button onClick={() => { setOpen(false); setVal('') }} className="text-slate-400 hover:text-slate-600"><X size={11} /></button>
        </span>
      ) : (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-md px-2 py-0.5">
          <Plus size={10} /> Sub-group
        </button>
      )}
    </div>
  )
}

function TaxonomyTab() {
  const [cats, setCats] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [newCat, setNewCat] = useState('')
  const [newDomain, setNewDomain] = useState('Other')
  const [adding, setAdding] = useState(false)
  const [sla, setSlaState] = useState(getSla)

  const reload = useCallback(async () => {
    const list = await fetchTaxonomy()
    setCats(list)
    return list
  }, [])
  useEffect(() => {
    Promise.all([
      fetchTaxonomy().then(setCats).catch(() => {}),
      fetchCaseStats().then(s => setCounts(s.byCategory || {})).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const add = async () => {
    const name = newCat.trim()
    if (!name || adding) return
    setAdding(true)
    try { await createCategory({ name, domain: newDomain }); setNewCat(''); setNewDomain('Other'); await reload(); toast(`Category “${name}” added to ${newDomain} Grievances — saved to the register`) }
    catch (e) { toast(e.message || 'That category already exists', 'error') }
    finally { setAdding(false) }
  }
  const removeCat = async (cat) => {
    try { await deleteCategory(cat.id); await reload(); toast(`Category “${cat.name}” removed`, 'info') }
    catch (e) { toast(e.message || 'Could not remove the category', 'error') }
  }

  const saveSla = () => {
    setSla(sla)
    toast('SLA targets saved — applies to newly registered cases')
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="h-9 w-9 rounded-md bg-amber-50 flex items-center justify-center">
            <Tags size={16} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Grievance Categories</h3>
            <p className="text-xs text-slate-400">{cats.length} categories · stored in the register, used across every intake channel</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mb-4 ml-12">Sub-groups are the second-level classifier. Every change here saves to the backend immediately.</p>

        {loading ? (
          <div className="flex items-center gap-2 text-[12.5px] text-slate-400 py-6"><Loader2 size={15} className="animate-spin" /> Loading categories…</div>
        ) : (
          <div className="space-y-4">

            {DOMAINS.map(dom => {
              const inDom = cats.filter(t => (t.domain || domainForCategory(t.name)) === dom)
              if (!inDom.length) return null
              return (
                <div key={dom}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{dom} Grievances</span>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 rounded-full px-1.5 py-px tabular-nums">{inDom.length}</span>
                    <span className="flex-1 h-px bg-slate-100" />
                  </div>
                  <div className="space-y-2.5">
                    {inDom.map((t) => {
                      const n = counts[t.name] || 0
                      return (
                        <div key={t.id} className={`rounded-md border p-3.5 ${t.restricted ? 'border-rose-200 bg-rose-50/40' : t.custom ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[13px] font-semibold text-slate-800">{t.name}</span>
                                <PriorityPill p={t.priority} />
                                {t.custom && <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-100 ring-1 ring-emerald-200 rounded-full px-1.5 py-px">Custom</span>}
                                {t.restricted && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 bg-rose-100 ring-1 ring-rose-200 rounded-full px-1.5 py-px">
                                    <Lock size={9} /> Restricted pathway
                                  </span>
                                )}
                              </div>
                              {t.description && <p className="text-[11.5px] text-slate-500 mt-1 leading-snug">{t.description}</p>}
                            </div>
                            <div className="shrink-0 flex items-center gap-2">

                              <select
                                value={t.domain || domainForCategory(t.name)}
                                onChange={async (e) => { await updateCategory(t.id, { domain: e.target.value }); await reload(); toast(`“${t.name}” moved to ${e.target.value} Grievances`) }}
                                title="Grievance domain"
                                className="text-[11px] font-medium text-slate-600 rounded-md border border-slate-200 bg-white px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                              >
                                {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-lg px-2 py-1 tabular-nums" title="Cases on the register">
                                {t.restricted ? '—' : n}
                              </span>
                              {t.custom && n === 0 && (
                                <button onClick={() => removeCat(t)} className="text-slate-400 hover:text-rose-500" title="Remove category"><X size={14} /></button>
                              )}
                            </div>
                          </div>
                          <SubgroupEditor cat={t} onChange={reload} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="New custom category…"
            className={`${inputCls} max-w-xs`}
          />
          <select value={newDomain} onChange={(e) => setNewDomain(e.target.value)} className={`${inputCls} max-w-[12rem]`} title="Grievance domain">
            {DOMAINS.map(d => <option key={d} value={d}>{d} Grievances</option>)}
          </select>
          <button onClick={add} disabled={adding || !newCat.trim()} className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2.5 hover:bg-brand-800 disabled:opacity-40">
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add category
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">Framework categories cannot be removed. Add <span className="font-medium text-slate-500">sub-groups</span> to any category with “+ Sub-group”, and add custom categories for local needs (removable while unused). Everything is saved to the backend.</p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-9 w-9 rounded-md bg-sky-50 flex items-center justify-center">
            <BellRing size={16} className="text-sky-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">SLA Targets</h3>
            <p className="text-xs text-slate-400">Resolution targets per priority level</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl">
          {[
            ['high', 'High priority (days)'],
            ['medium', 'Medium priority (days)'],
            ['low', 'Low priority (days)'],
            ['ackHours', 'Acknowledgement (hours)'],
          ].map(([k, label]) => (
            <label key={k} className="block">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">{label}</span>
              <input
                type="number"
                min="1"
                value={sla[k]}
                onChange={(e) => setSlaState(s => ({ ...s, [k]: Math.max(1, parseInt(e.target.value) || 1) }))}
                className={inputCls}
              />
            </label>
          ))}
        </div>
        <button onClick={saveSla} className="mt-4 text-sm font-semibold text-white bg-brand-700 rounded-md px-4 py-2 hover:bg-brand-800">
          Save SLA Targets
        </button>
      </Card>
    </div>
  )
}

function EscalationFlow() {
  const me = getViewAs()
  const ownedState = scopeStatesList(me.scope)[0] || null
  const isFederal = !ownedState
  const states = activeStateNames()

  const [picked, setPicked] = useState(ownedState || '')
  const view = ownedState || picked

  const model = view ? getStateModel(view) : 1
  const tiers = model === 2 ? GOVERNANCE_TIERS.filter(g => g.level !== 4) : GOVERNANCE_TIERS
  const peopleAt = (level) => getUsers().filter(u =>
    u.status === 'active' && u.tier === level && (level === 4 ? true : u.scope === view),
  )
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-md bg-indigo-50 flex items-center justify-center"><Network size={16} className="text-indigo-600" /></div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              Escalation flow{view ? ` · ${view}` : ''}
              {view && (
                <span className={`text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 ${model === 2 ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200'}`}>
                  Model {model} · {model === 2 ? 'SPIU' : 'RBDA / FPMU'}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">{view ? `Who handles a ${view} grievance at each level as it climbs` : 'Pick a state to see who handles its grievances at each level'}</p>
          </div>
        </div>
        {isFederal && (
          <select value={picked} onChange={e => setPicked(e.target.value)} className="text-[12.5px] rounded-md border border-slate-200 bg-white text-slate-700 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/30">
            <option value="">Select a state…</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
      {!view ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
          <Network size={20} className="mx-auto text-slate-300 mb-2" />
          <p className="text-[12.5px] text-slate-500">Choose a state above to view its escalation chain.</p>
        </div>
      ) : (
      <div className="space-y-1.5">
        {tiers.map(g => {
          const members = peopleAt(g.level)
          return (
            <div key={g.level} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="shrink-0 h-6 w-6 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold flex items-center justify-center">{g.level}</span>
                <span className="text-[12.5px] font-medium text-slate-700 flex-1 min-w-0 truncate">{tierName(g.level, model)}</span>
                <span className="hidden sm:inline text-[11px] text-slate-400 truncate">Escalates to <span className="text-slate-300">→</span> {tierEscalatesTo(g.level, model)}</span>
                <span className="shrink-0 text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-md px-2 py-0.5">{g.timeline}</span>
              </div>
              <div className="mt-1.5 pl-9 flex flex-wrap items-center gap-1.5">
                {members.length ? members.map(u => (
                  <span key={u.id} className="text-[10.5px] font-medium text-indigo-700 bg-indigo-50 ring-1 ring-indigo-200 rounded-md px-2 py-0.5">
                    {u.name}{g.level === 4 ? ' · federal' : ''}
                  </span>
                )) : (
                  <span className="text-[10.5px] text-slate-400 italic">{g.level === 4 ? 'No federal handler assigned' : 'No one assigned in this state'}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      )}
      <p className="text-[10.5px] text-slate-400 mt-3">
        {model === 2
          ? 'Model 2 (State SPIU): the FPMU is not a mandated step — Level 3 is the top in-system level, and an unresolved case goes to independent appeal (Level 5, external).'
          : 'Model 1 (RBDA): each state runs Levels 1–3; Level 4 (FPMU) is federal and shared across all states. Beyond it is independent appeal (Level 5, external).'}
      </p>
    </Card>
  )
}

function MinistriesManager() {
  const [, tick] = useState(0)
  const [val, setVal] = useState('')
  const list = getMinistries()
  const add = () => {
    if (!val.trim()) return
    if (addMinistry(val)) { setVal(''); tick(n => n + 1); toast('Ministry / agency added') }
    else toast('That ministry is already listed', 'error')
  }
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-9 w-9 rounded-md bg-indigo-50 flex items-center justify-center"><Network size={16} className="text-indigo-600" /></div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Level 3 — State Sector Ministries &amp; Agencies</h3>
          <p className="text-xs text-slate-400">The ministries / agencies a Level 3 handler can be assigned to</p>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="text-[12.5px] text-slate-400 mb-3">No ministries added yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5 mb-3">
          {list.map(m => (
            <li key={m} className="inline-flex items-center gap-1.5 text-[12px] text-slate-700 bg-slate-100 rounded-md px-2.5 py-1">
              {m}
              <button onClick={() => { removeMinistry(m); tick(n => n + 1) }} className="text-slate-400 hover:text-rose-500" title="Remove"><X size={11} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="e.g. State Ministry of Water Resources, River Basin Authority…" className={`${inputCls} max-w-md`} />
        <button onClick={add} className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2.5 hover:bg-brand-800"><Plus size={14} /> Add</button>
      </div>
    </Card>
  )
}

function ReferralBodiesManager() {
  const [, tick] = useState(0)
  const [val, setVal] = useState('')
  const [type, setType] = useState(REFERRAL_TYPES[0])
  const states = activeStateNames()
  const [state, setState] = useState(states[0] || '')
  const [contact, setContact] = useState('')
  const list = getReferralBodies()
  const add = () => {
    if (!val.trim()) return
    if (!state) { toast('Pick the state this provider serves', 'error'); return }
    if (addReferralBody(val, { type, state, contact })) { setVal(''); setContact(''); tick(n => n + 1); toast('Referral provider added') }
    else toast('That provider is already listed for this state', 'error')
  }

  const byState = {}
  for (const b of list) { const k = b.state || 'Any state'; (byState[k] ||= []).push(b) }
  const groups = Object.keys(byState).sort()
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-9 w-9 rounded-md bg-violet-50 flex items-center justify-center"><Share2 size={16} className="text-violet-600" /></div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Referral Directory (SEA/SH &amp; GBV) — per state</h3>
          <p className="text-xs text-slate-400">Service providers a confidential case is referred to. The Refer picker shows the case's state first.</p>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="text-[12.5px] text-slate-400 mb-3">No referral providers added yet.</p>
      ) : (
        <div className="space-y-3 mb-3">
          {groups.map(g => (
            <div key={g}>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{g} <span className="text-slate-300">· {byState[g].length}</span></p>
              <ul className="space-y-1">
                {byState[g].map(b => (
                  <li key={`${b.name}·${b.state || ''}`} className="flex items-start justify-between gap-2 text-[12px] text-slate-700 bg-slate-50 rounded-md px-2.5 py-1.5">
                    <span className="min-w-0">
                      <span className="font-medium">{b.name}</span>
                      <span className="text-[10.5px] text-slate-400"> · {b.type}</span>
                      {b.contact && <span className="block text-[11px] text-violet-600">☎ {b.contact}</span>}
                    </span>
                    <button onClick={() => { removeReferralBody(b.name, b.state); tick(n => n + 1) }} className="text-slate-400 hover:text-rose-500 shrink-0" title="Remove"><X size={12} /></button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select value={state} onChange={e => setState(e.target.value)} className={inputCls}>
          <option value="">Select state…</option>
          {states.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
          {REFERRAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={val} onChange={e => setVal(e.target.value)} placeholder="Provider / facility name" className={inputCls} />
        <input value={contact} onChange={e => setContact(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Contact (phone / name)" className={inputCls} />
      </div>
      <button onClick={add} className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2.5 hover:bg-brand-800"><Plus size={14} /> Add provider</button>
    </Card>
  )
}

function ReferralAuthoritiesManager() {
  const [, tick] = useState(0)
  const [val, setVal] = useState('')
  const [type, setType] = useState(REFERRAL_AUTHORITY_TYPES[0])
  const list = getReferralAuthorities()
  const add = () => {
    if (!val.trim()) return
    if (addReferralAuthority(val, type)) { setVal(''); tick(n => n + 1); toast('Referral authority added') }
    else toast('That authority is already listed', 'error')
  }
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="h-9 w-9 rounded-md bg-amber-50 flex items-center justify-center"><Scale size={16} className="text-amber-600" /></div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Referral Authorities (Legacy &amp; out-of-scope)</h3>
          <p className="text-xs text-slate-400">Bodies a non-project or pre-SPIN grievance is documented and referred to (Framework §2.2.1)</p>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="text-[12.5px] text-slate-400 mb-3">No referral authorities added yet — add them so officers can only pick from this list.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5 mb-3">
          {list.map(a => (
            <li key={a.name} className="inline-flex items-center gap-1.5 text-[12px] text-slate-700 bg-slate-100 rounded-md px-2.5 py-1">
              <span className="font-medium">{a.name}</span>
              <span className="text-[10.5px] text-slate-400">· {a.type}</span>
              <button onClick={() => { removeReferralAuthority(a.name); tick(n => n + 1) }} className="text-slate-400 hover:text-rose-500" title="Remove"><X size={11} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="e.g. Customary Court Yola, District Head, State Land Bureau…" className={`${inputCls} max-w-xs`} />
        <select value={type} onChange={e => setType(e.target.value)} className={`${inputCls} max-w-[16rem]`}>
          {REFERRAL_AUTHORITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={add} className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2.5 hover:bg-brand-800"><Plus size={14} /> Add</button>
      </div>
    </Card>
  )
}

function JourneyTab() {
  const [days, setDays] = useState(getTierDays)
  const [appeal, setAppeal] = useState(getAppealDays)
  const saveDays = () => { setTierDays(days); setAppealDays(appeal); toast('Tier timelines & appeal window saved') }

  return (
    <div className="space-y-4">

      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-9 w-9 rounded-md bg-emerald-50 flex items-center justify-center"><Route size={16} className="text-emerald-700" /></div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Case lifecycle</h3>
            <p className="text-xs text-slate-400">Every grievance moves through these stages (Framework §2.0)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-stretch gap-1.5">
          {JOURNEY_STAGES.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <div className="rounded-md border border-slate-200 bg-white px-3 py-2 min-w-[112px]">
                <p className="text-[10px] font-bold text-slate-300">{String(i + 1).padStart(2, '0')}</p>
                <p className="text-[12.5px] font-semibold text-slate-700 leading-tight">{s.label}</p>
                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{s.note}</p>
              </div>
              {i < JOURNEY_STAGES.length - 1 && <ArrowRight size={14} className="text-slate-300 shrink-0" />}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-3">Appeals (within 14 days) and unresolved cases re-enter the flow by escalating up a tier.</p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md bg-indigo-50 flex items-center justify-center"><ChevronsUp size={16} className="text-indigo-600" /></div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Escalation ladder &amp; timelines</h3>
              <p className="text-xs text-slate-400">A case auto-escalates to the next level if not resolved within its window</p>
            </div>
          </div>
          <button onClick={saveDays} className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2 hover:bg-brand-800"><Check size={14} /> Save</button>
        </div>
        <div className="space-y-1.5">
          {GOVERNANCE_TIERS.map(g => (
            <div key={g.level} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span className="shrink-0 h-6 w-6 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold flex items-center justify-center">{g.level}</span>
              <span className="text-[12.5px] font-medium text-slate-700 flex-1 min-w-0 truncate">{g.name}</span>
              <span className="hidden sm:inline text-[11px] text-slate-400 truncate">Escalates to <span className="text-slate-300">→</span> {g.escalatesTo}</span>
              {g.level < 5 ? (
                <span className="shrink-0 flex items-center gap-1.5">
                  <input
                    type="number" min="1"
                    value={days[g.level] ?? ''}
                    onChange={(e) => setDays(d => ({ ...d, [g.level]: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-16 text-[13px] text-right rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  />
                  <span className="text-[11px] text-slate-400 w-8">days</span>
                </span>
              ) : (
                <span className="shrink-0 text-[11px] text-slate-400">per procedures</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
          <span className="shrink-0 h-6 w-6 rounded-md bg-amber-50 text-amber-600 text-[11px] font-bold flex items-center justify-center"><Scale size={13} /></span>
          <span className="text-[12.5px] font-medium text-slate-700 flex-1 min-w-0">Appeal window <span className="text-[11px] font-normal text-slate-400">— a resolved case can only be closed after this many days, during which the complainant may appeal</span></span>
          <span className="shrink-0 flex items-center gap-1.5">
            <input type="number" min="0" value={appeal}
              onChange={(e) => setAppeal(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 text-[13px] text-right rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            <span className="text-[11px] text-slate-400 w-8">days</span>
          </span>
        </div>
      </Card>

      <EscalationFlow />

      <MinistriesManager />

      <ReferralBodiesManager />

      <ReferralAuthoritiesManager />

      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-9 w-9 rounded-md bg-amber-50 flex items-center justify-center"><Tags size={16} className="text-amber-600" /></div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Where a case enters the ladder</h3>
            <p className="text-xs text-slate-400">Determined by who raises it, not the category</p>
          </div>
        </div>
        <p className="text-[12.5px] text-slate-600 leading-relaxed ml-12">
          Anyone with case access can raise a grievance, and it enters at the level of whoever raises it:
        </p>
        <ul className="ml-12 mt-2 space-y-1 text-[12.5px] text-slate-600">
          <li>• Community / field officer → <span className="font-medium text-slate-700">Level 1</span></li>
          <li>• State PIU officer (SPIU) → <span className="font-medium text-slate-700">Level 2</span></li>
          <li>• State ministries handler → <span className="font-medium text-slate-700">Level 3</span></li>
          <li>• FPMU → <span className="font-medium text-slate-700">Level 4</span></li>
          <li>• Self-service / external intake (web, WhatsApp, phone) → <span className="font-medium text-slate-700">Level 2</span> (State PIU — the case centre)</li>
        </ul>
        <p className="text-[11px] text-slate-400 mt-3 ml-12">Sensitive (SEA/SH) grievances always go through the dedicated confidential pathway.</p>
      </Card>
    </div>
  )
}

function ProtectionTab() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-2">
          <ShieldCheck size={16} className="text-violet-600" />
          <h3 className="text-sm font-semibold text-slate-800">NDPR Compliance</h3>
        </div>
        <ul className="text-xs text-slate-500 space-y-2 leading-relaxed list-disc ml-4">
          <li>Complainant data is processed under the Nigeria Data Protection Act with explicit consent capture at intake.</li>
          <li>Data minimisation: only fields required for safe referral and resolution are collected.</li>
          <li>TLS in transit, encryption at rest, least-privilege database roles.</li>
        </ul>
      </Card>
      <Card className="p-5">
        <div className="flex items-center gap-2.5 mb-2">
          <ShieldCheck size={16} className="text-rose-500" />
          <h3 className="text-sm font-semibold text-slate-800">Restricted (SEA/SH) Pathway</h3>
        </div>
        <ul className="text-xs text-slate-500 space-y-2 leading-relaxed list-disc ml-4">
          <li>Sensitive cases never appear in lists, dashboards, exports or reports — aggregate counts only.</li>
          <li>Access restricted to designated focal persons; every read is written to an immutable audit log.</li>
          <li>Sensitive columns are encrypted at rest with keys held outside the database.</li>
          <li>Workflow and data fields signed off by the project safeguarding lead.</li>
        </ul>
      </Card>
    </div>
  )
}

const SETTINGS_GROUPS = [
  { label: 'Overview', ids: ['guide'] },
  { label: 'People & Access', ids: ['users', 'coverage'] },
  { label: 'Grievance Setup', ids: ['taxonomy', 'journey'] },
  { label: 'System', ids: ['fieldapp', 'intelligence', 'protection'] },
]
const tabById = (id) => TABS.find(t => t.id === id)

export default function Settings() {
  const [tab, setTab] = useState('guide')
  const active = tabById(tab)
  const me = getViewAs()
  const ownedState = scopeStatesList(me.scope)[0] || null
  const isFederal = !ownedState

  return (
    <div className="p-3 md:p-5">
      <div className="fade-up mb-4 md:mb-5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Settings</h1>
          <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ring-1 ${isFederal ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : 'bg-sky-50 text-sky-700 ring-sky-200'}`}>
            {isFederal ? 'Federal · all states' : `${ownedState} state`}
          </span>
        </div>
        <p className="text-[12.5px] text-slate-500 mt-0.5">
          {isFederal ? 'Federal configuration — covers every state.' : `State configuration — you own and manage ${ownedState} only.`}
        </p>
      </div>

      <div className="grid grid-cols-12 gap-3 md:gap-5 fade-up">

        <aside className="hidden md:block col-span-12 md:col-span-3 lg:col-span-3">
          <nav className="md:sticky md:top-4 space-y-4">
            {SETTINGS_GROUPS.map(g => (
              <div key={g.label}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-1.5">{g.label}</p>
                <div className="space-y-0.5">
                  {g.ids.map(id => {
                    const t = tabById(id)
                    const on = tab === id
                    return (
                      <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`w-full flex items-center gap-2.5 text-[13px] font-medium rounded-lg px-3 py-2 transition-colors ${
                          on ? 'bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                      >
                        <t.icon size={15} className={on ? 'text-brand-700' : 'text-slate-400'} /> {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="md:hidden col-span-12 flex items-center gap-1.5 overflow-x-auto pb-1 -mb-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 text-[12.5px] font-semibold rounded-full px-3 py-2 ring-1 ring-inset shrink-0 whitespace-nowrap ${
                tab === t.id ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-600 ring-slate-200'
              }`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        <div className="col-span-12 md:col-span-9 min-w-0">
          <div className="hidden md:flex items-center gap-2 mb-3">
            {active && <active.icon size={16} className="text-brand-700" />}
            <h2 className="text-[15px] font-semibold text-slate-800">{active?.label}</h2>
          </div>
          <div key={tab} className="fade-up">
            {tab === 'guide' && <GuideTab />}
            {tab === 'users' && <UsersTab />}
            {tab === 'coverage' && <CoverageTab />}
            {tab === 'fieldapp' && <FieldAppTab />}
            {tab === 'intelligence' && <IntelligenceTab />}
            {tab === 'taxonomy' && <TaxonomyTab />}
            {tab === 'journey' && <JourneyTab />}
            {tab === 'protection' && <ProtectionTab />}
          </div>
        </div>
      </div>
    </div>
  )
}
