import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ShieldX, ArrowLeft } from 'lucide-react'
import { MODULES } from '../data/users'
import { logEvent } from '../data/audit'

export default function AccessDenied({ module }) {
  const label = MODULES.find(m => m.key === module)?.label || module

  useEffect(() => {
    logEvent('access_denied', { target: `/${module}`, detail: `No permission for ${label}` })
  }, [module, label])

  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md text-center bg-white rounded-md border border-slate-200 p-8 shadow-sm">
        <div className="h-12 w-12 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldX size={22} />
        </div>
        <h2 className="text-base font-bold text-slate-800 mt-4">Access restricted</h2>
        <p className="text-[13px] text-slate-500 mt-1.5">
          You don&rsquo;t have permission to view <span className="font-semibold text-slate-700">{label}</span>.
          Contact your FPMU administrator if you need this access.
        </p>
        <Link to="/" className="inline-flex items-center gap-1.5 mt-5 text-[13px] font-semibold text-white bg-brand-700 rounded-md px-4 py-2 hover:bg-brand-800">
          <ArrowLeft size={14} /> Back to Overview
        </Link>
      </div>
    </div>
  )
}
