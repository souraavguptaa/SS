import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

export default function CourseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get(`/courses/${id}`)
      .then(r => { setCourse(r.data); setLoading(false); })
      .catch(() => { navigate('/courses'); });
  }, [id]);

  const enroll = async () => {
    setEnrolling(true); setMsg('');
    try {
      await api.post(`/courses/${id}/enroll`);
      const r = await api.get(`/courses/${id}`);
      setCourse(r.data);
      setMsg('Successfully enrolled! You can now access all lessons.');
    } catch (err) { setMsg(err.response?.data?.error || 'Enrollment failed'); }
    finally { setEnrolling(false); }
  };

  const unenroll = async () => {
    if (!confirm('Unenroll from this course?')) return;
    await api.delete(`/courses/${id}/enroll`);
    const r = await api.get(`/courses/${id}`);
    setCourse(r.data);
    setMsg('You have been unenrolled.');
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!course) return null;

  const completedCount = course.lessons?.filter(l => l.completed).length || 0;
  const totalCount = course.lessons?.length || 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <span className="badge badge-primary">{course.category}</span>
          {!course.published && <span className="badge badge-gray">Draft</span>}
        </div>
        <h1>{course.title}</h1>
        <p>By {course.teacher_name} · {course.enrollment_count} students enrolled</p>
      </div>

      <div className="page-body">
        {msg && <div className={`alert ${msg.includes('failed') ? 'alert-error' : 'alert-success'}`}>{msg}</div>}

        <div className="lesson-page">
          <div className="lesson-content-area">
            <div className="card">
              <div className="card-body">
                <h2 style={{ marginBottom: 12 }}>About this course</h2>
                <p style={{ lineHeight: 1.7, color: 'var(--text-muted)' }}>{course.description}</p>
              </div>
            </div>

            {course.enrolled && totalCount > 0 && (
              <div className="card">
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>Your Progress</span>
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{completedCount}/{totalCount} lessons</span>
                  </div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                  <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>{progress}% complete {course.enrollment?.completed ? '· 🏆 Course completed!' : ''}</div>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-header">
                <span style={{ fontWeight: 700, fontSize: 16 }}>Course Lessons ({totalCount})</span>
                {(user?.role === 'teacher' || user?.role === 'admin') && course.teacher_id === user?.id && (
                  <Link to={`/courses/${id}/manage`} className="btn btn-secondary btn-sm">Manage Course</Link>
                )}
              </div>
              <div className="card-body">
                {totalCount === 0 ? (
                  <div className="text-muted text-sm">No lessons yet.</div>
                ) : (
                  <ul className="lesson-list">
                    {course.lessons.map((l, i) => (
                      <li key={l.id} className={`lesson-item ${l.completed ? 'completed' : ''}`}
                        onClick={() => course.enrolled || user?.role !== 'student' ? navigate(`/lessons/${l.id}`) : setMsg('Enroll in this course to access lessons.')}>
                        <div className={`lesson-number ${l.completed ? 'done' : ''}`}>
                          {l.completed ? '✓' : i + 1}
                        </div>
                        <div className="lesson-item-title">{l.title}</div>
                        {l.duration > 0 && <div className="lesson-item-duration">{l.duration} min</div>}
                        {!course.enrolled && user?.role === 'student' && <span style={{ fontSize: 12 }}>🔒</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="lesson-sidebar-panel">
            <div className="card card-body">
              {user?.role === 'student' ? (
                <>
                  {course.enrolled ? (
                    <>
                      <div className="alert alert-success" style={{ marginBottom: 16 }}>✅ You're enrolled</div>
                      {totalCount > 0 && (
                        <Link to={`/lessons/${course.lessons[0].id}`} className="btn btn-primary w-full" style={{ marginBottom: 10 }}>
                          {completedCount > 0 ? 'Continue Learning' : 'Start Course'}
                        </Link>
                      )}
                      <button className="btn btn-ghost w-full btn-sm" onClick={unenroll}>Unenroll</button>
                    </>
                  ) : (
                    <button className="btn btn-primary w-full btn-lg" onClick={enroll} disabled={enrolling}>
                      {enrolling ? 'Enrolling…' : 'Enroll Now — Free'}
                    </button>
                  )}
                </>
              ) : (
                <Link to={`/courses/${id}/manage`} className="btn btn-secondary w-full">Manage Course</Link>
              )}
              <hr style={{ margin: '16px 0', borderColor: 'var(--border)' }} />
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: 'var(--text-muted)' }}>
                <li>📖 {totalCount} lessons</li>
                <li>👥 {course.enrollment_count} students</li>
                <li>🏷️ {course.category}</li>
                <li>👤 {course.teacher_name}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
