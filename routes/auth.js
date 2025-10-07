const express = require('express')
const bcrypt = require('bcryptjs')
const { db } = require('../lib/db-postgres') // Use PostgreSQL
const { setAuthCookie, clearAuthCookie, authRequired } = require('../lib/auth')

const router = express.Router()

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }
    
    const dbPool = db()
    const result = await dbPool.query('SELECT id, username, password_hash FROM admin WHERE username = $1', [username])
    const row = result.rows[0]
    
    if (!row) return res.status(401).json({ error: 'Invalid credentials' })
    
    const ok = bcrypt.compareSync(password, row.password_hash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    
    setAuthCookie(res, { sub: String(row.id), username: row.username })
    res.json({ ok: true, username: row.username })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/logout', (req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

router.get('/me', authRequired, async (req, res) => {
  try {
    const dbPool = db()
    const result = await dbPool.query('SELECT id, email, username, created_at FROM admin WHERE id = $1', [Number(req.user.sub)])
    const me = result.rows[0]
    res.json(me)
  } catch (error) {
    console.error('Me error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = { authRouter: router }