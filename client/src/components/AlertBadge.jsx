import React from 'react'

const STATUS_CONFIG = {
  New:       { bg: 'bg-gray-100',   text: 'text-gray-700',  dot: 'bg-gray-400'   },
  LMVM:      { bg: 'bg-orange-100', text: 'text-orange-700',dot: 'bg-orange-500'  },
  Scheduled: { bg: 'bg-blue-100',   text: 'text-blue-700',  dot: 'bg-blue-500'   },
  Confirmed: { bg: 'bg-purple-100', text: 'text-purple-700',dot: 'bg-purple-500' },
  Kept:      { bg: 'bg-yellow-100', text: 'text-yellow-700',dot: 'bg-yellow-500' },
  Placed:    { bg: 'bg-green-100',  text: 'text-green-700', dot: 'bg-green-500'  },
  // All closed reasons map to red
  Closed:        { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-400' },
  NCJO:          { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-400' },
  'Failed Audit':{ bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-400' },
  'No-Show':     { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-400' },
  Unresponsive:  { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-400' },
  MISC:          { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-400' },
}

export default function AlertBadge({ status, small = false }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['New']
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium
      ${cfg.bg} ${cfg.text}
      ${small ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'}`}>
      <span className={`rounded-full ${cfg.dot} ${small ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
      {status}
    </span>
  )
}
