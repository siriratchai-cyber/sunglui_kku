const supabase = require('../config/supabaseClient');

const TABLE = 'subjects';

// แปลงแถวจาก Postgres ให้หน้าตาเหมือนเดิม (frontend ไม่ต้องแก้อะไรเรื่อง links)
function normalize(row) {
  if (!row) return row;
  return { ...row, links: row.links || [] };
}

async function findAllByUser(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalize);
}

async function findByIdForUser(id, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return normalize(data);
}

async function create(userId, payload) {
  if (!payload.name || !payload.name.trim()) {
    const err = new Error('กรุณาระบุชื่อรายวิชา');
    err.status = 400;
    throw err;
  }
  const insertRow = {
    user_id: userId,
    name: payload.name.trim(),
    code: payload.code?.trim() || '',
    instructor: payload.instructor?.trim() || '',
    color: payload.color || '#A9714B',
    links: Array.isArray(payload.links) ? payload.links : [],
    note: payload.note?.trim() || '',
  };
  const { data, error } = await supabase.from(TABLE).insert(insertRow).select().single();
  if (error) throw error;
  return normalize(data);
}

async function update(id, userId, payload) {
  const updateRow = {};
  if (payload.name !== undefined) {
    if (!payload.name.trim()) {
      const err = new Error('กรุณาระบุชื่อรายวิชา');
      err.status = 400;
      throw err;
    }
    updateRow.name = payload.name.trim();
  }
  if (payload.code !== undefined) updateRow.code = payload.code?.trim() || '';
  if (payload.instructor !== undefined) updateRow.instructor = payload.instructor?.trim() || '';
  if (payload.color !== undefined) updateRow.color = payload.color;
  if (payload.links !== undefined) updateRow.links = Array.isArray(payload.links) ? payload.links : [];
  if (payload.note !== undefined) updateRow.note = payload.note?.trim() || '';

  const { data, error } = await supabase
    .from(TABLE)
    .update(updateRow)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return normalize(data);
}

async function remove(id, userId) {
  // ลบงานที่อยู่ในวิชานี้ก่อน (assignments อ้าง subject_id แบบ on delete cascade อยู่แล้ว
  // แต่กันเหนียวไว้เผื่อ DB เก่ายังไม่มี cascade)
  await supabase.from('assignments').delete().eq('subject_id', id).eq('user_id', userId);
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return normalize(data);
}

module.exports = { findAllByUser, findByIdForUser, create, update, remove };
