const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ไม่พบ SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน .env');
  console.error('   ไปที่ Supabase Dashboard > Project Settings > API เพื่อคัดลอกค่ามาใส่');
  process.exit(1);
}

// ใช้ "service_role key" ฝั่ง backend เท่านั้น (ห้ามส่งไปฝั่ง frontend เด็ดขาด)
// key นี้ bypass Row Level Security ได้ทั้งหมด — การจำกัดสิทธิ์ตามผู้ใช้
// ต้องทำที่ชั้น Express (กรอง user_id เอง) ไม่ใช่พึ่ง RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

module.exports = supabase;
