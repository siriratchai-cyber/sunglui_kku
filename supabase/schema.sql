-- ==========================================================
-- sungluiKKU — Supabase (Postgres) schema
-- วิธีใช้: เปิด Supabase Dashboard > SQL Editor > New query
-- แปะไฟล์นี้ทั้งหมดแล้วกด Run ครั้งเดียว
-- ==========================================================

create extension if not exists "pgcrypto"; -- สำหรับ gen_random_uuid()

-- ---------- ตาราง subjects (รายวิชา) ----------
create table if not exists subjects (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,            -- Firebase uid ของเจ้าของข้อมูล
  name         text not null,
  code         text default '',
  instructor   text default '',
  color        text default '#A9714B',
  -- ช่องทางของวิชา เก็บเป็น array of {type, label, value}
  -- type ที่ใช้: learn, submit, attendance, meet, facebook, email, other
  links        jsonb not null default '[]'::jsonb,
  note         text default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_subjects_user_id on subjects(user_id);

-- ---------- ตาราง assignments (งาน) ----------
create table if not exists assignments (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null,
  subject_id       uuid not null references subjects(id) on delete cascade,
  title            text not null,
  description      text default '',
  due_date         timestamptz not null,
  -- ลิงก์/อีเมลส่งงานเฉพาะงานนี้ (override) ถ้าว่าง frontend จะใช้ค่าเริ่มต้นจากตัววิชาแทน
  submission_link  text default '',
  status           text not null default 'pending' check (status in ('pending', 'done')),
  priority         text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_assignments_user_id on assignments(user_id);
create index if not exists idx_assignments_subject_id on assignments(subject_id);
create index if not exists idx_assignments_due_date on assignments(due_date);

-- ---------- auto-update updated_at ----------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_subjects_updated_at on subjects;
create trigger trg_subjects_updated_at
  before update on subjects
  for each row execute function set_updated_at();

drop trigger if exists trg_assignments_updated_at on assignments;
create trigger trg_assignments_updated_at
  before update on assignments
  for each row execute function set_updated_at();

-- ---------- Row Level Security ----------
-- เปิด RLS ไว้เป็นเกราะป้องกันชั้นสอง (กันเผื่อ key หลุด)
-- แต่ Express backend จะต่อด้วย "service_role key" ซึ่ง "bypass RLS" อยู่แล้วเสมอ
-- ดังนั้นไม่ต้องเขียน policy อนุญาตให้ใครเข้าตรง ๆ ผ่าน anon key เลย — ปล่อยให้ปิดกั้นหมด (ปลอดภัยสุด)
alter table subjects enable row level security;
alter table assignments enable row level security;
-- ไม่สร้าง policy ใด ๆ ให้ anon/authenticated role โดยเจตนา
-- ทุก request ต้องผ่าน Express API (ที่ยืนยันตัวตนด้วย Firebase ID token) เท่านั้น
