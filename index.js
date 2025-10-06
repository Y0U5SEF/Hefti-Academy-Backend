require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') })
require('dotenv').config() // also load .env

const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const path = require('path')
const { initDb, db } = require('./lib/db')
const fs = require('fs')
const { authRouter } = require('./routes/auth')
const { membersRouter } = require('./routes/members')
const { paymentsRouter } = require('./routes/payments')
const { adminRouter } = require('./routes/admin')

const PORT = process.env.SERVER_PORT ? Number(process.env.SERVER_PORT) : 4000
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000'

async function main() {
  initDb()

  const app = express()
  app.use(express.json({ limit: '2mb' }))
  app.use(cookieParser())
  app.use(
    cors({
      origin: ORIGIN,
      credentials: true,
    })
  )

  // Static uploads
  const uploadsDir = path.join(__dirname, 'data', 'uploads')
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
  app.use('/uploads', express.static(uploadsDir))

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/members', membersRouter)
  // Friendlier public member card path (optional)
  if ((process.env.ENABLE_PUBLIC_MEMBER_CARD || 'false').toLowerCase() === 'true') {
    app.get('/m/:academyId', (req, res) => {
      res.redirect(302, `/api/members/card/${encodeURIComponent(req.params.academyId)}`)
    })
  }
  app.use('/api/payments', paymentsRouter)
  app.use('/api/admin', adminRouter)
  app.post('/api/files/upload-base64', (req, res) => {
    try {
      const { dataUrl, filenameHint } = req.body || {}
      if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ error: 'dataUrl required' })
      const m = dataUrl.match(/^data:(.+);base64,(.+)$/)
      if (!m) return res.status(400).json({ error: 'Invalid dataUrl' })
      const mime = m[1]
      const buf = Buffer.from(m[2], 'base64')
      const ext = mime === 'image/png' ? 'png' : 'jpg'
      const safeName = (filenameHint || 'image').replace(/[^a-zA-Z0-9-_]/g, '')
      const ts = Date.now()
      const name = `${safeName}-${ts}.${ext}`
      const filePath = path.join(uploadsDir, name)
      fs.writeFileSync(filePath, buf)
      res.json({ url: `/uploads/${name}` })
    } catch (e) {
      console.error('upload-base64 error', e)
      res.status(500).json({ error: 'Upload failed' })
    }
  })

  app.use((err, req, res, next) => {
    console.error('Error:', err)
    res.status(err.status || 500).json({ error: err.message || 'Server error' })
  })

  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
