import React, { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, AlertTriangle, Loader, X } from 'lucide-react'
import api from '../api'
import { useAuth, useToast } from '../App'
import { Navigate } from 'react-router-dom'

export default function Import() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const fileRef = useRef()
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [allRecords, setAllRecords] = useState([])
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState(null)
  const [fileName, setFileName] = useState('')

  if (user?.role !== 'manager') {
    return <Navigate to="/pipeline" replace />
  }

  const handleFile = async (file) => {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      addToast('Please upload a CSV file', 'error'); return
    }

    setFileName(file.name)
    setLoading(true)
    setPreview(null)
    setResult(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const data = await api.importCSV(fd)
      setPreview(data.preview)
      setAllRecords(data.all)
      addToast(`Parsed ${data.total} records — showing first 10 below`)
    } catch (e) {
      addToast(e.message || 'Failed to parse CSV', 'error')
    }
    setLoading(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      const data = await api.confirmImport(allRecords)
      setResult(data)
      setPreview(null)
      setAllRecords([])
      addToast(`Import complete: ${data.inserted} added, ${data.skipped} skipped`)
    } catch (e) {
      addToast(e.message, 'error')
    }
    setConfirming(false)
  }

  const HEADERS = ['First Name', 'Last Name', 'Phone', 'Email', 'Office', 'Recruiter', 'Status', 'Lead Source', 'Duplicate?']

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-2 mb-2">
        <Upload size={22} className="text-gray-700" />
        <h1 className="font-bold text-gray-900 text-xl">Import Candidates</h1>
        <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">Manager Only</span>
      </div>

      {/* Upload Area */}
      {!preview && !result && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => handleFile(e.target.files?.[0])}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-blue-600">
              <Loader size={36} className="animate-spin" />
              <span className="font-medium">Parsing CSV...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <FileText size={40} />
              <div>
                <div className="font-medium text-gray-600">Click or drag a CSV file here</div>
                <div className="text-sm mt-1">Accepts: first_name, last_name, phone, email, office, recruiter, status, lead_source</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CSV Format Guide */}
      {!preview && !result && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">Expected CSV Columns</div>
          <div className="font-mono text-xs text-gray-600 bg-white border border-gray-200 rounded p-3">
            first_name, last_name, phone, email, office, recruiter, status, lead_source, position_interest, notes
          </div>
          <div className="text-xs text-gray-400 mt-2">Column names are case-insensitive. Unknown columns are ignored.</div>
        </div>
      )}

      {/* Preview Table */}
      {preview && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-800">Preview: {fileName}</h2>
              <div className="text-sm text-gray-500 mt-0.5">
                Showing first 10 of {allRecords.length} records
              </div>
            </div>
            <button onClick={() => { setPreview(null); setAllRecords([]) }} className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
              <X size={16} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {HEADERS.map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((row, i) => (
                  <tr key={i} className={row._duplicate ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                    <td className="px-3 py-2.5">{row.first_name}</td>
                    <td className="px-3 py-2.5">{row.last_name}</td>
                    <td className="px-3 py-2.5 text-gray-600">{row.phone}</td>
                    <td className="px-3 py-2.5 text-gray-600">{row.email}</td>
                    <td className="px-3 py-2.5 text-gray-600 uppercase text-xs">{row.office}</td>
                    <td className="px-3 py-2.5 text-gray-600">{row.recruiter}</td>
                    <td className="px-3 py-2.5 text-gray-600">{row.status}</td>
                    <td className="px-3 py-2.5 text-gray-600">{row.lead_source}</td>
                    <td className="px-3 py-2.5">
                      {row._duplicate ? (
                        <span className="flex items-center gap-1 text-yellow-700 text-xs">
                          <AlertTriangle size={11} />
                          {row._duplicate.first_name} {row._duplicate.last_name}
                        </span>
                      ) : (
                        <span className="text-green-600 text-xs">New</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50">
            <div className="text-sm text-gray-500">
              {allRecords.length} total records • Duplicates will be skipped during import
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setPreview(null); setAllRecords([]) }}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {confirming ? <Loader size={14} className="animate-spin" /> : <Upload size={14} />}
                {confirming ? 'Importing...' : `Import ${allRecords.length} Records`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Import Complete</h2>
          <div className="flex justify-center gap-8 text-sm">
            <div>
              <div className="text-2xl font-bold text-green-600">{result.inserted}</div>
              <div className="text-gray-500">Imported</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-400">{result.skipped}</div>
              <div className="text-gray-500">Skipped</div>
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div className="mt-4 text-left">
              <div className="text-sm font-medium text-red-600 mb-1">Errors:</div>
              {result.errors.map((e, i) => <div key={i} className="text-xs text-red-500">{e}</div>)}
            </div>
          )}
          <button
            onClick={() => setResult(null)}
            className="mt-5 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
