import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, Eye, PhoneForwarded, Loader2 } from 'lucide-react'
import { Card } from '../components/ui'
import { getViewAs, fmtDate } from '../data/mock'
import { statusLabel } from '../data/caseflow'
import { fetchRestrictedCases } from '../data/casesApi'
import OtpGate from '../components/OtpGate'

const STATUS_TONES = {
  referred: 'bg-violet-50 text-violet-700 ring-violet-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-500 ring-slate-200',
}
const toneFor = (s) => STATUS_TONES[s] || 'bg-amber-50 text-amber-700 ring-amber-200'

function lastReferral(c) {
  const r = (c.referrals || [])
  if (!r.length) return '—'
  const last = r[r.length - 1]
  return `${last.body}${last.bodyType ? ` (${last.bodyType})` : ''}`
}

export default function Restricted() {
  const view = getViewAs()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRestrictedCases().then(setCases).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <OtpGate
      purpose="restricted"
      title="Restricted SEA/SH register"
      blurb="This survivor-centred register holds sensitive safeguarding information. You have permission to enter, but you must accept the liability disclaimer and verify a one-time code emailed to you before any record is shown."
    >
    <div className="p-3 md:p-5 space-y-3 md:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 fade-up">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert size={18} className="text-violet-600" /> Restricted Cases
          </h1>
          <p className="text-[12.5px] text-slate-500 mt-0.5">SEA/SH &amp; GBV · survivor-centred · referral tracking only</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 bg-violet-50 ring-1 ring-violet-200 rounded-full px-3 py-1.5">
          <Eye size={12} /> Every view of this page is written to the audit log — {view.name}
        </span>
      </div>

      <Card className="p-4 border-l-4 border-l-violet-500 fade-up">
        <p className="text-xs text-slate-500 leading-relaxed">
          This register records <span className="font-semibold text-slate-700">that a case exists and where it has been referred</span> — it is not an
          investigation file. Narratives, identities and details are shown only inside the case file, behind a one-time code. These cases
          never appear in the open register, dashboards, exports or reports.
        </p>
      </Card>

      <Card className="overflow-hidden fade-up">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50/70 border-y border-slate-200">
              <th className="px-5 py-2.5 font-semibold">Case</th>
              <th className="px-3 py-2.5 font-semibold">Received</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Referred to</th>
              <th className="px-5 py-2.5 font-semibold text-right">Last update</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400"><Loader2 size={16} className="animate-spin inline mr-2" />Loading…</td></tr>
            ) : cases.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-[12.5px] text-slate-400">No restricted cases on the register.</td></tr>
            ) : cases.map(c => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-xs font-bold">
                  <Link to={`/cases/${c.id}`} className="text-violet-700 hover:underline">{c.code}</Link>
                </td>
                <td className="px-3 py-3 text-xs text-slate-500">{fmtDate(c.createdAt)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset ${toneFor(c.status)}`}>{statusLabel(c.status)}</span>
                </td>
                <td className="px-3 py-3 text-xs text-slate-600 max-w-md whitespace-normal min-w-[200px]">{lastReferral(c)}</td>
                <td className="px-5 py-3 text-right text-xs text-slate-400">{fmtDate(c.updatedAt ? new Date(c.updatedAt) : c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
          <PhoneForwarded size={12} className="text-violet-500" />
          Referral bodies are profiled in Settings → Case Journey. Open a case to record a referral.
        </div>
      </Card>
    </div>
    </OtpGate>
  )
}
