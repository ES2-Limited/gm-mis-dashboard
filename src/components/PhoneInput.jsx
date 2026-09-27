import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const COUNTRIES = [
  { code: 'NG', dial: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: 'GH', dial: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: 'BJ', dial: '+229', flag: '🇧🇯', name: 'Benin' },
  { code: 'NE', dial: '+227', flag: '🇳🇪', name: 'Niger' },
  { code: 'TD', dial: '+235', flag: '🇹🇩', name: 'Chad' },
  { code: 'CM', dial: '+237', flag: '🇨🇲', name: 'Cameroon' },
  { code: 'BF', dial: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: 'ML', dial: '+223', flag: '🇲🇱', name: 'Mali' },
  { code: 'SN', dial: '+221', flag: '🇸🇳', name: 'Senegal' },
  { code: 'CI', dial: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: 'TG', dial: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: 'LR', dial: '+231', flag: '🇱🇷', name: 'Liberia' },
  { code: 'SL', dial: '+232', flag: '🇸🇱', name: 'Sierra Leone' },
  { code: 'GM', dial: '+220', flag: '🇬🇲', name: 'Gambia' },
  { code: 'GN', dial: '+224', flag: '🇬🇳', name: 'Guinea' },
  { code: 'KE', dial: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: 'ET', dial: '+251', flag: '🇪🇹', name: 'Ethiopia' },
  { code: 'TZ', dial: '+255', flag: '🇹🇿', name: 'Tanzania' },
  { code: 'UG', dial: '+256', flag: '🇺🇬', name: 'Uganda' },
  { code: 'RW', dial: '+250', flag: '🇷🇼', name: 'Rwanda' },
  { code: 'ZA', dial: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: 'ZM', dial: '+260', flag: '🇿🇲', name: 'Zambia' },
  { code: 'ZW', dial: '+263', flag: '🇿🇼', name: 'Zimbabwe' },
  { code: 'EG', dial: '+20', flag: '🇪🇬', name: 'Egypt' },
  { code: 'CD', dial: '+243', flag: '🇨🇩', name: 'DR Congo' },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'United States' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'CA', dial: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France' },
  { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: 'IN', dial: '+91', flag: '🇮🇳', name: 'India' },
  { code: 'CN', dial: '+86', flag: '🇨🇳', name: 'China' },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE' },
]

function findCountry(value) {
  if (!value) return COUNTRIES[0]
  const v = value.replace(/\s/g, '')
  const match = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length).find(c => v.startsWith(c.dial))
  return match || COUNTRIES[0]
}

function stripDial(value, country) {
  if (!value) return ''
  return value.replace(/\s/g, '').replace(country.dial, '')
}

export function PhoneInput({ value, onChange, autoFocus }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const country = findCountry(value)
  const local = stripDial(value, country)

  const compose = (c, l) => (l ? `${c.dial} ${l}` : c.dial)
  const pickCountry = (c) => { onChange(compose(c, local)); setOpen(false); setQ('') }
  const setLocal = (v) => onChange(compose(country, v.replace(/[^\d]/g, '')))

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(q.toLowerCase()) || c.dial.includes(q.replace(/\s/g, ''))
  )

  return (
    <div className="relative">
      <div className="flex items-stretch rounded-md border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-500">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 pl-3 pr-2 border-r border-slate-200 text-[13px] text-slate-600 hover:bg-slate-50 rounded-l-md"
        >
          <span className="text-base leading-none">{country.flag}</span>
          <span className="tabular-nums">{country.dial}</span>
          <ChevronDown size={13} className="text-slate-400" />
        </button>
        <input
          type="tel"
          autoFocus={autoFocus}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="803 000 0000"
          className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-[13px] text-slate-700 focus:outline-none rounded-r-md"
        />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-[10]" onMouseDown={() => setOpen(false)} />
          <div className="absolute z-[20] right-0 mt-1 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-md border border-slate-200 shadow-xl shadow-slate-900/10 overflow-hidden">
            <div className="p-2 border-b border-slate-100">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search country…"
                className="w-full text-[12px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {filtered.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => pickCountry(c)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-50 ${c.code === country.code ? 'bg-brand-50' : ''}`}
                >
                  <span className="text-base leading-none">{c.flag}</span>
                  <span className="flex-1 truncate text-[12.5px] text-slate-700">{c.name}</span>
                  <span className="text-[11.5px] text-slate-400 tabular-nums">{c.dial}</span>
                </button>
              ))}
              {filtered.length === 0 && <p className="px-3 py-2 text-[12px] text-slate-400">No match</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
