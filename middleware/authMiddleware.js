const admin = require('../config/firebaseAdmin');

// Middleware: ตรวจ Firebase ID token จาก header "Authorization: Bearer <token>"
// ถ้าผ่าน จะเซ็ต req.userId = uid ของผู้ใช้ ให้ route ต่าง ๆ เอาไปกรองข้อมูล
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.userId = decoded.uid;
    req.userEmail = decoded.email || '';
    next();
  } catch (err) {
    return res.status(401).json({ message: 'เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' });
  }
}

module.exports = { requireAuth };
