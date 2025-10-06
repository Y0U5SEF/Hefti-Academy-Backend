﻿const express = require('express')
const { db } = require('../lib/db')
const { generateMemberPdf } = require('../lib/memberPdf') // Import the new PDF generation module
const path = require('path')
const fs = require('fs')
const { authRequired } = require('../lib/auth')

const router = express.Router()

function isMinor(dateStr) {
  if (!dateStr) return false
  const dob = new Date(dateStr)
  if (isNaN(dob)) return false
  const today = new Date()
  const age = today.getFullYear() - dob.getFullYear() - ((today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) ? 1 : 0)
  return age < 18
}

function initMonthlyPaymentsForYear(memberId, year, poor) {
  const insert = db().prepare(`
    INSERT OR IGNORE INTO payments(member_id, type, year, month, status, amount)
    VALUES(?, 'monthly', ?, ?, ?, NULL)
  `)
  for (let m = 1; m <= 12; m++) {
    insert.run(memberId, year, m, poor ? 'exempt' : 'pending')
  }
}

// Public member card by academy_id (no auth, minimal page)
router.get('/card/:academyId', (req, res) => {
  console.log('Public member card route accessed with ID:', req.params.academyId);
  try {
    const academyId = String(req.params.academyId || '').trim()
    if (!academyId) return res.status(400).send('Invalid academy id')

    const row = db().prepare('SELECT * FROM members WHERE academy_id = ?').get(academyId)
    if (!row) return res.status(404).send('Not found')

    // Helpers to embed local files as data URL
    function fileDataUrl(absPath, mimeFallback = 'application/octet-stream') {
      try {
        const buf = fs.readFileSync(absPath)
        // crude mime sniff by extension
        const ext = path.extname(absPath).toLowerCase()
        const mime = ext === '.otf' ? 'font/otf'
          : ext === '.ttf' ? 'font/ttf'
          : ext === '.png' ? 'image/png'
          : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg'
          : mimeFallback
        return `data:${mime};base64,${buf.toString('base64')}`
      } catch { return null }
    }
    function imageDataUrl(absPath) { return fileDataUrl(absPath, 'image/png') }

    // Fonts (Effra)
    const effraReg = fileDataUrl(path.join(__dirname, '..', '..', 'src', 'Fonts', 'EffraReg.otf'))
    const effraBold = fileDataUrl(path.join(__dirname, '..', '..', 'src', 'Fonts', 'EffraBold.otf'))

    // Logo from public/logo.png, if present
    let logoSrc = ''
    const logoPath = path.join(__dirname, '..', '..', 'public', 'logo.png')
    const logoData = imageDataUrl(logoPath)
    if (logoData) logoSrc = logoData

    // Member photo (uploads)
    let photoSrc = ''
    if (row.photo_url) {
      if (/^https?:/i.test(row.photo_url)) {
        photoSrc = row.photo_url
      } else {
        const rel = String(row.photo_url).replace(/^\/+/, '')
        const clean = rel.replace(/^uploads\//, '')
        const p = path.join(__dirname, '..', 'data', 'uploads', clean)
        const d = imageDataUrl(p)
        if (d) photoSrc = d
      }
    }

    const age = (() => {
      if (!row?.date_of_birth) return null
      const dob = new Date(row.date_of_birth)
      if (isNaN(dob)) return null
      const t = new Date()
      return t.getFullYear() - dob.getFullYear() - ((t.getMonth() < dob.getMonth() || (t.getMonth() === dob.getMonth() && t.getDate() < dob.getDate())) ? 1 : 0)
    })()
    const ageCategory = (() => {
      if (age === null || age < 0) return null
      if (age <= 7) return 'U7'
      if (age <= 9) return 'U9'
      if (age <= 11) return 'U11'
      if (age <= 13) return 'U13'
      if (age <= 15) return 'U15'
      if (age <= 17) return 'U17'
      if (age <= 19) return 'U19'
      return 'Senior'
    })()

    const firstLat = row.first_name_latin || ''
    const firstAr = row.first_name_arabic || ''
    const lastLat = row.last_name_latin || ''
    const lastAr = row.last_name_arabic || ''

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${row.academy_id || ''} – Member Card</title>
  <style>
    /* ====== Typography & Theme ====== */
    :root{
      --brand:#3A4090;
      --ink:#1b1f25;
      --muted:#6b7280;
      --line:#e5e7eb;
      --bg:#f8fafc;
      --card:#ffffff;
      --accent: #EEF0FF;
      --radius:16px;
    }

    ${effraReg ? `@font-face{font-family:'Effra';src:url(${effraReg}) format('opentype');font-weight:400;font-style:normal;}` : ''}
    ${effraBold ? `@font-face{font-family:'Effra';src:url(${effraBold}) format('opentype');font-weight:700;font-style:normal;}` : ''}

    html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);
      font-family:${effraReg ? 'Effra, "Noto Naskh Arabic", "Segoe UI", Arial, sans-serif' : '"Noto Naskh Arabic","Segoe UI", Arial, sans-serif'};
      -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
    }

    /* ====== Layout ====== */
    .sheet{
      max-width:900px; margin:24px auto; padding:clamp(16px,3vw,28px);
      background:linear-gradient(180deg,#fff, #fff), var(--card);
      border-radius:var(--radius); box-shadow:0 10px 30px rgba(16,24,40,.08);
      position:relative; overflow:hidden; border:1px solid var(--line);
    }

    /* Decorative corner band */
    .sheet::after{
      content:""; position:absolute; inset:-80px -80px auto auto; width:220px; height:220px;
      background:radial-gradient(120px 120px at 70% 30%, var(--accent), transparent 70%);
      transform:rotate(20deg); pointer-events:none;
    }

    /* Header */
    .header{
      display:flex; align-items:center; justify-content:space-between; gap:12px;
      margin-bottom:18px;
    }
    .brand{
      display:flex; flex-direction:column; gap:4px; align-items:flex-start; text-align:right;
    }
    .brand .inst-ar{
      font-weight:700; font-size:clamp(16px,2.6vw,20px); color:var(--brand);
      font-family:${effraBold ? "'Effra','Noto Naskh Arabic','Segoe UI',Arial,sans-serif" : "'Noto Naskh Arabic','Segoe UI',Arial,sans-serif"};
    }
    .brand .inst-en{
      font-size:clamp(12px,2.1vw,14px); color:var(--muted);
    }
    .logo{
      width:60px; height:auto; object-fit:contain; margin-inline-start:auto; /* small, right corner */
    }

    /* Title & ID */
    .title{
      text-align:center; font-weight:700; color:var(--brand);
      font-size:clamp(18px,3.2vw,22px); margin:8px 0 2px;
      letter-spacing:.3px;
    }
    .id-badge{
    display: block;
    align-items: center;
    padding: 8px 12px;
    margin: 10px auto;
    border: 1px dashed var(--brand);
    color: var(--brand);
    border-radius: 999px;
    font-weight: 700;
    font-size: 14px;
    background: #fff;
    text-align: center;
    width: max-content;
    }

    /* Photo centered block */
    .photo-wrap{
      display:flex; justify-content:center; margin:14px 0 0;
    }
    .photo{
      width:min(38vw,140px); aspect-ratio:3/4; object-fit:cover; border-radius:12px;
      background:#f1f2f6; border:1px solid #e6e8ee;
      box-shadow:0 6px 18px rgba(16,24,40,.08);
    }

    /* Info grid */
    .grid{
      display:grid; gap:12px;
      grid-template-columns:1fr; 
    }
    @media (min-width:620px){
      .grid{ grid-template-columns:1fr 1fr; }
    }

    .field{
      background:#fff; border:1px solid var(--line); border-radius:12px; padding:12px 14px;
      display:flex; flex-direction:column; gap:6px;
    }
    .label-row{
      display:flex; align-items:center; justify-content:space-between; gap:8px; flex-direction: row-reverse;;
    }
    .label-en{ font-size:12px; color:var(--muted); }
    .label-ar{ font-size:12px; color:var(--muted); direction:rtl; text-align:right;
      font-family:${effraReg ? "'Effra','Noto Naskh Arabic','Segoe UI',Arial,sans-serif" : "'Noto Naskh Arabic','Segoe UI',Arial,sans-serif"};
    }
    .value{
      border-top:1px solid var(--line); padding-top:6px; 
      font-weight:700; letter-spacing:.2px; text-align:center;
      font-size:clamp(14px,2.6vw,16px);
    }
    .value.ar{
      direction:rtl; text-align:center;
    }

    /* Compact triple row */
    .row-compact{
      display:grid; gap:12px; margin-top:6px;
      grid-template-columns:1fr;
    }
    @media (min-width:720px){
      .row-compact{ grid-template-columns:1fr 1fr 1fr; }
    }

    /* Footer (optional) */
    .foot{
      margin-top:18px; display:flex; justify-content:center; gap:10px; color:var(--muted);
      font-size:12px;
    }

    /* ====== Print Styles ====== */
    @page{ size:A4; margin:10mm; }
    @media print{
      body{ background:#fff; }
      .sheet{ box-shadow:none; border:0; margin:0; max-width:none; }
      .sheet::after{ display:none; }
      .logo{ filter:grayscale(0); }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="header">
      <div class="brand">
        <div class="inst-ar">${process.env.INST_NAME_AR || 'أكاديمية هفتي لكرة القدم'}</div>
        <div class="inst-en">${process.env.INST_NAME_EN || 'Hefti Academy'}</div>
      </div>
      ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="logo">` : ''}
    </header>

    <div class="photo-wrap">
      ${photoSrc ? `<img class="photo" src="${photoSrc}" alt="member photo">` : `<div class="photo"></div>`}
    </div>
     <div class="id-badge">ID: ${row.academy_id || '—'}</div>

    <!-- Names (2 columns) -->
    <section class="grid">
      <div class="field">
        <div class="label-row">
          <span class="label-en">First name</span>
          <span class="label-ar">الاسم الشخصي</span>
        </div>
        <div class="value">${firstLat || '—'}</div>
        <div class="value ar">${firstAr || '—'}</div>
      </div>

      <div class="field">
        <div class="label-row">
          <span class="label-en">Last name</span>
          <span class="label-ar">الاسم العائلي</span>
        </div>
        <div class="value">${lastLat || '—'}</div>
        <div class="value ar">${lastAr || '—'}</div>
      </div>
    </section>

    <!-- Compact trio (DOB / Age / Category) -->
    <section class="row-compact">
      <div class="field">
        <div class="label-row">
          <span class="label-en">Date of birth</span>
          <span class="label-ar">تاريخ الازدياد</span>
        </div>
        <div class="value">${row.date_of_birth || '—'}</div>
      </div>

      <div class="field">
        <div class="label-row">
          <span class="label-en">Age</span>
          <span class="label-ar">العمر</span>
        </div>
        <div class="value">${(age ?? '—')}</div>
      </div>

      <div class="field">
        <div class="label-row">
          <span class="label-en">Category</span>
          <span class="label-ar">الفئة</span>
        </div>
        <div class="value">${(ageCategory ?? '—')}</div>
      </div>
    </section>

    <footer class="foot">
      <span>${process.env.INST_NAME_EN || 'Hefti Academy'}</span>
      <span>•</span>
      <span>${process.env.INST_NAME_AR || 'أكاديمية هفتي لكرة القدم'}</span>
    </footer>
  </main>
</body>
</html>`;


    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.send(html)
  } catch (e) {
    console.error('member card error', e)
    return res.status(500).send('Server error')
  }
})

router.use(authRequired)

router.get('/', (req, res) => {
  const rows = db().prepare('SELECT * FROM members ORDER BY created_at DESC').all()
  res.json(rows)
})

router.get('/:id', (req, res) => {
  const row = db().prepare('SELECT * FROM members WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json(row)
})

// Generate PDF for member using Puppeteer
router.get('/:id/pdf', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'Invalid id' })
    const member = db().prepare('SELECT * FROM members WHERE id = ?').get(id)
    if (!member) return res.status(404).json({ error: 'Not found' })

    // Generate PDF using the new module
    const pdfBuffer = await generateMemberPdf(member)
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="member-${id}.pdf"`)
    return res.send(pdfBuffer)
  } catch (e) {
    console.error('PDF error', e)
    return res.status(500).json({ error: 'Failed to generate PDF' })
  }
})

router.post('/', (req, res) => {
  const b = req.body || {}
  const up = (s) => (s ? String(s).toUpperCase() : null)
  const first_name_latin = up(b.first_name_latin)
  const last_name_latin = up(b.last_name_latin)
  const guardian_first_name_latin = up(b.guardian_first_name_latin)
  const guardian_last_name_latin = up(b.guardian_last_name_latin)

  const full_name_latin = `${first_name_latin || ''} ${last_name_latin || ''}`.trim() || b.full_name_latin
  const full_name_arabic = `${b.first_name_arabic || ''} ${b.last_name_arabic || ''}`.trim() || b.full_name_arabic
  if (!full_name_latin || !b.date_of_birth) {
    return res.status(400).json({ error: 'first/last name (latin) and date_of_birth required' })
  }
  if (isMinor(b.date_of_birth)) {
    const required = ['guardian_first_name_latin','guardian_last_name_latin','guardian_id_number','guardian_phone']
    for (const f of required) {
      if (!b[f]) return res.status(400).json({ error: `Field ${f} required for minors` })
    }
  }
  const poor = !!b.poor_family
  const stmt = db().prepare(`
    INSERT INTO members (
      first_name_latin, last_name_latin, first_name_arabic, last_name_arabic,
      full_name_latin, full_name_arabic, date_of_birth, gender, place_of_birth,
      id_type, id_number, poor_family,
      photo_url,
      guardian_full_name, guardian_first_name_latin, guardian_last_name_latin,
      guardian_first_name_arabic, guardian_last_name_arabic,
      guardian_id_number, guardian_phone, guardian_kinship,
      guardian_date_of_birth, guardian_place_of_birth, guardian_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const info = stmt.run(
    first_name_latin || null, last_name_latin || null,
    b.first_name_arabic || null, b.last_name_arabic || null,
    full_name_latin, full_name_arabic || null, b.date_of_birth, (b.gender ? String(b.gender).toLowerCase() : null), b.place_of_birth || '',
    b.id_type || null, b.id_number || null, poor ? 1 : 0,
    b.photo_url || null,
    (b.guardian_full_name || [guardian_first_name_latin || '', guardian_last_name_latin || ''].join(' ').trim()) || null,
    guardian_first_name_latin || null,
    guardian_last_name_latin || null,
    b.guardian_first_name_arabic || null,
    b.guardian_last_name_arabic || null,
    b.guardian_id_number || null, b.guardian_phone || null, (b.guardian_kinship || null),
    b.guardian_date_of_birth || null, b.guardian_place_of_birth || null, b.guardian_address || null
  )

  // Set academy_id based on DB row id (e.g., HFA0001)
  try {
    const academyId = 'HFA' + String(info.lastInsertRowid).padStart(4, '0')
    db().prepare('UPDATE members SET academy_id = ? WHERE id = ?').run(academyId, info.lastInsertRowid)
  } catch {}

  // Initialize monthly rows for current year
  const currentYear = new Date().getFullYear()
  initMonthlyPaymentsForYear(info.lastInsertRowid, currentYear, poor)

  // Registration payment row
  db().prepare(`
    INSERT OR IGNORE INTO payments(member_id, type, year, month, status, amount)
    VALUES (?, 'registration', NULL, NULL, ?, NULL)
  `).run(info.lastInsertRowid, poor ? 'exempt' : 'pending')

  const created = db().prepare('SELECT * FROM members WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json(created)
})

router.put('/:id', (req, res) => {
  const id = Number(req.params.id)
  const b = req.body || {}
  const existing = db().prepare('SELECT * FROM members WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  const poor = !!b.poor_family
  const stmt = db().prepare(`
    UPDATE members SET
      first_name_latin = ?,
      last_name_latin = ?,
      first_name_arabic = ?,
      last_name_arabic = ?,
      full_name_latin = ?,
      full_name_arabic = ?,
      date_of_birth = ?,
      gender = ?,
      place_of_birth = ?,
      id_type = ?,
      id_number = ?,
      poor_family = ?,
      photo_url = ?,
      guardian_full_name = ?,
      guardian_first_name_latin = ?,
      guardian_last_name_latin = ?,
      guardian_first_name_arabic = ?,
      guardian_last_name_arabic = ?,
      guardian_id_number = ?,
      guardian_phone = ?,
      guardian_kinship = ?,
      guardian_date_of_birth = ?,
      guardian_place_of_birth = ?,
      guardian_address = ?,
      height_cm = ?,
      weight_kg = ?,
      scholar_level = ?,
      school_name = ?,
      blood_type = ?,
      allergies = ?,
      medical_notes = ?,
      emergency_contact_name = ?,
      emergency_contact_phone = ?,
      jersey_number = ?,
      preferred_position = ?,
      dominant_foot = ?,
      address_current = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `)
  const toUp = (s) => (s === undefined || s === null ? s : String(s).toUpperCase())
  const firstLat = b.first_name_latin !== undefined ? toUp(b.first_name_latin) : existing.first_name_latin
  const lastLat = b.last_name_latin !== undefined ? toUp(b.last_name_latin) : existing.last_name_latin
  const firstAr = b.first_name_arabic ?? existing.first_name_arabic
  const lastAr = b.last_name_arabic ?? existing.last_name_arabic
  const fullLat = `${firstLat || ''} ${lastLat || ''}`.trim() || existing.full_name_latin
  const fullAr = `${firstAr || ''} ${lastAr || ''}`.trim() || existing.full_name_arabic

  const gFirstLat = b.guardian_first_name_latin ?? existing.guardian_first_name_latin
  const gLastLat = b.guardian_last_name_latin ?? existing.guardian_last_name_latin
  const gFirstLatUp = b.guardian_first_name_latin !== undefined ? toUp(b.guardian_first_name_latin) : gFirstLat
  const gLastLatUp = b.guardian_last_name_latin !== undefined ? toUp(b.guardian_last_name_latin) : gLastLat
  const guardianFullName = (b.guardian_full_name || [gFirstLat || '', gLastLat || ''].join(' ').trim()) || existing.guardian_full_name

  stmt.run(
    firstLat,
    lastLat,
    firstAr,
    lastAr,
    fullLat,
    fullAr,
    b.date_of_birth || existing.date_of_birth,
    (b.gender !== undefined ? (b.gender ? String(b.gender).toLowerCase() : null) : existing.gender),
    b.place_of_birth || existing.place_of_birth,
    b.id_type || existing.id_type,
    b.id_number || existing.id_number,
    poor ? 1 : 0,
    b.photo_url ?? existing.photo_url,
    guardianFullName,
    gFirstLatUp,
    gLastLatUp,
    b.guardian_first_name_arabic ?? existing.guardian_first_name_arabic,
    b.guardian_last_name_arabic ?? existing.guardian_last_name_arabic,
    b.guardian_id_number || existing.guardian_id_number,
    b.guardian_phone || existing.guardian_phone,
    b.guardian_kinship ?? existing.guardian_kinship,
    b.guardian_date_of_birth || existing.guardian_date_of_birth,
    b.guardian_place_of_birth || existing.guardian_place_of_birth,
    b.guardian_address || existing.guardian_address,
    (b.height_cm !== undefined ? b.height_cm : existing.height_cm),
    (b.weight_kg !== undefined ? b.weight_kg : existing.weight_kg),
    b.scholar_level ?? existing.scholar_level,
    b.school_name ?? existing.school_name,
    b.blood_type ?? existing.blood_type,
    b.allergies ?? existing.allergies,
    b.medical_notes ?? existing.medical_notes,
    b.emergency_contact_name ?? existing.emergency_contact_name,
    b.emergency_contact_phone ?? existing.emergency_contact_phone,
    (b.jersey_number !== undefined ? b.jersey_number : existing.jersey_number),
    b.preferred_position ?? existing.preferred_position,
    b.dominant_foot ?? existing.dominant_foot,
    b.address_current ?? existing.address_current,
    id
  )
  // Ensure academy_id exists for legacy rows
  try {
    const row = db().prepare('SELECT id, academy_id FROM members WHERE id = ?').get(id)
    if (row && (!row.academy_id || row.academy_id === '')) {
      const academyId = 'HFA' + String(id).padStart(4, '0')
      db().prepare('UPDATE members SET academy_id = ? WHERE id = ?').run(academyId, id)
    }
  } catch {}
  // Adjust registration row status for poor families
  db().prepare(`UPDATE payments SET status = ? WHERE member_id = ? AND type = 'registration'`)
    .run(poor ? 'exempt' : 'pending', id)
  res.json(db().prepare('SELECT * FROM members WHERE id = ?').get(id))
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  const info = db().prepare('DELETE FROM members WHERE id = ?').run(id)
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' })
  res.json({ ok: true })
})

module.exports = { membersRouter: router }


