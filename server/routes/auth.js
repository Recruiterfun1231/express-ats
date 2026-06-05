const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const db = require('../db')

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' })
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.toLowerCase().trim())
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const valid = bcrypt.compareSync(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    display_name: user.display_name
  }

  res.json({ user: req.session.user })
})

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true })
  })
})

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  res.json({ user: req.session.user })
})

// POST /api/auth/change-password
router.post('/change-password', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const { current_password, new_password } = req.body
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Both passwords required' })
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id)
  if (!user) return res.status(404).json({ error: 'User not found' })

  const valid = bcrypt.compareSync(current_password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })

  const newHash = bcrypt.hashSync(new_password, 10)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id)

  res.json({ ok: true })
})

module.exports = router
