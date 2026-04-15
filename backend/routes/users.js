const express = require('express');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// List all users (admin only)
router.get('/', authenticate, requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

// Get single user (admin)
router.get('/:id', authenticate, requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Delete user (admin)
router.delete('/:id', authenticate, requireRole('admin'), (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted' });
});

// Update user role (admin)
router.patch('/:id/role', authenticate, requireRole('admin'), (req, res) => {
  const { role } = req.body;
  if (!['admin', 'teacher', 'student'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ message: 'Role updated' });
});

// Student: get my enrolled courses with progress
router.get('/students/my-courses', authenticate, requireRole('student'), (req, res) => {
  const courses = db.prepare(`
    SELECT c.*, u.name as teacher_name, e.enrolled_at, e.completed as course_completed,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id) as total_lessons,
      (SELECT COUNT(*) FROM lesson_progress lp
        JOIN lessons l ON lp.lesson_id = l.id
        WHERE lp.student_id = ? AND l.course_id = c.id AND lp.completed = 1) as completed_lessons
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    JOIN users u ON c.teacher_id = u.id
    WHERE e.student_id = ?
    ORDER BY e.enrolled_at DESC
  `).all(req.user.id, req.user.id);
  res.json(courses);
});

// Dashboard stats for admin
router.get('/admin/stats', authenticate, requireRole('admin'), (req, res) => {
  const stats = {
    total_users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    total_students: db.prepare("SELECT COUNT(*) as c FROM users WHERE role='student'").get().c,
    total_teachers: db.prepare("SELECT COUNT(*) as c FROM users WHERE role='teacher'").get().c,
    total_courses: db.prepare('SELECT COUNT(*) as c FROM courses').get().c,
    published_courses: db.prepare('SELECT COUNT(*) as c FROM courses WHERE published=1').get().c,
    total_enrollments: db.prepare('SELECT COUNT(*) as c FROM enrollments').get().c,
    completed_enrollments: db.prepare('SELECT COUNT(*) as c FROM enrollments WHERE completed=1').get().c,
    recent_users: db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5').all(),
  };
  res.json(stats);
});

// Dashboard stats for teacher
router.get('/teacher/stats', authenticate, requireRole('teacher'), (req, res) => {
  const stats = {
    total_courses: db.prepare('SELECT COUNT(*) as c FROM courses WHERE teacher_id = ?').get(req.user.id).c,
    total_students: db.prepare(`
      SELECT COUNT(DISTINCT student_id) as c FROM enrollments e
      JOIN courses c ON e.course_id = c.id WHERE c.teacher_id = ?
    `).get(req.user.id).c,
    total_lessons: db.prepare(`
      SELECT COUNT(*) as c FROM lessons l JOIN courses c ON l.course_id = c.id WHERE c.teacher_id = ?
    `).get(req.user.id).c,
    courses: db.prepare(`
      SELECT c.id, c.title, c.published,
        (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as students
      FROM courses c WHERE c.teacher_id = ? ORDER BY c.created_at DESC LIMIT 5
    `).all(req.user.id),
  };
  res.json(stats);
});

// Dashboard stats for student
router.get('/student/stats', authenticate, requireRole('student'), (req, res) => {
  const stats = {
    enrolled_courses: db.prepare('SELECT COUNT(*) as c FROM enrollments WHERE student_id = ?').get(req.user.id).c,
    completed_courses: db.prepare('SELECT COUNT(*) as c FROM enrollments WHERE student_id = ? AND completed = 1').get(req.user.id).c,
    completed_lessons: db.prepare('SELECT COUNT(*) as c FROM lesson_progress WHERE student_id = ? AND completed = 1').get(req.user.id).c,
    quiz_attempts: db.prepare('SELECT COUNT(*) as c FROM quiz_attempts WHERE student_id = ?').get(req.user.id).c,
    correct_answers: db.prepare('SELECT COUNT(*) as c FROM quiz_attempts WHERE student_id = ? AND is_correct = 1').get(req.user.id).c,
  };
  res.json(stats);
});

// Announcements for student's enrolled courses
router.get('/announcements/feed', authenticate, requireRole('student'), (req, res) => {
  const announcements = db.prepare(`
    SELECT a.*, c.title as course_title, u.name as teacher_name
    FROM announcements a
    JOIN courses c ON a.course_id = c.id
    JOIN users u ON a.teacher_id = u.id
    JOIN enrollments e ON e.course_id = c.id
    WHERE e.student_id = ?
    ORDER BY a.created_at DESC
    LIMIT 20
  `).all(req.user.id);
  res.json(announcements);
});

module.exports = router;
