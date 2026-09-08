const supabase = require('../config/supabaseClient');

const TABLE = 'assignments';
// select นี้ join เอาข้อมูลวิชามาด้วยในคำสั่งเดียว (เหมือน .populate('subject') สมัย Mongoose)
const SELECT_WITH_SUBJECT = '*, subject:subjects(*)';

// แปลง row จาก Postgres (snake_case) ให้เป็นรูปแบบเดิมที่ frontend คุ้นเคย (camelCase)
function normalize(row) {
  if (!row) return row;
  const subject = row.subject ? { ...row.subject, links: row.subject.links || [] } : null;
  return {
    id: row.id,
    subject,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    submissionLink: row.submission_link,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findAllByUser(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_WITH_SUBJECT)
    .eq('user_id', userId)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalize);
}

async function findUpcomingByUser(userId, days) {
  const now = new Date();
  const future = new Date();
  future.setDate(now.getDate() + days);

  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_WITH_SUBJECT)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('due_date', now.toISOString())
    .lte('due_date', future.toISOString())
    .order('due_date', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalize);
}

function validatePayload(payload, { partial = false } = {}) {
  if (!partial || payload.subject !== undefined) {
    if (!payload.subject) {
      const err = new Error('กรุณาเลือกรายวิชา');
      err.status = 400;
      throw err;
    }
  }
  if (!partial || payload.title !== undefined) {
    if (!payload.title || !payload.title.trim()) {
      const err = new Error('กรุณาระบุชื่องาน');
      err.status = 400;
      throw err;
    }
  }
  if (!partial || payload.dueDate !== undefined) {
    if (!payload.dueDate) {
      const err = new Error('กรุณาระบุกำหนดส่งงาน');
      err.status = 400;
      throw err;
    }
  }
}

async function create(userId, payload) {
  validatePayload(payload);
  const insertRow = {
    user_id: userId,
    subject_id: payload.subject,
    title: payload.title.trim(),
    description: payload.description?.trim() || '',
    due_date: new Date(payload.dueDate).toISOString(),
    submission_link: payload.submissionLink?.trim() || '',
    status: payload.status || 'pending',
    priority: payload.priority || 'medium',
  };
  const { data, error } = await supabase.from(TABLE).insert(insertRow).select(SELECT_WITH_SUBJECT).single();
  if (error) throw error;
  return normalize(data);
}

async function update(id, userId, payload) {
  validatePayload(payload, { partial: true });
  const updateRow = {};
  if (payload.subject !== undefined) updateRow.subject_id = payload.subject;
  if (payload.title !== undefined) updateRow.title = payload.title.trim();
  if (payload.description !== undefined) updateRow.description = payload.description?.trim() || '';
  if (payload.dueDate !== undefined) updateRow.due_date = new Date(payload.dueDate).toISOString();
  if (payload.submissionLink !== undefined) updateRow.submission_link = payload.submissionLink?.trim() || '';
  if (payload.status !== undefined) updateRow.status = payload.status;
  if (payload.priority !== undefined) updateRow.priority = payload.priority;

  const { data, error } = await supabase
    .from(TABLE)
    .update(updateRow)
    .eq('id', id)
    .eq('user_id', userId)
    .select(SELECT_WITH_SUBJECT)
    .maybeSingle();
  if (error) throw error;
  return normalize(data);
}

async function remove(id, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

module.exports = { findAllByUser, findUpcomingByUser, create, update, remove };
