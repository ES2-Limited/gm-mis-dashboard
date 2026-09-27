import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info }
const TONES = {
  success: 'text-emerald-600',
  error: 'text-rose-600',
  info: 'text-sky-600',
}

export default function Toasts() {
  const [items, setItems] = useState([])

  useEffect(() => {
    const onToast = (e) => {
      const item = e.detail
      setItems(prev => [...prev, item])
      setTimeout(() => setItems(prev => prev.filter(t => t.id !== item.id)), 3500)
    }
    window.addEventListener('app:toast', onToast)
    return () => window.removeEventListener('app:toast', onToast)
  }, [])

  return (
    <div className="fixed bottom-5 right-5 z-[3000] space-y-2 pointer-events-none">
      {items.map(t => {
        const Icon = ICONS[t.type] || Info
        return (
          <div
            key={t.id}
            className="fade-up flex items-center gap-2.5 bg-white border border-slate-200 shadow-lg shadow-slate-900/5 rounded-md px-4 py-3 text-[13px] font-medium text-slate-700 pointer-events-auto"
          >
            <Icon size={16} className={TONES[t.type] || TONES.info} />
            {t.message}
          </div>
        )
      })}
    </div>
  )
}
