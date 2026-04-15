const express = require('express');
const { db } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get lesson detail (must be enrolled or teacher/admin)
router.get('/:id', authenticate, (req, res) => {
  const lesson = db.prepare(`
    SELECT l.*, c.teacher_id, c.published
    FROM lessons l JOIN courses c ON l.course_id = c.id
    WHERE l.id = ?
  `).get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

  if (req.user.role === 'student') {
    const enrollment = db.prepare('SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?')
      .get(req.user.id, lesson.course_id);
    if (!enrollment) return res.status(403).json({ error: 'Not enrolled in this course' });
    const progress = db.prepare('SELECT * FROM lesson_progress WHERE student_id = ? AND lesson_id = ?')
      .get(req.user.id, req.params.id);
    lesson.progress = progress || null;
  }

  // Attach quizzes
  lesson.quizzes = db.prepare('SELECT id, question, options FROM quizzes WHERE lesson_id = ?').all(req.params.id)
    .map(q => ({ ...q, options: JSON.parse(q.options) }));

  res.json(lesson);
});

// Create lesson (teacher/admin)
router.post('/', authenticate, requireRole('teacher', 'admin'), (req, res) => {
  const { course_id, title, content, video_url, duration } = req.body;
  if (!course_id || !title) return res.status(400).json({ error: 'course_id and title required' });
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(course_id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  if (course.teacher_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const maxOrder = db.prepare('SELECT MAX(order_index) as m FROM lessons WHERE course_id = ?').get(course_id);
  const order = (maxOrder.m || 0) + 1;

  const result = db.prepare('INSERT INTO lessons (course_id, title, content, video_url, duration, order_index) VALUES (?,?,?,?,?,?)')
    .run(course_id, title, content || '', video_url || '', duration || 0, order);
  res.status(201).json(db.prepare('SELECT * FROM lessons WHERE id = ?').get(result.lastInsertRowid));
});

// Update lesson
router.put('/:id', authenticate, requireRole('teacher', 'admin'), (req, res) => {
  const lesson = db.prepare('SELECT l.*, c.teacher_id FROM lessons l JOIN courses c ON l.course_id = c.id WHERE l.id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  if (lesson.teacher_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { title, content, video_url, duration, order_index } = req.body;
  db.prepare('UPDATE lessons SET title=?, content=?, video_url=?, duration=?, order_index=? WHERE id=?')
    .run(title ?? lesson.title, content ?? lesson.content, video_url ?? lesson.video_url,
      duration ?? lesson.duration, order_index ?? lesson.order_index, req.params.id);
  res.json(db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id));
});

// Delete lesson
router.delete('/:id', authenticate, requireRole('teacher', 'admin'), (req, res) => {
  const lesson = db.prepare('SELECT l.*, c.teacher_id FROM lessons l JOIN courses c ON l.course_id = c.id WHERE l.id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  if (lesson.teacher_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM lessons WHERE id = ?').run(req.params.id);
  res.json({ message: 'Lesson deleted' });
});

// Mark lesson complete (student)
router.post('/:id/complete', authenticate, requireRole('student'), (req, res) => {
  const lesson = db.prepare('SELECT l.*, c.id as cid FROM lessons l JOIN courses c ON l.course_id = c.id WHERE l.id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  const enrollment = db.prepare('SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?').get(req.user.id, lesson.course_id);
  if (!enrollment) return res.status(403).json({ error: 'Not enrolled' });

  db.prepare(`
    INSERT INTO lesson_progress (student_id, lesson_id, completed, completed_at) VALUES (?,?,1,CURRENT_TIMESTAMP)
    ON CONFLICT(student_id, lesson_id) DO UPDATE SET completed=1, completed_at=CURRENT_TIMESTAMP
  `).run(req.user.id, req.params.id);

  // Check if all lessons complete → mark enrollment complete
  const total = db.prepare('SELECT COUNT(*) as c FROM lessons WHERE course_id = ?').get(lesson.course_id).c;
  const done = db.prepare(`
    SELECT COUNT(*) as c FROM lesson_progress lp
    JOIN lessons l ON lp.lesson_id = l.id
    WHERE lp.student_id = ? AND l.course_id = ? AND lp.completed = 1
  `).get(req.user.id, lesson.course_id).c;
  if (done >= total) {
    db.prepare('UPDATE enrollments SET completed = 1 WHERE student_id = ? AND course_id = ?').run(req.user.id, lesson.course_id);
  }
  res.json({ message: 'Lesson marked complete', course_completed: done >= total });
});

// Add quiz to lesson
router.post('/:id/quizzes', authenticate, requireRole('teacher', 'admin'), (req, res) => {
  const { question, options, correct_index } = req.body;
  if (!question || !options || correct_index === undefined) return res.status(400).json({ error: 'question, options, correct_index required' });
  const lesson = db.prepare('SELECT l.*, c.teacher_id FROM lessons l JOIN courses c ON l.course_id = c.id WHERE l.id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
  if (lesson.teacher_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const result = db.prepare('INSERT INTO quizzes (lesson_id, question, options, correct_index) VALUES (?,?,?,?)')
    .run(req.params.id, question, JSON.stringify(options), correct_index);
  res.status(201).json({ id: result.lastInsertRowid, question, options, correct_index });
});

// Submit quiz answer
router.post('/quizzes/:quizId/attempt', authenticate, requireRole('student'), (req, res) => {
  const { selected_index } = req.body;
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.quizId);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  const is_correct = selected_index === quiz.correct_index ? 1 : 0;
  db.prepare('INSERT INTO quiz_attempts (student_id, quiz_id, selected_index, is_correct) VALUES (?,?,?,?)')
    .run(req.user.id, req.params.quizId, selected_index, is_correct);
  res.json({ is_correct: !!is_correct, correct_index: quiz.correct_index });
});

module.exports = router;
