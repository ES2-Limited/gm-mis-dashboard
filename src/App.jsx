import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Layout from './components/Layout'
import { currentPermissions } from './lib/rbac'
import Login from './pages/Login'
import { getAuth } from './lib/auth'
import { getViewAs } from './data/mock'
import { refreshUsers } from './data/users'
import { loadSettings } from './data/settingsStore'
import Dashboard from './pages/Dashboard'
import Cases from './pages/Cases'
import CaseDetail from './pages/CaseDetail'
import RegisterCase from './pages/RegisterCase'
import MapView from './pages/MapView'
import Insights from './pages/Insights'
import Reports from './pages/Reports'
import ReportRunner from './pages/ReportRunner'
import DataSharing from './pages/DataSharing'
import Restricted from './pages/Restricted'
import Settings from './pages/Settings'
import Devices from './pages/Devices'
import AuditLog from './pages/AuditLog'
import AccessDenied from './pages/AccessDenied'

function Guard({ module, children }) {
  const allowed = currentPermissions(getViewAs()).includes(module)
  return allowed ? children : <AccessDenied module={module} />
}

export default function App() {
  const authed = !!getAuth()

  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!authed) return
    let alive = true
    Promise.all([loadSettings(), refreshUsers().catch(() => {})]).finally(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [authed])

  if (!authed) return <Login />
  if (!ready) return (
    <div className="h-full flex items-center justify-center text-slate-400">
      <Loader2 size={20} className="animate-spin mr-2" /> Loading…
    </div>
  )

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Guard module="overview"><Dashboard /></Guard>} />
          <Route path="/cases" element={<Guard module="cases"><Cases /></Guard>} />
          <Route path="/cases/new" element={<Guard module="case_intake"><RegisterCase /></Guard>} />

          <Route path="/cases/confidential" element={<Guard module="restricted"><RegisterCase confidentialStart /></Guard>} />
          <Route path="/cases/:id" element={<Guard module="cases"><CaseDetail /></Guard>} />
          <Route path="/map" element={<Guard module="locations"><MapView /></Guard>} />
          <Route path="/insights" element={<Guard module="insights"><Insights /></Guard>} />
          <Route path="/reports" element={<Guard module="reports"><Reports /></Guard>} />
          <Route path="/reports/:id" element={<Guard module="reports"><ReportRunner /></Guard>} />
          <Route path="/sharing" element={<Guard module="sharing"><DataSharing /></Guard>} />
          <Route path="/restricted" element={<Guard module="restricted"><Restricted /></Guard>} />
          <Route path="/devices" element={<Guard module="devices"><Devices /></Guard>} />
          <Route path="/audit" element={<Guard module="audit"><AuditLog /></Guard>} />
          <Route path="/settings" element={<Guard module="settings"><Settings /></Guard>} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
