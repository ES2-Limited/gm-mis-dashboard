import { useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, PenLine, Trash2, RefreshCw, FileBarChart2 } from 'lucide-react'
import ReportView, { ParamBar } from '../components/ReportView'
import { getReport, runReport, defaultValues, deleteReport } from '../lib/reportEngine'
import { refineNarrative, isConfigured } from '../lib/intelligence'

export default function ReportRunner() {
  const { id } = useParams()
  const navigate = useNavigate()
  const entry = useMemo(() => getReport(id), [id])
  const [values, setValues] = useState(() => (entry ? defaultValues(entry.spec) : {}))
  const [refined, setRefined] = useState(null)
  const [refining, setRefining] = useState(false)

  if (!entry) {
    return (
      <div className="p-5 text-center py-20 text-slate-400 text-sm">
        Report not found. <Link to="/reports" className="text-brand-700 font-semibold">Back to library</Link>
      </div>
    )
  }

  const result = runReport(entry.spec, values)

  const display = refined
    ? { ...result, sections: result.sections.map(s => (s.type === 'narrative' ? { ...s, text: refined } : s)) }
    : result

  const onChange = (pid, v) => {
    setValues(prev => ({ ...prev, [pid]: v }))
    setRefined(null)
  }

  const refine = async () => {
    setRefining(true)
    try { setRefined(await refineNarrative(entry.spec.name, result.placeholders)) }
    catch { /* keep template narrative */ }
    finally { setRefining(false) }
  }

  const hasNarrative = entry.spec.sections.some(s => s.type === 'narrative')

  return (
    <div className="p-3 md:p-5 space-y-3 md:space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-3 fade-up">
        <div className="flex items-center gap-3">
          <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/reports'))} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-1.5">
            <ArrowLeft size={14} /> Back
          </button>
          <span className="h-4 w-px bg-slate-200" />
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileBarChart2 size={17} className="text-emerald-600" />
              {entry.spec.name}
            </h1>
            <p className="text-[12px] text-slate-500">{entry.spec.description} · {result.matched} cases in view</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasNarrative && isConfigured() && (
            <button
              onClick={refine}
              disabled={refining}
              className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-md px-3.5 py-2 hover:bg-slate-50 disabled:opacity-50"
            >
              {refining ? <RefreshCw size={14} className="animate-spin" /> : <PenLine size={14} className="text-emerald-600" />}
              Refine summary
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-3.5 py-2 hover:bg-brand-800"
          >
            <Printer size={14} /> Export / Print
          </button>
          {entry.source === 'generated' && (
            <button
              onClick={() => { deleteReport(entry.id); navigate('/reports') }}
              title="Delete definition"
              className="h-9 w-9 rounded-md border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white border border-slate-200/80 px-5 py-3 fade-up">
        <ParamBar spec={entry.spec} values={values} onChange={onChange} />
        <span className="text-[10.5px] text-slate-400">
          Definition saved {entry.createdAt}{entry.prompt ? ` · authored from: “${entry.prompt.slice(0, 60)}${entry.prompt.length > 60 ? '…' : ''}”` : ''}
        </span>
      </div>

      <div className="fade-up">
        <ReportView result={display} />
      </div>
    </div>
  )
}
