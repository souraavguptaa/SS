const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'lms.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      thumbnail TEXT,
      teacher_id INTEGER NOT NULL,
      published INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      video_url TEXT,
      duration INTEGER DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed INTEGER DEFAULT 0,
      UNIQUE(student_id, course_id),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      completed INTEGER DEFAULT 0,
      completed_at DATETIME,
      UNIQUE(student_id, lesson_id),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_index INTEGER NOT NULL,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      quiz_id INTEGER NOT NULL,
      selected_index INTEGER NOT NULL,
      is_correct INTEGER NOT NULL,
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Seed an admin account if none exists
  const admin = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
  if (!admin) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)")
      .run('Admin', 'admin@lms.com', hash, 'admin');

    // Seed a demo teacher
    const teacherHash = bcrypt.hashSync('teacher123', 10);
    db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)")
      .run('Jane Doe', 'teacher@lms.com', teacherHash, 'teacher');

    // Seed a demo student
    const studentHash = bcrypt.hashSync('student123', 10);
    db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)")
      .run('John Smith', 'student@lms.com', studentHash, 'student');

    // Seed demo courses
    const teacherId = db.prepare("SELECT id FROM users WHERE role='teacher' LIMIT 1").get().id;
    const c1 = db.prepare("INSERT INTO courses (title, description, category, teacher_id, published) VALUES (?,?,?,?,1)")
      .run('Introduction to JavaScript', 'Learn the fundamentals of JavaScript programming language.', 'Programming', teacherId);
    const c2 = db.prepare("INSERT INTO courses (title, description, category, teacher_id, published) VALUES (?,?,?,?,1)")
      .run('Web Design Fundamentals', 'HTML, CSS, and responsive design from scratch.', 'Design', teacherId);

    // Seed lessons
    const lessons = [
      { course_id: c1.lastInsertRowid, title: 'Variables & Data Types', content: 'In JavaScript, variables are containers for storing data values. Use let, const, or var to declare variables.\n\n**let** - block-scoped, can be updated\n**const** - block-scoped, cannot be reassigned\n**var** - function-scoped (legacy)\n\nData types include: String, Number, Boolean, null, undefined, Object, Symbol.', order_index: 1 },
      { course_id: c1.lastInsertRowid, title: 'Functions & Scope', content: 'Functions are reusable blocks of code. JavaScript supports function declarations, expressions, and arrow functions.\n\nScope determines where variables are accessible. JavaScript has global scope, function scope, and block scope.', order_index: 2 },
      { course_id: c1.lastInsertRowid, title: 'Arrays & Objects', content: 'Arrays store ordered lists of values. Objects store key-value pairs.\n\nArrays: [], push(), pop(), map(), filter(), reduce()\nObjects: {}, dot notation, bracket notation, destructuring', order_index: 3 },
      { course_id: c2.lastInsertRowid, title: 'HTML Basics', content: 'HTML (HyperText Markup Language) is the standard language for creating web pages.\n\nKey elements: headings (h1-h6), paragraphs (p), links (a), images (img), divs, spans, forms.', order_index: 1 },
      { course_id: c2.lastInsertRowid, title: 'CSS Styling', content: 'CSS (Cascading Style Sheets) controls the visual presentation of HTML.\n\nSelectors, properties, values. Box model: margin, border, padding, content. Flexbox and Grid for layouts.', order_index: 2 },
    ];
    const insertLesson = db.prepare("INSERT INTO lessons (course_id, title, content, order_index) VALUES (?,?,?,?)");
    lessons.forEach(l => insertLesson.run(l.course_id, l.title, l.content, l.order_index));

    // Seed quizzes
    const firstLesson = db.prepare("SELECT id FROM lessons ORDER BY id LIMIT 1").get();
    db.prepare("INSERT INTO quizzes (lesson_id, question, options, correct_index) VALUES (?,?,?,?)")
      .run(firstLesson.id, 'Which keyword declares a block-scoped variable that can be reassigned?', JSON.stringify(['var','let','const','function']), 1);
    db.prepare("INSERT INTO quizzes (lesson_id, question, options, correct_index) VALUES (?,?,?,?)")
      .run(firstLesson.id, 'What is the output of typeof null?', JSON.stringify(['"null"','"undefined"','"object"','"boolean"']), 2);
  }
}

module.exports = { db, initDB };
