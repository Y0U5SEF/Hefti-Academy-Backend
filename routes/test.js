const express = require('express')
const { db, client } = require('../lib/db-mongo') // Use MongoDB

const router = express.Router()

router.get('/db-test', async (req, res) => {
  try {
    // Test database connection
    const dbc = db()
    if (!dbc) {
      return res.status(500).json({ error: 'Database not initialized' })
    }

    // Test a simple command
    await client().db(dbc.databaseName).command({ ping: 1 })
    const currentTime = new Date().toISOString()

    res.json({ 
      ok: true, 
      message: 'Database connection successful',
      currentTime,
      isVercel: !!process.env.VERCEL
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
