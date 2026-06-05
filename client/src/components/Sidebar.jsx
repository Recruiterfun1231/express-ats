import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, KanbanSquare, Bell, ClipboardCheck,
  XCircle, Gift, Upload, User, LogOut, X
} from 'lucide-react'
import { useAuth, useToast } from '../App'
import api from '../api'

const navItems = [
  { to: '/pipeline', icon: KanbanSquare, label: 'Pipeline' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/arrival', icon: ClipboardCheck, label: 'Arrival Log' },
  { to: '/closed', icon: XCircle, label: 'Closed Leads' },
  { to: '/incentives', icon: Gift, label: 'Incentive Tracker' },
  { to: '/import', icon: Upload, label: 'Import', managerOnly: true },
  { to: '/profile', icon: User, label: 'Profile' },
]

export default function Sidebar({ onClose }) {
  const { user, setUser } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    api.getAlerts().then(alerts => setAlertCount(alerts.length)).catch(() => {})
    const interval = setInterval(() => {
      api.getAlerts().then(alerts => setAlertCount(alerts.length)).catch(() => {})
    }, 30 * 60 * 1000) // 30 minutes per spec
    return () => clearInterval(interval)
  }, [])

  const handleLogout = async () => {
    try {
      await api.logout()
      setUser(null)
      navigate('/login')
    } catch {
      addToast('Logout failed', 'error')
    }
  }

  const visibleItems = navItems.filter(item => !item.managerOnly || user?.role === 'manager')

  return (
    <div className="h-full bg-blue-900 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-blue-800">
        <div>
          <div className="font-bold text-lg leading-tight">Express ATS</div>
          <div className="text-blue-300 text-xs">Employment Professionals</div>
        </div>
        <button onClick={onClose} className="lg:hidden p-1 hover:bg-blue-800 rounded">
          <X size={18} />
        </button>
      </div>

      {/* User info */}
      <div className="px-5 py-3 border-b border-blue-800">
        <div className="text-sm font-medium">{user?.display_name || user?.username}</div>
        <div className="text-blue-300 text-xs capitalize">{user?.role}</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative
              ${isActive ? 'bg-blue-700 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'}`
            }
          >
            <item.icon size={18} />
            <span className="flex-1">{item.label}</span>
            {item.to === '/alerts' && alertCount > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {alertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-blue-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-blue-200 hover:bg-blue-800 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  )
}
