const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')
const QRCode = require('qrcode') // Import QR code library

/**
 * Generate a member card PDF using Puppeteer
 * @param {Object} member - The member object with all relevant data
 * @param {Object} institution - Institution details (name, logo, etc.)
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateMemberPdf(member, institution = {}) {
  try {
    // Prepare base64 data URLs for local Effra fonts
    function fileDataUrl(relPath, mime) {
      const p = path.join(__dirname, '..', '..', relPath)
      const buf = fs.readFileSync(p)
      return `data:${mime};base64,${buf.toString('base64')}`
    }
    
    let effraReg = ''
    let effraBold = ''
    try {
      effraReg = fileDataUrl('src/Fonts/EffraReg.otf', 'font/otf')
      effraBold = fileDataUrl('src/Fonts/EffraBold.otf', 'font/otf')
    } catch {}

    let AlexandriaReg = ''
    let AlexandriaBold = ''
    try {
      AlexandriaReg = fileDataUrl('src/Fonts/Alexandria-Regular.ttf', 'font/ttf')
      AlexandriaBold = fileDataUrl('src/Fonts/Alexandria-Bold.ttf', 'font/ttf')
    } catch {}

    const age = (() => {
      if (!member?.date_of_birth) return null
      const dob = new Date(member.date_of_birth)
      if (isNaN(dob)) return null
      const t = new Date()
      return t.getFullYear() - dob.getFullYear() - ((t.getMonth() < dob.getMonth() || (t.getMonth() === dob.getMonth() && t.getDate() < dob.getDate())) ? 1 : 0)
    })()
    
    const isMinor = age !== null && age < 18
    const today = new Date()
    const td = `${today.getFullYear()}/${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}`

    const firstLat = member.first_name_latin || ''
    const firstAr = member.first_name_arabic || ''
    const lastLat = member.last_name_latin || ''
    const lastAr = member.last_name_arabic || ''
    const memberName = [firstAr || firstLat || '', lastAr || lastLat || ''].filter(Boolean).join(' ')
    const guardianName = [
      member.guardian_first_name_arabic || member.guardian_first_name_latin || '',
      member.guardian_last_name_arabic || member.guardian_last_name_latin || '',
    ].filter(Boolean).join(' ')

    // Function to get category
    function getAgeCategory(a) {
      if (a === null || a === undefined) return null
      if (a < 0) return null
      if (a <= 7) return 'U7'
      if (a <= 9) return 'U9'
      if (a <= 11) return 'U12'
      if (a <= 13) return 'U13'
      if (a <= 15) return 'U15'
      if (a <= 17) return 'U17'
      if (a <= 19) return 'U19'
      return 'Senior'
    }

    const ageCategory = getAgeCategory(age)

    // Function to convert date to Arabic format
    function formatArabicDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date)) return dateStr;
      
      const day = date.getDate();
      const year = date.getFullYear();
      
      // Arabic month names
      const arabicMonths = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
        'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'
      ];
      
      const month = arabicMonths[date.getMonth()];
      return `${day} ${month} ${year}`;
    }

    // Format guardian date of birth
    const guardianDobAr = formatArabicDate(member.guardian_date_of_birth);

    const ibn = member.gender === "male" ? "ابني" : "ابنتي";
    const pronoun = member.gender === "male" ? "ه" : "ها";
    const tpronoun = member.gender === "male" ? "ي" : "ت";
    const gtae = member.guardian_kinship === "mother" ? "ة" : "";
    const mtae = member.gender === "female" ? "ة" : "";

    // Format member date of birth
    const memberDobAr = formatArabicDate(member.date_of_birth);

    // Kinship translation
    const guardianKinshipAr = member.guardian_kinship === 'father' ? 'والد' :
                             member.guardian_kinship === 'mother' ? 'والدة' :
                             'ولي أمر';

    // Resolve images (logo, photo) to data URLs where possible
    function imageDataUrl(absPath) {
      try {
        const buf = fs.readFileSync(absPath)
        const ext = path.extname(absPath).toLowerCase()
        const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
        return `data:${mime};base64,${buf.toString('base64')}`
      } catch { return null }
    }

    let logoSrc = ''
    try {
      // Default to public/logo.png if present
      const p = path.join(__dirname, '..', '..', 'public', 'logo.png')
      const d = imageDataUrl(p)
      if (d) logoSrc = d
    } catch {}
    
    let photoSrc = ''
    if (member.photo_url) {
      if (/^https?:/i.test(member.photo_url)) {
        photoSrc = member.photo_url
      } else {
        const rel = String(member.photo_url).replace(/^\/+/, '') // strip leading slash
        const clean = rel.replace(/^uploads\//, '') // expect uploads/<file>
        const p = path.join(__dirname, '..', 'data', 'uploads', clean)
        const d = imageDataUrl(p)
        if (d) photoSrc = d
      }
    }

    // Institution titles (fallback to parameters or defaults)
    const instAr = institution.nameAr || process.env.INST_NAME_AR || 'أكاديمية هفتي لكرة القدم'
    const instEn = institution.nameEn || process.env.INST_NAME_EN || 'Hefti Academy'

    // Generate QR code for the member card URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
    const memberCardUrl = `${baseUrl}/m/${member.academy_id}`;
    const qrCodeDataUrl = await QRCode.toDataURL(memberCardUrl, { width: 200 });

    const html = `<!doctype html>
<html lang="ar">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { size: A4; margin: 0; }
    body { font-family: ${AlexandriaReg ? '"Alexandria", Arial, sans-serif' : 'Arial, sans-serif'}; }
    ${effraReg ? `
    @font-face { font-family: 'Effra'; src: url(${effraReg}) format('opentype'); font-weight: 400; font-style: normal; }
    @font-face { font-family: 'Effra'; src: url(${effraBold}) format('opentype'); font-weight: 700; font-style: normal; }
    @font-face { font-family: 'Alexandria'; src: url(${AlexandriaReg}) format('opentype'); font-weight: 400; font-style: normal; }
    @font-face { font-family: 'Alexandria'; src: url(${AlexandriaBold}) format('opentype'); font-weight: 700; font-style: normal; }
    `: ''}
    .frame { position: fixed; top: 5mm; right: 5mm; bottom: 5mm; left: 5mm; border: 2pt solid #3A4090; padding: 3mm; box-sizing: border-box; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .photo { width: 120px; height: auto; object-fit: contain; background: #eee; }
    .logo { width: 90px; height: 90px; object-fit: contain; }
    .inst-ar { font-size: 16px; font-weight: bold; color: #3A4090; direction: rtl; font-family: 'Alexandria','Noto Naskh Arabic','Segoe UI', Arial, sans-serif; }
    .inst-en { font-size: 14px; font-weight: bold; color: #3A4090; font-family: 'Alexandria', Arial, sans-serif; }
    .title { direction:rtl; text-align: center; margin: 12px 0 8px; font-size: 16pt; color: #3A4090; font-weight: 700; font-family: 'Alexandria','Noto Naskh Arabic','Segoe UI', Arial, sans-serif; }
    .grid { margin-top: 6px; }
    .row { display: flex; align-items: flex-end; gap: 12px; margin-top: 6px; }
    .label-en { width: 160px; font-size: 10pt; }
    .mid { font-size: 10pt; flex: 1; border-bottom: 0.5pt solid #C8C8C8; padding-bottom: 2px; text-align: center; font-weight: 700; }
    .label-ar { width: 160px; font-size: 10pt; text-align: right; direction: rtl; font-family: 'Alexandria','Noto Naskh Arabic','Segoe UI', Arial, sans-serif; }
    .half { flex: 1; display: flex; flex-direction: row; align-items: flex-end; justify-content: flex-start; }
    .halfAr { direction: rtl; }
    .uline { width:100%; border-bottom: 0.5px solid #C8C8C8; padding: 0; margin: 0; font-weight: bold; display: flex; align-items: center;}
    .val-ar { direction: rtl; text-align: right; font-family: 'Alexandria','Noto Naskh Arabic','Segoe UI', Arial, sans-serif; }
    .para {
    text-indent: 0.7cm;
    direction: rtl;
    line-height:1.9;
    text-align: justify;
    font-size: 10pt;
    font-family: 'Alexandria','Noto Naskh Arabic','Segoe UI', Arial, sans-serif;
    margin: 0 0 0.3cm 0; 
    }
    .styled-hr {
    border: none;
    height: 1px;
    background-color: #3a4090;
    margin: 20px 0 0 0;
    }
    .terms {
      text-align: justify;
      direction: rtl;
      font-size: 9pt;
      line-height:1.9;
      font-family: 'Alexandria','Noto Naskh Arabic','Segoe UI', Arial, sans-serif;
      margin: 0; 
    }
    
    .doc-footer {
  position: absolute;
  bottom: 7mm;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
}

.footer-inner {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  max-width: 900px;
  width: 100%;
  gap: 30px;
  padding-top:2mm;
}

.footer-link {
  display: flex;
  flex-direction: row; 
  align-items: center; 
  text-align: left; 
  text-decoration: none;
  color: #000000;
  white-space: nowrap; 
  min-width: 0;
  flex-grow: 0; 
}

.footer-link .icon {
  display: flex;
  justify-content: center;
  align-items: center;
  color: #3a4090;
  margin-right: 8px; 
  margin-bottom: 0; 
}

.footer-link .footer-label-wrapper {
  display: flex;
  align-items: center; 
}

.footer-link .label {
  font-size: 12px;
  line-height: 1.2;
  color: #000000;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal; 
} 

.signature {
display:flex;
gap:2px;
}

.qr-section {
position: absolute;
bottom:12mm;
left:5mm;
z-index:-10;
}

.qr-section img {
height: 120px;
width:auto;
}


.signature {
display:flex;
flex-direction:column;
align-items:center;
font-size:10pt;
font-weight:bold;
width:200px;
position:relative;
gap:5px;
}

.signature small {
font-size:7pt;
font-weight:normal;
}

.signature .box {
border:1px solid #dddddd;
height:65px;
width:200px;
margin:5px 0 0 0;
}

.doc_footer {
    margin:0.3cm 0 0 0;
    display: flex;
    flex-direction: row-reverse;
    justify-content: space-between;
    align-items: flex-start;
  }

  </style>
</head>
<body>
  <div class="frame">
    <div class="header">
      ${photoSrc ? `<img class="photo" src="${photoSrc}" />` : `<div class="photo"></div>`}
      <div style="    text-align: right; display: flex; flex-direction: row-reverse; align-items: center; gap: 20px;">
        ${logoSrc ? `<img class="logo" src="${logoSrc}" />` : ''}
        <div class="AcademyName">
          ${instAr ? `<div class="inst-ar">${instAr}</div>` : ''}
          ${instEn ? `<div class="inst-en">${instEn}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="title">ورقة التسجيل</div>

    <div class="grid">
      <div class="row">
        <div class="half">
          <div class="label-en">First name</div>
          <div class="uline">${firstLat}</div>
        </div>
        <div class="half halfAr">
          <div class="label-ar">الاسم الشخصي</div>
          <div class="uline val-ar">${firstAr || '—'}</div>
        </div>
      </div>
      <div class="row">
        <div class="half">
          <div class="label-en">Last name</div>
          <div class="uline">${lastLat}</div>
        </div>
        <div class="half halfAr">
          <div class="label-ar">الاسم العائلي</div>
          <div class="uline val-ar">${lastAr || '—'}</div>
        </div>
      </div>

      ${[{
        en:'Date of birth', val: member.date_of_birth || '—', ar:'تاريخ الازدياد'
      },{
        en:'Age', val: (age ?? '—'), ar:'العمر'
      },{
        en:'Category', val: (ageCategory ?? '—'), ar:'الفئة'
      },{
        en:'Place of birth', val: member.place_of_birth || '—', ar:'مكان الازدياد'
      },{
        en:'ID Number', val: member.id_number || '—', ar:'رقم التعريف'
      },{
        en:'Height', val: (member.height_cm ? `${member.height_cm} cm` : '—'), ar:'الطول'
      },{
        en:'Weight', val: (member.weight_kg ? `${member.weight_kg} kg` : '—'), ar:'الوزن'
      },{
        en:'Parent phone number', val: member.guardian_phone || '—', ar:'هاتف الولي'
      },{
        en:'Address', val: (member.guardian_address || member.address_current || '—'), ar:'العنوان'
      }].map(r => `
        <div class="row">
          <div class="label-en">${r.en}</div>
          <div class="mid">${r.val}</div>
          <div class="label-ar">${r.ar}</div>
        </div>
      `).join('')}
    </div>

    <hr class="styled-hr">
    


    ${isMinor ? `
    <div class="title">التزام ولي الأمر</div>
    <p class="para">أنا الموقع${gtae} أسفله السيد${gtae} <b>${guardianName}</b> الحامل${gtae} لبطاقة التعريف الوطنية رقم <b>${member.guardian_id_number || ''}</b> المزداد${gtae} بتاريخ <b>${guardianDobAr}</b> والساكن${gtae} <b>ب${member.guardian_address}</b>. بصفتي ${guardianKinshipAr} المنخرط${mtae} <b>${memberName}</b> المزداد${mtae} بتاريخ <b>${memberDobAr || ''}</b>.</p>
    <ul class="terms" style="padding-right: 20px; margin: 0;">
      <li>أوافق على انخراط${pronoun} في أكاديمية هفتي لكرة القدم وأتحمل كامل المسؤولية عن مشاركت${pronoun} في أنشطة الأكاديمية.</li>
      <li>اطلعت على القانون الداخلي للأكاديمية وأتعهد باحترام جميع بنوده والالتزام بها دون استثناء.</li>
      <li>أدرك أن أي سلوك عنيف أو تصرف غير أخلاقي أو مسيء لسمعة الأكاديمية يعرض المنخرط${pronoun} للإيقاف المؤقت أو الطرد النهائي.</li>
      <li>أصرح أن المنخرط${mtae} ${tpronoun}تمتع بصحة جيدة تخول${pronoun} للمشاركة في الأنشطة الرياضية.</li>
      <li>أوافق على أن مسؤولية الأكاديمية تقتصر على التأمين الصحي في حدود ما هو منصوص عليه في عقد التأمين، وألتزم بعدم تحميل الأكاديمية أي تبعات قانونية أو مالية في حال وقوع حادث ناتج عن مخالفة التعليمات أو القواعد المعمول بها من طرف الطاقم التقني أو الإداري.</li>
      <li>أوافق على استعمال صور أو مقاطع فيديو تخص المنخرط${mtae} في الأنشطة الرسمية أو الترويجية للأكاديمية، وأحتفظ بحق سحب هذا الإذن كتابيا في أي وقت.</li>
    </ul>
    <div class="doc_footer">
      <p style="font-weight:bold;" font-weight:bold;" class="para">حرر بأكدز، في: ${td}</p>
      <div class="signature">
        <div>الإمضاء</div>
        <small>${guardianName}</small>
        <div class="box"></div>
      </div>
    </div>
    ` : ''}
  </div>

    <div class="qr-section">
      <img class="qr-code" src="${qrCodeDataUrl}" alt="QR Code" />
    </div>
  
  <footer class="doc-footer" dir="ltr">
  <hr class="styled-hr">
  <div class="footer-inner">
    <a class="footer-link" href="https://heftiacademy.com" target="_blank" rel="noopener">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"></path>
        </svg>
      </span>
      <div class="footer-label-wrapper">
        <span class="label">www.heftiacademy.com</span>
      </div>
    </a>

    <a class="footer-link" href="tel:+2126666871517">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v2a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 5.18 2 2 0 0 1 4.11 3h2a2 2 0 0 1 2 1.72c.12.89.32 1.75.6 2.58a2 2 0 0 1-.45 2.11L7.6 10.1a16 16 0 0 0 6.3 6.3l.69-.66a2 2 0 0 1 2.11-.45c.83.28 1.69.48 2.58.6A2 2 0 0 1 22 16.92z"/>
        </svg>
      </span>
      <div class="footer-label-wrapper">
        <span class="label">+212 661-227033  |  +212 761-772580</span>
      </div>
    </a>

    <a class="footer-link" href="mailto:contact@heftiacademy.com">
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
          <path d="m22 6-10 7L2 6"/>
        </svg>
      </span>
      <div class="footer-label-wrapper">
        <span class="label">contact@heftiacademy.com</span>
      </div>
    </a>
  </div>
</footer>
</body>
</html>`

    const browser = await puppeteer.launch({ args: ['--no-sandbox','--font-render-hinting=none'] })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
    await browser.close()
    
    return pdfBuffer
  } catch (e) {
    console.error('PDF generation error', e)
    throw new Error('Failed to generate PDF: ' + e.message)
  }
}

module.exports = { generateMemberPdf }
