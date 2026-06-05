import React, { useState, useEffect } from 'react'
import { Gift, DollarSign, RefreshCw, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import api from '../api'
import { useAuth, useToast } from '../App'

export default function IncentiveTracker() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterRecruiter, setFilterRecruiter] = useState(user?.role === 'recruiter' ? user.username : '')
  const [filterOffice, setFilterOffice] = useState('')

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

  // Spec: $1 incentive if placed_date is within 7 calendar days of inperson_datetime (Kept date)
  const daysBetween = (d1, d2) => {
    if (!d1 || !d2) return null
    return Math.abs(Math.floor((new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24)))
  }

  const getInvoiceFriday = (placedDate) => {
    if (!placedDate) return null
    const d = new Date(placedDate)
    const day = d.getDay() // 0=Sun, 5=Fri
    const daysToFriday = (5 - day + 7) % 7
    d.setDate(d.getDate() + daysToFriday)
    return d
  }

  const qualifies = (c) => {
    if (c.status !== 'Placed') return false
    if (!c.placed_date || !c.inperson_datetime) return false
    const days = daysBetween(c.placed_date, c.inperson_datetime)
    return days !== null && days <= 7
  }

  const placed = candidates.filter(c => c.status === 'Placed')
  const qualified = placed.filter(qualifies)

  // Group placed by recruiter (show all placed, mark qualifying)
  const byRecruiter = placed.reduce((acc, c) => {
    const key = c.recruiter || 'Unassigned'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const totalIncentive = qualified.length // only placed within 7 days of kept

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Gift size={22} className="text-yellow-600" />
        <h1 className="font-bold text-gray-900 text-xl flex-1">Incentive Tracker</h1>

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
          <option value="1231">1231</option>
          <option value="1338">1338</option>
        </select>
        <button onClick={loadCandidates} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total Qualified</div>
          <div className="text-3xl font-bold text-yellow-600 mt-1">{qualified.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">Kept + Placed</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total Incentive</div>
          <div className="text-3xl font-bold text-green-600 mt-1">${totalIncentive}</div>
          <div className="text-xs text-gray-400 mt-0.5">$1 per placement</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-sm text-gray-500">Kept</div>
          <div className="text-3xl font-bold text-yellow-500 mt-1">
            {candidates.filter(c => c.status === 'Kept').length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-sm text-gray-500">Placed</div>
          <div className="text-3xl font-bold text-green-500 mt-1">
            {candidates.filter(c => c.status === 'Placed').length}
          </div>
        </div>
      </div>

      {/* Incentive Rule Callout */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
        <DollarSign size={18} className="text-yellow-600 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-semibold text-yellow-800 text-sm">Incentive Rule</div>
          <div className="text-yellow-700 text-sm mt-0.5">
            $1 incentive per placement where <strong>placed_date</strong> is within <strong>7 calendar days</strong> of the in-person (Kept) date. Invoice week = Friday on or after placed_date.
          </div>
        </div>
      </div>

      {/* By Recruiter breakdown */}
      {user?.role === 'manager' && Object.keys(byRecruiter).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Recruiter Breakdown</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Recruiter','Total Placed','Qualifying (≤7 days)','Incentive $'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(byRecruiter).sort((a,b) => b[1].length - a[1].length).map(([recruiter, list]) => (
                <tr key={recruiter} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800 capitalize">{recruiter}</td>
                  <td className="px-4 py-3 text-green-600">{list.length}</td>
                  <td className="px-4 py-3 font-semibold">{list.filter(qualifies).length}</td>
                  <td className="px-4 py-3 font-bold text-green-700">${list.filter(qualifies).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Qualified Candidates Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Qualifying Candidates ({qualified.length})</h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400">Loading...</div>
        ) : qualified.length === 0 ? (
          <div className="py-12 text-center text-gray-400">No qualifying candidates yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Candidate','Recruiter','Office','Kept Date','Placed Date','Days','Qualifies ($1)?','Invoice Week'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {placed.map(c => {
                  const q = qualifies(c)
                  const days = daysBetween(c.placed_date, c.inperson_datetime)
                  const friday = getInvoiceFriday(c.placed_date)
                  return (
                  <tr key={c.id} className={`hover:bg-gray-50 ${q ? '' : 'opacity-60'}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.first_name} {c.last_name}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{c.recruiter}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{c.office}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.inperson_datetime ? format(new Date(c.inperson_datetime), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.placed_date ? format(new Date(c.placed_date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">{days !== null ? days : '—'}</td>
                    <td className="px-4 py-3">
                      {q
                        ? <span className="flex items-center gap-1 text-green-700 font-bold"><CheckCircle size={13} /> ✓ $1</span>
                        : <span className="text-gray-400 text-xs">✗</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {friday ? format(friday, 'MMM d, yyyy') : '—'}
                    </td>
                  </tr>
                )})}

              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
