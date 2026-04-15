import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function MyCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/students/my-courses')
      .then(r => { setCourses(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>My Learning</h1>
        <p>Track your enrolled courses and progress</p>
      </div>
      <div className="page-body">
        {courses.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🎓</div>
            <h3>No courses yet</h3>
            <p>Enroll in courses to start learning</p>
            <button className="btn btn-primary mt-4" onClick={() => navigate('/courses')}>Browse Courses</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {courses.map(c => {
              const pct = c.total_lessons > 0 ? Math.round((c.completed_lessons / c.total_lessons) * 100) : 0;
              return (
                <div key={c.id} className="card" style={{ display: 'flex', gap: 0, overflow: 'hidden' }}>
                  <div style={{ width: 8, background: c.course_completed ? 'var(--success)' : 'var(--primary)', flexShrink: 0 }} />
                  <div style={{ flex: 1, padding: '20px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span className="badge badge-primary">{c.category}</span>
                          {c.course_completed && <span className="badge badge-success">🏆 Completed</span>}
                        </div>
                        <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 2 }}>{c.title}</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>By {c.teacher_name} · Enrolled {new Date(c.enrolled_at).toLocaleDateString()}</p>
                      </div>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/courses/${c.id}`)}>
                        {c.completed_lessons > 0 ? 'Continue' : 'Start'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${pct}%`, background: c.course_completed ? 'var(--success)' : undefined }} />
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {c.completed_lessons}/{c.total_lessons} lessons · {pct}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
