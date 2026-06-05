import React, { useState } from 'react'
import { X, Phone, Loader } from 'lucide-react'
import api from '../api'
import { useAuth, useToast } from '../App'

const LEAD_SOURCES = ['Job Board', 'Call-To-Text', 'Online Application', 'Referral', 'Other']

export default function QuickAddModal({ onClose, onAdded }) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [step, setStep] = useState(1) // 1: phone/office/source, 2: confirm dup
  const [loading, setLoading] = useState(false)
  const [phone, setPhone] = useState('')
  const [officeGroup, setOfficeGroup] = useState('stl') // 'stl' (1231/1338) or '1511'
  const [leadSource, setLeadSource] = useState('')
  const [dupCandidate, setDupCandidate] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!phone.trim()) { addToast('Phone required', 'warning'); return }
    if (!leadSource) { addToast('Lead source required', 'warning'); return }

    setLoading(true)
    try {
      // Check for duplicate
      const check = await api.checkPhone(phone)
      if (check.exists && !dupCandidate) {
        setDupCandidate(check.candidate)
        setLoading(false)
        return
      }

      // Determine recruiter: recruiters assign to themselves, manager uses round-robin
      let assignedRecruiter = user.username
      let office = officeGroup === '1511' ? '1511' : '1231'
      if (user.role === 'manager') {
        const rr = await api.getRoundRobin(officeGroup)
        assignedRecruiter = rr.recruiter
        // For STL group, default office is 1231 (can be changed later)
      }

      const candidate = await api.createCandidate({
        first_name: 'New',
        last_name: 'Lead',
        phone: phone.trim(),
        office,
        lead_source: leadSource,
        recruiter: assignedRecruiter,
        status: 'New'
      })

      addToast(`Lead added — assigned to ${assignedRecruiter}`)
      onAdded && onAdded(candidate)
      onClose()
    } catch (e) {
      if (e.status === 409) {
        addToast('Duplicate phone number', 'error')
      } else {
        addToast(e.message, 'error')
      }
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">Quick Add Candidate</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {dupCandidate && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
              <div className="text-sm font-semibold text-yellow-800 mb-1">⚠️ Duplicate Phone Number</div>
              <div className="text-sm text-yellow-700 mb-2">
                {dupCandidate.first_name} {dupCandidate.last_name} is already in the system —
                assigned to <strong>{dupCandidate.recruiter}</strong>, status: <strong>{dupCandidate.status}</strong>
                {!dupCandidate.is_active && ' (Closed)'}
              </div>
              <button type="button" onClick={() => { onClose(); }} className="text-xs text-blue-600 underline">View their record instead</button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number <span className="text-red-500">*</span></label>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setDupCandidate(null) }}
              placeholder="(314) 555-0100"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Office <span className="text-red-500">*</span></label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2.5 text-sm transition-colors
                ${officeGroup === 'stl' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" value="stl" checked={officeGroup === 'stl'} onChange={() => setOfficeGroup('stl')} className="accent-blue-600" />
                <span>1231 / 1338 — STL</span>
              </label>
              <label className={`flex-1 flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2.5 text-sm transition-colors
                ${officeGroup === '1511' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" value="1511" checked={officeGroup === '1511'} onChange={() => setOfficeGroup('1511')} className="accent-blue-600" />
                <span>1511 — St. Charles</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Lead Source <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-1.5">
              {LEAD_SOURCES.map(src => (
                <label key={src} className={`flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 text-sm transition-colors
                  ${leadSource === src ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" value={src} checked={leadSource === src} onChange={() => setLeadSource(src)} className="accent-blue-600" />
                  {src}
                </label>
              ))}
            </div>
          </div>

          {user?.role === 'recruiter' && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
              This lead will be assigned to <strong>you</strong> ({user.username})
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading && <Loader size={14} className="animate-spin" />}
            Add Lead
          </button>
        </form>
      </div>
    </div>
  )
}
