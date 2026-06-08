const express = require('express')
const router = express.Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

// GET /api/dashboard/stats
router.get('/stats', requireAuth, (req, res) => {
  const { recruiter, office, dateRange } = req.query

  let dateFilter = ''
  const now = new Date()
  if (dateRange === '7d') {
    const d = new Date(now); d.setDate(d.getDate() - 7)
    dateFilter = `AND created_at >= '${d.toISOString()}'`
  } else if (dateRange === '30d') {
    const d = new Date(now); d.setDate(d.getDate() - 30)
    dateFilter = `AND created_at >= '${d.toISOString()}'`
  } else if (dateRange === '90d') {
    const d = new Date(now); d.setDate(d.getDate() - 90)
    dateFilter = `AND created_at >= '${d.toISOString()}'`
  }

  let baseFilter = `WHERE 1=1 ${dateFilter}`
  const params = []
  if (recruiter) { baseFilter += ' AND recruiter = ?'; params.push(recruiter) }
  if (office) { baseFilter += ' AND office = ?'; params.push(office) }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM candidates ${baseFilter}`).get(...params)
  const active = db.prepare(`SELECT COUNT(*) as cnt FROM candidates ${baseFilter} AND is_active = 1`).get(...params)
  const placed = db.prepare(`SELECT COUNT(*) as cnt FROM candidates ${baseFilter} AND status = 'Placed'`).get(...params)
  const kept = db.prepare(`SELECT COUNT(*) as cnt FROM candidates ${baseFilter} AND status = 'Kept'`).get(...params)
  const closed = db.prepare(`SELECT COUNT(*) as cnt FROM candidates ${baseFilter} AND is_active = 0`).get(...params)

  // By status
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as cnt FROM candidates ${baseFilter} AND is_active = 1 GROUP BY status
  `).all(...params)

  // By recruiter
  const byRecruiter = db.prepare(`
    SELECT recruiter, COUNT(*) as total,
      SUM(CASE WHEN status = 'Placed' THEN 1 ELSE 0 END) as placed,
      SUM(CASE WHEN status = 'Kept' THEN 1 ELSE 0 END) as kept,
      SUM(CASE WHEN status = 'Confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'Scheduled' THEN 1 ELSE 0 END) as scheduled
    FROM candidates ${baseFilter}
    GROUP BY recruiter
    ORDER BY total DESC
  `).all(...params)

  // By lead source
  const bySource = db.prepare(`
    SELECT lead_source, COUNT(*) as cnt FROM candidates ${baseFilter} GROUP BY lead_source ORDER BY cnt DESC
  `).all(...params)

  // By office
  const byOffice = db.prepare(`
    SELECT office, COUNT(*) as cnt FROM candidates ${baseFilter} GROUP BY office
  `).all(...params)

  // Daily trend (last 14 days)
  const trend = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as cnt
    FROM candidates
    WHERE created_at >= date('now', '-14 days')
    GROUP BY day ORDER BY day ASC
  `).all()

  // Conversion funnel
  const funnel = [
    { stage: 'New', count: 0 },
    { stage: 'LMVM', count: 0 },
    { stage: 'Scheduled', count: 0 },
    { stage: 'Confirmed', count: 0 },
    { stage: 'Kept', count: 0 },
    { stage: 'Placed', count: 0 }
  ]
  const funnelData = db.prepare(`
    SELECT status, COUNT(*) as cnt FROM candidates ${baseFilter} GROUP BY status
  `).all(...params)
  funnelData.forEach(row => {
    const found = funnel.find(f => f.stage === row.status)
    if (found) found.count = row.cnt
  })

  res.json({
    summary: {
      total: total.cnt,
      active: active.cnt,
      placed: placed.cnt,
      kept: kept.cnt,
      closed: closed.cnt
    },
    byStatus,
    byRecruiter,
    bySource,
    byOffice,
    trend,
    funnel
  })
})

// GET /api/dashboard/alerts
router.get('/alerts', requireAuth, (req, res) => {
  const alerts = []
  const { recruiter } = req.query
  const isManager = req.session.user.role === 'manager'
  const filterRecruiter = isManager ? (recruiter || null) : req.session.user.username
  const baseFilter = filterRecruiter ? `AND recruiter = '${filterRecruiter}'` : ''

  // Load all current dismissals so we can skip them
  const dismissalRows = db.prepare('SELECT candidate_id, alert_type FROM alert_dismissals').all()
  const dismissed = new Set(dismissalRows.map(r => `${r.candidate_id}|${r.alert_type}`))
  const isDismissed = (id, type) => dismissed.has(`${id}|${type}`)

  const push = (type, c, message) => {
    if (!isDismissed(c.id, type)) {
      alerts.push({ type, message, candidate_id: c.id, recruiter: c.recruiter, office: c.office })
    }
  }

  // 1. New — applied 24+ hours ago, never contacted
  db.prepare(`
    SELECT id, first_name, last_name, recruiter, office, application_date
    FROM candidates
    WHERE status = 'New' AND is_active = 1
    AND application_date IS NOT NULL
    AND julianday('now') - julianday(application_date) > 1
    ${baseFilter}
  `).all().forEach(c => push('new_uncontacted', c,
    `📞 ${c.first_name} ${c.last_name} — applied 24+ hrs ago, not yet contacted`))

  // 2. LMVM — voicemail left 24+ hrs ago, under 3 attempts
  db.prepare(`
    SELECT id, first_name, last_name, recruiter, office, last_contacted_date, lmvm_count
    FROM candidates
    WHERE status = 'LMVM' AND is_active = 1
    AND (last_contacted_date IS NULL OR julianday('now') - julianday(last_contacted_date) > 1)
    AND (lmvm_count IS NULL OR lmvm_count < 3)
    ${baseFilter}
  `).all().forEach(c => push('lmvm_followup', c,
    `📞 ${c.first_name} ${c.last_name} — voicemail left 24+ hrs ago, call back (attempt ${c.lmvm_count || 1} of 3)`))

  // 3. LMVM — 3 voicemails unanswered, should be closed
  db.prepare(`
    SELECT id, first_name, last_name, recruiter, office, lmvm_count
    FROM candidates
    WHERE status = 'LMVM' AND is_active = 1 AND lmvm_count >= 3
    ${baseFilter}
  `).all().forEach(c => push('lmvm_max', c,
    `⚠️ ${c.first_name} ${c.last_name} — 3 voicemails unanswered, close as Unresponsive`))

  // 4. Scheduled today — not yet confirmed
  db.prepare(`
    SELECT id, first_name, last_name, recruiter, office, inperson_datetime
    FROM candidates
    WHERE status = 'Scheduled' AND is_active = 1
    AND candidate_confirmed = 0
    AND date(inperson_datetime) = date('now')
    ${baseFilter}
  `).all().forEach(c => {
    const t = c.inperson_datetime ? new Date(c.inperson_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' }) : ''
    push('confirm_today', c, `✅ ${c.first_name} ${c.last_name} — confirm today's in-person${t ? ` at ${t}` : ''}`)
  })

  // 5. Scheduled/Confirmed — interview is upcoming, no activity for 48+ hrs
  db.prepare(`
    SELECT id, first_name, last_name, recruiter, office, inperson_datetime, updated_at, status
    FROM candidates
    WHERE status IN ('Scheduled','Confirmed') AND is_active = 1
    AND inperson_datetime > datetime('now')
    AND julianday('now') - julianday(updated_at) > 2
    ${baseFilter}
  `).all().forEach(c => {
    const d = c.inperson_datetime ? new Date(c.inperson_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' }) : ''
    push('scheduled_silent', c,
      `🔔 ${c.first_name} ${c.last_name} — ${c.status} for ${d}, no follow-up in 48+ hrs`)
  })

  // 6. Scheduled/Confirmed — interview date has already passed, status not updated
  db.prepare(`
    SELECT id, first_name, last_name, recruiter, office, inperson_datetime, status
    FROM candidates
    WHERE status IN ('Scheduled','Confirmed') AND is_active = 1
    AND inperson_datetime IS NOT NULL
    AND inperson_datetime < datetime('now')
    ${baseFilter}
  `).all().forEach(c => {
    const d = c.inperson_datetime ? new Date(c.inperson_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' }) : ''
    push('past_inperson', c,
      `❗ ${c.first_name} ${c.last_name} — in-person was ${d}, update their status (Kept, No-Show, etc.)`)
  })

  // 7. Kept — no placement after 7 days
  db.prepare(`
    SELECT id, first_name, last_name, recruiter, office, status_changed_at
    FROM candidates
    WHERE status = 'Kept' AND is_active = 1
    AND status_changed_at IS NOT NULL
    AND julianday('now') - julianday(status_changed_at) > 7
    ${baseFilter}
  `).all().forEach(c => push('kept_no_placement', c,
    `🏁 ${c.first_name} ${c.last_name} — Kept 7+ days ago, follow up on placement`))

  // 8. Onboarding not complete — in-person is today or tomorrow
  db.prepare(`
    SELECT id, first_name, last_name, recruiter, office, inperson_datetime
    FROM candidates
    WHERE status IN ('Scheduled','Confirmed') AND is_active = 1
    AND onboarding_complete = 0
    AND (date(inperson_datetime) = date('now') OR date(inperson_datetime) = date('now','+1 day'))
    ${baseFilter}
  `).all().forEach(c => {
    const d = c.inperson_datetime ? new Date(c.inperson_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' }) : ''
    push('onboarding_check', c, `📋 ${c.first_name} ${c.last_name} — check onboarding before in-person on ${d}`)
  })

  res.json(alerts)
})

// POST /api/dashboard/alerts/dismiss
router.post('/alerts/dismiss', requireAuth, (req, res) => {
  const { candidate_id, alert_type } = req.body
  if (!candidate_id || !alert_type) return res.status(400).json({ error: 'candidate_id and alert_type required' })
  db.prepare('INSERT OR REPLACE INTO alert_dismissals (candidate_id, alert_type, dismissed_by) VALUES (?, ?, ?)')
    .run(candidate_id, alert_type, req.session.user.username)
  res.json({ ok: true })
})

module.exports = router
