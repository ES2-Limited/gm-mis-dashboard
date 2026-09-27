import { useEffect, useState } from 'react'
import { Plug, KeyRound, Plus, Copy, Check, Loader2, AlertTriangle, Terminal } from 'lucide-react'
import { fetchIntegrationKeys, createIntegrationKey, revokeIntegrationKey, API_BASE } from '../data/integrationApi'
import { fetchTaxonomy } from '../data/taxonomyApi'
import { getAuth } from '../lib/auth'
import { currentPermissions } from '../lib/rbac'
import { logEvent } from '../data/audit'
import { toast } from '../lib/toast'

const fmt = (d) => (d ? d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Never')

const CURL = `curl -X POST ${API_BASE}/integration/cases \\
  -H "x-api-key: YOUR_CHANNEL_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "category": "Land Acquisition and Resettlement Grievances",
    "subcategory": "Compensation",
    "state": "Adamawa",
    "lga": "Demsa",
    "description": "Compensation not paid for acquired farmland",
    "priority": "high",
    "anonymous": false,
    "complainant": "Musa Ibrahim",
    "phone": "08030000000"
  }'`

function CodeBox({ code }) {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <div className="relative">
      <pre className="bg-slate-900 text-slate-100 text-[11.5px] leading-relaxed rounded-lg p-3.5 overflow-x-auto whitespace-pre">{code}</pre>
      <button onClick={copy} className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[10.5px] font-semibold text-slate-300 hover:text-white bg-slate-800 rounded px-2 py-1">
        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
      </button>
    </div>
  )
}

export default function DataSharing() {
  const me = getAuth() || {}
  const canManage = me.isSuperAdmin || currentPermissions(me).includes('sharing')

  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [fresh, setFresh] = useState(null)
  const [copied, setCopied] = useState(false)
  const [tax, setTax] = useState([])

  const load = () => fetchIntegrationKeys().then(setKeys).catch(() => {}).finally(() => setLoading(false))
  useEffect(() => { load(); fetchTaxonomy().then(setTax).catch(() => {}) }, [])

  const byDomain = ['Social', 'Environmental', 'Other'].map((d) => [d, tax.filter((c) => (c.domain || 'Other') === d)]).filter(([, cs]) => cs.length)

  const generate = async () => {
    if (!label.trim()) { toast('Enter a channel name', 'error'); return }
    setCreating(true)
    try {
      const res = await createIntegrationKey(label.trim())
      setFresh(res)
      setLabel('')
      logEvent('export_report', { target: `Integration key — ${res.label}` })
      load()
    } catch (e) { toast(e.message || 'Could not create key', 'error') }
    finally { setCreating(false) }
  }

  const revoke = async (id) => {
    try { await revokeIntegrationKey(id); toast('Key revoked'); load() }
    catch (e) { toast(e.message || 'Could not revoke', 'error') }
  }

  const copyFresh = () => { navigator.clipboard?.writeText(fresh.key); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  return (
    <div className="p-3 md:p-5 space-y-3 md:space-y-4">
      <div className="fade-up">
        <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Plug size={18} className="text-brand-600" /> Self-Service Integration
        </h1>
        <p className="text-[12.5px] text-slate-500 mt-0.5">
          Issue an API key to a collection channel (website, USSD, WhatsApp bot…) so it can submit grievances directly into SPIN.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden fade-up">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><KeyRound size={15} className="text-brand-700" /> Channel Access Keys</h3>
            <p className="text-[11.5px] text-slate-400 mt-0.5">A key is shown once. Store it safely — it can’t be retrieved again.</p>
          </div>

          {canManage && (
            <div className="p-4 border-b border-slate-100">
              {fresh ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5">
                  <p className="text-[12px] font-semibold text-amber-800 flex items-center gap-1.5"><AlertTriangle size={13} /> Copy your key for “{fresh.label}” now — you won’t see it again</p>
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-white ring-1 ring-amber-200 px-3 py-2.5">
                    <code className="text-[12.5px] font-mono text-slate-800 break-all">{fresh.key}</code>
                    <button onClick={copyFresh} className="shrink-0 flex items-center gap-1 text-[11.5px] font-semibold text-brand-700 hover:text-brand-800">{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}</button>
                  </div>
                  <button onClick={() => setFresh(null)} className="mt-3 text-[12px] font-semibold text-slate-500 hover:text-slate-800">I’ve saved it — done</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && generate()}
                    placeholder="Channel name, e.g. “Website self-service”"
                    className="flex-1 text-[13px] rounded-md border border-slate-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                  <button onClick={generate} disabled={creating} className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2.5 hover:bg-brand-800 disabled:opacity-50">
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Generate Key
                  </button>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="p-6 flex items-center justify-center text-slate-400 text-[12.5px] gap-2"><Loader2 size={15} className="animate-spin" /> Loading…</div>
          ) : keys.length === 0 ? (
            <p className="p-6 text-center text-[12.5px] text-slate-400">No channel keys yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {keys.map((k) => (
                <div key={k.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">{k.label} {k.revoked && <span className="text-[10px] font-bold uppercase text-rose-600 bg-rose-50 rounded px-1.5 py-0.5 ml-1">Revoked</span>}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{k.prefix}…… · {k.requests} req · last used {fmt(k.lastUsedAt)}</p>
                  </div>
                  {canManage && !k.revoked && <button onClick={() => revoke(k.id)} className="shrink-0 text-[11.5px] font-medium text-rose-600 hover:text-rose-700">Revoke</button>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden fade-up">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2"><Terminal size={15} className="text-brand-700" /> Create a case (Integration API)</h3>
            <p className="text-[11.5px] text-slate-400 mt-0.5">A channel submits grievances here. Authenticate with the <code className="text-slate-600">x-api-key</code> header.</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-[12.5px]">
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded px-1.5 py-0.5">POST</span>
              <code className="text-slate-700 break-all">{API_BASE}/integration/cases</code>
            </div>
            <CodeBox code={CURL} />
            <div className="text-[12px] text-slate-500 leading-relaxed">
              <p className="font-semibold text-slate-700 mb-1">Fields</p>
              <p><span className="font-medium text-slate-700">Required:</span> category, state, description.</p>
              <p><span className="font-medium text-slate-700">Optional:</span> subcategory, lga, community, priority (low/medium/high), anonymous, complainant, phone, email, lat, lng, narrative.</p>
              <p className="mt-2"><code className="text-slate-600">channel</code> is set to <code className="text-slate-600">self_service</code> automatically, the domain is derived from the category, and the case is routed straight to <span className="font-medium text-slate-700">Level 2 (State PIU)</span> — who are emailed the new case.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12px] pt-1 border-t border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wide text-sky-700 bg-sky-50 ring-1 ring-sky-200 rounded px-1.5 py-0.5">GET</span>
              <code className="text-slate-600 break-all">{API_BASE}/integration/schema</code>
              <span className="text-slate-400">— valid states, categories & sub-groups</span>
            </div>
          </div>
        </div>
      </div>

      {byDomain.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden fade-up">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Categories, domains &amp; sub-groups</h3>
            <p className="text-[11.5px] text-slate-400 mt-0.5">Send <code className="text-slate-600">category</code> (its domain is derived) and optionally a <code className="text-slate-600">subcategory</code> from that category’s sub-groups.</p>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {byDomain.map(([domain, cats]) => (
              <div key={domain}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700 mb-2">{domain}</p>
                <div className="space-y-2.5">
                  {cats.map((c) => (
                    <div key={c.name}>
                      <p className="text-[12.5px] font-semibold text-slate-800">{c.name}</p>
                      {(c.subgroups || []).length > 0 && (
                        <p className="text-[11px] text-slate-400 leading-relaxed">{(c.subgroups || []).join(' · ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
