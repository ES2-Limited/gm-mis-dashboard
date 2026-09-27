import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Send, RefreshCw, FileText, TrendingUp, MapPinned, Lightbulb,
  Lock, ScrollText, Database, ChevronRight,
} from 'lucide-react'
import { Card } from '../components/ui'
import { isConfigured, askInsights, BRIEFING_PROMPT } from '../lib/intelligence'
import { STATES, TODAY, fmtDate, getViewAs } from '../data/mock'
import { fetchCaseStats } from '../data/casesApi'

function Md({ text }) {
  const renderInline = (s) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>
        : part
    )
  const blocks = []
  let list = null
  text.split('\n').forEach((line, i) => {
    const t = line.trim()
    const m = t.match(/^([-*•]|\d+[.)])\s+(.*)/)
    if (m) {
      if (!list) { list = []; blocks.push(list) }
      list.push(<li key={i} className="ml-4 list-disc">{renderInline(m[2])}</li>)
    } else {
      list = null
      if (t) blocks.push(<p key={i}>{renderInline(t.replace(/^#+\s*/, ''))}</p>)
    }
  })
  return (
    <div className="space-y-2 text-[13px] text-slate-600 leading-relaxed">
      {blocks.map((b, i) => Array.isArray(b) ? <ul key={`b${i}`} className="space-y-1">{b}</ul> : <span key={`b${i}`}>{b}</span>)}
    </div>
  )
}

const SUGGESTIONS = [
  { icon: TrendingUp, q: 'Which grievance categories are growing fastest and what might be driving them?' },
  { icon: MapPinned, q: 'Which states need the most attention right now, and why?' },
  { icon: Lightbulb, q: 'Where are SLA breaches concentrated and what should we do about them?' },
  { icon: FileText, q: 'Summarise this month’s caseload compared to last month.' },
]

function NotConfigured() {
  return (
    <Card className="p-10 text-center max-w-xl mx-auto mt-10">
      <div className="h-12 w-12 rounded-md bg-brand-50 flex items-center justify-center mx-auto mb-4">
        <Lock size={20} className="text-brand-700" />
      </div>
      <h2 className="text-base font-bold text-slate-900">Insights is not activated yet</h2>
      <p className="text-sm text-slate-500 mt-2 leading-relaxed">
        Briefings and caseload analysis become available once the Insights engine is
        connected by an administrator.
      </p>
      <Link
        to="/settings"
        className="inline-flex mt-5 items-center gap-1.5 text-sm font-semibold text-white bg-brand-700 rounded-md px-4 py-2 hover:bg-brand-800"
      >
        Configure in Settings
      </Link>
    </Card>
  )
}

export default function Insights() {
  const configured = isConfigured()
  const [briefing, setBriefing] = useState('')
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, asking])

  const [snapRows, setSnapRows] = useState(null)
  useEffect(() => {
    let alive = true
    fetchCaseStats()
      .then(s => {
        if (!alive) return
        const top = (obj) => {
          const e = Object.entries(obj || {}).sort((a, b) => b[1] - a[1])[0]
          return e ? `${e[0]} (${e[1]})` : '—'
        }
        setSnapRows([
          ['Cases on register', s.total],
          ['Open', s.open],
          ['Past SLA', s.breached],
          ['Resolution rate', `${s.resolutionRate}%`],
          ['Avg. resolution', `${s.avgResolutionDays} days`],
          ['Highest volume', top(s.byState)],
          ['Top category', (Object.entries(s.byCategory || {}).sort((a, b) => b[1] - a[1])[0] || ['—'])[0]],
        ])
      })
      .catch(() => alive && setSnapRows([]))
    return () => { alive = false }
  }, [])

  if (!configured) return <div className="p-3 md:p-5"><NotConfigured /></div>

  const friendlyError = (e) => {
    if (e.message === 'INVALID_KEY') return 'The access key was rejected. Please update it in Settings.'
    if (e.message === 'NOT_CONFIGURED') return 'Insights is not configured. Add an access key in Settings.'
    return 'The Insights service could not be reached. Check your connection and try again.'
  }

  const generateBriefing = async () => {
    setBriefingLoading(true); setError('')
    try { setBriefing(await askInsights(BRIEFING_PROMPT, [], getViewAs().scope)) }
    catch (e) { setError(friendlyError(e)) }
    finally { setBriefingLoading(false) }
  }

  const ask = async (q) => {
    const question = (q ?? input).trim()
    if (!question || asking) return
    setInput(''); setError('')
    setMessages(m => [...m, { role: 'user', content: question }])
    setAsking(true)
    try {
      const history = messages.slice(-6)
      const answer = await askInsights(question, history, getViewAs().scope)
      setMessages(m => [...m, { role: 'assistant', content: answer }])
    } catch (e) {
      setError(friendlyError(e))
      setMessages(m => m.slice(0, -1))
      setInput(question)
    } finally { setAsking(false) }
  }

  return (
    <div className="p-3 md:p-5 xl:h-full">
      <div className="grid grid-cols-12 gap-3 md:gap-4 xl:h-full min-h-0">

        <div className="col-span-12 xl:col-span-4 flex flex-col gap-4 min-h-0 overflow-y-auto pr-0.5">
          <Card className="shrink-0">
            <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
              <Database size={14} className="text-slate-400" />
              <h3 className="text-[13px] font-semibold text-slate-800">Register Snapshot</h3>
              <span className="ml-auto text-[10.5px] text-slate-400">{fmtDate(TODAY)} · {STATES.length} states</span>
            </div>
            <dl className="px-5 py-2">
              {!snapRows && [...Array(7)].map((_, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <span className="h-2.5 w-28 rounded-full bg-slate-100 animate-pulse" />
                  <span className="h-2.5 w-10 rounded-full bg-slate-100 animate-pulse" />
                </div>
              ))}
              {snapRows?.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <dt className="text-[12px] text-slate-500">{k}</dt>
                  <dd className="text-[12.5px] font-semibold text-slate-800 tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="flex-1 min-h-0 flex flex-col">
            <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2 shrink-0">
              <ScrollText size={14} className="text-slate-400" />
              <h3 className="text-[13px] font-semibold text-slate-800">Management Briefing</h3>
              <button
                onClick={generateBriefing}
                disabled={briefingLoading}
                className="ml-auto flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-700 bg-brand-50 rounded-lg px-2.5 py-1.5 hover:bg-brand-100 disabled:opacity-50"
              >
                <RefreshCw size={12} className={briefingLoading ? 'animate-spin' : ''} />
                {briefing ? 'Refresh' : 'Generate'}
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto">
              {briefingLoading && !briefing && (
                <div className="space-y-2.5">
                  {[92, 100, 84, 96, 70, 88, 60].map((w, i) => (
                    <div key={i} className="h-3 rounded-full bg-slate-100 animate-pulse" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}
              {briefing && <Md text={briefing} />}
              {!briefing && !briefingLoading && (
                <div className="text-[12.5px] text-slate-400 leading-relaxed">
                  <p>No briefing generated for {fmtDate(TODAY)} yet.</p>
                  <p className="mt-1.5">Covers caseload health, states needing attention, category patterns and recommended actions.</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card className="col-span-12 xl:col-span-8 flex flex-col min-h-0">
          <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-end justify-between gap-3 shrink-0">
            <div>
              <h3 className="text-[13px] font-semibold text-slate-800">Caseload Analysis</h3>
              <p className="text-[11.5px] text-slate-400">Grounded in the live register · restricted cases excluded · figures verifiable in Cases</p>
            </div>
            <Link to="/reports" className="text-[11.5px] font-medium text-slate-400 hover:text-brand-700 whitespace-nowrap">
              Recurring need? Save it as a report →
            </Link>
          </div>

          <div className="h-[55vh] xl:h-auto xl:flex-1 overflow-y-auto px-5 py-4 min-h-0">
            {messages.length === 0 && !asking && (
              <div className="max-w-xl">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Start an analysis</p>
                <div className="divide-y divide-slate-100">
                  {SUGGESTIONS.map(({ icon: Icon, q }) => (
                    <button
                      key={q}
                      onClick={() => ask(q)}
                      className="w-full flex items-center gap-3 py-3 text-left text-[13px] text-slate-600 hover:text-slate-900 group"
                    >
                      <Icon size={15} className="shrink-0 text-slate-300 group-hover:text-brand-600" />
                      <span className="flex-1">{q}</span>
                      <ChevronRight size={14} className="text-slate-200 group-hover:text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-5">
              {messages.map((m, i) => (
                m.role === 'user' ? (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 h-6 w-6 rounded-md bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0">FN</span>
                    <p className="text-[13px] font-medium text-slate-800 pt-0.5">{m.content}</p>
                  </div>
                ) : (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 h-6 w-6 rounded-md bg-brand-700 text-white text-[9px] font-bold flex items-center justify-center shrink-0">GM</span>
                    <div className="flex-1 border-l-2 border-slate-100 pl-4 -ml-px">
                      <Md text={m.content} />
                    </div>
                  </div>
                )
              ))}
              {asking && (
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 h-6 w-6 rounded-md bg-brand-700 text-white text-[9px] font-bold flex items-center justify-center shrink-0">GM</span>
                  <div className="flex gap-1.5 pt-2">
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          {error && (
            <div className="mx-5 mb-2 text-[12px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 shrink-0">{error}</div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); ask() }}
            className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about volumes, states, categories, SLAs…"
              className="flex-1 text-[13px] rounded-md border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={asking || !input.trim()}
              className="h-10 w-10 rounded-md bg-brand-700 text-white flex items-center justify-center hover:bg-brand-800 disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </form>
        </Card>
      </div>
    </div>
  )
}
