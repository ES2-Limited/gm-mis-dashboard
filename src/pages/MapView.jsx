import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { Loader2, MapPin } from 'lucide-react'
import { Card, Select, StatusBadge } from '../components/ui'
import { STATES, CATEGORIES, isOpen, fmtDate } from '../data/mock'
import { fetchCases } from '../data/casesApi'
import { getAuth } from '../lib/auth'

const VIEW = { center: [9.7, 8.2], zoom: 6 }

function markerStyle(c) {
  if (c.slaBreached && isOpen(c)) return { color: '#be123c', fillColor: '#f43f5e' }
  if (isOpen(c)) return { color: '#1b6541', fillColor: '#2f8a5d' }
  return { color: '#475569', fillColor: '#94a3b8' }
}

export default function MapView() {
  const me = getAuth() || {}
  const national = me.isSuperAdmin || !me.scope || me.scope === 'All states'

  const [allCases, setAllCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [stateF, setStateF] = useState('')
  const [catF, setCatF] = useState('')
  const [statusF, setStatusF] = useState('')

  useEffect(() => {
    fetchCases().then(setAllCases).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => allCases.filter(c =>
    (!stateF || c.state === stateF) &&
    (!catF || c.category === catF) &&
    (!statusF || (statusF === 'open' ? isOpen(c) : statusF === 'breached' ? (c.slaBreached && isOpen(c)) : !isOpen(c)))
  ), [allCases, stateF, catF, statusF])

  const mapped = useMemo(() => filtered.filter(c => c.lat != null && c.lng != null), [filtered])

  const summary = useMemo(() => {
    const keyOf = national ? (c => c.state) : (c => c.lga || '—')
    const m = {}
    filtered.forEach(c => {
      const key = keyOf(c) || '—'
      m[key] = m[key] || { name: key, total: 0, open: 0, breached: 0 }
      m[key].total++
      if (isOpen(c)) m[key].open++
      if (c.slaBreached && isOpen(c)) m[key].breached++
    })
    return Object.values(m).sort((a, b) => b.total - a.total)
  }, [filtered, national])

  if (loading) {
    return <div className="p-5 flex items-center justify-center h-[60vh] text-slate-400"><Loader2 size={18} className="animate-spin mr-2" /> Loading locations…</div>
  }

  return (
    <div className="p-3 md:p-5 h-full flex flex-col gap-3 md:gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 fade-up">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Grievance Locations</h1>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            {national ? 'National view' : `${me.scope} · State view`} · {mapped.length} of {filtered.length} cases geo-tagged
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {national && <Select value={stateF} onChange={setStateF} options={STATES.map(s => s.name)} allLabel="All states" />}
          <Select value={catF} onChange={setCatF} options={CATEGORIES} allLabel="All categories" />
          <Select
            value={statusF}
            onChange={setStatusF}
            options={[{ id: 'open', label: 'Open' }, { id: 'breached', label: 'SLA breached' }, { id: 'closed', label: 'Resolved / Closed' }]}
            allLabel="All statuses"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 flex-1 min-h-0 fade-up">
        <Card className="xl:col-span-3 overflow-hidden min-h-[560px] relative">
          {mapped.length === 0 && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
              <div className="bg-white/90 ring-1 ring-slate-200 rounded-md px-4 py-3 text-center pointer-events-auto">
                <MapPin size={18} className="text-slate-300 mx-auto mb-1" />
                <p className="text-[12.5px] font-semibold text-slate-600">No geo-tagged cases in this view</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Cases appear on the map once captured with GPS coordinates.<br />Use the location ranking on the right meanwhile.</p>
              </div>
            </div>
          )}
          <MapContainer center={VIEW.center} zoom={VIEW.zoom} scrollWheelZoom style={{ height: '100%', width: '100%', minHeight: 560 }}>
            <TileLayer attribution='&copy; OpenStreetMap &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            {mapped.map(c => {
              const st = markerStyle(c)
              return (
                <CircleMarker key={c.id} center={[c.lat, c.lng]} radius={c.priority === 'high' ? 8 : 6} pathOptions={{ ...st, fillOpacity: 0.75, weight: 1.5 }}>
                  <Popup>
                    <div className="text-xs leading-relaxed min-w-44">
                      <div className="font-bold text-slate-900">{c.code}</div>
                      <div className="text-slate-600">{c.category}</div>
                      <div className="text-slate-500">{c.lga ? `${c.lga}, ` : ''}{c.state} · {fmtDate(c.createdAt)}</div>
                      <div className="my-1.5"><StatusBadge status={c.status} /></div>
                      <Link to={`/cases/${c.id}`} className="font-semibold text-emerald-700">Open case →</Link>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </Card>

        <div className="flex flex-col gap-4 min-h-0">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Legend</h3>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200" /> Open case</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rose-500 ring-2 ring-rose-200" /> Open · SLA breached</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-slate-400 ring-2 ring-slate-200" /> Resolved / closed</div>
              <div className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full bg-emerald-500/60" /> Larger marker = high priority</div>
            </div>
          </Card>

          <Card className="flex-1 overflow-hidden flex flex-col min-h-64">
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-slate-800">{national ? 'By State' : `By LGA · ${me.scope}`}</h3>
              <p className="text-xs text-slate-400">Hotspots first</p>
            </div>
            <div className="overflow-y-auto px-2 pb-2">
              {summary.map(s => (
                <button
                  key={s.name}
                  onClick={() => national && setStateF(stateF === s.name ? '' : s.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-sm transition-colors ${stateF === s.name ? 'bg-brand-50' : 'hover:bg-slate-50'}`}
                >
                  <span className="font-medium text-slate-700">{s.name}</span>
                  <span className="flex items-center gap-2 text-xs">
                    {s.breached > 0 && <span className="font-semibold text-rose-600">{s.breached} ⚠</span>}
                    <span className="text-emerald-700 font-semibold">{s.open}</span>
                    <span className="text-slate-400">/ {s.total}</span>
                  </span>
                </button>
              ))}
              {summary.length === 0 && <p className="px-3 py-8 text-center text-[12px] text-slate-300">No cases in this view yet</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
