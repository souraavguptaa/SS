const express = require('express');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// List announcements for a course
router.get('/course/:courseId', authenticate, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  if (req.user.role === 'student') {
    const enrollment = db.prepare('SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?')
      .get(req.user.id, req.params.courseId);
    if (!enrollment) return res.status(403).json({ error: 'Not enrolled' });
  }

  const announcements = db.prepare(`
    SELECT a.*, u.name as teacher_name FROM announcements a
    JOIN users u ON a.teacher_id = u.id
    WHERE a.course_id = ? ORDER BY a.created_at DESC
  `).all(req.params.courseId);
  res.json(announcements);
});

// Create announcement (teacher/admin)
router.post('/', authenticate, requireRole('teacher', 'admin'), (req, res) => {
  const { course_id, title, body } = req.body;
  if (!course_id || !title || !body) return res.status(400).json({ error: 'course_id, title, body required' });
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(course_id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  if (course.teacher_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const result = db.prepare('INSERT INTO announcements (course_id, teacher_id, title, body) VALUES (?,?,?,?)')
    .run(course_id, req.user.id, title, body);
  res.status(201).json(db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid));
});

// Delete announcement
router.delete('/:id', authenticate, requireRole('teacher', 'admin'), (req, res) => {
  const a = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (a.teacher_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
