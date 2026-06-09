import React, { useState, useEffect } from 'react'
import { Gift, DollarSign, RefreshCw, CheckCircle, Star } from 'lucide-react'
import { format } from 'date-fns'
import api from '../api'
import { useAuth, useToast } from '../App'
import DateRangeFilter, { getDateBounds, matchesDateBounds } from '../components/DateRangeFilter'

export default function IncentiveTracker() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterRecruiter, setFilterRecruiter] = useState(user?.role === 'recruiter' ? user.username : '')
  const [filterOffice, setFilterOffice] = useState('')
  const [saving, setSaving] = useState(null)

  // Date filter (applied to placed_date)
  const [dateRange, setDateRange] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => { loadCandidates() }, [filterRecruiter, filterOffice])

  const loadCandidates = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterRecruiter) params.recruiter = filterRecruiter
      if (filterOffice) params.office = filterOffice
      const data = await api.getCandidates(params)
      setCandidates(data)
    } catch (e) {
      addToast(e.message, 'error')
    }
    setLoading(false)
  }

  const daysBetween = (d1, d2) => {
    if (!d1 || !d2) return null
    return Math.abs(Math.floor((new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24)))
  }

  const getInvoiceFriday = (placedDate) => {
    if (!placedDate) return null
    const d = new Date(placedDate)
    const day = d.getDay()
    const daysToFriday = (5 - day + 7) % 7
    d.setDate(d.getDate() + daysToFriday)
    return d
  }

  const autoQualifies1 = (c) => {
    if (c.status !== 'Placed') return false
    if (!c.placed_date || !c.inperson_datetime) return false
    const days = daysBetween(c.placed_date, c.inperson_datetime)
    return days !== null && days <= 7
  }

  const getIncentiveType = (c) => {
    if (c.status !== 'Placed') return null
    if (c.incentive_type === '$1') return '$1'
    if (c.incentive_type === '$2') return '$2'
    if (c.incentive_type === 'none') return null
    if (autoQualifies1(c)) return '$1'
    return null
  }

  const setIncentiveType = async (candidate, type) => {
    const current = getIncentiveType(candidate)
    const newType = current === type ? null : type
    let storedValue = newType
    if (newType === null && autoQualifies1(candidate)) {
      storedValue = 'none'
    }

    setSaving(candidate.id)
    try {
      const updated = await api.updateCandidate(candidate.id, { incentive_type: storedValue })
      setCandidates(prev => prev.map(c => c.id === candidate.id ? updated : c))
    } catch (e) {
      addToast(e.message, 'error')
    }
    setSaving(null)
  }

  // Date bounds for filtering placed_date
  const dateBounds = (dateRange === 'custom' && (!startDate || !endDate))
    ? null
    : getDateBounds(dateRange, startDate, endDate)

  // All placed candidates
  const allPlaced = candidates.filter(c => c.status === 'Placed')

  // Date-filtered placed candidates (for the table)
  const placed = allPlaced.filter(c => {
    if (!dateBounds) return true
    // Filter on placed_date, falling back to updated_at if placed_date is empty
    return matchesDateBounds(dateBounds, c.placed_date, c.updated_at)
  })

  const dollar1 = placed.filter(c => getIncentiveType(c) === '$1')
  const dollar2 = placed.filter(c => getIncentiveType(c) === '$2')
  const totalIncentive = dollar1.length * 1 + dollar2.length * 2

  // Recruiter breakdown — based on the date-filtered list
  const byRecruiter = placed.reduce((acc, c) => {
    const key = c.recruiter || 'Unassigned'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const isManager = user?.role === 'manager'

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Gift size={22} className="text-yellow-600" />
        <h1 className="font-bold text-gray-900 text-xl flex-1">Incentive Tracker</h1>

        {isManager && (
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
          <option value="1231">1231</option>
          <option value="1338">1338</option>
        </select>
        <button onClick={loadCandidates} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Date filter — filters placed_date */}
      <div className="flex items-center gap-3 flex-wrap bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
        <span className="text-xs text-gray-500 font-medium">Filter by placed date:</span>
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
        {dateBounds && (
          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded ml-auto">
            Showing {placed.length} of {allPlaced.length} placed
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-sm text-gray-500">$1 Kept → Placed</div>
          <div className="text-3xl font-bold text-yellow-600 mt-1">{dollar1.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">${dollar1.length} total</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-sm text-gray-500">$2 Good Hunter</div>
          <div className="text-3xl font-bold text-purple-600 mt-1">{dollar2.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">${dollar2.length * 2} total</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total Incentive</div>
          <div className="text-3xl font-bold text-green-600 mt-1">${totalIncentive}</div>
          <div className="text-xs text-gray-400 mt-0.5">{dollar1.length + dollar2.length} qualifying</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total Placed</div>
          <div className="text-3xl font-bold text-green-500 mt-1">{placed.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">{dateBounds ? 'in selected period' : 'all time'}</div>
        </div>
      </div>

      {/* Incentive Rules Callout */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <DollarSign size={16} className="text-yellow-600 flex-shrink-0" />
          <span className="font-semibold text-yellow-800 text-sm">$1 — Kept-to-Placement</span>
        </div>
        <p className="text-yellow-700 text-sm ml-5">
          Applicant was <strong>Kept</strong> and then <strong>Placed within 7 calendar days</strong> of their in-person date — either tagged Placed manually or confirmed Green on the arrival list.
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Star size={16} className="text-purple-600 flex-shrink-0" />
          <span className="font-semibold text-purple-800 text-sm">$2 — Good Hunter</span>
        </div>
        <p className="text-yellow-700 text-sm ml-5">
          Recruiter maintained their pipeline and proactively got an applicant placed. Manually assigned by manager.
        </p>
        {isManager && (
          <p className="text-xs text-yellow-600 ml-5">Use the <strong>$1</strong> / <strong>$2</strong> buttons in the table below to assign or override incentive type.</p>
        )}
      </div>

      {/* Recruiter Breakdown (manager only) */}
      {isManager && Object.keys(byRecruiter).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Recruiter Breakdown</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Recruiter', 'Total Placed', '$1 Kept→Placed', '$2 Good Hunter', 'Total Incentive'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(byRecruiter).sort((a,b) => b[1].length - a[1].length).map(([recruiter, list]) => {
                const r1 = list.filter(c => getIncentiveType(c) === '$1').length
                const r2 = list.filter(c => getIncentiveType(c) === '$2').length
                return (
                  <tr key={recruiter} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 capitalize">{recruiter}</td>
                    <td className="px-4 py-3 text-green-600">{list.length}</td>
                    <td className="px-4 py-3 font-semibold text-yellow-700">{r1}</td>
                    <td className="px-4 py-3 font-semibold text-purple-700">{r2}</td>
                    <td className="px-4 py-3 font-bold text-green-700">${r1 * 1 + r2 * 2}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Placed Candidates Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Placed Candidates ({placed.length})</h2>
          {isManager && (
            <span className="text-xs text-gray-400">Click <strong>$1</strong> or <strong>$2</strong> to assign — click again to remove</span>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading...</div>
        ) : placed.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            {dateBounds ? 'No placed candidates in this date range' : 'No placed candidates yet'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Candidate', 'Recruiter', 'Office', 'Kept Date', 'Placed Date', 'Days', 'Auto $1?', 'Incentive', 'Invoice Week'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {placed.map(c => {
                  const incentiveType = getIncentiveType(c)
                  const days = daysBetween(c.placed_date, c.inperson_datetime)
                  const friday = getInvoiceFriday(c.placed_date)
                  const isSaving = saving === c.id
                  return (
                    <tr key={c.id} className={`hover:bg-gray-50 ${incentiveType ? '' : 'opacity-60'}`}>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.first_name} {c.last_name}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{c.recruiter}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{c.office}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {c.inperson_datetime ? format(new Date(c.inperson_datetime), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {c.placed_date ? format(new Date(c.placed_date), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">{days !== null ? days : '—'}</td>
                      <td className="px-4 py-3">
                        {autoQualifies1(c)
                          ? <span className="flex items-center gap-1 text-yellow-600 text-xs font-medium"><CheckCircle size={12} /> Yes</span>
                          : <span className="text-gray-400 text-xs">No</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isManager ? (
                          <div className="flex items-center gap-1">
                            <button
                              disabled={isSaving}
                              onClick={() => setIncentiveType(c, '$1')}
                              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-50 ${
                                incentiveType === '$1'
                                  ? 'bg-yellow-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-700'
                              }`}
                            >$1</button>
                            <button
                              disabled={isSaving}
                              onClick={() => setIncentiveType(c, '$2')}
                              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors disabled:opacity-50 ${
                                incentiveType === '$2'
                                  ? 'bg-purple-500 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700'
                              }`}
                            >$2</button>
                          </div>
                        ) : (
                          incentiveType === '$1'
                            ? <span className="inline-flex items-center gap-1 text-yellow-700 font-bold text-xs"><CheckCircle size={12} /> $1</span>
                            : incentiveType === '$2'
                              ? <span className="inline-flex items-center gap-1 text-purple-700 font-bold text-xs"><Star size={12} /> $2</span>
                              : <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {friday ? format(friday, 'MMM d, yyyy') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
