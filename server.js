require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// การ require สองบรรทัดนี้จะ process.exit(1) ทันทีถ้า .env ตั้งค่าไม่ครบ
// (ดูรายละเอียดข้อความ error ที่ config/supabaseClient.js และ config/firebaseAdmin.js)
const supabase = require('./config/supabaseClient');
require('./config/firebaseAdmin');

const subjectRoutes = require('./routes/subjects');
const assignmentRoutes = require('./routes/assignments');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes (ทุก route ในนี้ต้องแนบ Authorization: Bearer <Firebase ID token>)
app.use('/api/subjects', subjectRoutes);
app.use('/api/assignments', assignmentRoutes);

// Health check — เช็คว่าต่อ Supabase ได้จริง (ไม่ต้อง auth)
app.get('/api/health', async (req, res) => {
  const { error } = await supabase.from('subjects').select('id').limit(1);
  res.json({
    status: 'ok',
    supabaseConnected: !error,
    supabaseError: error ? error.message : null,
  });
});

// Fallback: ส่งหน้าเว็บหลักสำหรับทุก route ที่ไม่ใช่ API (SPA)
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('✅ ตั้งค่า Supabase และ Firebase Admin สำเร็จ');
  console.log(`🚀 เซิร์ฟเวอร์ทำงานที่ http://localhost:${PORT}`);
});
