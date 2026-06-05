const express = require('express')
const router = express.Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')
const multer = require('multer')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// GET /api/arrival - get kept/placed candidates
router.get('/', requireAuth, (req, res) => {
  const { office, recruiter } = req.query
  let query = "SELECT * FROM candidates WHERE status IN ('Kept', 'Placed') AND is_active = 1"
  const params = []
  if (office) { query += ' AND office = ?'; params.push(office) }
  if (recruiter) { query += ' AND recruiter = ?'; params.push(recruiter) }
  query += ' ORDER BY status_changed_at DESC'
  const candidates = db.prepare(query).all(...params)
  res.json(candidates)
})

// POST /api/arrival/analyze - send image to Claude for name matching
router.post('/analyze', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' })

  const { office } = req.body

  // Get current kept/placed candidates
  let query = "SELECT id, first_name, last_name, status FROM candidates WHERE status IN ('Kept', 'Placed') AND is_active = 1"
  const params = []
  if (office) { query += ' AND office = ?'; params.push(office) }
  const candidates = db.prepare(query).all(...params)

  if (!process.env.ANTHROPIC_API_KEY) {
    // Fallback: return candidates without AI analysis
    return res.json({
      matches: candidates.map(c => ({ ...c, arrival_match: false, confidence: 0 })),
      raw_text: 'AI analysis unavailable - no API key configured'
    })
  }

  try {
    const Anthropic = require('@anthropic-ai/sdk')
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })

    const base64Image = req.file.buffer.toString('base64')
    const mimeType = req.file.mimetype || 'image/jpeg'

    const candidateList = candidates.map(c => `${c.id}: ${c.first_name} ${c.last_name}`).join('\n')

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Image }
          },
          {
            type: 'text',
            text: 'This is a table from a staffing company daily arrival email. Each row has a due date/time, company name, and candidate name. Green rows = arrived, red rows = did not arrive. Extract every row as JSON: {name: \'Last, First\', company: string, due_datetime: string, arrived: boolean}. Return only a valid JSON array, nothing else.'
          }
        ]
      }]
    })

    const text = message.content[0].text
    let parsedRows = []
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) parsedRows = JSON.parse(jsonMatch[0])
    } catch (e) { /* use empty */ }

    // Fuzzy match each extracted name against candidates
    const fuzzyMatch = (extractedName, cands) => {
      const norm = s => s.toLowerCase().replace(/[^a-z]/g, '')
      const nameParts = extractedName.toLowerCase().split(/[, ]+/).filter(Boolean)
      let best = null, bestScore = 0
      for (const c of cands) {
        const fn = norm(c.first_name), ln = norm(c.last_name)
        const fullName = fn + ln
        const score = nameParts.reduce((acc, part) => {
          const p = norm(part)
          if (fn.includes(p) || ln.includes(p) || fullName.includes(p)) return acc + 1
          return acc
        }, 0) / Math.max(nameParts.length, 1)
        if (score > bestScore && score >= 0.5) { bestScore = score; best = c }
      }
      return best ? { candidate: best, confidence: bestScore } : null
    }

    const previewRows = parsedRows.map(row => {
      const match = fuzzyMatch(row.name || '', candidates)
      return {
        extracted_name: row.name,
        company: row.company,
        due_datetime: row.due_datetime,
        arrived: row.arrived,
        matched_candidate: match?.candidate || null,
        confidence: match?.confidence || 0
      }
    })

    res.json({ preview: previewRows, raw_text: text })
  } catch (err) {
    console.error('Claude API error:', err.message)
    res.json({
      matches: candidates.map(c => ({ ...c, arrival_match: false, confidence: 0 })),
      raw_text: `Analysis failed: ${err.message}`
    })
  }
})

// POST /api/arrival/confirm - save arrival updates
router.post('/confirm', requireAuth, (req, res) => {
  const { arrivals } = req.body
  if (!arrivals || !Array.isArray(arrivals)) {
    return res.status(400).json({ error: 'arrivals array required' })
  }

  const updateStmt = db.prepare(
    'UPDATE candidates SET arrival_status = ?, arrival_confirmed_at = ?, updated_at = ? WHERE id = ?'
  )

  const now = new Date().toISOString()
  const update = db.transaction((rows) => {
    for (const row of rows) {
      updateStmt.run(row.arrival_status, now, now, row.id)
      db.prepare('INSERT INTO activity_log (candidate_id, user, action, detail) VALUES (?, ?, ?, ?)')
        .run(row.id, req.session.user.username, 'arrival_update', `Arrival status: ${row.arrival_status}`)
    }
  })

  update(arrivals)
  res.json({ ok: true, updated: arrivals.length })
})

module.exports = router
