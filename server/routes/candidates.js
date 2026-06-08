const express = require('express')
const router = express.Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

const ROUND_ROBIN = {
  '1511': ['shayne', 'luke', 'carl'],
  'stl': ['marc', 'ru', 'pam']
}

// GET /api/round-robin/:officeGroup
router.get('/round-robin/:officeGroup', requireAuth, (req, res) => {
  const group = req.params.officeGroup
  const recruiters = ROUND_ROBIN[group]
  if (!recruiters) return res.status(404).json({ error: 'Unknown office group' })

  const row = db.prepare('SELECT counter FROM assignment_counters WHERE office_group = ?').get(group)
  const idx = row ? row.counter % recruiters.length : 0
  const recruiter = recruiters[idx]

  db.prepare('UPDATE assignment_counters SET counter = counter + 1 WHERE office_group = ?').run(group)

  res.json({ recruiter, next_index: idx })
})

// GET /api/candidates/check-phone/:phone
router.get('/check-phone/:phone', requireAuth, (req, res) => {
  const phone = req.params.phone.replace(/\D/g, '')
  const candidate = db.prepare(
    `SELECT id, first_name, last_name, recruiter, status, is_active FROM candidates WHERE replace(replace(replace(replace(phone,'-',''),'(',''),')',''),' ','') = ?`
  ).get(phone)
  res.json({ exists: !!candidate, candidate: candidate || null })
})

// GET /api/candidates
router.get('/', requireAuth, (req, res) => {
  const { recruiter, office, status, active } = req.query
  let query = 'SELECT * FROM candidates WHERE 1=1'
  const params = []

  if (recruiter) { query += ' AND recruiter = ?'; params.push(recruiter) }
  if (office) { query += ' AND office = ?'; params.push(office) }
  if (status) { query += ' AND status = ?'; params.push(status) }
  if (active !== undefined) { query += ' AND is_active = ?'; params.push(active === 'true' ? 1 : 0) }

  query += ' ORDER BY created_at DESC'
  const candidates = db.prepare(query).all(...params)
  res.json(candidates)
})

// POST /api/candidates
router.post('/', requireAuth, (req, res) => {
  try {
    const {
      first_name, last_name, phone, email, office, status,
      recruiter, lead_source, job_applied_for, position_interest, notes,
      days_available, shift_preference, wage_expectation, prior_experience,
      application_date, inperson_datetime, candidate_confirmed, onboarding_complete
    } = req.body

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'First and last name required' })
    }

    // Duplicate phone check
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '')
      const existing = db.prepare("SELECT id FROM candidates WHERE replace(replace(replace(replace(phone,'-',''),'(',''),')',''),' ','') = ?").get(cleanPhone)
      if (existing) {
        return res.status(409).json({ error: 'Candidate with this phone already exists', id: existing.id })
      }
    }

    const today = new Date().toISOString().split('T')[0]
    const result = db.prepare(`
      INSERT INTO candidates (first_name, last_name, phone, email, office, status, recruiter, lead_source,
        job_applied_for, position_interest, notes, days_available, shift_preference, wage_expectation, prior_experience,
        application_date, inperson_datetime, candidate_confirmed, onboarding_complete)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      first_name, last_name, phone || '', email || '',
      office || '1511', status || 'New', recruiter || '',
      lead_source || '', job_applied_for || '', position_interest || '', notes || '',
      days_available || '', shift_preference || '', wage_expectation || '', prior_experience || '',
      application_date || today, inperson_datetime || null,
      candidate_confirmed ? 1 : 0, onboarding_complete ? 1 : 0
    )

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(result.lastInsertRowid)

    // Log activity
    db.prepare('INSERT INTO activity_log (candidate_id, user, action, detail) VALUES (?, ?, ?, ?)')
      .run(candidate.id, req.session.user.username, 'created', `Candidate added by ${req.session.user.display_name}`)

    res.status(201).json(candidate)
  } catch (err) {
    console.error('POST /candidates error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/candidates/:id
router.get('/:id', requireAuth, (req, res) => {
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id)
  if (!candidate) return res.status(404).json({ error: 'Not found' })
  res.json(candidate)
})

// PATCH /api/candidates/:id
router.patch('/:id', requireAuth, (req, res) => {
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id)
  if (!candidate) return res.status(404).json({ error: 'Not found' })

  const allowed = [
    'first_name', 'last_name', 'phone', 'email', 'office', 'status', 'recruiter',
    'lead_source', 'job_applied_for', 'position_interest', 'days_available', 'shift_preference',
    'wage_expectation', 'prior_experience', 'closed_reason', 'is_active', 'arrival_status',
    'arrival_date', 'application_date', 'first_contact_date', 'last_contacted_date',
    'inperson_datetime', 'candidate_confirmed', 'onboarding_complete', 'placed_date', 'lmvm_count',
    'incentive_type'
  ]

  const updates = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  // Track status change
  if (updates.status && updates.status !== candidate.status) {
    updates.status_changed_at = new Date().toISOString()
    db.prepare('INSERT INTO activity_log (candidate_id, user, action, detail) VALUES (?, ?, ?, ?)')
      .run(candidate.id, req.session.user.username, 'status_change', `Status changed from ${candidate.status} to ${updates.status}`)
  }

  // If setting a closed_reason, deactivate and set status to the reason
  const CLOSED_REASONS = ['NCJO', 'Failed Audit', 'No-Show', 'Unresponsive', 'Closed', 'MISC']
  if (updates.closed_reason && CLOSED_REASONS.includes(updates.closed_reason)) {
    updates.is_active = 0
    updates.status = updates.closed_reason
    db.prepare('INSERT INTO activity_log (candidate_id, user, action, detail) VALUES (?, ?, ?, ?)')
      .run(candidate.id, req.session.user.username, 'status_changed', `Closed: ${updates.closed_reason}`)
  }
  // Handle lmvm_count increment
  if (updates.status === 'LMVM' && candidate.status !== 'LMVM') {
    updates.lmvm_count = (candidate.lmvm_count || 0) + 1
    updates.last_contacted_date = new Date().toISOString()
  }
  // Set dates on specific status transitions
  if (updates.status === 'Placed' && candidate.status !== 'Placed' && !updates.placed_date) {
    updates.placed_date = new Date().toISOString().split('T')[0]
  }
  if ((updates.status === 'LMVM' || updates.status === 'Scheduled' || updates.status === 'Confirmed' || updates.status === 'Kept' || updates.status === 'Placed') && !candidate.first_contact_date) {
    updates.first_contact_date = new Date().toISOString()
  }

  updates.updated_at = new Date().toISOString()

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ')
  const values = [...Object.values(updates), req.params.id]

  db.prepare(`UPDATE candidates SET ${setClauses} WHERE id = ?`).run(...values)

  // Clear alert dismissals based on what changed so alerts re-fire after action is taken
  if (updates.status && updates.status !== candidate.status) {
    // Any status change clears all alerts for this candidate
    db.prepare('DELETE FROM alert_dismissals WHERE candidate_id = ?').run(req.params.id)
  } else {
    const toClear = []
    if (updates.last_contacted_date || updates.lmvm_count) toClear.push('lmvm_followup', 'lmvm_max', 'stuck_lmvm')
    if (updates.candidate_confirmed) toClear.push('confirm_today')
    if (updates.onboarding_complete) toClear.push('onboarding_check')
    if (toClear.length) {
      db.prepare(`DELETE FROM alert_dismissals WHERE candidate_id = ? AND alert_type IN (${toClear.map(() => '?').join(',')})`)
        .run(req.params.id, ...toClear)
    }
  }

  const updated = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id)
  res.json(updated)
})

// POST /api/candidates/:id/notes
router.post('/:id/notes', requireAuth, (req, res) => {
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id)
  if (!candidate) return res.status(404).json({ error: 'Not found' })

  const { note } = req.body
  if (!note || !note.trim()) return res.status(400).json({ error: 'Note required' })

  const timestamp = new Date().toISOString()
  const user = req.session.user.display_name || req.session.user.username
  const formattedNote = `[${timestamp}] ${user}: ${note.trim()}`

  const existing = candidate.notes || ''
  const newNotes = existing ? `${existing}\n${formattedNote}` : formattedNote

  db.prepare('UPDATE candidates SET notes = ?, updated_at = ? WHERE id = ?')
    .run(newNotes, timestamp, req.params.id)

  db.prepare('INSERT INTO activity_log (candidate_id, user, action, detail) VALUES (?, ?, ?, ?)')
    .run(candidate.id, req.session.user.username, 'note', note.trim())

  const updated = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id)
  res.json(updated)
})

// GET /api/candidates/:id/activity
router.get('/:id/activity', requireAuth, (req, res) => {
  const logs = db.prepare('SELECT * FROM activity_log WHERE candidate_id = ? ORDER BY created_at DESC').all(req.params.id)
  res.json(logs)
})

// POST /api/candidates/:id/activity
router.post('/:id/activity', requireAuth, (req, res) => {
  const { action, detail } = req.body
  db.prepare('INSERT INTO activity_log (candidate_id, user, action, detail) VALUES (?, ?, ?, ?)')
    .run(req.params.id, req.session.user.username, action || 'note', detail || '')
  res.json({ ok: true })
})

// POST /api/candidates/:id/reactivate
router.post('/:id/reactivate', requireAuth, (req, res) => {
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id)
  if (!candidate) return res.status(404).json({ error: 'Not found' })

  db.prepare(`UPDATE candidates SET is_active = 1, status = 'New', closed_reason = NULL, status_changed_at = ?, updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), new Date().toISOString(), req.params.id)

  db.prepare('INSERT INTO activity_log (candidate_id, user, action, detail) VALUES (?, ?, ?, ?)')
    .run(candidate.id, req.session.user.username, 'reactivated', `Reactivated by ${req.session.user.display_name}`)

  const updated = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id)
  res.json(updated)
})

module.exports = router
