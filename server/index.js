const express = require('express')
const session = require('express-session')
const cors = require('cors')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3001

// Trust Railway's proxy so secure cookies work
app.set('trust proxy', 1)

// Middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cors({
  origin: true, // reflect the request origin — works for same-origin Railway deployment
  credentials: true
}))
app.use(session({
  secret: process.env.SESSION_SECRET || 'express-ats-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: 'auto', // automatically uses secure on HTTPS, plain on HTTP
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))

// Routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/candidates', require('./routes/candidates'))
app.use('/api/dashboard', require('./routes/dashboard'))
app.use('/api/import', require('./routes/import'))
app.use('/api/arrival', require('./routes/arrival'))

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`ATS Server running on http://localhost:${PORT}`)
})
