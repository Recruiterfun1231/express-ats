import React, { useState, useEffect } from 'react'
import { X, Phone, Mail, Edit2, Save, XCircle, ChevronDown, MessageSquare, Activity } from 'lucide-react'
import { format } from 'date-fns'
import api from '../api'
import AlertBadge from './AlertBadge'
import { useAuth, useToast } from '../App'

const STATUSES = ['New', 'LMVM', 'Scheduled', 'Confirmed', 'Kept', 'Placed']
const CLOSE_REASONS = ['NCJO', 'Failed Audit', 'No-Show', 'Unresponsive', 'Closed', 'MISC']
const LEAD_SOURCES = ['Job Board', 'Call-To-Text', 'Online Application', 'Referral', 'Other']
const OFFICES = ['1511', '1231', '1338']
const RECRUITERS = ['shayne', 'luke', 'carl', 'marc', 'ru', 'pam']

export default function CandidateModal({ candidate, onClose, onUpdate }) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [data, setData] = useState(candidate)
  const [editing, setEditing] = useState(false)
  const [editFields, setEditFields] = useState({})
  const [note, setNote] = useState('')
  const [activity, setActivity] = useState([])
  const [tab, setTab] = useState('details') // details | notes | activity
  const [closing, setClosing] = useState(false)
  const [closeReason, setCloseReason] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadActivity()
  }, [])

  const loadActivity = async () => {
    try {
      const logs = await api.getActivity(data.id)
      setActivity(logs)
    } catch {}
  }

  const handleEdit = () => {
    setEditFields({
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      email: data.email,
      office: data.office,
      recruiter: data.recruiter,
      lead_source: data.lead_source,
      job_applied_for: data.job_applied_for,
      position_interest: data.position_interest,
      inperson_datetime: data.inperson_datetime ? data.inperson_datetime.slice(0, 16) : '',
      candidate_confirmed: data.candidate_confirmed,
      onboarding_complete: data.onboarding_complete,
      days_available: data.days_available,
      shift_preference: data.shift_preference,
      wage_expectation: data.wage_expectation,
      prior_experience: data.prior_experience,
    })
    setEditing(true)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const updated = await api.updateCandidate(data.id, editFields)
      setData(updated)
      setEditing(false)
      onUpdate && onUpdate(updated)
      addToast('Candidate updated')
    } catch (e) {
      addToast(e.message, 'error')
    }
    setLoading(false)
  }

  const handleStatusChange = async (newStatus) => {
    setLoading(true)
    try {
      const updated = await api.updateCandidate(data.id, { status: newStatus })
      setData(updated)
      onUpdate && onUpdate(updated)
      addToast(`Status → ${newStatus}`)
      loadActivity()
    } catch (e) {
      addToast(e.message, 'error')
    }
    setLoading(false)
  }

  const handleAction = async (action) => {
    setLoading(true)
    try {
      const now = new Date().toISOString()
      let updates = { last_contacted_date: now }
      let actAction = action
      let actDetail = ''
      if (action === 'log_call') {
        actAction = 'call_attempted'
        actDetail = 'Call logged'
      } else if (action === 'log_lmvm') {
        updates.status = 'LMVM'
        updates.lmvm_count = (data.lmvm_count || 0) + 1
        actAction = 'lmvm_left'
        actDetail = `Voicemail #${updates.lmvm_count} left`
      } else if (action === 'mark_confirmed') {
        updates.candidate_confirmed = 1
        updates.status = 'Confirmed'
        actAction = 'confirmed'
        actDetail = 'Candidate confirmed in-person'
      } else if (action === 'mark_onboarding') {
        updates.onboarding_complete = 1
        actAction = 'status_changed'
        actDetail = 'Onboarding marked complete'
      } else if (action === 'mark_kept') {
        updates.status = 'Kept'
        if (!data.inperson_datetime) updates.inperson_datetime = now
        actAction = 'status_changed'
        actDetail = 'Marked Kept'
      } else if (action === 'mark_placed') {
        updates.status = 'Placed'
        updates.placed_date = now.split('T')[0]
        actAction = 'status_changed'
        actDetail = 'Marked Placed'
      }
      const updated = await api.updateCandidate(data.id, updates)
      await api.logActivity(data.id, actAction, actDetail)
      setData(updated)
      onUpdate && onUpdate(updated)
      addToast(actDetail || 'Updated')
      loadActivity()
    } catch (e) {
      addToast(e.message, 'error')
    }
    setLoading(false)
  }

  const handleClose = async () => {
    if (!closeReason) { addToast('Please select a reason', 'warning'); return }
    setLoading(true)
    try {
      const updated = await api.updateCandidate(data.id, { status: 'Closed', closed_reason: closeReason, is_active: 0 })
      setData(updated)
      setClosing(false)
      onUpdate && onUpdate(updated)
      addToast('Candidate closed')
      loadActivity()
    } catch (e) {
      addToast(e.message, 'error')
    }
    setLoading(false)
  }

  const handleAddNote = async () => {
    if (!note.trim()) return
    setLoading(true)
    try {
      const updated = await api.addNote(data.id, note)
      setData(updated)
      setNote('')
      onUpdate && onUpdate(updated)
      addToast('Note added')
      loadActivity()
    } catch (e) {
      addToast(e.message, 'error')
    }
    setLoading(false)
  }

  const noteLines = (data.notes || '').split('\n').filter(Boolean).reverse()

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-start justify-end">
      <div className="absolute inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full bg-white shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 bg-white">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">{data.first_name} {data.last_name}</h2>
              <AlertBadge status={data.status} small />
            </div>
            {data.phone && (
              <a href={`tel:${data.phone}`} className="flex items-center gap-1 text-blue-600 text-sm mt-0.5">
                <Phone size={13} /> {data.phone}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!editing && !closing && (
              <button onClick={handleEdit} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
                <Edit2 size={16} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Action buttons */}
        {!data.closed_reason && (
          <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <div className="flex flex-wrap gap-1.5 mb-2">
              <ActionBtn onClick={() => handleAction('log_call')} disabled={loading} color="blue">📞 Log Call</ActionBtn>
              <ActionBtn onClick={() => handleAction('log_lmvm')} disabled={loading} color="orange">📩 Log LMVM {data.lmvm_count > 0 && `(${data.lmvm_count})`}</ActionBtn>
              {!data.candidate_confirmed && <ActionBtn onClick={() => handleAction('mark_confirmed')} disabled={loading} color="purple">✅ Mark Confirmed</ActionBtn>}
              {!data.onboarding_complete && <ActionBtn onClick={() => handleAction('mark_onboarding')} disabled={loading} color="gray">📋 Onboarding Done</ActionBtn>}
              {data.status !== 'Kept' && data.status !== 'Placed' && <ActionBtn onClick={() => handleAction('mark_kept')} disabled={loading} color="yellow">🤝 Mark Kept</ActionBtn>}
              {data.status !== 'Placed' && <ActionBtn onClick={() => handleAction('mark_placed')} disabled={loading} color="green">🏆 Mark Placed</ActionBtn>}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-gray-200">
              <span className="text-xs text-gray-400 self-center mr-1">Close as:</span>
              {CLOSE_REASONS.map(r => (
                <button key={r} disabled={loading} onClick={() => { setCloseReason(r); setClosing(true) }}
                  className="text-xs px-2 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 font-medium">{r}</button>
              ))}
            </div>
          </div>
        )}

        {/* Close reason panel */}
        {closing && (
          <div className="px-5 py-3 bg-red-50 border-b border-red-200">
            <div className="text-sm font-medium text-red-700 mb-2">Close Candidate</div>
            <div className="flex gap-2">
              <select
                value={closeReason}
                onChange={e => setCloseReason(e.target.value)}
                className="flex-1 text-sm border border-red-300 rounded px-2 py-1.5 bg-white"
              >
                <option value="">Select reason...</option>
                {CLOSE_REASONS.map(r => <option key={r}>{r}</option>)}
              </select>
              <button onClick={handleClose} disabled={loading} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                Confirm
              </button>
              <button onClick={() => setClosing(false)} className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 text-sm rounded">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white">
          {['details', 'notes', 'activity'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors
                ${tab === t ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t}
              {t === 'notes' && noteLines.length > 0 && (
                <span className="ml-1 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5">{noteLines.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'details' && (
            <div className="p-5">
              {editing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First Name" value={editFields.first_name} onChange={v => setEditFields(p => ({...p, first_name: v}))} />
                    <Field label="Last Name" value={editFields.last_name} onChange={v => setEditFields(p => ({...p, last_name: v}))} />
                  </div>
                  <Field label="Phone" value={editFields.phone} onChange={v => setEditFields(p => ({...p, phone: v}))} />
                  <Field label="Email" value={editFields.email} onChange={v => setEditFields(p => ({...p, email: v}))} type="email" />
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="Office" value={editFields.office} options={OFFICES} onChange={v => setEditFields(p => ({...p, office: v}))} />
                    <SelectField label="Recruiter" value={editFields.recruiter} options={RECRUITERS} onChange={v => setEditFields(p => ({...p, recruiter: v}))} />
                  </div>
                  <SelectField label="Lead Source" value={editFields.lead_source} options={LEAD_SOURCES} onChange={v => setEditFields(p => ({...p, lead_source: v}))} />
                  <Field label="Job Applied For" value={editFields.job_applied_for} onChange={v => setEditFields(p => ({...p, job_applied_for: v}))} />
                  <Field label="In-Person Date & Time" value={editFields.inperson_datetime} onChange={v => setEditFields(p => ({...p, inperson_datetime: v}))} type="datetime-local" />
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={!!editFields.candidate_confirmed} onChange={e => setEditFields(p => ({...p, candidate_confirmed: e.target.checked ? 1 : 0}))} className="accent-purple-600" />
                      Candidate Confirmed
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={!!editFields.onboarding_complete} onChange={e => setEditFields(p => ({...p, onboarding_complete: e.target.checked ? 1 : 0}))} className="accent-green-600" />
                      Onboarding Complete
                    </label>
                  </div>
                  <Field label="Position Interest" value={editFields.position_interest} onChange={v => setEditFields(p => ({...p, position_interest: v}))} />
                  <Field label="Days Available" value={editFields.days_available} onChange={v => setEditFields(p => ({...p, days_available: v}))} />
                  <Field label="Shift Preference" value={editFields.shift_preference} onChange={v => setEditFields(p => ({...p, shift_preference: v}))} />
                  <Field label="Wage Expectation" value={editFields.wage_expectation} onChange={v => setEditFields(p => ({...p, wage_expectation: v}))} />
                  <Field label="Prior Experience" value={editFields.prior_experience} onChange={v => setEditFields(p => ({...p, prior_experience: v}))} textarea />
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSave} disabled={loading} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                      <Save size={14} /> Save
                    </button>
                    <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <InfoRow label="Office" value={data.office?.toUpperCase()} />
                  <InfoRow label="Recruiter" value={data.recruiter} />
                  <InfoRow label="Lead Source" value={data.lead_source} />
                  <InfoRow label="Job Applied For" value={data.job_applied_for} />
                  <InfoRow label="In-Person" value={data.inperson_datetime ? format(new Date(data.inperson_datetime), 'MMM d, yyyy h:mm a') : null} />
                  <InfoRow label="Confirmed" value={data.candidate_confirmed ? '✅ Yes' : '✗ No'} />
                  <InfoRow label="Onboarding" value={data.onboarding_complete ? '✅ Complete' : '✗ Pending'} />
                  <InfoRow label="Placed Date" value={data.placed_date} />
                  <InfoRow label="Email" value={data.email} />
                  <InfoRow label="Position Interest" value={data.position_interest} />
                  <InfoRow label="Days Available" value={data.days_available} />
                  <InfoRow label="Shift Preference" value={data.shift_preference} />
                  <InfoRow label="Wage Expectation" value={data.wage_expectation} />
                  {data.prior_experience && (
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Prior Experience</div>
                      <div className="text-sm text-gray-700 bg-gray-50 rounded p-2">{data.prior_experience}</div>
                    </div>
                  )}
                  {data.closed_reason && (
                    <InfoRow label="Closed Reason" value={data.closed_reason} valueClass="text-red-600" />
                  )}
                  <InfoRow label="Added" value={data.created_at ? format(new Date(data.created_at), 'MMM d, yyyy h:mm a') : ''} />
                </div>
              )}
            </div>
          )}

          {tab === 'notes' && (
            <div className="p-5 flex flex-col h-full">
              {/* Add note */}
              <div className="mb-4">
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a note..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!note.trim() || loading}
                  className="mt-2 px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Add Note
                </button>
              </div>
              {/* Notes feed */}
              <div className="space-y-2">
                {noteLines.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-8">No notes yet</div>
                ) : noteLines.map((line, i) => {
                  const match = line.match(/^\[(.+?)\] (.+?): (.+)$/)
                  if (match) {
                    return (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-blue-700">{match[2]}</span>
                          <span className="text-xs text-gray-400">
                            {format(new Date(match[1]), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700">{match[3]}</div>
                      </div>
                    )
                  }
                  return <div key={i} className="text-sm text-gray-600 py-1">{line}</div>
                })}
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="p-5">
              {activity.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-8">No activity yet</div>
              ) : (
                <div className="space-y-3">
                  {activity.map(log => (
                    <div key={log.id} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-gray-500">
                          {log.created_at ? format(new Date(log.created_at), 'MMM d, h:mm a') : ''} · {log.user}
                        </div>
                        <div className="text-sm text-gray-700 capitalize">{log.action}: {log.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ onClick, disabled, color, children }) {
  const colors = {
    blue: 'border-blue-300 text-blue-700 hover:bg-blue-50',
    orange: 'border-orange-300 text-orange-700 hover:bg-orange-50',
    purple: 'border-purple-300 text-purple-700 hover:bg-purple-50',
    gray: 'border-gray-300 text-gray-700 hover:bg-gray-100',
    yellow: 'border-yellow-400 text-yellow-700 hover:bg-yellow-50',
    green: 'border-green-300 text-green-700 hover:bg-green-50',
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className={`text-xs px-2.5 py-1 rounded border font-medium transition-colors disabled:opacity-40 ${colors[color] || colors.gray}`}>
      {children}
    </button>
  )
}

function Field({ label, value, onChange, type = 'text', textarea }) {
  const cls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
  return (
    <div>
      <label className="block text-xs text-gray-500 font-medium mb-1">{label}</label>
      {textarea
        ? <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3} className={cls + ' resize-none'} />
        : <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} className={cls} />
      }
    </div>
  )
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 font-medium mb-1">{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
        <option value="">-- Select --</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function InfoRow({ label, value, valueClass = '' }) {
  if (!value) return null
  return (
    <div className="flex gap-2">
      <div className="text-xs text-gray-500 uppercase tracking-wide font-medium w-28 flex-shrink-0 pt-0.5">{label}</div>
      <div className={`text-sm text-gray-800 ${valueClass}`}>{value}</div>
    </div>
  )
}
