require('dotenv').config({ path: require('path').join(process.cwd(), '.env.local') })
require('dotenv').config() // also load .env

const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const path = require('path')
const { initDb, setupDatabase } = require('./lib/db-postgres') // Use PostgreSQL
const fs = require('fs')
const { authRouter } = require('./routes/auth')
const { membersRouter } = require('./routes/members')
const { paymentsRouter } = require('./routes/payments')
const { adminRouter } = require('./routes/admin')
const { testRouter } = require('./routes/test')
const { contactRouter } = require('./routes/contact')

const PORT = process.env.SERVER_PORT ? Number(process.env.SERVER_PORT) : 4000
// Support one or more allowed origins (comma-separated)
const ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())

// Initialize the database
let dbPool;
try {
  dbPool = initDb()
  // Setup database tables asynchronously
  setupDatabase().catch(error => {
    console.error('Database setup error:', error)
  })
} catch (error) {
  console.error('Failed to initialize database:', error)
}

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use(
  cors({
    origin: ORIGINS,
    credentials: true,
  })
)

// Static uploads - use /tmp for Vercel
const isVercel = !!process.env.VERCEL
const uploadsDir = isVercel 
  ? path.join('/tmp', 'uploads') 
  : path.join(__dirname, 'data', 'uploads')
  
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true })
  } catch (error) {
    console.error('Failed to create uploads directory:', error)
  }
}
app.use('/uploads', express.static(uploadsDir))

// Add a root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hefti Academy API Server', 
    status: 'ok',
    timestamp: new Date().toISOString(),
    documentation: 'API documentation will be available at /api/docs (coming soon)',
    health: '/api/health',
    version: '1.0.0'
  })
})

// Add API documentation route
app.get('/api/docs', (req, res) => {
  res.json({ 
    message: 'Hefti Academy API Documentation',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me'
      },
      members: {
        getAll: 'GET /api/members',
        getById: 'GET /api/members/:id',
        create: 'POST /api/members',
        update: 'PUT /api/members/:id',
        delete: 'DELETE /api/members/:id',
        getCard: 'GET /api/members/card/:academyId',
        getPdf: 'GET /api/members/:id/pdf'
      },
      payments: {
        getMonthly: 'GET /api/payments/monthly',
        updateMonthly: 'PATCH /api/payments/monthly',
        getRegistration: 'GET /api/payments/registration/:memberId',
        updateRegistration: 'PATCH /api/payments/registration/:memberId',
        getStats: 'GET /api/payments/stats'
      },
      admin: {
        profile: 'GET /api/admin/profile',
        changePassword: 'POST /api/admin/change-password'
      },
      test: {
        dbTest: 'GET /api/test/db-test'
      },
      health: 'GET /api/health',
      env: 'GET /api/env'
    },
    timestamp: new Date().toISOString()
  })
})

app.get('/api/health', (req, res) => {
  try {
    res.json({ 
      ok: true, 
      ts: new Date().toISOString(),
      isVercel: !!process.env.VERCEL,
      environment: process.env.NODE_ENV || 'development',
      database: 'PostgreSQL'
    })
  } catch (error) {
    console.error('Health check failed:', error)
    res.status(500).json({ 
      ok: false, 
      error: error.message,
      isVercel: !!process.env.VERCEL
    })
  }
})

app.get('/api/env', (req, res) => {
  // Return environment info (without sensitive values)
  const envInfo = {
    isVercel: !!process.env.VERCEL,
    nodeEnv: process.env.NODE_ENV,
    serverPort: process.env.SERVER_PORT,
    corsOrigin: process.env.CORS_ORIGIN,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasAdminEmail: !!process.env.ADMIN_EMAIL,
    hasAdminUsername: !!process.env.ADMIN_USERNAME,
    hasDatabaseUrl: !!process.env.DATABASE_URL
  }
  res.json(envInfo)
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
app.use('/api/test', testRouter)
app.use('/api/contact', contactRouter)

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
    
    // Ensure directory exists before writing
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    
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

// For local development
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`)
  })
}

// Export the app for Vercel
module.exports = app
