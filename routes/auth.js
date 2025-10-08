const express = require('express')
const bcrypt = require('bcryptjs')
const { db } = require('../lib/db-mongo') // Use MongoDB
const { setAuthCookie, clearAuthCookie, authRequired } = require('../lib/auth')

const router = express.Router()

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' })
    }
    
    const col = db().collection('admin')
    const row = await col.findOne({ username }, { projection: { id: 1, username: 1, password_hash: 1 } })
    
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
    const col = db().collection('admin')
    const me = await col.findOne(
      { id: Number(req.user.sub) },
      { projection: { _id: 0, id: 1, email: 1, username: 1, created_at: 1 } }
    )
    res.json(me)
  } catch (error) {
    console.error('Me error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = { authRouter: router }
