import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const btn = 'inline-flex items-center gap-1 text-[12px] font-medium rounded-md px-2 py-1.5 border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50'
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100">
      <span className="text-[12px] text-slate-500">Showing {from}–{to} of {total}</span>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={13} /> Prev
        </button>
        <span className="text-[12px] text-slate-500">Page {page} / {pages}</span>
        <button className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next <ChevronRight size={13} />
        </button>
      </div>
    </div>
  )
}
