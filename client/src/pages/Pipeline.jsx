import React, { useState, useEffect, useRef } from 'react'
import { Plus, Search, RefreshCw } from 'lucide-react'
import api from '../api'
import CandidateCard from '../components/CandidateCard'
import CandidateModal from '../components/CandidateModal'
import QuickAddModal from '../components/QuickAddModal'
import DateRangeFilter, { getDateBounds, matchesDateBounds } from '../components/DateRangeFilter'
import { useAuth, useToast } from '../App'

const COLUMNS = [
  { status: 'New',       label: 'New',       color: 'bg-gray-500',   header: 'bg-gray-50  border-gray-200' },
  { status: 'LMVM',     label: 'LMVM',      color: 'bg-orange-500', header: 'bg-orange-50 border-orange-200' },
  { status: 'Scheduled',label: 'Scheduled', color: 'bg-blue-500',   header: 'bg-blue-50  border-blue-200'  },
  { status: 'Confirmed', label: 'Confirmed', color: 'bg-purple-500', header: 'bg-purple-50 border-purple-200' },
  { status: 'Kept',      label: 'Kept',      color: 'bg-yellow-500', header: 'bg-yellow-50 border-yellow-200' },
  { status: 'Placed',    label: 'Placed',    color: 'bg-green-500',  header: 'bg-green-50  border-green-200' },
]

export default function Pipeline() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [filterRecruiter, setFilterRecruiter] = useState(user?.role === 'recruiter' ? user.username : '')
  const [filterOffice, setFilterOffice] = useState('')

  // Date filter
  const [dateRange, setDateRange] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  // Which dates to filter on: 'both' | 'entry' | 'touch'
  const [dateField, setDateField] = useState('both')

  // Drag state
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const dragItem = useRef(null)

  useEffect(() => {
    loadCandidates()
  }, [filterRecruiter, filterOffice])

  const loadCandidates = async () => {
    setLoading(true)
    try {
      const params = { active: 'true' }
      if (filterRecruiter) params.recruiter = filterRecruiter
      if (filterOffice) params.office = filterOffice
      const data = await api.getCandidates(params)
      setCandidates(data)
    } catch (e) {
      addToast(e.message, 'error')
    }
    setLoading(false)
  }

  // Build date bounds from current filter selections
  const dateBounds = (dateRange === 'custom' && (!startDate || !endDate))
    ? null
    : getDateBounds(dateRange, startDate, endDate)

  const filtered = candidates.filter(c => {
    // Text search
    if (search) {
      const q = search.toLowerCase()
      const matchesSearch = (
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.recruiter?.toLowerCase().includes(q)
      )
      if (!matchesSearch) return false
    }

    // Date filter
    if (dateBounds) {
      if (dateField === 'entry') {
        // Entry date = application_date or created_at
        if (!matchesDateBounds(dateBounds, c.application_date, c.created_at)) return false
      } else if (dateField === 'touch') {
        // Last touch = last_contacted_date or updated_at
        if (!matchesDateBounds(dateBounds, c.last_contacted_date, c.updated_at)) return false
      } else {
        // 'both' — any of the above dates in range
        if (!matchesDateBounds(dateBounds, c.application_date, c.created_at, c.last_contacted_date, c.updated_at)) return false
      }
    }

    return true
  })

  const byStatus = (status) => filtered.filter(c => c.status === status)

  // Total visible vs total loaded
  const showingLabel = dateBounds
    ? `${filtered.length} of ${candidates.length} visible`
    : `${candidates.length} total`

  // Drag handlers
  const handleDragStart = (e, candidate) => {
    dragItem.current = candidate
    setDragging(candidate.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDragging(null)
    setDragOver(null)
    dragItem.current = null
  }

  const handleDragOver = (e, status) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(status)
  }

  const handleDrop = async (e, newStatus) => {
    e.preventDefault()
    const candidate = dragItem.current
    if (!candidate || candidate.status === newStatus) {
      setDragging(null); setDragOver(null); return
    }

    setCandidates(prev => prev.map(c =>
      c.id === candidate.id ? { ...c, status: newStatus, status_changed_at: new Date().toISOString() } : c
    ))
    setDragging(null); setDragOver(null)

    try {
      await api.updateCandidate(candidate.id, { status: newStatus })
      addToast(`${candidate.first_name} → ${newStatus}`)
    } catch (e) {
      addToast(e.message, 'error')
      setCandidates(prev => prev.map(c =>
        c.id === candidate.id ? { ...c, status: candidate.status } : c
      ))
    }
  }

  const handleUpdate = (updated) => {
    if (!updated.is_active) {
      setCandidates(prev => prev.filter(c => c.id !== updated.id))
    } else {
      setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c))
    }
    setSelected(prev => prev?.id === updated.id ? updated : prev)
  }

  const uniqueRecruiters = [...new Set(candidates.map(c => c.recruiter).filter(Boolean))].sort()

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-5 py-3 bg-white border-b border-gray-200 space-y-2">
        {/* Row 1: title, search, recruiter/office, refresh, add */}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-bold text-gray-900 text-lg mr-2">Pipeline</h1>

          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm w-44 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {user?.role === 'manager' && (
            <select
              value={filterRecruiter}
              onChange={e => setFilterRecruiter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Recruiters</option>
              {uniqueRecruiters.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}

          <select
            value={filterOffice}
            onChange={e => setFilterOffice(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Offices</option>
            <option value="1511">1511 — St. Charles</option>
            <option value="1231">1231 — Maryland Heights</option>
            <option value="1338">1338 — STL Downtown</option>
          </select>

          <button
            onClick={loadCandidates}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {dateBounds && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
              {showingLabel}
            </span>
          )}

          <div className="ml-auto">
            <button
              onClick={() => setShowQuickAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
            >
              <Plus size={16} /> + Add Lead
            </button>
          </div>
        </div>

        {/* Row 2: date filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangeFilter
            dateRange={dateRange}
            setDateRange={setDateRange}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
          />
          {/* What date field to filter on */}
          <div className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-lg overflow-hidden">
            {[
              { val: 'both',  label: 'Entry or Last Touch' },
              { val: 'entry', label: 'Entry Date' },
              { val: 'touch', label: 'Last Touch' },
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => setDateField(opt.val)}
                className={`px-2.5 py-1.5 transition-colors ${
                  dateField === opt.val
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {dateRange && (
            <button
              onClick={() => { setDateRange(''); setStartDate(''); setEndDate('') }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full p-4 min-w-max">
          {COLUMNS.map(col => {
            const cards = byStatus(col.status)
            const isDragTarget = dragOver === col.status

            return (
              <div
                key={col.status}
                className={`flex flex-col w-60 rounded-xl border transition-colors
                  ${col.header}
                  ${isDragTarget ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                onDragOver={e => handleDragOver(e, col.status)}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => handleDrop(e, col.status)}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-inherit">
                  <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                  <span className="font-semibold text-sm text-gray-700">{col.label}</span>
                  <span className="ml-auto text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500 font-medium">
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {cards.map(candidate => (
                    <div
                      key={candidate.id}
                      draggable
                      onDragStart={e => handleDragStart(e, candidate)}
                      onDragEnd={handleDragEnd}
                    >
                      <CandidateCard
                        candidate={candidate}
                        onClick={setSelected}
                        isDragging={dragging === candidate.id}
                      />
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <div className={`flex items-center justify-center h-16 rounded-lg border-2 border-dashed text-xs text-gray-300
                      ${isDragTarget ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}>
                      {isDragTarget ? 'Drop here' : 'No candidates'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modals */}
      {selected && (
        <CandidateModal
          candidate={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
      {showQuickAdd && (
        <QuickAddModal
          onClose={() => setShowQuickAdd(false)}
          onAdded={(c) => { setCandidates(prev => [c, ...prev]); loadCandidates() }}
        />
      )}
    </div>
  )
}
