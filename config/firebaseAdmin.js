const admin = require('firebase-admin');

// วิธีที่ 1 (แนะนำ — ปลอดภัยจากปัญหาขึ้นบรรทัดใหม่พังตอน copy-paste):
// เอาไฟล์ .json ทั้งไฟล์เข้ารหัสเป็น base64 บรรทัดเดียว แล้ววางใน .env ตัวเดียว
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

// วิธีที่ 2 (เดิม): แยกเป็น 3 ตัวแปร — เสี่ยงพังถ้า private key ถูกตัดขึ้นบรรทัดใหม่ผิดที่ตอน paste
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

function loadServiceAccount() {
  if (serviceAccountBase64) {
    try {
      const json = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
      return JSON.parse(json);
    } catch (e) {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT_BASE64 ใน .env ถอดรหัสไม่ได้ (อาจก็อปมาไม่ครบ)');
      process.exit(1);
    }
  }
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }
  return null;
}

const serviceAccount = loadServiceAccount();

if (!serviceAccount) {
  console.error('❌ ไม่พบค่า Firebase service account ใน .env');
  console.error('   ใส่ FIREBASE_SERVICE_ACCOUNT_BASE64 ตัวเดียว (แนะนำ) หรือ');
  console.error('   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY ทั้ง 3 ตัว');
  console.error('   ไปที่ Firebase Console > Project settings > Service accounts > Generate new private key');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;