/* ==========================================================
   DeadlineDen — frontend app logic
   ========================================================== */
const API = {
  subjects: '/api/subjects',
  assignments: '/api/assignments',
};

let state = {
  subjects: [],
  assignments: [],
  view: 'dashboard',
  calendarCursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDate: null, // 'YYYY-MM-DD'
};

/* ---------- ช่องทางของวิชา (learn / submit / attendance / meet / facebook / email / other) ---------- */
const LINK_META = {
  learn:      { icon: '🎓', label: 'ที่เรียน' },
  submit:     { icon: '📤', label: 'ส่งงาน' },
  attendance: { icon: '📝', label: 'เช็คชื่อ' },
  meet:       { icon: '🎥', label: 'มีทประจำ' },
  facebook:   { icon: '📘', label: 'เฟซบุ๊ก' },
  email:      { icon: '✉️', label: 'อีเมล' },
  other:      { icon: '🔗', label: 'อื่นๆ' },
};

function linkHref(link) {
  if (!link || !link.value) return '#';
  if (link.type === 'email') {
    return link.value.startsWith('mailto:') ? link.value : `mailto:${link.value}`;
  }
  return link.value;
}

function linkDisplayLabel(link) {
  if (!link) return '';
  if (link.label && link.label.trim()) return link.label.trim();
  return LINK_META[link.type]?.label || 'ลิงก์';
}

function linksChipsHtml(links = []) {
  if (!links || !links.length) return '';
  return `<div class="link-chip-row">${links
    .map((l) => {
      const meta = LINK_META[l.type] || LINK_META.other;
      return `<a class="link-chip" href="${escapeHtml(linkHref(l))}" target="_blank" rel="noopener">${meta.icon} ${escapeHtml(linkDisplayLabel(l))}</a>`;
    })
    .join('')}</div>`;
}

// หาช่องทาง "ส่งงาน" หลักของงานชิ้นหนึ่ง: ใช้ลิงก์เฉพาะงาน ถ้าไม่มีค่อยหยิบจากวิชา (submit ก่อน แล้วค่อย email)
function primarySubmitLink(a) {
  if (a.submissionLink && a.submissionLink.trim()) {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.submissionLink.trim());
    return {
      href: isEmail ? `mailto:${a.submissionLink.trim()}` : a.submissionLink.trim(),
      label: 'ส่งงานที่นี่ (เฉพาะงานนี้)',
      icon: isEmail ? '✉️' : '📤',
    };
  }
  const subjectLinks = (a.subject && a.subject.links) || [];
  const submit = subjectLinks.find((l) => l.type === 'submit');
  if (submit) return { href: linkHref(submit), label: `ส่งงานที่นี่ (${linkDisplayLabel(submit)})`, icon: LINK_META.submit.icon };
  const email = subjectLinks.find((l) => l.type === 'email');
  if (email) return { href: linkHref(email), label: `ส่งงานทางอีเมล (${linkDisplayLabel(email)})`, icon: LINK_META.email.icon };
  return null;
}

/* ---------- helpers ---------- */
function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $all(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function showToast(msg) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('is-visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

async function api(url, options = {}) {
  const token = await window.sungluiAuth.getIdToken();
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'เกิดข้อผิดพลาด');
  return data;
}

function daysUntil(dateStr) {
  const now = new Date();
  const due = new Date(dateStr);
  const ms = due - now;
  return ms / (1000 * 60 * 60 * 24);
}

function formatThaiDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function urgencyClass(dateStr, status) {
  if (status === 'done') return 'done';
  const days = daysUntil(dateStr);
  if (days < 0) return 'urgent';
  if (days <= 1) return 'urgent';
  if (days <= 3) return 'soon';
  return '';
}

function countdownLabel(dateStr, status) {
  if (status === 'done') return { text: 'ส่งแล้ว', cls: 'countdown-ok' };

  const ms = new Date(dateStr) - new Date();
  if (ms <= 0) return { text: 'เลยกำหนดแล้ว', cls: 'countdown-urgent' };

  const totalMinutes = Math.ceil(ms / 60000); // ✅ เปลี่ยนจาก Math.floor เป็น Math.ceil
  const totalHours = Math.ceil(ms / 3600000); // ✅ เปลี่ยนด้วย
  const totalDays = Math.ceil(ms / (1000 * 60 * 60 * 24)); // ✅ เปลี่ยนด้วย

  // ใช้เกณฑ์เดียวกับ NOTIFY_MILESTONES
  if (totalMinutes <= 30) {
    return { text: `เหลือ ${Math.max(1, totalMinutes)} นาที`, cls: 'countdown-urgent' };
  }
  if (totalMinutes <= 60) {
    if (totalHours < 1) {
      return { text: `เหลือ ${totalMinutes} นาที`, cls: 'countdown-urgent' };
    }
    return { text: `เหลือ ${totalHours} ชม.`, cls: 'countdown-urgent' };
  }
  if (totalDays <= 1) {
    return { text: `เหลือ ${Math.ceil(totalDays)} วัน`, cls: 'countdown-soon' };
  }
  return { text: `เหลือ ${Math.ceil(totalDays)} วัน`, cls: 'countdown-ok' };
}

/* ---------- ripple effect on all buttons ---------- */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn, .nav-item, .ghost-btn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.style.position = btn.style.position || 'relative';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
});

/* ---------- navigation ---------- */
const viewTitles = {
  dashboard: ['ภาพรวมงานของคุณ', 'ทุกกำหนดส่ง ทุกวิชา อยู่ในหน้าเดียว'],
  assignments: ['งานทั้งหมด', 'ดูและจัดการงานของทุกรายวิชา'],
  subjects: ['รายวิชาของคุณ', 'จัดการรายวิชาและช่องทางส่งงาน'],
  calendar: ['ปฏิทินงาน', 'ดูงานของแต่ละวันแบบรายเดือน'],
};

$all('.nav-item[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(view) {
  state.view = view;
  $all('.nav-item[data-view]').forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
  $all('.view').forEach((v) => v.classList.remove('is-active'));
  $(`#view-${view}`).classList.add('is-active');
  $('#view-title').textContent = viewTitles[view][0];
  $('#view-subtitle').textContent = viewTitles[view][1];
  if (view === 'calendar') renderCalendar();
}

/* ---------- data loading ---------- */
async function loadAll() {
  try {
    const [subjects, assignments] = await Promise.all([
      api(API.subjects),
      api(API.assignments),
    ]);
    state.subjects = subjects;
    state.assignments = assignments;
    renderSubjectSelects();
    renderDashboard();
    renderAssignments();
    renderSubjects();
    renderCalendar();
    checkDueSoonNotifications();
  } catch (err) {
    showToast('เชื่อมต่อฐานข้อมูลไม่สำเร็จ: ' + err.message);
  }
}

/* ---------- rendering: subject selects ---------- */
function renderSubjectSelects() {
  const assignSelect = $('#assignment-subject');
  const filterSelect = $('#filter-subject');
  const options = state.subjects
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join('');
  assignSelect.innerHTML = options || '<option value="">ยังไม่มีรายวิชา — เพิ่มก่อน</option>';

  const current = filterSelect.value;
  filterSelect.innerHTML =
    '<option value="">ทุกรายวิชา</option>' + options;
  filterSelect.value = current;
}

/* ---------- rendering: dashboard ---------- */
function renderDashboard() {
  const total = state.assignments.length;
  const urgent = state.assignments.filter(
    (a) => a.status === 'pending' && daysUntil(a.dueDate) <= 3
  ).length;
  const done = state.assignments.filter((a) => a.status === 'done').length;

  $('#stat-total').textContent = total;
  $('#stat-urgent').textContent = urgent;
  $('#stat-done').textContent = done;
  $('#stat-subjects').textContent = state.subjects.length;

  const upcoming = state.assignments
    .filter((a) => a.status === 'pending')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))

  $('#upcoming-list').innerHTML = upcoming.length
    ? upcoming.map(assignmentCardHtml).join('')
    : emptyStateHtml('ยังไม่มีงานที่ต้องส่ง', 'กดปุ่ม "+ เพิ่มงาน" เพื่อเริ่มบันทึกกำหนดส่งงานของคุณ');

  bindAssignmentCardEvents('#upcoming-list');
}

/* ---------- rendering: assignments list ---------- */
function renderAssignments() {
  const subjectFilter = $('#filter-subject').value;
  const statusFilter = $('#filter-status').value;

  let list = [...state.assignments].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  if (subjectFilter) list = list.filter((a) => a.subject && a.subject.id === subjectFilter);
  if (statusFilter) list = list.filter((a) => a.status === statusFilter);

  $('#all-assignment-list').innerHTML = list.length
    ? list.map(assignmentCardHtml).join('')
    : emptyStateHtml('ไม่พบงานที่ตรงกับเงื่อนไข', 'ลองเปลี่ยนตัวกรอง หรือเพิ่มงานใหม่');

  bindAssignmentCardEvents('#all-assignment-list');
}

$('#filter-subject').addEventListener('change', renderAssignments);
$('#filter-status').addEventListener('change', renderAssignments);

function emptyStateHtml(title, sub) {
  return `<div class="empty-state"><span class="emoji">🌿</span><strong>${title}</strong><p>${sub}</p></div>`;
}

function assignmentCardHtml(a) {
  const subject = a.subject || { name: 'ไม่ระบุวิชา', color: '#A8552E', links: [] };
  const uCls = urgencyClass(a.dueDate, a.status);
  const cd = countdownLabel(a.dueDate, a.status);
  const isDone = a.status === 'done';
  const primary = primarySubmitLink(a);

  return `
  <div class="assignment-card ${uCls}" data-id="${a.id}">
    <button class="assignment-check ${isDone ? 'checked' : ''}" data-action="toggle" title="ทำเครื่องหมายว่าส่งแล้ว">
      ${isDone ? '✓' : ''}
    </button>
    <div class="assignment-info">
      <div class="assignment-title ${isDone ? 'done' : ''}">${escapeHtml(a.title)}</div>
      <div class="assignment-meta">
        <span class="subject-pill" style="background:${subject.color}"><span class="dot"></span>${escapeHtml(subject.name)}</span>
      </div>
      ${linksChipsHtml(subject.links)}
      ${primary ? `<a class="submit-cta" href="${escapeHtml(primary.href)}" target="_blank" rel="noopener">${primary.icon} ${escapeHtml(primary.label)}</a>` : ''}
    </div>
    <div class="assignment-due">
      <div class="due-countdown ${cd.cls}">${cd.text}</div>
      <div class="due-date">${formatThaiDate(a.dueDate)}</div>
    </div>
    <div class="assignment-actions">
      <button class="icon-btn" data-action="edit" title="แก้ไข">✎</button>
      <button class="icon-btn" data-action="delete" title="ลบ">🗑</button>
    </div>
  </div>`;
}

function bindAssignmentCardEvents(containerSel) {
  $all(`${containerSel} .assignment-card`).forEach((card) => {
    const id = card.dataset.id;
    const assignment = state.assignments.find((a) => a.id === id);
    if (!assignment) return;

    const toggleBtn = $('[data-action="toggle"]', card);
    if (toggleBtn) toggleBtn.addEventListener('click', () => toggleAssignmentStatus(assignment));

    const editBtn = $('[data-action="edit"]', card);
    if (editBtn) editBtn.addEventListener('click', () => openAssignmentModal(assignment));

    const delBtn = $('[data-action="delete"]', card);
    if (delBtn) delBtn.addEventListener('click', () => deleteAssignment(assignment));
  });
}

async function toggleAssignmentStatus(a) {
  const newStatus = a.status === 'done' ? 'pending' : 'done';
  try {
    await api(`${API.assignments}/${a.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });
    showToast(newStatus === 'done' ? 'ทำเครื่องหมายว่าส่งแล้ว' : 'เปลี่ยนเป็นยังไม่ส่ง');
    await loadAll();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message);
  }
}

async function deleteAssignment(a) {
  if (!confirm(`ลบงาน "${a.title}" ใช่หรือไม่?`)) return;
  try {
    await api(`${API.assignments}/${a.id}`, { method: 'DELETE' });
    resetNotifiedMilestones(a.id);
    showToast('ลบงานเรียบร้อยแล้ว');
    await loadAll();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message);
  }
}

/* ---------- rendering: subjects ---------- */
function renderSubjects() {
  $('#subject-grid').innerHTML = state.subjects.length
    ? state.subjects.map(subjectCardHtml).join('')
    : emptyStateHtml('ยังไม่มีรายวิชา', 'กดปุ่ม "+ เพิ่มรายวิชา" เพื่อเริ่มต้น');

  $all('#subject-grid .subject-card').forEach((card) => {
    const id = card.dataset.id;
    const subject = state.subjects.find((s) => s.id === id);
    if (!subject) return;
    $('[data-action="edit"]', card)?.addEventListener('click', () => openSubjectModal(subject));
    $('[data-action="delete"]', card)?.addEventListener('click', () => deleteSubject(subject));
  });
}

function subjectCardHtml(s) {
  const count = state.assignments.filter((a) => a.subject && a.subject.id === s.id).length;
  return `
  <div class="subject-card" data-id="${s.id}" style="border-top-color:${s.color}">
    <div class="subject-card-actions">
      <button class="icon-btn" data-action="edit" title="แก้ไข">✎</button>
      <button class="icon-btn" data-action="delete" title="ลบ">🗑</button>
    </div>
    <h3>${escapeHtml(s.name)}</h3>
    ${s.code ? `<div class="code">${escapeHtml(s.code)}</div>` : ''}
    ${s.instructor ? `<div class="instructor">👤 ${escapeHtml(s.instructor)}</div>` : ''}
    ${linksChipsHtml(s.links)}
    ${s.note ? `<div class="subject-note">💬 ${escapeHtml(s.note)}</div>` : ''}
    <div class="subject-count">📌 ${count} งาน</div>
  </div>`;
}

async function deleteSubject(s) {
  if (!confirm(`ลบรายวิชา "${s.name}" จะลบงานทั้งหมดในวิชานี้ด้วย ต้องการดำเนินการต่อหรือไม่?`)) return;
  try {
    await api(`${API.subjects}/${s.id}`, { method: 'DELETE' });
    showToast('ลบรายวิชาเรียบร้อยแล้ว');
    await loadAll();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message);
  }
}

/* ---------- rendering: calendar ---------- */
function ymd(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function assignmentsByDate() {
  const map = {};
  state.assignments.forEach((a) => {
    const key = ymd(new Date(a.dueDate));
    if (!map[key]) map[key] = [];
    map[key].push(a);
  });
  return map;
}

function renderCalendar() {
  const cursor = state.calendarCursor;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  $('#cal-month-label').textContent = cursor.toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric',
  });

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const todayKey = ymd(new Date());
  const byDate = assignmentsByDate();

  const cells = [];

  // วันท้ายเดือนก่อนหน้า (เติมช่องว่าง)
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, daysInPrevMonth - i);
    cells.push({ date: d, otherMonth: true });
  }
  // วันในเดือนนี้
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), otherMonth: false });
  }
  // เติมช่องว่างท้ายตาราง ให้ครบแถวสุดท้าย (คูณ 7)
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    cells.push({ date: d, otherMonth: true });
  }

  $('#calendar-grid').innerHTML = cells
    .map((cell) => {
      const key = ymd(cell.date);
      const dayAssignments = byDate[key] || [];
      const isToday = key === todayKey;
      const isSelected = key === state.selectedDate;

      const chips = dayAssignments
        .slice(0, 2)
        .map((a) => {
          const color = a.subject?.color || '#A8552E';
          const done = a.status === 'done' ? 'is-done' : '';
          return `<span class="calendar-chip ${done}" style="background:${color}">${escapeHtml(a.title)}</span>`;
        })
        .join('');
      const more = dayAssignments.length > 2
        ? `<span class="calendar-more">+${dayAssignments.length - 2} เพิ่มเติม</span>`
        : '';

      return `
      <div class="calendar-day ${cell.otherMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}" data-date="${key}">
        <span class="calendar-day-num">${cell.date.getDate()}</span>
        ${chips}
        ${more}
      </div>`;
    })
    .join('');

  $all('#calendar-grid .calendar-day').forEach((cellEl) => {
    cellEl.addEventListener('click', () => {
      state.selectedDate = cellEl.dataset.date;
      renderCalendar();
      renderCalendarDayPanel();
    });
  });
}

function renderCalendarDayPanel() {
  const panel = $('#calendar-day-panel');
  if (!state.selectedDate) {
    panel.style.display = 'none';
    return;
  }
  const byDate = assignmentsByDate();
  const dayAssignments = (byDate[state.selectedDate] || []).sort(
    (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
  );
  const niceDate = new Date(state.selectedDate + 'T00:00:00').toLocaleDateString('th-TH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  $('#calendar-day-title').textContent = `งานวันที่ ${niceDate}`;
  $('#calendar-day-list').innerHTML = dayAssignments.length
    ? dayAssignments.map(assignmentCardHtml).join('')
    : emptyStateHtml('ไม่มีงานในวันนี้', 'เลือกวันอื่น หรือเพิ่มงานใหม่สำหรับวันนี้');

  bindAssignmentCardEvents('#calendar-day-list');
  panel.style.display = 'block';
}

$('#cal-prev').addEventListener('click', () => {
  state.calendarCursor.setMonth(state.calendarCursor.getMonth() - 1);
  renderCalendar();
});
$('#cal-next').addEventListener('click', () => {
  state.calendarCursor.setMonth(state.calendarCursor.getMonth() + 1);
  renderCalendar();
});
$('#cal-today').addEventListener('click', () => {
  const now = new Date();
  state.calendarCursor = new Date(now.getFullYear(), now.getMonth(), 1);
  state.selectedDate = ymd(now);
  renderCalendar();
  renderCalendarDayPanel();
});

/* ---------- modals: subject ---------- */
const subjectModal = $('#subject-modal');
const assignmentModal = $('#assignment-modal');

$('#add-subject-btn').addEventListener('click', () => openSubjectModal());
$all('[data-close-modal]').forEach((btn) =>
  btn.addEventListener('click', () => {
    subjectModal.classList.remove('is-open');
    assignmentModal.classList.remove('is-open');
  })
);
[subjectModal, assignmentModal].forEach((m) =>
  m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('is-open'); })
);

/* ---------- subject modal: dynamic link rows ---------- */
function linkRowHtml(link, idx) {
  const l = link || { type: 'submit', label: '', value: '' };
  const typeOptions = Object.entries(LINK_META)
    .map(([key, meta]) => `<option value="${key}" ${l.type === key ? 'selected' : ''}>${meta.icon} ${meta.label}</option>`)
    .join('');
  return `
  <div class="link-row" data-idx="${idx}">
    <select class="link-type-select">${typeOptions}</select>
    <input type="text" class="link-label-input" placeholder="ชื่อ/หมายเหตุ (ถ้ามี)" value="${escapeHtml(l.label || '')}" />
    <input type="text" class="link-value-input" placeholder="วางลิงก์ที่นี่ https://..." value="${escapeHtml(l.value || '')}" />
    <button type="button" class="icon-btn link-remove-btn" title="ลบช่องทางนี้">✕</button>
  </div>`;
}

function bindLinkRow(rowEl) {
  const select = $('.link-type-select', rowEl);
  const valueInput = $('.link-value-input', rowEl);
  const labelInput = $('.link-label-input', rowEl);
  function syncType() {
    const isEmail = select.value === 'email';
    valueInput.type = isEmail ? 'email' : 'text';
    valueInput.placeholder = isEmail ? 'เช่น teacher@kku.ac.th' : 'วางลิงก์ที่นี่ https://...';
    labelInput.placeholder = select.value === 'other'
      ? 'ชื่อช่องทาง เช่น Discord, LINE OpenChat'
      : 'ชื่อ/หมายเหตุ (ถ้ามี) เช่น Google Classroom';
  }
  select.addEventListener('change', syncType);
  syncType();
  $('.link-remove-btn', rowEl).addEventListener('click', () => rowEl.remove());
}

let linkRowCounter = 0;
function addLinkRow(link) {
  const container = $('#subject-links-list');
  const idx = linkRowCounter++;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = linkRowHtml(link, idx).trim();
  const rowEl = wrapper.firstChild;
  container.appendChild(rowEl);
  bindLinkRow(rowEl);
}

$('#add-link-row-btn').addEventListener('click', () => addLinkRow());

function collectLinksFromForm() {
  return $all('#subject-links-list .link-row')
    .map((row) => ({
      type: $('.link-type-select', row).value,
      label: $('.link-label-input', row).value.trim(),
      value: $('.link-value-input', row).value.trim(),
    }))
    .filter((l) => l.value); // ตัดแถวที่ยังไม่กรอกลิงก์ทิ้ง
}

function openSubjectModal(subject) {
  $('#subject-modal-title').textContent = subject ? 'แก้ไขรายวิชา' : 'เพิ่มรายวิชาใหม่';
  $('#subject-id').value = subject ? subject.id : '';
  $('#subject-name').value = subject ? subject.name : '';
  $('#subject-code').value = subject ? subject.code || '' : '';
  $('#subject-instructor').value = subject ? subject.instructor || '' : '';
  $('#subject-color').value = subject ? subject.color || '#A8552E' : '#A8552E';
  $('#subject-note').value = subject ? subject.note || '' : '';

  $('#subject-links-list').innerHTML = '';
  const links = subject && subject.links && subject.links.length
    ? subject.links
    : [{ type: 'learn', label: '', value: '' }, { type: 'submit', label: '', value: '' }];
  links.forEach(addLinkRow);

  subjectModal.classList.add('is-open');
}

$('#subject-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#subject-id').value;
  const payload = {
    name: $('#subject-name').value.trim(),
    code: $('#subject-code').value.trim(),
    instructor: $('#subject-instructor').value.trim(),
    color: $('#subject-color').value,
    note: $('#subject-note').value.trim(),
    links: collectLinksFromForm(),
  };
  try {
    if (id) {
      await api(`${API.subjects}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('แก้ไขรายวิชาเรียบร้อยแล้ว');
    } else {
      await api(API.subjects, { method: 'POST', body: JSON.stringify(payload) });
      showToast('เพิ่มรายวิชาเรียบร้อยแล้ว');
    }
    subjectModal.classList.remove('is-open');
    await loadAll();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message);
  }
});

/* ---------- modals: assignment ---------- */
$('#add-assignment-btn').addEventListener('click', () => {
  if (!state.subjects.length) {
    showToast('กรุณาเพิ่มรายวิชาก่อนเพิ่มงาน');
    openSubjectModal();
    return;
  }
  openAssignmentModal();
});

function toDatetimeLocal(dateStr) {
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function updateAssignmentSubjectHint() {
  const subj = state.subjects.find((s) => s.id === $('#assignment-subject').value);
  const hint = $('#assignment-subject-hint');
  if (!subj || !subj.links || !subj.links.length) {
    hint.innerHTML = '';
    return;
  }
  hint.innerHTML = `<span class="subject-hint-label">ช่องทางของวิชานี้:</span>${linksChipsHtml(subj.links)}`;
}

$('#assignment-subject').addEventListener('change', updateAssignmentSubjectHint);

function openAssignmentModal(assignment) {
  $('#assignment-modal-title').textContent = assignment ? 'แก้ไขงาน' : 'เพิ่มงานใหม่';
  $('#assignment-id').value = assignment ? assignment.id : '';
  renderSubjectSelects();
  $('#assignment-subject').value = assignment ? assignment.subject.id : state.subjects[0]?.id || '';
  $('#assignment-title').value = assignment ? assignment.title : '';
  $('#assignment-desc').value = assignment ? assignment.description || '' : '';
  $('#assignment-due').value = assignment ? toDatetimeLocal(assignment.dueDate) : '';
  $('#assignment-link').value = assignment ? assignment.submissionLink || '' : '';
  $('#assignment-priority').value = assignment ? assignment.priority || 'medium' : 'medium';
  updateAssignmentSubjectHint();
  assignmentModal.classList.add('is-open');
}

$('#assignment-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#assignment-id').value;
  const payload = {
    subject: $('#assignment-subject').value,
    title: $('#assignment-title').value.trim(),
    description: $('#assignment-desc').value.trim(),
    dueDate: new Date($('#assignment-due').value).toISOString(),
    submissionLink: $('#assignment-link').value.trim(),
    priority: $('#assignment-priority').value,
  };
  try {
    if (id) {
      await api(`${API.assignments}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      resetNotifiedMilestones(id); // กำหนดส่งอาจเปลี่ยน ให้เตือนใหม่ตามรอบที่ถูกต้อง
      showToast('แก้ไขงานเรียบร้อยแล้ว');
    } else {
      await api(API.assignments, { method: 'POST', body: JSON.stringify(payload) });
      showToast('เพิ่มงานเรียบร้อยแล้ว');
    }
    assignmentModal.classList.remove('is-open');
    await loadAll();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message);
  }
});

/* ---------- notifications ---------- */
const notifBtn = $('#notif-toggle-btn');

function updateNotifBtnLabel() {
  if (!('Notification' in window)) {
    notifBtn.textContent = '🔕 เบราว์เซอร์ไม่รองรับ';
    notifBtn.disabled = true;
    return;
  }
  notifBtn.textContent = Notification.permission === 'granted'
    ? '🔔 การแจ้งเตือนเปิดอยู่'
    : '🔔 เปิดการแจ้งเตือน';
}

notifBtn.addEventListener('click', async () => {
  if (!('Notification' in window)) return;
  const perm = await Notification.requestPermission();
  updateNotifBtnLabel();
  if (perm === 'granted') {
    showToast('เปิดการแจ้งเตือนเรียบร้อยแล้ว');
    checkDueSoonNotifications();
  }
});

let notifiedMilestones = JSON.parse(localStorage.getItem('notifiedMilestones') || '{}');



function saveNotifiedMilestones() {
  localStorage.setItem('notifiedMilestones', JSON.stringify(notifiedMilestones));
}

// เรียกตอนแก้ไข/ลบงาน เผื่อเปลี่ยนกำหนดส่งใหม่ จะได้เตือนใหม่ตามรอบที่ถูกต้อง
function resetNotifiedMilestones(assignmentId) {
  delete notifiedMilestones[assignmentId];
  saveNotifiedMilestones();
}

// สร้างข้อความเวลาที่เหลือจาก "เวลาจริง ณ ตอนนั้น" แทนที่จะใช้ label ตายตัวของ milestone
// (แก้บั๊ก: งานที่เพิ่มมาแล้วใกล้เดดไลน์มาก ๆ เช่นเหลือ 2 นาที จะไม่ถูกแจ้งว่า "อีก 30 นาที" ผิด ๆ อีกต่อไป)
function formatMinutesLeft(minutesLeft) {
  if (minutesLeft < 1) return 'อีกไม่ถึง 1 นาที';
  if (minutesLeft < 60) return `อีก ${Math.round(minutesLeft)} นาที`;
  if (minutesLeft < 24 * 60) {
    const h = Math.floor(minutesLeft / 60);
    const m = Math.round(minutesLeft % 60);
    return m > 0 ? `อีก ${h} ชม. ${m} นาที` : `อีก ${h} ชั่วโมง`;
  }
  const d = Math.floor(minutesLeft / (24 * 60));
  const h = Math.floor((minutesLeft % (24 * 60)) / 60);
  return h > 0 ? `อีก ${d} วัน ${h} ชม.` : `อีก ${d} วัน`;
}

/* ---------- helper: show a notification safely (works on desktop + mobile Chrome) ---------- */
let swRegistration = null;

async function getServiceWorkerRegistration() {
  if (swRegistration) return swRegistration;
  if (!('serviceWorker' in navigator)) return null;
  try {
    // Reuse an existing registration if one is already active for this scope,
    // otherwise register a minimal one just for notifications.
    swRegistration = await navigator.serviceWorker.getRegistration();
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.register('/sw.js');
    }
    await navigator.serviceWorker.ready;
    return swRegistration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

async function showAppNotification(title, options) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const registration = await getServiceWorkerRegistration();
  if (registration) {
    // Mobile Chrome requires this path — `new Notification()` throws
    // "Illegal constructor" there.
    await registration.showNotification(title, options);
  } else if (typeof Notification === 'function') {
    // Fallback for contexts where the plain constructor is allowed (mostly desktop).
    try {
      new Notification(title, options);
    } catch (err) {
      console.warn('Notification fallback failed:', err);
    }
  }
}

function checkDueSoonNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const pending = state.assignments.filter((a) => a.status === 'pending');

  pending.forEach((a) => {
    const minutesLeft = (new Date(a.dueDate) - new Date()) / 60000;
    if (minutesLeft < 0) return; // เลยกำหนดไปแล้ว

    const notifiedForThis = notifiedMilestones[a.id] || [];

    // ✅ ตั้งเกณฑ์เอง แทนการใช้ NOTIFY_MILESTONES
    const milestones = [
      { key: '1d', minutes: 24 * 60 },
      { key: '1h', minutes: 60 },
      { key: '30m', minutes: 30 },
    ];

    const applicable = milestones
      .filter((m) => minutesLeft <= m.minutes && !notifiedForThis.includes(m.key))
      .sort((x, y) => x.minutes - y.minutes);

    if (applicable.length) {
      const remainingText = formatMinutesLeft(minutesLeft);
      showAppNotification(`ใกล้ถึงกำหนดส่งงาน (${remainingText})`, {
        body: `${a.title} (${a.subject?.name || ''}) — ครบกำหนด ${formatThaiDate(a.dueDate)}`,
        icon: '',
      });
      applicable.forEach((m) => notifiedForThis.push(m.key));
    }

    notifiedMilestones[a.id] = notifiedForThis;
  });

  saveNotifiedMilestones();
}

/* ---------- utils ---------- */
function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ---------- auth: login / register / logout ---------- */
const authScreen = $('#auth-screen');
const appShell = $('.app-shell');

function showAuthScreen() {
  authScreen.classList.add('is-open');
  appShell.style.display = 'none';
}

function showApp() {
  authScreen.classList.remove('is-open');
  appShell.style.display = '';
}

$('#auth-toggle-mode').addEventListener('click', () => {
  const isRegister = $('#auth-form').dataset.mode === 'register';
  $('#auth-form').dataset.mode = isRegister ? 'login' : 'register';
  $('#auth-title').textContent = isRegister ? 'เข้าสู่ระบบ sungluiKKU' : 'สมัครสมาชิก sungluiKKU';
  $('#auth-submit-btn').textContent = isRegister ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
  $('#auth-toggle-mode').textContent = isRegister
    ? 'ยังไม่มีบัญชี? สมัครสมาชิก'
    : 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ';
  $('#auth-error').textContent = '';
});

$('#auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  const isRegister = $('#auth-form').dataset.mode === 'register';
  $('#auth-error').textContent = '';
  try {
    if (isRegister) {
      await window.sungluiAuth.registerWithEmail(email, password);
    } else {
      await window.sungluiAuth.loginWithEmail(email, password);
    }
  } catch (err) {
    $('#auth-error').textContent = friendlyAuthError(err);
  }
});

$('#auth-google-btn').addEventListener('click', async () => {
  $('#auth-error').textContent = '';
  try {
    await window.sungluiAuth.loginWithGoogle();
  } catch (err) {
    $('#auth-error').textContent = friendlyAuthError(err);
  }
});

$('#logout-btn').addEventListener('click', async () => {
  await window.sungluiAuth.logout();
});

function friendlyAuthError(err) {
  const code = err?.code || '';
  const map = {
    'auth/invalid-email': 'อีเมลไม่ถูกต้อง',
    'auth/user-not-found': 'ไม่พบบัญชีนี้',
    'auth/wrong-password': 'รหัสผ่านไม่ถูกต้อง',
    'auth/invalid-credential': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    'auth/email-already-in-use': 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน',
    'auth/weak-password': 'รหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัวอักษร)',
  };
  return map[code] || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
}

let refreshIntervalId = null;
let uiRefreshIntervalId = null;

function startUiAutoRefresh() {
  if (uiRefreshIntervalId) clearInterval(uiRefreshIntervalId);
  uiRefreshIntervalId = setInterval(() => {
    renderDashboard();
    renderAssignments();
    renderCalendar();
  }, 10000);
}

/* ---------- init: รอ Firebase พร้อมก่อน แล้วค่อยผูก auth state ---------- */
function startAuthListening() {
  window.sungluiAuth.onAuthChange((user) => {
    if (user) {
      showApp();
      updateNotifBtnLabel();
      $('#user-email-label').textContent = user.email || '';
      loadAll();
      if (refreshIntervalId) clearInterval(refreshIntervalId);
      refreshIntervalId = setInterval(loadAll, 60000);
      startUiAutoRefresh();
    } else {
      if (refreshIntervalId) clearInterval(refreshIntervalId);
      if (uiRefreshIntervalId) clearInterval(uiRefreshIntervalId);
      state.subjects = [];
      state.assignments = [];
      showAuthScreen();
    }
  });
}

if (window.sungluiAuth) {
  startAuthListening();
} else {
  window.addEventListener('sungluiAuthReady', startAuthListening, { once: true });
}