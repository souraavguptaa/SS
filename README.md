# LearnHub LMS

A fully functional Learning Management System built with Node.js, Express, SQLite, and React.

## Features

- **Multi-role authentication** — Admin, Teacher, Student with JWT
- **Course management** — Create, edit, publish/unpublish, delete courses
- **Lesson management** — Rich text content, optional video embedding, ordering
- **Quiz system** — Multiple-choice questions with instant feedback
- **Progress tracking** — Per-lesson completion, course progress bars
- **Enrollment system** — Students enroll/unenroll; teachers see student progress
- **Announcements** — Teachers post course announcements visible to enrolled students
- **Admin panel** — User management, role assignment, platform stats
- **Dashboards** — Role-specific dashboards with key metrics

## Demo Accounts

| Role    | Email               | Password    |
|---------|---------------------|-------------|
| Admin   | admin@lms.com       | admin123    |
| Teacher | teacher@lms.com     | teacher123  |
| Student | student@lms.com     | student123  |

## Getting Started

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Build frontend
cd frontend && npm run build

# Start server (serves both API + frontend)
cd backend && npm start
```

Open [http://localhost:5000](http://localhost:5000)

## Development

```bash
# Run backend with auto-reload
cd backend && npm run dev

# Run frontend dev server (with API proxy)
cd frontend && npm run dev
```

## Tech Stack

- **Backend**: Node.js · Express · better-sqlite3 · JWT · bcryptjs
- **Frontend**: React 19 · React Router v6 · Axios · Vite
- **Database**: SQLite (auto-created, seeded with demo data)

## Project Structure

```
├── backend/
│   ├── server.js           # Express app entry point
│   ├── db.js               # SQLite setup & seed data
│   ├── middleware/auth.js  # JWT middleware
│   └── routes/
│       ├── auth.js         # Register, login, profile
│       ├── courses.js      # Course CRUD + enrollment
│       ├── lessons.js      # Lesson CRUD + quiz + progress
│       ├── users.js        # User management + stats
│       └── announcements.js
├── frontend/
│   └── src/
│       ├── App.jsx         # Router setup
│       ├── api.js          # Axios instance
│       ├── context/AuthContext.jsx
│       ├── components/Layout.jsx
│       └── pages/
│           ├── Login.jsx · Register.jsx
│           ├── Dashboard.jsx   # Role-aware dashboard
│           ├── Courses.jsx     # Course catalog
│           ├── CourseDetail.jsx
│           ├── LessonView.jsx  # Lesson + quiz
│           ├── MyCourses.jsx   # Student progress
│           ├── ManageCourse.jsx # Teacher tools
│           ├── AdminUsers.jsx
│           └── Profile.jsx
```
