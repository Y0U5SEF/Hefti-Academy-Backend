const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const COOKIE_NAME = 'token'

function signToken(payload, opts = {}) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d', ...opts })
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

function authRequired(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const payload = verifyToken(token)
    req.user = payload
    return next()
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

function setAuthCookie(res, payload) {
  const token = signToken(payload)
  const isProd = process.env.NODE_ENV === 'production'
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd ? true : false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' })
}

module.exports = { authRequired, signToken, setAuthCookie, clearAuthCookie }

