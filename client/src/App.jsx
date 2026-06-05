import React, { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import api from './api'
import Layout from './components/Layout'
import Login from './pages/Login'
import Pipeline from './pages/Pipeline'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import ArrivalLog from './pages/ArrivalLog'
import ClosedLeads from './pages/ClosedLeads'
import IncentiveTracker from './pages/IncentiveTracker'
import Import from './pages/Import'
import Profile from './pages/Profile'

export const AuthContext = createContext(null)
export const ToastContext = createContext(null)

export function useAuth() { return useContext(AuthContext) }
export function useToast() { return useContext(ToastContext) }

function Toast({ toasts, remove }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => remove(t.id)}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg cursor-pointer text-white text-sm max-w-sm transition-all
            ${t.type === 'error' ? 'bg-red-600' : t.type === 'warning' ? 'bg-yellow-500' : 'bg-green-600'}`}
        >
          <span className="flex-1">{t.message}</span>
          <span className="text-xs opacity-75">✕</span>
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    api.me().then(data => {
      setUser(data.user)
    }).catch(() => {
      setUser(null)
    }).finally(() => setLoading(false))
  }, [])

  const addToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => removeToast(id), 4000)
  }
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <ToastContext.Provider value={{ addToast }}>
        <Toast toasts={toasts} remove={removeToast} />
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
            <Route index element={<Navigate to="/pipeline" replace />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="arrival" element={<ArrivalLog />} />
            <Route path="closed" element={<ClosedLeads />} />
            <Route path="incentives" element={<IncentiveTracker />} />
            <Route path="import" element={<Import />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </ToastContext.Provider>
    </AuthContext.Provider>
  )
}
