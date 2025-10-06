const express = require('express')
const { db } = require('../lib/db')
const { authRequired } = require('../lib/auth')

const router = express.Router()

router.use(authRequired)

// Get monthly tracker for a given year
router.get('/monthly', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear()
  const members = db().prepare('SELECT id, full_name_latin, poor_family FROM members').all()
  const rows = db().prepare(`
    SELECT member_id, month, status, amount, paid_at
    FROM payments WHERE type = 'monthly' AND year = ?
  `).all(year)
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
})

// Update a monthly cell (upsert)
router.patch('/monthly', (req, res) => {
  const { memberId, year, month, status, amount, paidAt } = req.body || {}
  if (!memberId || !year || !month || !status) return res.status(400).json({ error: 'memberId, year, month, status required' })
  db().prepare(`
    INSERT INTO payments(member_id, type, year, month, status, amount, paid_at)
    VALUES(?, 'monthly', ?, ?, ?, ?, ?)
    ON CONFLICT(member_id, type, year, month)
    DO UPDATE SET status = excluded.status, amount = excluded.amount, paid_at = excluded.paid_at, updated_at = datetime('now')
  `).run(memberId, year, month, status, amount ?? null, paidAt ?? null)
  res.json({ ok: true })
})

// Registration fee status
router.get('/registration/:memberId', (req, res) => {
  const memberId = Number(req.params.memberId)
  const row = db().prepare(`
    SELECT status, amount, paid_at FROM payments WHERE member_id = ? AND type = 'registration'
  `).get(memberId)
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json(row)
})

router.patch('/registration/:memberId', (req, res) => {
  const memberId = Number(req.params.memberId)
  const { status, amount, paidAt } = req.body || {}
  if (!status) return res.status(400).json({ error: 'status required' })
  db().prepare(`
    UPDATE payments SET status = ?, amount = ?, paid_at = ?, updated_at = datetime('now')
    WHERE member_id = ? AND type = 'registration'
  `).run(status, amount ?? null, paidAt ?? null, memberId)
  res.json({ ok: true })
})

// Stats for a year
router.get('/stats', (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear()
  const rows = db().prepare(`SELECT status, amount FROM payments WHERE type = 'monthly' AND year = ?`).all(year)
  let totalPaid = 0, totalPending = 0, totalExempt = 0
  for (const r of rows) {
    if (r.status === 'paid') totalPaid += Number(r.amount || 0)
    if (r.status === 'pending') totalPending += 1
    if (r.status === 'exempt') totalExempt += 1
  }
  res.json({ year, totalPaid, totalPending, totalExempt })
})

module.exports = { paymentsRouter: router }
