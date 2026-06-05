import React, { useState, useEffect, useRef } from 'react'
import { Upload, Camera, CheckCircle, XCircle, RefreshCw, Save } from 'lucide-react'
import api from '../api'
import { useToast } from '../App'
import AlertBadge from '../components/AlertBadge'

// arrival_status: null (pending) | green (arrived) | red (no-arrival)

export default function ArrivalLog() {
  const { addToast } = useToast()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterOffice, setFilterOffice] = useState('')
  const [arrivals, setArrivals] = useState({}) // id -> status
  const [imagePreview, setImagePreview] = useState(null)
  const [analysisResult, setAnalysisResult] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    loadCandidates()
  }, [filterOffice])

  const loadCandidates = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterOffice) params.office = filterOffice
      const data = await api.getArrival(params)
      setCandidates(data)
      // Init arrivals from existing data
      const init = {}
      data.forEach(c => { if (c.arrival_status) init[c.id] = c.arrival_status })
      setArrivals(init)
    } catch (e) {
      addToast(e.message, 'error')
    }
    setLoading(false)
  }

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setImagePreview(url)
    setAnalyzing(true)
    setAnalysisResult(null)

    try {
      const formData = new FormData()
      formData.append('image', file)
      if (filterOffice) formData.append('office', filterOffice)

      const result = await api.analyzeArrival(formData)
      setAnalysisResult(result)

      // Auto-mark matches
      if (result.preview) {
        setAnalysisResult(result)
        // Pre-apply matches to arrivals map
        const newArrivals = { ...arrivals }
        result.preview.forEach(row => {
          if (row.matched_candidate && row.confidence >= 0.5) {
            newArrivals[row.matched_candidate.id] = row.arrived ? 'green' : 'red'
          }
        })
        setArrivals(newArrivals)
        const matchCount = result.preview.filter(r => r.matched_candidate).length
        addToast(`AI matched ${matchCount} name${matchCount !== 1 ? 's' : ''} — review and confirm`)
      }
    } catch (e) {
      addToast('Analysis failed: ' + e.message, 'error')
    }
    setAnalyzing(false)
  }

  const handleSave = async () => {
    const updates = Object.entries(arrivals).map(([id, status]) => ({
      id: parseInt(id),
      arrival_status: status
    }))

    if (updates.length === 0) {
      addToast('No changes to save', 'warning'); return
    }

    setSaving(true)
    try {
      await api.confirmArrivals(updates)
      addToast(`Saved ${updates.length} arrival status updates`)
      loadCandidates()
    } catch (e) {
      addToast(e.message, 'error')
    }
    setSaving(false)
  }

  const statusColor = (s) => ({
    green: 'bg-green-100 text-green-700 border-green-200',
    red:   'bg-red-100 text-red-700 border-red-200',
  }[s] || 'bg-gray-100 text-gray-500 border-gray-200')

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-bold text-gray-900 text-xl flex-1">Arrival Log</h1>

        <select value={filterOffice} onChange={e => setFilterOffice(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5">
          <option value="">All Offices</option>
          <option value="1511">1511 — St. Charles</option>
          <option value="1231">1231 — Maryland Heights</option>
          <option value="1338">1338 — STL Downtown</option>
        </select>

        <button onClick={loadCandidates} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* AI Image Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Camera size={18} className="text-blue-600" />
          <h2 className="font-semibold text-gray-800">AI Arrival Sheet Scanner</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">Upload a photo of the arrival sign-in sheet to automatically match candidates.</p>

        <div className="flex items-start gap-4">
          <div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <Upload size={15} />
              {analyzing ? 'Analyzing...' : 'Upload Image'}
            </button>
          </div>

          {imagePreview && (
            <img src={imagePreview} alt="Arrival sheet" className="h-24 w-24 object-cover rounded-lg border border-gray-200" />
          )}

        </div>

        {analysisResult?.preview && (
          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">AI Analysis Preview — confirm before saving:</div>
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500">Extracted Name</th>
                  <th className="px-3 py-2 text-left text-gray-500">Matched Candidate</th>
                  <th className="px-3 py-2 text-left text-gray-500">Arrived?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analysisResult.preview.map((row, i) => (
                  <tr key={i} className={row.arrived ? 'bg-green-50' : 'bg-red-50'}>
                    <td className="px-3 py-2 font-medium">{row.extracted_name}</td>
                    <td className="px-3 py-2">
                      {row.matched_candidate
                        ? <span className="text-green-700">{row.matched_candidate.first_name} {row.matched_candidate.last_name}</span>
                        : <span className="text-gray-400 italic">Not found — will skip</span>}
                    </td>
                    <td className="px-3 py-2">
                      {row.arrived
                        ? <span className="text-green-600 font-semibold">✓ Arrived</span>
                        : <span className="text-red-600 font-semibold">✗ No-Arrival</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Candidates Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">
            Kept & Placed Candidates
            <span className="ml-2 text-sm font-normal text-gray-400">({candidates.length})</span>
          </h2>
          <button
            onClick={handleSave}
            disabled={saving || Object.keys(arrivals).length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save Arrivals'}
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading...</div>
        ) : candidates.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No kept or placed candidates found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Candidate','Status','Office','Recruiter','Arrival Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {candidates.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3"><AlertBadge status={c.status} small /></td>
                    <td className="px-4 py-3 text-gray-600 uppercase text-xs">{c.office}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{c.recruiter}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 items-center">
                        {arrivals[c.id] && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor(arrivals[c.id])}`}>
                            {arrivals[c.id] === 'green' ? '✓ Arrived' : '✗ No-Arrival'}
                          </span>
                        )}
                        {!arrivals[c.id] && <span className="text-xs text-gray-400">Pending</span>}
                        <button onClick={() => setArrivals(p => ({...p, [c.id]: 'green'}))}
                          className="text-xs px-2 py-0.5 rounded border border-green-300 text-green-700 hover:bg-green-50 font-medium">✓</button>
                        <button onClick={() => setArrivals(p => ({...p, [c.id]: 'red'}))}
                          className="text-xs px-2 py-0.5 rounded border border-red-300 text-red-700 hover:bg-red-50 font-medium">✗</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
