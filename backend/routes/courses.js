const express = require('express');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// List all published courses (with optional search/filter)
router.get('/', authenticate, (req, res) => {
  const { search, category } = req.query;
  let query = `
    SELECT c.*, u.name as teacher_name,
      (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrollment_count,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count
    FROM courses c
    JOIN users u ON c.teacher_id = u.id
    WHERE c.published = 1
  `;
  const params = [];
  if (search) { query += ` AND (c.title LIKE ? OR c.description LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
  if (category) { query += ` AND c.category = ?`; params.push(category); }
  query += ' ORDER BY c.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

// Teacher's own courses (all, including drafts)
router.get('/my', authenticate, requireRole('teacher', 'admin'), (req, res) => {
  const courses = db.prepare(`
    SELECT c.*, u.name as teacher_name,
      (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrollment_count,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as lesson_count
    FROM courses c JOIN users u ON c.teacher_id = u.id
    WHERE c.teacher_id = ?
    ORDER BY c.created_at DESC
  `).all(req.user.id);
  res.json(courses);
});

// Get single course
router.get('/:id', authenticate, (req, res) => {
  const course = db.prepare(`
    SELECT c.*, u.name as teacher_name,
      (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as enrollment_count
    FROM courses c JOIN users u ON c.teacher_id = u.id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  course.lessons = db.prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY order_index').all(req.params.id);

  if (req.user.role === 'student') {
    const enrollment = db.prepare('SELECT * FROM enrollments WHERE student_id = ? AND course_id = ?').get(req.user.id, req.params.id);
    course.enrolled = !!enrollment;
    course.enrollment = enrollment || null;
    if (enrollment) {
      const progress = db.prepare('SELECT * FROM lesson_progress WHERE student_id = ?').all(req.user.id);
      const completedIds = new Set(progress.filter(p => p.completed).map(p => p.lesson_id));
      course.lessons = course.lessons.map(l => ({ ...l, completed: completedIds.has(l.id) }));
    }
  }

  res.json(course);
});

// Create course (teacher/admin)
router.post('/', authenticate, requireRole('teacher', 'admin'), (req, res) => {
  const { title, description, category, thumbnail } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const result = db.prepare('INSERT INTO courses (title, description, category, thumbnail, teacher_id) VALUES (?,?,?,?,?)')
    .run(title, description || '', category || 'General', thumbnail || '', req.user.id);
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(course);
});

// Update course
router.put('/:id', authenticate, requireRole('teacher', 'admin'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  if (course.teacher_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { title, description, category, thumbnail, published } = req.body;
  db.prepare('UPDATE courses SET title=?, description=?, category=?, thumbnail=?, published=? WHERE id=?')
    .run(title ?? course.title, description ?? course.description, category ?? course.category,
      thumbnail ?? course.thumbnail, published ?? course.published, req.params.id);
  res.json(db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id));
});

// Delete course
router.delete('/:id', authenticate, requireRole('teacher', 'admin'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  if (course.teacher_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
  res.json({ message: 'Course deleted' });
});

// Publish / unpublish
router.patch('/:id/publish', authenticate, requireRole('teacher', 'admin'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Not found' });
  if (course.teacher_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('UPDATE courses SET published = ? WHERE id = ?').run(course.published ? 0 : 1, req.params.id);
  res.json({ published: !course.published });
});

// Enroll
router.post('/:id/enroll', authenticate, requireRole('student'), (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ? AND published = 1').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  try {
    db.prepare('INSERT INTO enrollments (student_id, course_id) VALUES (?,?)').run(req.user.id, req.params.id);
    res.json({ message: 'Enrolled successfully' });
  } catch {
    res.status(409).json({ error: 'Already enrolled' });
  }
});

// Unenroll
router.delete('/:id/enroll', authenticate, requireRole('student'), (req, res) => {
  db.prepare('DELETE FROM enrollments WHERE student_id = ? AND course_id = ?').run(req.user.id, req.params.id);
  res.json({ message: 'Unenrolled' });
});

// Get students enrolled in a course (teacher view)
router.get('/:id/students', authenticate, requireRole('teacher', 'admin'), (req, res) => {
  const students = db.prepare(`
    SELECT u.id, u.name, u.email, e.enrolled_at, e.completed,
      (SELECT COUNT(*) FROM lesson_progress lp
        JOIN lessons l ON lp.lesson_id = l.id
        WHERE lp.student_id = u.id AND l.course_id = ? AND lp.completed = 1) as lessons_completed,
      (SELECT COUNT(*) FROM lessons WHERE course_id = ?) as total_lessons
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    WHERE e.course_id = ?
    ORDER BY e.enrolled_at DESC
  `).all(req.params.id, req.params.id, req.params.id);
  res.json(students);
});

// Get categories
router.get('/meta/categories', authenticate, (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM courses WHERE published = 1 ORDER BY category').all();
  res.json(rows.map(r => r.category));
});

module.exports = router;
