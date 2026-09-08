const express = require('express');
const router = express.Router();
const assignmentsRepo = require('../models/assignmentsRepo');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth); // ทุก route ในไฟล์นี้ต้องล็อกอินก่อน

// GET /api/assignments — ดึงงานทั้งหมด (พร้อมข้อมูลรายวิชา) ของผู้ใช้คนนี้
router.get('/', async (req, res) => {
  try {
    const assignments = await assignmentsRepo.findAllByUser(req.userId);
    res.json(assignments);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// GET /api/assignments/upcoming?days=3 — งานที่ใกล้ถึงกำหนดส่ง
router.get('/upcoming', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 3;
    const upcoming = await assignmentsRepo.findUpcomingByUser(req.userId, days);
    res.json(upcoming);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// POST /api/assignments — เพิ่มงานใหม่
router.post('/', async (req, res) => {
  try {
    const saved = await assignmentsRepo.create(req.userId, req.body);
    res.status(201).json(saved);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

// PUT /api/assignments/:id — แก้ไขงาน (รวมถึงเปลี่ยนสถานะ)
router.put('/:id', async (req, res) => {
  try {
    const updated = await assignmentsRepo.update(req.params.id, req.userId, req.body);
    if (!updated) return res.status(404).json({ message: 'ไม่พบงานนี้' });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

// DELETE /api/assignments/:id — ลบงาน
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await assignmentsRepo.remove(req.params.id, req.userId);
    if (!deleted) return res.status(404).json({ message: 'ไม่พบงานนี้' });
    res.json({ message: 'ลบงานเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

module.exports = router;
