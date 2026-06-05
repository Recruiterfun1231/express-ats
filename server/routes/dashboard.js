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

  // 1. New AND application_date > 24 hours ago
  const newUncontacted = db.prepare(`
    SELECT id, first_name, last_name, recruiter, office, application_date
    FROM candidates
    WHERE status = 'New' AND is_active = 1
    AND application_date IS NOT NULL
    AND julianday('now') - julianday(application_date) > 1
    ${baseFilter}
  `).all()
  newUncontacted.forEach(c => {
    alerts.push({
      type: 'new_uncontacted',
      severity: 'warning',
      message: `📞 Call ${c.first_name} ${c.last_name} — applied 24+ hrs ago, not yet contacted`,
      candidate_id: c.id, recruiter: c.recruiter, office: c.office
    })
  })

  // 2. LMVM AND last_contacted_date > 24 hours AND lmvm_count < 3
  const lmvmFollowup = db.prepare(`
    SELECT id, first_name, last_name, recruiter, office, last_contacted_date, lmvm_count
    FROM candidates
    WHERE status = 'LMVM' AND is_active = 1
    AND (last_contacted_date IS NULL OR julianday('now') - julianday(last_contacted_date) > 1)
    AND (lmvm_count IS NULL OR lmvm_count < 3)
    ${baseFilter}
  `).all()
  lmvmFollowup.forEach(c => {
    alerts.push({
      type: 'lmvm_followup',
      severity: 'warning',
      message: `📞 Follow up with ${c.first_name} ${c.last_name} — voicemail left 24+ hrs ago`,
      candidate_id: c.id, recruiter: c.recruiter, office: c.office
    })
  })

  // 3. LMVM count >= 3 AND still active
  const lmvmMax = db.prepare(`
    SELECT id, first_name, last_name, recruiter, office, lmvm_count
    FROM candidates
    WHERE status = 'LMVM' AND is_active = 1 AND lmvm_count >= 3
    ${baseFilter}
  `).all()
  lmvmMax.forEach(c => {
    alerts.push({
      type: 'lmvm_max',
      severity: 'error',
      message: `⚠️ ${c.first_name} ${c.last_name} — 3 voicemails unanswered. Consider closing as Unresponsive`,
      candidate_id: c.id, recruiter: c.recruiter, office: c.office
    })
  })

  // 4. Scheduled AND inperson_datetime is today AND candidate_confirmed = 0
  const needConfirm = db.prepare(`
    SELECT id, first_name, last_name, recruiter, office, inperson_datetime
    FROM candidates
    WHERE status = 'Scheduled' AND is_active = 1
    AND candidate_confirmed = 0
    AND date(inperson_datetime) = date('now')
    ${baseFilter}
  `).all()
  needConfirm.forEach(c => {
    const timeStr = c.inperson_datetime ? new Date(c.inperson_datetime).toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit',timeZone:'America/Chicago'}) : ''
    alerts.push({
      type: 'confirm_today',
      severity: 'warning',
      message: `✅ Confirm ${c.first_name} ${c.last_name}'s in-person today${timeStr ? ` at ${timeStr}` : ''}`,
      candidate_id: c.id, recruiter: c.recruiter, office: c.office
    })
  })

  // 5. Scheduled/Confirmed AND inperson_datetime is today or tomorrow AND onboarding_complete = 0
  const checkOnboarding = db.prepare(`
    SELECT id, first_name, last_name, recruiter, office, inperson_datetime
    FROM candidates
    WHERE status IN ('Scheduled','Confirmed') AND is_active = 1
    AND onboarding_complete = 0
    AND (date(inperson_datetime) = date('now') OR date(inperson_datetime) = date('now','+1 day'))
    ${baseFilter}
  `).all()
  checkOnboarding.forEach(c => {
    const dateStr = c.inperson_datetime ? new Date(c.inperson_datetime).toLocaleDateString('en-US', {month:'short',day:'numeric',timeZone:'America/Chicago'}) : ''
    alerts.push({
      type: 'onboarding_check',
      severity: 'info',
      message: `📋 Check onboarding for ${c.first_name} ${c.last_name} — in-person is ${dateStr}`,
      candidate_id: c.id, recruiter: c.recruiter, office: c.office
    })
  })

  res.json(alerts)
})

module.exports = router
