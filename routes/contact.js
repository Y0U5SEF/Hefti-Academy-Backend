const express = require('express')
const nodemailer = require('nodemailer')
const { z } = require('zod')
const { db } = require('../lib/db-mongo')

const router = express.Router()

// Validation schema
const ContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(254),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  language: z.string().optional(),
})

function buildTransporter() {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !port || !user || !pass) {
    throw new Error('SMTP configuration missing (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)')
  }

  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })
}

router.post('/', async (req, res) => {
  try {
    const parsed = ContactSchema.safeParse(req.body || {})
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid input', details: parsed.error.flatten() })
    }

    const { name, email, subject, message, language } = parsed.data

    // Persist to DB (best-effort)
    try {
      const pool = db()
      await pool.collection('contact_messages').insertOne({
        name,
        email,
        subject,
        message,
        language: language || null,
        ip_address: req.ip || null,
        created_at: new Date(),
      })
    } catch (e) {
      // Log but don't fail the request solely because persistence failed
      console.error('Failed to persist contact message:', e)
    }

    // Send email
    const to = process.env.CONTACT_TO || process.env.ADMIN_EMAIL
    if (!to) {
      return res.status(500).json({ ok: false, error: 'CONTACT_TO or ADMIN_EMAIL not configured' })
    }

    const from = process.env.CONTACT_FROM || process.env.SMTP_USER
    const prefix = process.env.CONTACT_SUBJECT_PREFIX || '[Contact]'

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
        <p>You received a new contact message from your website:</p>
        <table style="border-collapse:collapse">
          <tr><td style="padding:4px 8px;color:#666">Name</td><td style="padding:4px 8px"><strong>${escapeHtml(name)}</strong></td></tr>
          <tr><td style="padding:4px 8px;color:#666">Email</td><td style="padding:4px 8px"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
          <tr><td style="padding:4px 8px;color:#666">Language</td><td style="padding:4px 8px">${escapeHtml(language || '')}</td></tr>
          <tr><td style="padding:4px 8px;color:#666">IP</td><td style="padding:4px 8px">${escapeHtml(req.ip || '')}</td></tr>
          <tr><td style="padding:4px 8px;color:#666;vertical-align:top">Message</td><td style="padding:8px;border:1px solid #eee;white-space:pre-wrap">${escapeHtml(message)}</td></tr>
        </table>
      </div>
    `
    const text = `New contact message from your website\n\nName: ${name}\nEmail: ${email}\nLanguage: ${language || ''}\nIP: ${req.ip || ''}\n\nSubject: ${subject}\n\n${message}`

    const transporter = buildTransporter()
    await transporter.sendMail({
      from,
      to,
      subject: `${prefix} ${subject}`,
      replyTo: email,
      text,
      html,
    })

    return res.json({ ok: true })
  } catch (error) {
    console.error('Contact route error:', error)
    return res.status(500).json({ ok: false, error: 'Failed to send message' })
  }
})

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

module.exports = { contactRouter: router }
