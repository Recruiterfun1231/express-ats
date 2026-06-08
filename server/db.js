const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const path = require('path')

const db = new Database(path.join(__dirname, 'ats.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'recruiter',
    display_name TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    office TEXT NOT NULL DEFAULT '1511',
    status TEXT NOT NULL DEFAULT 'New',
    recruiter TEXT,
    lead_source TEXT,
    job_applied_for TEXT,
    position_interest TEXT,
    notes TEXT DEFAULT '',
    closed_reason TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    days_available TEXT,
    shift_preference TEXT,
    wage_expectation TEXT,
    prior_experience TEXT,
    assigned_at TEXT DEFAULT (datetime('now')),
    status_changed_at TEXT DEFAULT (datetime('now')),
    application_date TEXT,
    first_contact_date TEXT,
    last_contacted_date TEXT,
    inperson_datetime TEXT,
    candidate_confirmed INTEGER DEFAULT 0,
    onboarding_complete INTEGER DEFAULT 0,
    placed_date TEXT,
    arrival_status TEXT,
    arrival_date TEXT,
    arrival_confirmed_at TEXT,
    lmvm_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    user TEXT,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id)
  );

  CREATE TABLE IF NOT EXISTS assignment_counters (
    office_group TEXT PRIMARY KEY,
    counter INTEGER NOT NULL DEFAULT 0
  );
`)

// Seed users if none exist
const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get()
if (userCount.cnt === 0) {
  const hash = bcrypt.hashSync('express2024', 10)
  const insert = db.prepare(
    'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)'
  )
  insert.run('jordan', hash, 'manager', 'Jordan')
  insert.run('shayne', hash, 'recruiter', 'Shayne')
  insert.run('luke', hash, 'recruiter', 'Luke')
  insert.run('carl', hash, 'recruiter', 'Carl')
  insert.run('marc', hash, 'recruiter', 'Marc')
  insert.run('ru', hash, 'recruiter', 'Ru')
  insert.run('pam', hash, 'recruiter', 'Pam')
  console.log('Seeded 7 users')
}

// Alert dismissals table
db.exec(`
  CREATE TABLE IF NOT EXISTS alert_dismissals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    candidate_id INTEGER NOT NULL,
    alert_type TEXT NOT NULL,
    dismissed_by TEXT,
    dismissed_at TEXT DEFAULT (datetime('now')),
    UNIQUE(candidate_id, alert_type)
  )
`)

// Migrate: add incentive_type column if missing
const candidateCols = db.prepare("PRAGMA table_info(candidates)").all()
if (!candidateCols.find(c => c.name === 'incentive_type')) {
  db.exec("ALTER TABLE candidates ADD COLUMN incentive_type TEXT DEFAULT NULL")
  console.log('Migrated: added incentive_type column')
}

// Seed assignment counters if not present
const c1511 = db.prepare("SELECT * FROM assignment_counters WHERE office_group = '1511'").get()
if (!c1511) {
  db.prepare("INSERT INTO assignment_counters (office_group, counter) VALUES ('1511', 0)").run()
}
const cStl = db.prepare("SELECT * FROM assignment_counters WHERE office_group = 'stl'").get()
if (!cStl) {
  db.prepare("INSERT INTO assignment_counters (office_group, counter) VALUES ('stl', 0)").run()
}

module.exports = db
