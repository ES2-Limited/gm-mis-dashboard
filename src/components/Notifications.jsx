import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, AlertTriangle, ChevronsUp, UserPlus, Inbox } from 'lucide-react'
import { apiGet, apiPost, apiPatch } from '../lib/api'

const TONE = {
  sla_breach: { icon: AlertTriangle, cls: 'text-rose-500 bg-rose-50' },
  escalation: { icon: ChevronsUp, cls: 'text-amber-600 bg-amber-50' },
  assigned: { icon: UserPlus, cls: 'text-indigo-600 bg-indigo-50' },
}
const toneFor = (type) => TONE[type] || { icon: Inbox, cls: 'text-emerald-600 bg-emerald-50' }
const fmt = (iso) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Notifications() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  const refreshCount = () => apiGet('/notifications/unread-count').then(r => setUnread(r?.count || 0)).catch(() => {})

  useEffect(() => { refreshCount(); const iv = setInterval(refreshCount, 60000); return () => clearInterval(iv) }, [])
  useEffect(() => { if (open) apiGet('/notifications').then(setItems).catch(() => {}) }, [open])
  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const markAll = async () => {
    try { await apiPost('/notifications/read-all') } catch { /* ignore */ }
    setItems(items.map(i => ({ ...i, read: true })))
    setUnread(0)
  }

  const openItem = (n) => {
    setOpen(false)
    if (!n.read) {
      apiPatch(`/notifications/${n.id}/read`).catch(() => {})
      setUnread(u => Math.max(0, u - 1))
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative h-9 w-9 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 rounded-full bg-rose-500 ring-2 ring-white text-white text-[8.5px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] bg-white rounded-md border border-slate-200 shadow-xl shadow-slate-900/10 overflow-hidden fade-up z-[1500]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-[13px] font-semibold text-slate-800">Notifications</h3>
            {items.length > 0 && (
              <button onClick={markAll} className="text-[11px] font-semibold text-brand-700 hover:text-brand-800">Mark all read</button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.map(n => {
              const t = toneFor(n.type)
              const Inner = (
                <>
                  <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${t.cls}`}><t.icon size={14} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-slate-800 truncate">{n.title}</span>
                    <span className="block text-[11.5px] text-slate-400 truncate">{n.body}</span>
                    <span className="block text-[10px] text-slate-300 mt-0.5">{fmt(n.createdAt)}</span>
                  </span>
                  {!n.read && <span className="ml-auto mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />}
                </>
              )
              const cls = `flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50/70 ${n.read ? 'opacity-55' : ''}`
              return n.caseId
                ? <Link key={n.id} to={`/cases/${n.caseId}`} onClick={() => openItem(n)} className={cls}>{Inner}</Link>
                : <button key={n.id} onClick={() => openItem(n)} className={`w-full text-left ${cls}`}>{Inner}</button>
            })}
            {items.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-400">All clear — nothing needs attention.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
