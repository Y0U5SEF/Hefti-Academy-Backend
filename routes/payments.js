const express = require('express')
const { db } = require('../lib/db-postgres') // Use PostgreSQL
const { authRequired } = require('../lib/auth')

const router = express.Router()

router.use(authRequired)

// Get monthly tracker for a given year
router.get('/monthly', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear()
    
    const dbPool = db()
    const membersResult = await dbPool.query('SELECT id, full_name_latin, poor_family FROM members')
    const members = membersResult.rows
    
    const rowsResult = await dbPool.query(`
      SELECT member_id, month, status, amount, paid_at
      FROM payments WHERE type = 'monthly' AND year = $1
    `, [year])
    const rows = rowsResult.rows
    
    const byMember = {}
    for (const m of members) {
      byMember[m.id] = {
        memberId: m.id,
        name: m.full_name_latin,
        poor: !!m.poor_family,
        months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, status: 'pending', amount: null, paid_at: null })),
      }
    }
    
    for (const r of rows) {
      const m = byMember[r.member_id]
      if (!m) continue
      m.months[r.month - 1] = { month: r.month, status: r.status, amount: r.amount, paid_at: r.paid_at }
    }
    
    // Totals per month
    // Do not count exempt players as pending even if their cell status is 'pending'.
    const totals = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, paid: 0, pending: 0, exempt: 0, amount: 0 }))
    for (const m of Object.values(byMember)) {
      for (const cell of m.months) {
        const t = totals[cell.month - 1]
        // Normalize status for poor families: treat anything not 'paid' as 'exempt'
        const effectiveStatus = m.poor && cell.status !== 'paid' ? 'exempt' : cell.status
        t[effectiveStatus] += 1
        if (effectiveStatus === 'paid' && cell.amount) t.amount += Number(cell.amount)
      }
    }
    
    res.json({ year, members: Object.values(byMember), totals })
  } catch (error) {
    console.error('Get monthly payments error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update a monthly cell (upsert)
router.patch('/monthly', async (req, res) => {
  try {
    const { memberId, year, month, status, amount, paidAt } = req.body || {}
    if (!memberId || !year || !month || !status) return res.status(400).json({ error: 'memberId, year, month, status required' })
    
    const dbPool = db()
    // PostgreSQL upsert using ON CONFLICT
    await dbPool.query(`
      INSERT INTO payments(member_id, type, year, month, status, amount, paid_at)
      VALUES($1, 'monthly', $2, $3, $4, $5, $6)
      ON CONFLICT(member_id, type, year, month)
      DO UPDATE SET status = $4, amount = $5, paid_at = $6, updated_at = NOW()
    `, [memberId, year, month, status, amount ?? null, paidAt ?? null])
    
    res.json({ ok: true })
  } catch (error) {
    console.error('Update monthly payment error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Registration fee status
router.get('/registration/:memberId', async (req, res) => {
  try {
    const memberId = Number(req.params.memberId)
    const dbPool = db()
    const result = await dbPool.query(`
      SELECT status, amount, paid_at FROM payments WHERE member_id = $1 AND type = 'registration'
    `, [memberId])
    const row = result.rows[0]
    
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json(row)
  } catch (error) {
    console.error('Get registration payment error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.patch('/registration/:memberId', async (req, res) => {
  try {
    const memberId = Number(req.params.memberId)
    const { status, amount, paidAt } = req.body || {}
    if (!status) return res.status(400).json({ error: 'status required' })
    
    const dbPool = db()
    const result = await dbPool.query(`
      UPDATE payments SET status = $1, amount = $2, paid_at = $3, updated_at = NOW()
      WHERE member_id = $4 AND type = 'registration'
    `, [status, amount ?? null, paidAt ?? null, memberId])
    
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true })
  } catch (error) {
    console.error('Update registration payment error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Stats for a year
router.get('/stats', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear()
    const dbPool = db()
    const result = await dbPool.query(`SELECT status, amount FROM payments WHERE type = 'monthly' AND year = $1`, [year])
    const rows = result.rows
    
    let totalPaid = 0, totalPending = 0, totalExempt = 0
    for (const r of rows) {
      if (r.status === 'paid') totalPaid += Number(r.amount || 0)
      if (r.status === 'pending') totalPending += 1
      if (r.status === 'exempt') totalExempt += 1
    }
    
    res.json({ year, totalPaid, totalPending, totalExempt })
  } catch (error) {
    console.error('Get payment stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = { paymentsRouter: router }