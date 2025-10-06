const express = require('express')
const bcrypt = require('bcryptjs')
const { db } = require('../lib/db')
const { authRequired } = require('../lib/auth')

const router = express.Router()

router.use(authRequired)

router.get('/profile', (req, res) => {
  const me = db().prepare('SELECT id, email, username, created_at FROM admin WHERE id = ?').get(Number(req.user.sub))
  res.json(me)
})

router.post('/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  const id = Number(req.user.sub)
  const row = db().prepare('SELECT password_hash FROM admin WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  const ok = bcrypt.compareSync(currentPassword || '', row.password_hash)
  if (!ok) return res.status(400).json({ error: 'Current password incorrect' })
  const hash = bcrypt.hashSync(newPassword, 10)
  db().prepare('UPDATE admin SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hash, id)
  res.json({ ok: true })
})

module.exports = { adminRouter: router }
