import React, { useState, useEffect } from 'react'
import { Bell, AlertTriangle, AlertCircle, Info, RefreshCw, User, Building2, Clock, CheckCheck } from 'lucide-react'
import api from '../api'
import { useAuth, useToast } from '../App'
import CandidateModal from '../components/CandidateModal'

const TYPE_CONFIG = {
  new_uncontacted:  { icon: AlertCircle,   color: 'text-red-600',    bg: 'bg-red-50 border-red-200',       label: '24-Hr Contact Rule' },
  lmvm_followup:    { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', label: 'Voicemail Follow-Up' },
  lmvm_max:         { icon: AlertCircle,   color: 'text-red-600',    bg: 'bg-red-50 border-red-200',       label: '3 Voicemails — Close Out' },
  confirm_today:    { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', label: 'Confirm Today\'s In-Person' },
  scheduled_silent: { icon: Clock,         color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', label: 'No Follow-Up (48hrs)' },
  past_inperson:    { icon: AlertCircle,   color: 'text-red-600',    bg: 'bg-red-50 border-red-200',       label: 'Interview Passed — Update Status' },
  kept_no_placement:{ icon: AlertTriangle, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', label: 'Kept — Placement Follow-Up' },
  onboarding_check: { icon: Info,          color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',     label: 'Onboarding Check' },
}

// Order alerts appear on screen — most urgent first
const TYPE_ORDER = [
  'new_uncontacted', 'past_inperson', 'lmvm_max', 'confirm_today',
  'scheduled_silent', 'lmvm_followup', 'kept_no_placement', 'onboarding_check'
]

export default function Alerts() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [alerts, setAlerts] = useState([])
  const [dismissing, setDismissing] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  useEffect(() => { loadAlerts() }, [])

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

  const handleDismiss = async (e, alert) => {
    e.stopPropagation()
    const key = `${alert.candidate_id}|${alert.type}`
    setDismissing(prev => new Set([...prev, key]))
    try {
      await api.dismissAlert(alert.candidate_id, alert.type)
      setAlerts(prev => prev.filter(a => !(a.candidate_id === alert.candidate_id && a.type === alert.type)))
    } catch (err) {
      addToast('Could not dismiss alert', 'error')
    }
    setDismissing(prev => { const s = new Set(prev); s.delete(key); return s })
  }

  const handleDismissAll = async () => {
    for (const alert of alerts) {
      try { await api.dismissAlert(alert.candidate_id, alert.type) } catch {}
    }
    setAlerts([])
  }

  const handleCardClick = async (alert) => {
    try {
      const c = await api.getCandidate(alert.candidate_id)
      setSelectedCandidate(c)
    } catch (e) {
      addToast(e.message, 'error')
    }
  }

  // Group by type in priority order
  const grouped = TYPE_ORDER.reduce((acc, type) => {
    const group = alerts.filter(a => a.type === type)
    if (group.length) acc[type] = group
    return acc
  }, {})
  // Catch any types not in our order list
  alerts.forEach(a => {
    if (!TYPE_ORDER.includes(a.type)) {
      if (!grouped[a.type]) grouped[a.type] = []
      if (!grouped[a.type].includes(a)) grouped[a.type].push(a)
    }
  })

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Bell size={22} className="text-gray-700" />
        <h1 className="font-bold text-gray-900 text-xl flex-1">Alerts</h1>
        {alerts.length > 0 && (
          <span className="text-xs bg-red-100 text-red-700 font-semibold px-2.5 py-1 rounded-full">
            {alerts.length} active
          </span>
        )}
        <button onClick={loadAlerts} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
        {alerts.length > 0 && (
          <button onClick={handleDismissAll} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">
            <CheckCheck size={14} /> Dismiss All
          </button>
        )}
      </div>

      {/* How alerts work callout */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5 text-xs text-blue-700">
        <strong>How this works:</strong> Alerts stay dismissed until action is taken on the candidate — updating their status, logging a contact, or confirming their interview automatically resets the alert.
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20">
          <Bell size={40} className="mx-auto text-gray-200 mb-3" />
          <div className="text-gray-400 font-medium">No active alerts</div>
          <div className="text-gray-300 text-sm mt-1">All candidates are up to date</div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, typeAlerts]) => {
            const cfg = TYPE_CONFIG[type] || { icon: Info, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', label: type }
            const Icon = cfg.icon
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={15} className={cfg.color} />
                  <h2 className="font-semibold text-sm text-gray-700">{cfg.label}</h2>
                  <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">{typeAlerts.length}</span>
                </div>
                <div className="space-y-2">
                  {typeAlerts.map((alert, i) => {
                    const key = `${alert.candidate_id}|${alert.type}`
                    const isDismissing = dismissing.has(key)
                    return (
                      <div
                        key={i}
                        className={`border rounded-xl p-4 ${cfg.bg} cursor-pointer hover:shadow-sm transition-shadow ${isDismissing ? 'opacity-50' : ''}`}
                        onClick={() => handleCardClick(alert)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-sm text-gray-800">{alert.message}</p>
                            <div className="flex items-center gap-3 mt-1.5">
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
                            disabled={isDismissing}
                            onClick={e => handleDismiss(e, alert)}
                            className="text-xs text-gray-400 hover:text-gray-700 flex-shrink-0 px-2 py-1 hover:bg-white rounded border border-transparent hover:border-gray-200 disabled:opacity-50"
                          >
                            {isDismissing ? '...' : 'Dismiss'}
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
          onUpdate={(updated) => {
            setSelectedCandidate(updated)
            loadAlerts() // refresh alerts after candidate update
          }}
        />
      )}
    </div>
  )
}
