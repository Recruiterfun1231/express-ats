import React from 'react'
import { Calendar } from 'lucide-react'

// Reusable date range filter — drop into any page
export default function DateRangeFilter({ dateRange, setDateRange, startDate, setStartDate, endDate, setEndDate }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Calendar size={14} className="text-gray-400 flex-shrink-0" />
      <select
        value={dateRange}
        onChange={e => setDateRange(e.target.value)}
        className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5"
      >
        <option value="">All Time</option>
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="7d">Last 7 Days</option>
        <option value="30d">Last 30 Days</option>
        <option value="90d">Last 90 Days</option>
        <option value="custom">Custom Range</option>
      </select>
      {dateRange === 'custom' && (
        <>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5"
          />
        </>
      )}
    </div>
  )
}

// Helper — get start/end Date objects for a given range selection
export function getDateBounds(dateRange, startDate, endDate) {
  if (!dateRange) return null
  const now = new Date()

  if (dateRange === 'today') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
      end:   new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    }
  }
  if (dateRange === 'week') {
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1   // days since Monday
    const start = new Date(now)
    start.setDate(now.getDate() - diff)
    start.setHours(0, 0, 0, 0)
    return { start, end: new Date(now) }
  }
  if (dateRange === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0), end: new Date(now) }
  }
  if (dateRange === '7d') {
    const s = new Date(now); s.setDate(now.getDate() - 7); s.setHours(0,0,0,0)
    return { start: s, end: new Date(now) }
  }
  if (dateRange === '30d') {
    const s = new Date(now); s.setDate(now.getDate() - 30); s.setHours(0,0,0,0)
    return { start: s, end: new Date(now) }
  }
  if (dateRange === '90d') {
    const s = new Date(now); s.setDate(now.getDate() - 90); s.setHours(0,0,0,0)
    return { start: s, end: new Date(now) }
  }
  if (dateRange === 'custom' && startDate && endDate) {
    return {
      start: new Date(startDate + 'T00:00:00'),
      end:   new Date(endDate   + 'T23:59:59')
    }
  }
  return null
}

// Returns true if at least one of the provided date strings falls within bounds
export function matchesDateBounds(bounds, ...dateStrings) {
  if (!bounds) return true   // no filter = show everything
  return dateStrings.some(d => {
    if (!d) return false
    // Date-only strings like "2026-06-09" are parsed as UTC midnight by JS,
    // which shifts them to the previous day in US timezones.
    // Treat them as local midnight instead to avoid off-by-one errors.
    const dt = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d)
    return dt >= bounds.start && dt <= bounds.end
  })
}
