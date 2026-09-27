import { useEffect, useMemo, useState } from 'react'
import { Paperclip, Play, Pause, X, MapPin, Camera, Mic, Download, FileText } from 'lucide-react'
import { Card } from './ui'
import { fmtDateTime, channelLabel } from '../data/mock'

function seedNum(s) {
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

const isDocPhoto = (label) => /slip|screenshot|ID card|paper/i.test(label)

function PhotoScene({ seed, doc, className }) {
  const n = seedNum(seed)
  if (doc) {
    const lines = 4 + (n % 4)
    return (
      <svg viewBox="0 0 160 120" className={className} preserveAspectRatio="xMidYMid slice">
        <rect width="160" height="120" fill="#e2e8f0" />
        <rect x="22" y="10" width="116" height="100" rx="3" fill="#fff" transform={`rotate(${(n % 5) - 2} 80 60)`} />
        <rect x="34" y="22" width="60" height="7" rx="2" fill="#94a3b8" />
        {Array.from({ length: lines }, (_, i) => (
          <rect key={i} x="34" y={38 + i * 11} width={96 - ((n >> i) % 40)} height="4.5" rx="2" fill="#cbd5e1" />
        ))}
        <circle cx={118 + (n % 8)} cy="92" r="11" fill="none" stroke="#3b82f6" strokeWidth="1.6" opacity="0.65" />
        <rect x="34" y="92" width="38" height="5" rx="2" fill="#86efac" />
      </svg>
    )
  }
  const sunX = 28 + (n % 100)
  const hill = 56 + (n % 14)
  return (
    <svg viewBox="0 0 160 120" className={className} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`sky-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>
        <linearGradient id={`fld-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
      </defs>
      <rect width="160" height={hill} fill={`url(#sky-${seed})`} />
      <circle cx={sunX} cy={20 + (n % 12)} r="9" fill="#fde68a" />
      <ellipse cx={120 - (n % 60)} cy={hill - 26} rx="16" ry="7" fill="#fff" opacity="0.8" />
      <rect y={hill - 4} width="160" height={124 - hill} fill={`url(#fld-${seed})`} />
      {Array.from({ length: 6 }, (_, i) => (
        <path
          key={i}
          d={`M0 ${hill + 6 + i * 9} Q 80 ${hill + 1 + i * 9 + (n % 6)} 160 ${hill + 6 + i * 9}`}
          stroke="#166534" strokeWidth="1.4" fill="none" opacity="0.5"
        />
      ))}
      {(n % 3 === 0) && (
        <>
          <rect x={118 + (n % 18)} y={hill - 18} width="3" height="16" fill="#854d0e" />
          <circle cx={119.5 + (n % 18)} cy={hill - 22} r="9" fill="#22c55e" />
        </>
      )}
      <path d={`M${20 + (n % 30)} 120 L ${52 + (n % 30)} ${hill + 4} L ${56 + (n % 30)} ${hill + 4} L ${34 + (n % 30)} 120 Z`} fill="#a16207" opacity="0.45" />
    </svg>
  )
}

function VoiceNote({ att }) {
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)

  const bars = useMemo(() => {
    const n = seedNum(att.id)
    return Array.from({ length: 40 }, (_, i) => 5 + ((n >> (i % 24)) * (i + 3)) % 17)
  }, [att.id])

  useEffect(() => {
    if (!playing) return
    const iv = setInterval(() => {
      setT(prev => {
        if (prev + 0.1 >= att.duration) { setPlaying(false); return 0 }
        return prev + 0.1
      })
    }, 100)
    return () => clearInterval(iv)
  }, [playing, att.duration])

  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const frac = t / att.duration

  return (
    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50/50 px-3.5 py-3">
      <button
        onClick={() => setPlaying(p => !p)}
        className="h-9 w-9 rounded-full bg-brand-700 text-white flex items-center justify-center hover:bg-brand-800 shrink-0"
      >
        {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-end gap-[2px] h-6">
          {bars.map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-full transition-colors"
              style={{ height: h, backgroundColor: i / bars.length <= frac ? '#1b6541' : '#cbd5e1' }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10.5px] text-slate-400 flex items-center gap-1"><Mic size={10} /> {att.label}</span>
          <span className="text-[10.5px] tabular-nums text-slate-400">{mmss(t)} / {mmss(att.duration)}</span>
        </div>
      </div>
    </div>
  )
}

function Lightbox({ att, c, onClose }) {
  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center p-6" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl overflow-hidden shadow-2xl fade-up"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <PhotoScene seed={att.id} doc={isDocPhoto(att.label)} className="w-full h-80" />
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-slate-900/50 text-white flex items-center justify-center hover:bg-slate-900/70"
        >
          <X size={15} />
        </button>
        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">{att.label}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11.5px] text-slate-400">
              <span className="flex items-center gap-1"><Camera size={11} /> {fmtDateTime(att.capturedAt)} · via {channelLabel(c.channel)}</span>
              <span className="flex items-center gap-1"><MapPin size={11} /> {c.lat.toFixed(5)}, {c.lng.toFixed(5)} (±8 m)</span>
              <span className="flex items-center gap-1"><FileText size={11} /> {att.size} · JPEG</span>
            </div>
          </div>
          <button className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">
            <Download size={13} /> Download original
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Attachments({ c }) {
  const [openAtt, setOpenAtt] = useState(null)
  const atts = c.attachments || []
  if (!atts.length) return null

  const photos = atts.filter(a => a.type === 'photo')
  const voices = atts.filter(a => a.type === 'voice')

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3.5">
        <Paperclip size={14} className="text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-800">Attachments</h3>
        <span className="text-[11px] text-slate-400">{atts.length} file{atts.length > 1 ? 's' : ''} · captured at intake</span>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          {photos.map(a => (
            <button
              key={a.id}
              onClick={() => setOpenAtt(a)}
              className="group relative rounded-md overflow-hidden border border-slate-200 text-left hover:shadow-md transition-shadow"
            >
              <PhotoScene seed={a.id} doc={isDocPhoto(a.label)} className="w-full h-28 group-hover:scale-[1.03] transition-transform" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/75 to-transparent px-2.5 pt-6 pb-2">
                <p className="text-[11px] font-semibold text-white truncate">{a.label}</p>
                <p className="text-[9.5px] text-white/70">{a.size} · {fmtDateTime(a.capturedAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {voices.length > 0 && (
        <div className="space-y-2.5">
          {voices.map(a => <VoiceNote key={a.id} att={a} />)}
          <p className="text-[10.5px] text-slate-400">Transcribed at intake.</p>
        </div>
      )}

      {openAtt && <Lightbox att={openAtt} c={c} onClose={() => setOpenAtt(null)} />}
    </Card>
  )
}
