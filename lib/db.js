const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')

let db

function initDb() {
  if (db) return db
  const dataDir = path.join(__dirname, '..', 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  const file = path.join(dataDir, 'data.sqlite')
  db = new Database(file)
  db.pragma('journal_mode = WAL')

  // Admin table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      username TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()

  // Migrate: add username column if missing
  const adminCols = db.prepare("PRAGMA table_info('admin')").all()
  const hasUsername = adminCols.some(c => c.name === 'username')
  if (!hasUsername) {
    db.prepare("ALTER TABLE admin ADD COLUMN username TEXT").run()
  }
  // Ensure unique index on username (allows multiple NULLs but we will set values)
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS admin_username_idx ON admin(username)').run()

  // Members table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name_latin TEXT,
      last_name_latin TEXT,
      first_name_arabic TEXT,
      last_name_arabic TEXT,
      full_name_latin TEXT NOT NULL,
      full_name_arabic TEXT,
      date_of_birth TEXT NOT NULL,
      place_of_birth TEXT,
      id_type TEXT CHECK(id_type IN ('birth_cert','national_id')),
      id_number TEXT,
      poor_family INTEGER NOT NULL DEFAULT 0,
      photo_url TEXT,
      guardian_full_name TEXT,
      guardian_id_number TEXT,
      guardian_phone TEXT,
      guardian_date_of_birth TEXT,
      guardian_place_of_birth TEXT,
      guardian_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()

  // Migrate: add split name and photo columns if missing
  const memberCols = db.prepare("PRAGMA table_info('members')").all()
  const ensureCol = (name, def) => {
    if (!memberCols.some(c => c.name === name)) {
      db.prepare(`ALTER TABLE members ADD COLUMN ${name} ${def}`).run()
    }
  }
  ensureCol('first_name_latin', 'TEXT')
  ensureCol('last_name_latin', 'TEXT')
  ensureCol('first_name_arabic', 'TEXT')
  ensureCol('last_name_arabic', 'TEXT')
  ensureCol('photo_url', 'TEXT')
  ensureCol('guardian_first_name_latin', 'TEXT')
  ensureCol('guardian_last_name_latin', 'TEXT')
  ensureCol('guardian_first_name_arabic', 'TEXT')
  ensureCol('guardian_last_name_arabic', 'TEXT')
  ensureCol('guardian_kinship', 'TEXT')
  // Additional info columns
  ensureCol('height_cm', 'REAL')
  ensureCol('weight_kg', 'REAL')
  ensureCol('scholar_level', 'TEXT')
  ensureCol('school_name', 'TEXT')
  ensureCol('blood_type', 'TEXT')
  ensureCol('allergies', 'TEXT')
  ensureCol('medical_notes', 'TEXT')
  ensureCol('emergency_contact_name', 'TEXT')
  ensureCol('emergency_contact_phone', 'TEXT')
  ensureCol('jersey_number', 'INTEGER')
  ensureCol('preferred_position', 'TEXT')
  ensureCol('dominant_foot', 'TEXT')
  ensureCol('address_current', 'TEXT')
  // Gender column (male/female)
  ensureCol('gender', 'TEXT')
  // Academy ID (e.g., HFA0001)
  ensureCol('academy_id', 'TEXT')
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS members_academy_id_idx ON members(academy_id)').run()

  // Backfill academy_id for existing rows if missing
  try {
    const missing = db.prepare("SELECT id FROM members WHERE academy_id IS NULL OR academy_id = ''").all()
    const upd = db.prepare('UPDATE members SET academy_id = ? WHERE id = ?')
    for (const r of missing) {
      const aid = 'HFA' + String(r.id).padStart(4, '0')
      upd.run(aid, r.id)
    }
  } catch {}

  // Payments table (registration + monthly)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('registration','monthly')),
      year INTEGER,
      month INTEGER,
      status TEXT NOT NULL CHECK(status IN ('paid','pending','exempt')),
      amount REAL,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(member_id, type, year, month)
    )
  `).run()

  // Bootstrap admin if none exists
  const row = db.prepare('SELECT id FROM admin LIMIT 1').get()
  if (!row) {
    const email = process.env.ADMIN_EMAIL || null
    const usernameEnv = process.env.ADMIN_USERNAME || 'admin'
    const passwordHash = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('admin123', 10)

    // Ensure username uniqueness if needed
    let username = usernameEnv
    let suffix = 1
    while (db.prepare('SELECT 1 FROM admin WHERE username = ?').get(username)) {
      username = `${usernameEnv}${suffix++}`
    }

    db.prepare(
      'INSERT INTO admin(email, username, password_hash) VALUES(?, ?, ?)' 
    ).run(email, username, passwordHash)
    console.log('Admin user bootstrapped. Username:', username)
  } else {
    // Ensure existing admin(s) have username
    const admins = db.prepare('SELECT id, email, username FROM admin').all()
    for (const a of admins) {
      if (!a.username) {
        const base = (process.env.ADMIN_USERNAME || (a.email ? a.email.split('@')[0] : 'admin'))
        let username = base
        let i = 1
        while (db.prepare('SELECT 1 FROM admin WHERE username = ? AND id != ?').get(username, a.id)) {
          username = `${base}${i++}`
        }
        db.prepare('UPDATE admin SET username = ?, updated_at = datetime(\'now\') WHERE id = ?').run(username, a.id)
      }
    }
  }

  return db
}

module.exports = { initDb, db: () => db }
