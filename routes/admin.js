const express = require('express')
const bcrypt = require('bcryptjs')
const { db } = require('../lib/db-postgres') // Use PostgreSQL
const { authRequired } = require('../lib/auth')

const router = express.Router()

router.use(authRequired)

router.get('/profile', async (req, res) => {
  try {
    const dbPool = db()
    const result = await dbPool.query('SELECT id, email, username, created_at FROM admin WHERE id = $1', [Number(req.user.sub)])
    const me = result.rows[0]
    res.json(me)
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {}
    const id = Number(req.user.sub)
    
    const dbPool = db()
    const result = await dbPool.query('SELECT password_hash FROM admin WHERE id = $1', [id])
    const row = result.rows[0]
    
    if (!row) return res.status(404).json({ error: 'Not found' })
    
    const ok = bcrypt.compareSync(currentPassword || '', row.password_hash)
    if (!ok) return res.status(400).json({ error: 'Current password incorrect' })
    
    const hash = bcrypt.hashSync(newPassword, 10)
    await dbPool.query('UPDATE admin SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, id])
    
    res.json({ ok: true })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = { adminRouter: router }