const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

let pool

function initDb() {
  if (pool) return pool
  
  // Check if DATABASE_URL is provided
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  
  // PostgreSQL connection
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  })
  
  // Test connection
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('PostgreSQL connection error:', err)
    } else {
      console.log('PostgreSQL connected successfully')
    }
  })
  
  return pool
}

// Initialize database tables
async function setupDatabase() {
  const client = await pool.connect()
  try {
    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        username TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
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
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        guardian_first_name_latin TEXT,
        guardian_last_name_latin TEXT,
        guardian_first_name_arabic TEXT,
        guardian_last_name_arabic TEXT,
        guardian_kinship TEXT,
        height_cm REAL,
        weight_kg REAL,
        scholar_level TEXT,
        school_name TEXT,
        blood_type TEXT,
        allergies TEXT,
        medical_notes TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        jersey_number INTEGER,
        preferred_position TEXT,
        dominant_foot TEXT,
        address_current TEXT,
        gender TEXT,
        academy_id TEXT UNIQUE
      )
    `)
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('registration','monthly')),
        year INTEGER,
        month INTEGER,
        status TEXT NOT NULL CHECK(status IN ('paid','pending','exempt')),
        amount REAL,
        paid_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(member_id, type, year, month)
      )
    `)
    
    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS admin_username_idx ON admin(username)')
    await client.query('CREATE INDEX IF NOT EXISTS members_academy_id_idx ON members(academy_id)')
    
    // Bootstrap admin if none exists
    const result = await client.query('SELECT id FROM admin LIMIT 1')
    if (result.rows.length === 0) {
      const email = process.env.ADMIN_EMAIL || null
      const usernameEnv = process.env.ADMIN_USERNAME || 'admin'
      const passwordHash = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('admin123', 10)
      
      await client.query(
        'INSERT INTO admin(email, username, password_hash) VALUES($1, $2, $3)',
        [email, usernameEnv, passwordHash]
      )
      console.log('Admin user bootstrapped. Username:', usernameEnv)
    }
    
    console.log('Database setup completed')
  } catch (error) {
    console.error('Database setup error:', error)
  } finally {
    client.release()
  }
}

module.exports = { initDb, setupDatabase, db: () => pool }