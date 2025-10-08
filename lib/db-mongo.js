const { MongoClient, ServerApiVersion } = require('mongodb')
const bcrypt = require('bcryptjs')

let client
let database

function getDbNameFromUri(uri) {
  try {
    const u = new URL(uri)
    // Path may be like "/dbname" or empty for Atlas SRV
    const dbName = (u.pathname || '').replace(/^\//, '')
    return dbName || null
  } catch {
    return null
  }
}

function initDb() {
  if (database) return database

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required')
  }

  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  })

  // Determine DB name
  const fromUri = getDbNameFromUri(uri)
  const dbName = process.env.MONGODB_DB || fromUri || 'hefti_academy'
  database = client.db(dbName)

  // Fire-and-forget connect; handlers will await where needed
  client
    .connect()
    .then(() => database.command({ ping: 1 }))
    .then(() => {
      console.log('MongoDB connected successfully')
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err)
    })

  return database
}

async function ensureCounters() {
  const db = database
  const col = db.collection('counters')
  const keys = ['admin', 'members']
  for (const _id of keys) {
    await col.updateOne({ _id }, { $setOnInsert: { seq: 0 } }, { upsert: true })
  }
}

async function nextId(key) {
  const db = database
  const res = await db.collection('counters').findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  )
  return res.value.seq
}

async function setupDatabase() {
  if (!client) initDb()
  await client.connect()

  const db = database

  // Indexes
  await db.collection('admin').createIndex({ username: 1 }, { unique: true })
  await db.collection('members').createIndex({ id: 1 }, { unique: true })
  await db.collection('members').createIndex({ academy_id: 1 }, { unique: true, sparse: true })
  await db
    .collection('payments')
    .createIndex({ member_id: 1, type: 1, year: 1, month: 1 }, { unique: true, partialFilterExpression: { type: 'monthly' } })
  await db.collection('payments').createIndex({ member_id: 1, type: 1 }, { unique: true, partialFilterExpression: { type: 'registration' } })

  await ensureCounters()

  // Bootstrap admin if none exists
  const existing = await db.collection('admin').findOne({}, { projection: { _id: 1 } })
  if (!existing) {
    const email = process.env.ADMIN_EMAIL || null
    const usernameEnv = process.env.ADMIN_USERNAME || 'admin'
    const passwordHash = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('admin123', 10)
    const id = await nextId('admin')
    await db.collection('admin').insertOne({
      id,
      email,
      username: usernameEnv,
      password_hash: passwordHash,
      created_at: new Date(),
      updated_at: new Date(),
    })
    console.log('Admin user bootstrapped. Username:', usernameEnv)
  }

  console.log('MongoDB database setup completed')
}

module.exports = { initDb, setupDatabase, db: () => database, client: () => client, nextId }

