const express = require('express')
const router = express.Router()
const multer = require('multer')
const { parse } = require('csv-parse/sync')
const db = require('../db')
const { requireManager } = require('../middleware/auth')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// Recruiter name mapping
const RECRUITER_MAP = {
  'trinidad, shayne': 'shayne', 'shayne': 'shayne',
  'noriega, luke': 'luke', 'luke': 'luke',
  'sanchez, carl': 'carl', 'carl': 'carl',
  'maruo, ru': 'ru', 'ru': 'ru',
  'lantin, pam': 'pam', 'pam': 'pam',
  'mason, bobby': 'jordan', 'bobby': 'jordan',
  'patigdas, ingrid': 'jordan', 'ingrid': 'jordan',
  'jordan': 'jordan'
}

function normalizePhone(raw) {
  if (!raw) return ''
  const s = String(raw).trim()
  // Handle scientific notation e.g. 3.15E+09
  if (/e\+/i.test(s)) {
    const num = parseFloat(s)
    if (!isNaN(num)) return String(Math.round(num)).padStart(10, '0').slice(-10)
  }
  return s.replace(/\D/g, '').slice(-10)
}

function mapRecruiter(raw) {
  if (!raw) return ''
  const lower = raw.toLowerCase().trim()
  // Try exact and prefix matches
  for (const [key, val] of Object.entries(RECRUITER_MAP)) {
    if (lower.startsWith(key) || lower.includes(key)) return val
  }
  return lower.split(/[, ]+/)[0] || ''
}

function parseDate(raw) {
  if (!raw) return null
  // MM/DD/YYYY
  const m = String(raw).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) {
    const d = new Date(`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  // Try generic parse
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function parseDateTime(raw) {
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? parseDate(raw) : d.toISOString()
}

const ACTIVE_PRIORITY = ['Placed', 'Kept', 'Confirmed', 'Scheduled', 'LMVM', 'Screening', 'New']
const CLOSED_REASONS = ['NCJO', 'Failed Audit', 'No-Show', 'Unresponsive', 'Closed', 'MISC']

function mapStatus(rawStatus) {
  // rawStatus may be a JSON array string like ["Kept","Placed"]
  let stages = []
  if (typeof rawStatus === 'string' && rawStatus.startsWith('[')) {
    try { stages = JSON.parse(rawStatus) } catch { stages = [rawStatus] }
  } else if (Array.isArray(rawStatus)) {
    stages = rawStatus
  } else {
    stages = rawStatus ? [String(rawStatus)] : []
  }

  // Check for active stages in priority order
  for (const active of ACTIVE_PRIORITY) {
    if (stages.some(s => String(s).toLowerCase().includes(active.toLowerCase()))) {
      if (active === 'Screening') return { pipeline_status: 'LMVM', closed_reason: null, is_active: 1 }
      return { pipeline_status: active, closed_reason: null, is_active: 1 }
    }
  }
  // Check for closed reasons
  for (const reason of CLOSED_REASONS) {
    if (stages.some(s => String(s).toLowerCase().includes(reason.toLowerCase()))) {
      return { pipeline_status: reason, closed_reason: reason, is_active: 0 }
    }
  }
  return { pipeline_status: 'New', closed_reason: null, is_active: 1 }
}

// POST /api/import/csv - parse and preview
router.post('/csv', requireManager, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  let records
  try {
    records = parse(req.file.buffer.toString('utf8'), {
      columns: true,
      skip_empty_lines: true,
      trim: true
    })
  } catch (err) {
    return res.status(400).json({ error: 'Failed to parse CSV: ' + err.message })
  }

  const normalized = records.map(row => {
    // Flexible column lookup (case-insensitive)
    const get = (...keys) => {
      for (const key of keys) {
        for (const [col, val] of Object.entries(row)) {
          if (col.toLowerCase().trim() === key.toLowerCase()) return val || ''
        }
      }
      return ''
    }

    const rawName = get('name')
    let first_name = '', last_name = ''
    if (rawName) {
      // Could be "Last, First" or "First Last"
      if (rawName.includes(',')) {
        const parts = rawName.split(',').map(s => s.trim())
        last_name = parts[0]; first_name = parts[1] || ''
      } else {
        const parts = rawName.trim().split(/\s+/)
        first_name = parts[0]; last_name = parts.slice(1).join(' ')
      }
    } else {
      first_name = get('first name', 'firstname')
      last_name = get('last name', 'lastname')
    }

    const rawPhone = get('phone number', 'phone')
    const phone = normalizePhone(rawPhone)
    const recruiter = mapRecruiter(get('recruiter'))
    const rawStatus = get('status')
    const { pipeline_status, closed_reason, is_active } = mapStatus(rawStatus)

    const rawOffice = get('office')
    let office = '1511'
    if (rawOffice.includes('1231')) office = '1231'
    else if (rawOffice.includes('1338')) office = '1338'
    else if (rawOffice.includes('1511')) office = '1511'
    else if (rawOffice.toLowerCase().includes('stl') || rawOffice.includes('downtown') || rawOffice.includes('maryland')) office = '1231'

    return {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone,
      office,
      recruiter,
      lead_source: get('lead source'),
      job_applied_for: get('job applied for', 'job applied'),
      pipeline_status,
      closed_reason,
      is_active,
      application_date: parseDate(get('application date')),
      first_contact_date: parseDate(get('first contact date')),
      last_contacted_date: parseDate(get('last contacted date')),
      inperson_datetime: parseDateTime(get('in-person date & time', 'in-person date', 'inperson date')),
      candidate_confirmed: get('candidate confirmed?', 'candidate confirmed').toLowerCase().includes('yes') ? 1 : 0,
      notes: get('notes')
    }
  })

  const preview = normalized.slice(0, 10)

  const previewWithFlags = preview.map(r => {
    let duplicate = null
    if (r.phone) {
      const existing = db.prepare('SELECT id, first_name, last_name FROM candidates WHERE replace(replace(replace(replace(phone,"-",""),"(",""),")","")," ","") = ?').get(r.phone)
      if (existing) duplicate = existing
    }
    return { ...r, _duplicate: duplicate }
  })

  res.json({ preview: previewWithFlags, total: normalized.length, all: normalized })
})

// POST /api/import/confirm - bulk insert
router.post('/confirm', requireManager, (req, res) => {
  const { records } = req.body
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Records array required' })
  }

  let inserted = 0, skipped = 0
  const errors = []

  const insertStmt = db.prepare(`
    INSERT INTO candidates (first_name, last_name, phone, office, status, recruiter,
      lead_source, job_applied_for, notes, closed_reason, is_active,
      application_date, first_contact_date, last_contacted_date,
      inperson_datetime, candidate_confirmed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMany = db.transaction((rows) => {
    for (const r of rows) {
      if (!r.first_name && !r.last_name) { skipped++; continue }
      if (r.phone) {
        const existing = db.prepare('SELECT id FROM candidates WHERE replace(replace(replace(replace(phone,"-",""),"(",""),")","")," ","") = ?').get(r.phone)
        if (existing) { skipped++; continue }
      }
      try {
        insertStmt.run(
          r.first_name || '', r.last_name || '', r.phone || '',
          r.office || '1511', r.pipeline_status || 'New', r.recruiter || '',
          r.lead_source || '', r.job_applied_for || '', r.notes || '',
          r.closed_reason || null, r.is_active !== undefined ? r.is_active : 1,
          r.application_date || null, r.first_contact_date || null,
          r.last_contacted_date || null, r.inperson_datetime || null,
          r.candidate_confirmed || 0
        )
        inserted++
      } catch (e) {
        errors.push(e.message)
        skipped++
      }
    }
  })

  insertMany(records)
  res.json({ inserted, skipped, errors })
})

module.exports = router
