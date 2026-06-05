const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw Object.assign(new Error(err.error || 'Request failed'), { status: res.status, data: err })
  }
  return res.json()
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // Candidates
  getCandidates: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/candidates${q ? '?' + q : ''}`)
  },
  getCandidate: (id) => request(`/candidates/${id}`),
  createCandidate: (data) => request('/candidates', { method: 'POST', body: JSON.stringify(data) }),
  updateCandidate: (id, data) => request(`/candidates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addNote: (id, note) => request(`/candidates/${id}/notes`, { method: 'POST', body: JSON.stringify({ note }) }),
  getActivity: (id) => request(`/candidates/${id}/activity`),
  logActivity: (id, action, detail) => request(`/candidates/${id}/activity`, { method: 'POST', body: JSON.stringify({ action, detail }) }),
  reactivate: (id) => request(`/candidates/${id}/reactivate`, { method: 'POST' }),
  checkPhone: (phone) => request(`/candidates/check-phone/${encodeURIComponent(phone)}`),
  getRoundRobin: (officeGroup) => request(`/candidates/round-robin/${officeGroup}`),

  // Dashboard
  getStats: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/dashboard/stats${q ? '?' + q : ''}`)
  },
  getAlerts: () => request('/dashboard/alerts'),

  // Arrival
  getArrival: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return request(`/arrival${q ? '?' + q : ''}`)
  },
  analyzeArrival: (formData) => fetch(`${BASE}/arrival/analyze`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  }).then(r => r.json()),
  confirmArrivals: (arrivals) => request('/arrival/confirm', { method: 'POST', body: JSON.stringify({ arrivals }) }),

  // Import
  importCSV: (formData) => fetch(`${BASE}/import/csv`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  }).then(r => r.json()),
  confirmImport: (records) => request('/import/confirm', { method: 'POST', body: JSON.stringify({ records }) }),
}

export default api
