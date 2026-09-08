const express = require('express');
const router = express.Router();
const subjectsRepo = require('../models/subjectsRepo');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth); // ทุก route ในไฟล์นี้ต้องล็อกอินก่อน

// GET /api/subjects — ดึงรายวิชาทั้งหมด "ของผู้ใช้คนนี้เท่านั้น"
router.get('/', async (req, res) => {
  try {
    const subjects = await subjectsRepo.findAllByUser(req.userId);
    res.json(subjects);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// POST /api/subjects — เพิ่มรายวิชาใหม่
router.post('/', async (req, res) => {
  try {
    const saved = await subjectsRepo.create(req.userId, req.body);
    res.status(201).json(saved);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

// PUT /api/subjects/:id — แก้ไขรายวิชา
router.put('/:id', async (req, res) => {
  try {
    const updated = await subjectsRepo.update(req.params.id, req.userId, req.body);
    if (!updated) return res.status(404).json({ message: 'ไม่พบรายวิชานี้' });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message });
  }
});

// DELETE /api/subjects/:id — ลบรายวิชา (พร้อมงานที่เกี่ยวข้อง)
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await subjectsRepo.remove(req.params.id, req.userId);
    if (!deleted) return res.status(404).json({ message: 'ไม่พบรายวิชานี้' });
    res.json({ message: 'ลบรายวิชาเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

module.exports = router;
