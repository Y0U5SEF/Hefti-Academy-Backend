const express = require('express')
const bcrypt = require('bcryptjs')
const { db } = require('../lib/db-mongo') // Use MongoDB
const { authRequired } = require('../lib/auth')

const router = express.Router()

router.use(authRequired)

router.get('/profile', async (req, res) => {
  try {
    const col = db().collection('admin')
    const me = await col.findOne(
      { id: Number(req.user.sub) },
      { projection: { _id: 0, id: 1, email: 1, username: 1, created_at: 1 } }
    )
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
    
    const col = db().collection('admin')
    const row = await col.findOne({ id }, { projection: { password_hash: 1 } })
    
    if (!row) return res.status(404).json({ error: 'Not found' })
    
    const ok = bcrypt.compareSync(currentPassword || '', row.password_hash)
    if (!ok) return res.status(400).json({ error: 'Current password incorrect' })
    
    const hash = bcrypt.hashSync(newPassword, 10)
    await col.updateOne({ id }, { $set: { password_hash: hash, updated_at: new Date() } })
    
    res.json({ ok: true })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = { adminRouter: router }
