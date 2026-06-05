import React, { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  FunnelChart, Funnel, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Users, TrendingUp, CheckCircle, Target, XCircle, RefreshCw } from 'lucide-react'
import api from '../api'
import { useAuth, useToast } from '../App'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f97316']
const STATUS_COLORS = {
  New: '#6b7280', LMVM: '#f97316', Scheduled: '#3b82f6',
  Confirmed: '#8b5cf6', Kept: '#eab308', Placed: '#22c55e', Closed: '#ef4444'
}

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-500 font-medium">{label}</div>
          <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
          {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
        </div>
        <div className={`p-2.5 rounded-xl ${color.replace('text-', 'bg-').replace('-600', '-100').replace('-500', '-100')}`}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30d')
  const [filterRecruiter, setFilterRecruiter] = useState('')
  const [filterOffice, setFilterOffice] = useState('')

  useEffect(() => {
    loadStats()
  }, [dateRange, filterRecruiter, filterOffice])

  const loadStats = async () => {
    setLoading(true)
    try {
      const params = { dateRange }
      if (filterRecruiter) params.recruiter = filterRecruiter
      if (filterOffice) params.office = filterOffice
      const data = await api.getStats(params)
      setStats(data)
    } catch (e) {
      addToast(e.message, 'error')
    }
    setLoading(false)
  }

  const conversionRate = stats
    ? stats.summary.total > 0 ? Math.round((stats.summary.placed / stats.summary.total) * 100) : 0
    : 0

  return (
    <div className="p-5 space-y-6">
      {/* Header + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-bold text-gray-900 text-xl flex-1">Dashboard</h1>

        <select value={dateRange} onChange={e => setDateRange(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="">All time</option>
        </select>

        {user?.role === 'manager' && (
          <>
            <select value={filterRecruiter} onChange={e => setFilterRecruiter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5">
              <option value="">All Recruiters</option>
              {['shayne','luke','carl','marc','ru','pam'].map(r => <option key={r}>{r}</option>)}
            </select>
            <select value={filterOffice} onChange={e => setFilterOffice(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5">
              <option value="">All Offices</option>
              <option value="1511">1511</option>
              <option value="stl">STL</option>
            </select>
          </>
        )}

        <button onClick={loadStats} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center py-20 text-gray-400">Loading...</div>
      ) : stats ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label="Total Candidates" value={stats.summary.total} icon={Users} color="text-blue-600" />
            <StatCard label="Active" value={stats.summary.active} icon={TrendingUp} color="text-purple-600" />
            <StatCard label="Placed" value={stats.summary.placed} icon={CheckCircle} color="text-green-600" />
            <StatCard label="Kept" value={stats.summary.kept} icon={Target} color="text-yellow-600" />
            <StatCard label="Conversion" value={`${conversionRate}%`} icon={TrendingUp} color="text-blue-500" sub="leads to placed" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily trend */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">New Candidates (14 days)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={v => v?.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="cnt" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Candidates" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Status pie */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Pipeline by Status</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stats.byStatus} dataKey="cnt" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ status, cnt }) => `${status}: ${cnt}`} labelLine={false}>
                    {stats.byStatus.map((entry, i) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Lead source bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Leads by Source</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.bySource.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="lead_source" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="cnt" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Candidates" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Conversion funnel */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Conversion Funnel</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.funnel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Candidates">
                    {stats.funnel.map((entry, i) => (
                      <Cell key={entry.stage} fill={STATUS_COLORS[entry.stage] || COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recruiter Scorecard */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Recruiter Scorecard</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Recruiter','Total','Scheduled','Confirmed','Kept','Placed','Conv%'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.byRecruiter.map(row => (
                    <tr key={row.recruiter} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800 capitalize">{row.recruiter}</td>
                      <td className="px-4 py-2.5 text-gray-600">{row.total}</td>
                      <td className="px-4 py-2.5 text-blue-600">{row.scheduled}</td>
                      <td className="px-4 py-2.5 text-purple-600">{row.confirmed}</td>
                      <td className="px-4 py-2.5 text-yellow-600">{row.kept}</td>
                      <td className="px-4 py-2.5 text-green-600 font-medium">{row.placed}</td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {row.total > 0 ? Math.round((row.placed / row.total) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                  {stats.byRecruiter.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
