const express = require('express')
const bcrypt = require('bcryptjs')
const { db } = require('../lib/db')
const { setAuthCookie, clearAuthCookie, authRequired } = require('../lib/auth')

const router = express.Router()

router.post('/login', (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' })
  }
  const row = db().prepare('SELECT id, username, password_hash FROM admin WHERE username = ?').get(username)
  if (!row) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = bcrypt.compareSync(password, row.password_hash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  setAuthCookie(res, { sub: String(row.id), username: row.username })
  res.json({ ok: true, username: row.username })
})

router.post('/logout', (req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

router.get('/me', authRequired, (req, res) => {
  res.json({ ok: true, user: { id: req.user.sub, username: req.user.username } })
})

module.exports = { authRouter: router }
