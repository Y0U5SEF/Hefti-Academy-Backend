const express = require('express')
const { db } = require('../lib/db-postgres') // Use PostgreSQL

const router = express.Router()

router.get('/db-test', async (req, res) => {
  try {
    // Test database connection
    const dbPool = db()
    if (!dbPool) {
      return res.status(500).json({ error: 'Database not initialized' })
    }
    
    // Test a simple query
    const result = await dbPool.query('SELECT 1 as test')
    
    res.json({ 
      ok: true, 
      message: 'Database connection successful',
      testResult: result.rows[0],
      isVercel: !!process.env.VERCEL,
      dataDir: process.env.VERCEL ? '/tmp/data' : 'local data directory'
    })
  } catch (error) {
    console.error('Database test failed:', error)
    res.status(500).json({ 
      error: 'Database test failed',
      message: error.message,
      isVercel: !!process.env.VERCEL
    })
  }
})

module.exports = { testRouter: router }