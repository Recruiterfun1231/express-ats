function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

function requireManager(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (req.session.user.role !== 'manager') {
    return res.status(403).json({ error: 'Manager access required' })
  }
  next()
}

module.exports = { requireAuth, requireManager }
