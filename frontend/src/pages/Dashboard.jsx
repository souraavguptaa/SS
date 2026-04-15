import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

function StatCard({ icon, iconClass, label, value }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconClass}`}>{icon}</div>
      <div>
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get('/users/admin/stats').then(r => setStats(r.data)).catch(() => {}); }, []);
  if (!stats) return <div className="spinner" style={{ margin: '40px auto' }} />;
  return (
    <>
      <div className="stats-grid">
        <StatCard icon="👥" iconClass="purple" label="Total Users" value={stats.total_users} />
        <StatCard icon="🎓" iconClass="cyan" label="Students" value={stats.total_students} />
        <StatCard icon="📋" iconClass="green" label="Teachers" value={stats.total_teachers} />
        <StatCard icon="📚" iconClass="orange" label="Published Courses" value={stats.published_courses} />
        <StatCard icon="📝" iconClass="purple" label="Total Enrollments" value={stats.total_enrollments} />
        <StatCard icon="✅" iconClass="green" label="Completions" value={stats.completed_enrollments} />
      </div>
      <div className="card">
        <div className="card-header"><span className="section-title" style={{ marginBottom: 0 }}>Recent Users</span><Link to="/admin/users" className="btn btn-secondary btn-sm">View All</Link></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody>
              {stats.recent_users.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td><td>{u.email}</td>
                  <td><span className={`badge badge-${u.role === 'admin' ? 'danger' : u.role === 'teacher' ? 'warning' : 'primary'}`}>{u.role}</span></td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function TeacherDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get('/users/teacher/stats').then(r => setStats(r.data)).catch(() => {}); }, []);
  if (!stats) return <div className="spinner" style={{ margin: '40px auto' }} />;
  return (
    <>
      <div className="stats-grid">
        <StatCard icon="📚" iconClass="purple" label="My Courses" value={stats.total_courses} />
        <StatCard icon="👥" iconClass="cyan" label="Total Students" value={stats.total_students} />
        <StatCard icon="📖" iconClass="green" label="Total Lessons" value={stats.total_lessons} />
      </div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="section-title" style={{ marginBottom: 0 }}>My Courses</h2>
        <Link to="/courses" className="btn btn-primary btn-sm">+ New Course</Link>
      </div>
      {stats.courses.length === 0 ? (
        <div className="empty-state"><div className="icon">📚</div><h3>No courses yet</h3><p>Create your first course to get started.</p></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Course</th><th>Status</th><th>Students</th><th>Actions</th></tr></thead>
              <tbody>
                {stats.courses.map(c => (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td><span className={`badge ${c.published ? 'badge-success' : 'badge-gray'}`}>{c.published ? 'Published' : 'Draft'}</span></td>
                    <td>{c.students}</td>
                    <td><Link to={`/courses/${c.id}/manage`} className="btn btn-ghost btn-sm">Manage</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function StudentDashboard() {
  const [stats, setStats] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  useEffect(() => {
    api.get('/users/student/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/users/announcements/feed').then(r => setAnnouncements(r.data)).catch(() => {});
  }, []);
  if (!stats) return <div className="spinner" style={{ margin: '40px auto' }} />;

  const pct = stats.enrolled_courses > 0 ? Math.round((stats.completed_courses / stats.enrolled_courses) * 100) : 0;
  const quizPct = stats.quiz_attempts > 0 ? Math.round((stats.correct_answers / stats.quiz_attempts) * 100) : 0;

  return (
    <>
      <div className="stats-grid">
        <StatCard icon="📚" iconClass="purple" label="Enrolled Courses" value={stats.enrolled_courses} />
        <StatCard icon="✅" iconClass="green" label="Completed" value={stats.completed_courses} />
        <StatCard icon="📖" iconClass="cyan" label="Lessons Done" value={stats.completed_lessons} />
        <StatCard icon="🧠" iconClass="orange" label="Quiz Score" value={`${quizPct}%`} />
      </div>
      <div className="two-col">
        <div>
          <h2 className="section-title">My Progress</h2>
          <div className="card card-body">
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span>Course completion</span><span>{pct}%</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
            <div style={{ marginTop: 20, marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span>Quiz accuracy</span><span>{quizPct}%</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${quizPct}%`, background: 'var(--secondary)' }} /></div>
            <div className="mt-4">
              <Link to="/my-courses" className="btn btn-primary">View My Courses</Link>
            </div>
          </div>
        </div>
        <div>
          <h2 className="section-title">Announcements</h2>
          {announcements.length === 0 ? (
            <div className="card card-body text-muted text-sm">No announcements yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {announcements.slice(0, 4).map(a => (
                <div key={a.id} className="card card-body" style={{ padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                  <div className="text-muted text-sm" style={{ marginTop: 2 }}>{a.course_title} · {a.teacher_name}</div>
                  <div style={{ fontSize: 13, marginTop: 6 }}>{a.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div>
      <div className="page-header">
        <h1>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p>Here's what's happening on your learning platform today.</p>
      </div>
      <div className="page-body">
        {user?.role === 'admin' && <AdminDashboard />}
        {user?.role === 'teacher' && <TeacherDashboard />}
        {user?.role === 'student' && <StudentDashboard />}
      </div>
    </div>
  );
}
