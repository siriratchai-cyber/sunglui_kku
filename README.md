# sungluiKKU — ระบบรวบรวมกำหนดการส่งงานและช่องทางการส่งงานสำหรับนักศึกษา

เว็บแอปสำหรับบันทึกรายวิชา งาน กำหนดส่ง และช่องทางการเรียน/ส่งงานของแต่ละวิชาไว้ในที่เดียว
พร้อมระบบล็อกอินส่วนตัว แดชบอร์ดภาพรวม การแจ้งเตือนก่อนถึงกำหนดส่ง และดีไซน์โทนสีเอิร์ธโทน

**เทคโนโลยีที่ใช้**
- Frontend: HTML / CSS / JavaScript (Vanilla) — ไม่ต้อง build
- Backend: Node.js + Express (เป็นตัวกลาง ตรวจสิทธิ์ + คุยกับฐานข้อมูล)
- **ระบบล็อกอิน: Firebase Authentication** (อีเมล/รหัสผ่าน + Google)
- **ฐานข้อมูล: Supabase (Postgres)**

---

## 0. ภาพรวมสถาปัตยกรรม (สำคัญ อ่านก่อน)

```
┌─────────────┐        1) ล็อกอิน            ┌──────────────────┐
│  Browser    │ ─────────────────────────────▶│  Firebase Auth    │
│ (frontend)  │ ◀───── 2) ได้ ID token ─────── │  (แค่ระบบล็อกอิน)  │
└──────┬──────┘                                └──────────────────┘
       │ 3) เรียก API พร้อมแนบ
       │    Authorization: Bearer <ID token>
       ▼
┌─────────────────────┐   4) ตรวจ token ด้วย   ┌──────────────────┐
│   Express (server.js) │ ────firebase-admin───▶ │  Firebase Auth    │
│   = ตัวกลาง/คนเฝ้าประตู │ ◀──── ok / ไม่ok ────── │  (ตรวจสอบเท่านั้น) │
└──────────┬───────────┘                        └──────────────────┘
           │ 5) query/insert/update/delete
           │    (กรองด้วย user_id เสมอ)
           ▼
   ┌────────────────┐
   │ Supabase        │
   │ (Postgres DB)   │
   └────────────────┘
```

**ประเด็นสำคัญที่ต้องเข้าใจ:**
- **Firebase ใช้แค่ "ยืนยันตัวตน"** — ไม่ได้เก็บข้อมูลวิชา/งานเลย
- **Supabase ใช้แค่ "เก็บข้อมูล"** — ไม่ได้ใช้ระบบล็อกอินของ Supabase เอง (Supabase Auth) เลย
- Browser (frontend) **ไม่ได้คุยกับ Supabase ตรง ๆ** — ทุกอย่างต้องผ่าน Express ก่อนเสมอ เพราะ Express เป็นคนเดียวที่ถือ "service_role key" (กุญแจลับที่เข้าถึงฐานข้อมูลได้เต็มสิทธิ์) ถ้าปล่อยกุญแจนี้ไปอยู่ฝั่ง browser คนอื่นจะเอาไปอ่าน/ลบข้อมูลทุกคนได้
- ทุก request ไป Express ต้องแนบ Firebase ID token มาด้วยเสมอ ไม่งั้นจะโดนปฏิเสธ (401)

---

## 1. สิ่งที่ต้องสร้างเอง (ทำครั้งเดียวตอนตั้งโปรเจกต์)

ส่วนนี้เป็นสิ่งที่ **ต้องไปทำในเว็บ Firebase Console และ Supabase Dashboard เอง** โค้ดที่ให้มาทำแทนไม่ได้ เพราะต้องใช้บัญชีของคุณ

### 1.1 สร้างโปรเจกต์ Firebase (สำหรับระบบล็อกอิน)

1. ไปที่ https://console.firebase.google.com/ → **Add project** → ตั้งชื่อ (เช่น `sunglui-kku`) → สร้างเสร็จ
2. ในเมนูซ้าย ไปที่ **Build > Authentication** → กด **Get started**
3. แท็บ **Sign-in method** → เปิดใช้งาน:
   - **Email/Password** (กด Enable)
   - **Google** (กด Enable แล้วเลือกอีเมลสนับสนุน)
4. ไปที่ **Project settings** (รูปเฟืองมุมซ้ายบน) → แท็บ **General** → เลื่อนลงมาที่ "Your apps" → กด ไอคอน **`</>`** (Web) → ตั้งชื่อแอป → กด Register
   - จะได้ config object หน้าตาแบบนี้ **(เอาไปใส่ใน `public/js/firebase-config.js`)**:
     ```js
     const firebaseConfig = {
       apiKey: "...",
       authDomain: "...",
       projectId: "...",
       storageBucket: "...",
       messagingSenderId: "...",
       appId: "..."
     };
     ```
5. ไปที่ **Project settings > Service accounts** → กด **Generate new private key** → จะได้ไฟล์ `.json` ดาวน์โหลดมา
   - เปิดไฟล์นั้นด้วย Notepad จะเห็น `project_id`, `client_email`, `private_key`
   - **เอาไปใส่ใน `.env`** (ขั้นตอนที่ 3) — ค่าพวกนี้เป็นความลับ ห้ามให้ใครเห็น ห้าม commit ขึ้น GitHub

### 1.2 สร้างโปรเจกต์ Supabase (สำหรับฐานข้อมูล)

1. ไปที่ https://supabase.com/ → สมัคร/ล็อกอิน → **New project** → ตั้งชื่อ + ตั้งรหัสผ่าน database (เก็บไว้ แต่ไม่ได้ใช้ตรง ๆ ในโปรเจกต์นี้) → รอสร้างเสร็จ (~2 นาที)
2. ไปที่ **SQL Editor** (เมนูซ้าย) → **New query**
3. เปิดไฟล์ `supabase/schema.sql` ที่แนบมาในโปรเจกต์นี้ → คัดลอกทั้งหมด → วางใน SQL Editor → กด **Run**
   - จะได้ตาราง `subjects` และ `assignments` พร้อม index และการป้องกันเบื้องต้น
4. ไปที่ **Project Settings > API** → คัดลอก 2 ค่านี้ **(เอาไปใส่ใน `.env`)**:
   - **Project URL** → ใส่เป็น `SUPABASE_URL`
   - **service_role key** (อยู่ในหัวข้อ "Project API keys" — ระวังอย่าเผลอก๊อบ `anon` key มาแทน) → ใส่เป็น `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ **service_role key คือกุญแจลับสุด ๆ** ใช้ได้เฉพาะฝั่ง backend (`.env`) เท่านั้น ห้ามเอาไปแปะในโค้ด frontend หรือ commit ขึ้น GitHub เด็ดขาด

---

## 2. วิธีติดตั้งและรันโปรเจกต์ (หลังทำข้อ 1 เสร็จแล้ว)

1. แตกไฟล์ ZIP แล้วเปิด Terminal ในโฟลเดอร์โปรเจกต์
2. ติดตั้งไลบรารี:
   ```bash
   npm install
   ```
3. สร้างไฟล์ตั้งค่า:
   ```bash
   cp .env.example .env
   ```
   (บน Windows ใช้ `copy .env.example .env`) แล้วเปิด `.env` มากรอกค่า 4 ตัวจากข้อ 1.1 และ 1.2:
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   FIREBASE_PROJECT_ID=...
   FIREBASE_CLIENT_EMAIL=...
   FIREBASE_PRIVATE_KEY="..."
   ```
4. เปิดไฟล์ `public/js/firebase-config.js` แล้ววาง `firebaseConfig` object จากข้อ 1.1 ทับของเดิม (ค่านี้อยู่ฝั่ง frontend ไม่ใช่ความลับ ใส่ตรง ๆ ในโค้ดได้)
5. รันเซิร์ฟเวอร์:
   ```bash
   npm start
   ```
6. เห็นข้อความ:
   ```
   ✅ ตั้งค่า Supabase และ Firebase Admin สำเร็จ
   🚀 เซิร์ฟเวอร์ทำงานที่ http://localhost:3000
   ```
   เปิดเบราว์เซอร์ไปที่ **http://localhost:3000** จะเจอหน้าล็อกอิน → สมัครสมาชิกด้วยอีเมล/รหัสผ่าน หรือ Google ได้เลย

> ระหว่างพัฒนา ใช้ `npm run dev` แทน `npm start` เพื่อรีสตาร์ทอัตโนมัติเมื่อแก้โค้ด

---

## 3. โครงสร้างโปรเจกต์

```
sungluiKKU/
├── server.js                    # จุดเริ่มต้นเซิร์ฟเวอร์
├── package.json
├── .env.example                 # ตัวอย่างไฟล์ตั้งค่า (คัดลอกเป็น .env)
├── supabase/
│   └── schema.sql                # SQL สำหรับสร้างตารางใน Supabase (รันครั้งเดียวตอนตั้งโปรเจกต์)
├── config/
│   ├── supabaseClient.js         # เชื่อมต่อ Supabase ด้วย service_role key
│   └── firebaseAdmin.js          # เชื่อมต่อ Firebase Admin SDK (ไว้ตรวจ token)
├── middleware/
│   └── authMiddleware.js         # ตรวจ Firebase ID token ทุก request ที่เข้า /api
├── models/
│   ├── subjectsRepo.js           # ฟังก์ชันอ่าน/เขียนตาราง subjects
│   └── assignmentsRepo.js        # ฟังก์ชันอ่าน/เขียนตาราง assignments
├── routes/
│   ├── subjects.js               # API สำหรับรายวิชา (ต้องล็อกอินก่อน)
│   └── assignments.js            # API สำหรับงาน (ต้องล็อกอินก่อน)
└── public/                       # หน้าเว็บฝั่งผู้ใช้ (Frontend)
    ├── index.html                # มีทั้งหน้า login และตัวแอปหลัก
    ├── css/style.css
    └── js/
        ├── firebase-config.js    # ตั้งค่า Firebase ฝั่ง frontend + ฟังก์ชัน login/logout
        ├── app.js                # ตรรกะหลักของเว็บแอป
        └── bubbles.js            # อนิเมชันพื้นหลังฟองอากาศ
```

---

## 4. API ที่มีให้ใช้งาน

ทุก endpoint ด้านล่าง (ยกเว้น `/api/health`) **ต้องแนบ header** `Authorization: Bearer <Firebase ID token>` มาด้วยเสมอ ไม่งั้นจะได้ 401

| Method | Endpoint | คำอธิบาย |
|---|---|---|
| GET | `/api/subjects` | ดึงรายวิชาทั้งหมด **ของผู้ใช้ที่ล็อกอินอยู่เท่านั้น** |
| POST | `/api/subjects` | เพิ่มรายวิชาใหม่ |
| PUT | `/api/subjects/:id` | แก้ไขรายวิชา |
| DELETE | `/api/subjects/:id` | ลบรายวิชา (และงานที่เกี่ยวข้อง) |
| GET | `/api/assignments` | ดึงงานทั้งหมด (พร้อมข้อมูลวิชา) |
| GET | `/api/assignments/upcoming?days=3` | งานที่ใกล้ถึงกำหนดส่งภายในจำนวนวันที่ระบุ |
| POST | `/api/assignments` | เพิ่มงานใหม่ |
| PUT | `/api/assignments/:id` | แก้ไขงาน / เปลี่ยนสถานะ |
| DELETE | `/api/assignments/:id` | ลบงาน |
| GET | `/api/health` | เช็คว่าเซิร์ฟเวอร์ต่อ Supabase ได้ไหม (ไม่ต้องล็อกอิน) |

---

## 5. ฟีเจอร์หลักของเว็บไซต์

- **ระบบล็อกอินส่วนตัว** — สมัคร/เข้าสู่ระบบด้วยอีเมล-รหัสผ่าน หรือ Google แต่ละคนเห็นแค่ข้อมูลของตัวเอง
- **แดชบอร์ดภาพรวม** — จำนวนงานทั้งหมด งานใกล้ถึงกำหนด งานที่ส่งแล้ว และจำนวนรายวิชา
- **จัดการรายวิชา** — เพิ่ม/แก้ไข/ลบ พร้อมระบุ "ช่องทาง" ได้หลายแบบต่อวิชา (ที่เรียน, ที่ส่งงาน, เช็คชื่อ, มีทประจำ, เฟซบุ๊ก, อีเมล, อื่นๆ)
- **จัดการงาน** — เพิ่ม/แก้ไข/ลบ/ทำเครื่องหมายว่าส่งแล้ว พร้อมตัวกรองตามรายวิชาและสถานะ
- **การแจ้งเตือน** — ขอสิทธิ์แจ้งเตือนผ่านเบราว์เซอร์ และแจ้งเตือนอัตโนมัติเมื่องานใกล้ถึงกำหนด
- **ดีไซน์เอิร์ธโทน** — โทนสีดินเผา/มอส/ทราย พร้อมพื้นหลังฟองอากาศลอยตัว
- **รองรับมือถือ** — ปรับเลย์เอาต์อัตโนมัติตามขนาดหน้าจอ

---

## 6. เอาไปขึ้นเว็บจริง (Deploy) เช่นบน Render

1. Push โค้ดขึ้น GitHub (เช็คว่า `.gitignore` กัน `node_modules` และ `.env` ไว้แล้ว — มีให้แล้วในโปรเจกต์นี้)
2. บน Render.com → New > Web Service → เลือก repo นี้ → Build: `npm install`, Start: `npm start`
3. ไปที่ Settings > Environment ของ Web Service แล้วใส่ตัวแปร 4 ตัวเดียวกับใน `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) — ไม่ต้องใส่ `PORT` เพราะ Render กำหนดให้เอง
4. **สำคัญ:** กลับไปที่ Firebase Console > Authentication > Settings > **Authorized domains** → เพิ่มโดเมนของ Render (เช่น `sungluikku.onrender.com`) ไม่งั้นปุ่ม "เข้าสู่ระบบด้วย Google" จะ error บนเว็บจริง (ตอนรันที่ `localhost` จะไม่มีปัญหานี้เพราะ Firebase ใส่ `localhost` ให้อัตโนมัติ)

---

## 7. แก้ปัญหาที่พบบ่อย

- **เซิร์ฟเวอร์ไม่ยอมสตาร์ท ขึ้น `❌ ไม่พบ SUPABASE_URL...`** → ยังไม่ได้สร้างไฟล์ `.env` หรือกรอกค่าไม่ครบ ดูข้อ 2.3
- **ล็อกอินแล้วขึ้น "เซสชันหมดอายุหรือไม่ถูกต้อง"** → เช็คว่า `FIREBASE_PROJECT_ID` ใน `.env` (ฝั่ง backend) กับ `projectId` ใน `firebase-config.js` (ฝั่ง frontend) เป็นโปรเจกต์เดียวกัน
- **"เข้าสู่ระบบด้วย Google" ไม่ทำงานตอน deploy จริง** → ลืมเพิ่มโดเมนใน Firebase Authorized domains (ดูข้อ 6.4)
- **บันทึกวิชา/งานไม่ได้ ขึ้น error จาก Supabase** → เช็คว่ารัน `supabase/schema.sql` ครบแล้ว และคัดลอก `service_role key` (ไม่ใช่ `anon key`) มาใส่ถูกต้อง
