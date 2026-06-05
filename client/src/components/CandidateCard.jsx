import React from 'react'
import { Phone, Clock, MapPin, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const OFFICE_COLORS = {
  '1511': 'bg-blue-100 text-blue-700',
  '1231': 'bg-indigo-100 text-indigo-700',
  '1338': 'bg-violet-100 text-violet-700',
}

export default function CandidateCard({ candidate, onClick, isDragging }) {
  const daysSince = candidate.status_changed_at
    ? Math.floor((Date.now() - new Date(candidate.status_changed_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  return (
    <div
      onClick={() => onClick(candidate)}
      className={`bg-white rounded-lg border p-3 cursor-pointer select-none transition-all
        hover:shadow-md hover:border-blue-300
        ${isDragging ? 'shadow-lg rotate-1 border-blue-400' : 'border-gray-200 shadow-sm'}`}
    >
      {/* Name */}
      <div className="font-semibold text-gray-900 text-sm leading-tight mb-1.5">
        {candidate.first_name} {candidate.last_name}
      </div>

      {/* Phone */}
      {candidate.phone && (
        <a
          href={`tel:${candidate.phone}`}
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs mb-2"
        >
          <Phone size={11} />
          {candidate.phone}
        </a>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-1 mb-2">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${OFFICE_COLORS[candidate.office] || 'bg-gray-100 text-gray-600'}`}>
          {candidate.office?.toUpperCase()}
        </span>
        {candidate.recruiter && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium flex items-center gap-0.5">
            <User size={9} />
            {candidate.recruiter}
          </span>
        )}
      </div>

      {/* Lead source */}
      {candidate.lead_source && (
        <div className="text-xs text-gray-400 truncate mb-1">{candidate.lead_source}</div>
      )}

      {/* Days in stage */}
      <div className={`flex items-center gap-1 text-xs
        ${daysSince > 5 ? 'text-red-500' : daysSince > 2 ? 'text-yellow-600' : 'text-gray-400'}`}>
        <Clock size={10} />
        {daysSince === 0 ? 'Today' : `${daysSince}d in stage`}
      </div>
    </div>
  )
}
