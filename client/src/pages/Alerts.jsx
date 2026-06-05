import React, { useState, useEffect } from 'react'
import { Bell, AlertTriangle, AlertCircle, Info, RefreshCw, User, Building2 } from 'lucide-react'
import api from '../api'
import { useToast } from '../App'
import CandidateModal from '../components/CandidateModal'

const TYPE_CONFIG = {
  stuck:       { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', label: 'Stuck in Stage' },
  unconfirmed: { icon: AlertCircle,   color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', label: 'Unconfirmed' },
  lmvm_overdue:{ icon: AlertCircle,   color: 'text-red-600',    bg: 'bg-red-50 border-red-200',       label: 'LMVM Overdue' },
  inactive:    { icon: Info,          color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',     label: 'Inactive' },
}

export default function Alerts() {
  const { addToast } = useToast()
  const [alerts, setAlerts] = useState([])
  const [dismissed, setDismissed] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  useEffect(() => {
    loadAlerts()
  }, [])

  const loadAlerts = async () => {
    setLoading(true)
    try {
      const data = await api.getAlerts()
      setAlerts(data)
    } catch (e) {
      addToast(e.message, 'error')
    }
    setLoading(false)
  }

  const handleDismiss = (idx) => {
    setDismissed(prev => new Set([...prev, idx]))
  }

  const handleDismissAll = () => {
    setDismissed(new Set(alerts.map((_, i) => i)))
  }

  const handleCardClick = async (alert) => {
    try {
      const c = await api.getCandidate(alert.candidate_id)
      setSelectedCandidate(c)
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  const visible = alerts.filter((_, i) => !dismissed.has(i))
  const grouped = Object.groupBy
    ? Object.groupBy(visible, a => a.type)
    : visible.reduce((acc, a) => { (acc[a.type] = acc[a.type] || []).push(a); return acc }, {})

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Bell size={22} className="text-gray-700" />
        <h1 className="font-bold text-gray-900 text-xl flex-1">Alerts</h1>
        <button onClick={loadAlerts} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
        {visible.length > 0 && (
          <button onClick={handleDismissAll} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-300 rounded-lg">
            Dismiss All
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading alerts...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20">
          <Bell size={40} className="mx-auto text-gray-200 mb-3" />
          <div className="text-gray-400 font-medium">No active alerts</div>
          <div className="text-gray-300 text-sm mt-1">Everything looks good!</div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, typeAlerts]) => {
            const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.inactive
            const Icon = cfg.icon
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={15} className={cfg.color} />
                  <h2 className="font-semibold text-sm text-gray-700">{cfg.label}</h2>
                  <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">{typeAlerts.length}</span>
                </div>
                <div className="space-y-2">
                  {typeAlerts.map((alert, i) => {
                    const globalIdx = alerts.indexOf(alert)
                    return (
                      <div
                        key={i}
                        className={`border rounded-xl p-4 ${cfg.bg} cursor-pointer hover:shadow-sm transition-shadow`}
                        onClick={() => handleCardClick(alert)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm text-gray-700">{alert.message}</p>
                            <div className="flex items-center gap-3 mt-2">
                              {alert.recruiter && (
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <User size={11} /> {alert.recruiter}
                                </span>
                              )}
                              {alert.office && (
                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                  <Building2 size={11} /> {alert.office?.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); handleDismiss(globalIdx) }}
                            className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0 px-2 py-1 hover:bg-white rounded"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          onUpdate={(updated) => setSelectedCandidate(updated)}
        />
      )}
    </div>
  )
}
