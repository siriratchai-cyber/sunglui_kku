
const firebaseConfig = {
  apiKey: 'AIzaSyCyKxIajbISnEiVDqHhXUfwycUQmr8KO_c',
  authDomain: 'sungluikku.firebaseapp.com',
  projectId: 'sungluikku',
  storageBucket: 'sungluikku.firebasestorage.app',
  messagingSenderId: '882800465050',
  appId: '1:882800465050:web:9b7ef9e6d85a09d1a3fb23',
};

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

let currentUser = null;

// สมัครสมาชิกด้วยอีเมล/รหัสผ่าน
async function registerWithEmail(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ล็อกอินด้วยอีเมล/รหัสผ่าน
async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ล็อกอินด้วย Google
async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

// ออกจากระบบ
async function logout() {
  await signOut(auth);
}

// ดึง ID token ปัจจุบัน (ใช้แนบไปกับทุก request ไปยัง Express API)
async function getIdToken() {
  if (!currentUser) return null;
  return currentUser.getIdToken();
}

// สมัครฟังก์ชันที่จะถูกเรียกทุกครั้งที่สถานะล็อกอินเปลี่ยน (login/logout)
function onAuthChange(callback) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    callback(user);
  });
}

// เปิด global object ให้ app.js (ไฟล์ธรรมดา ไม่ใช่ module) เรียกใช้ได้
window.sungluiAuth = {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  logout,
  getIdToken,
  onAuthChange,
};

// แจ้ง index.html ว่าโหลด Firebase เสร็จแล้ว พร้อมเริ่มแอปได้
window.dispatchEvent(new Event('sungluiAuthReady'));
