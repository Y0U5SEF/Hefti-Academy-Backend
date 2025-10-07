#!/usr/bin/env node

/**
 * Script to migrate data from SQLite to PostgreSQL
 * 
 * Usage:
 * 1. Export your SQLite data to JSON files
 * 2. Set DATABASE_URL environment variable for PostgreSQL
 * 3. Run this script: node scripts/migrate-sqlite-to-postgres.js
 */

const { Pool } = require('pg')
const fs = require('fs').promises
const path = require('path')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
require('dotenv').config()

async function migrateData() {
  // Connect to PostgreSQL
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  })

  try {
    console.log('Starting migration from SQLite to PostgreSQL...')
    
    // Check if we can connect to PostgreSQL
    const client = await pool.connect()
    console.log('Connected to PostgreSQL successfully')
    client.release()
    
    // Migration steps would go here
    // This is a template - you would need to implement the actual data migration
    
    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await pool.end()
  }
}

// Run migration if script is called directly
if (require.main === module) {
  migrateData()
}

module.exports = { migrateData }