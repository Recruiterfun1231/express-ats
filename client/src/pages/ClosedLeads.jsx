import React, { useState, useEffect } from 'react'
import { Search, RefreshCw, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'
import api from '../api'
import { useAuth, useToast } from '../App'
import CandidateModal from '../components/CandidateModal'
import DateRangeFilter, { getDateBounds, matchesDateBounds } from '../components/DateRangeFilter'

export default function ClosedLeads() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRecruiter, setFilterRecruiter] = useState(user?.role === 'recruiter' ? user.username : '')
  const [filterOffice, setFilterOffice] = useState('')
  const [reactivating, setReactivating] = useState(null)
  const [selected, setSelected] = useState(null)

  // Date filter
  const [dateRange, setDateRange] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => { loadClosed() }, [filterRecruiter, filterOffice])

  const loadClosed = async () => {
    setLoading(true)
    try {
      const params = { active: 'false' }
      if (filterRecruiter) params.recruiter = filterRecruiter
      if (filterOffice) params.office = filterOffice
      const data = await api.getCandidates(params)
      setCandidates(data)
    } catch (e) {
      addToast(e.message, 'error')
    }
    setLoading(false)
  }

  const handleReactivate = async (id) => {
    setReactivating(id)
    try {
      const updated = await api.reactivate(id)
      setCandidates(prev => prev.filter(c => c.id !== id))
      addToast(`${updated.first_name} ${updated.last_name} reactivated`)
    } catch (e) {
      addToast(e.message, 'error')
    }
    setReactivating(null)
  }

  const dateBounds = (dateRange === 'custom' && (!startDate || !endDate))
    ? null
    : getDateBounds(dateRange, startDate, endDate)

  const filtered = candidates.filter(c => {
    if (search) {
      const q = search.toLowerCase()
      const match = (
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.closed_reason?.toLowerCase().includes(q)
      )
      if (!match) return false
    }

    // Date filter on close date (updated_at)
    if (dateBounds) {
      if (!matchesDateBounds(dateBounds, c.updated_at)) return false
    }

    return true
  })

  return (
    <div className="p-5 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h1 className="font-bold text-gray-900 text-xl flex-1">Closed Leads</h1>

        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search..." className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-44 focus:ring-2 focus:ring-blue-500" />
        </div>

        {user?.role === 'manager' && (
          <select value={filterRecruiter} onChange={e => setFilterRecruiter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5">
            <option value="">All Recruiters</option>
            {['shayne','luke','carl','marc','ru','pam'].map(r => <option key={r}>{r}</option>)}
          </select>
        )}

        <select value={filterOffice} onChange={e => setFilterOffice(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5">
          <option value="">All Offices</option>
          <option value="1511">1511</option>
          <option value="stl">STL</option>
        </select>

        <button onClick={loadClosed} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Date filter row */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="text-xs text-gray-500">Filter by closed date:</span>
        <DateRangeFilter
          dateRange={dateRange}
          setDateRange={setDateRange}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />
        {dateRange && (
          <button
            onClick={() => { setDateRange(''); setStartDate(''); setEndDate('') }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {dateBounds
              ? `${filtered.length} of ${candidates.length} closed leads`
              : `${filtered.length} closed leads`}
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">No closed leads found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name','Phone','Office','Recruiter','Closed Reason','Closed Date','Actions'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(c)}
                        className="font-medium text-blue-600 hover:underline text-left"
                      >
                        {c.first_name} {c.last_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.phone && <a href={`tel:${c.phone}`} className="hover:text-blue-600">{c.phone}</a>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 uppercase text-xs font-medium">{c.office}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{c.recruiter}</td>
                    <td className="px-4 py-3">
                      {c.closed_reason && (
                        <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded">{c.closed_reason}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.updated_at ? format(new Date(c.updated_at), 'MMM d, yyyy') : ''}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleReactivate(c.id)}
                        disabled={reactivating === c.id}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50"
                      >
                        <RotateCcw size={11} />
                        {reactivating === c.id ? '...' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <CandidateModal
          candidate={selected}
          onClose={() => setSelected(null)}
          onUpdate={(updated) => {
            if (updated.is_active) setCandidates(prev => prev.filter(c => c.id !== updated.id))
            else setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c))
            setSelected(updated.is_active ? null : updated)
          }}
        />
      )}
    </div>
  )
}
