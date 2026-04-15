import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

function LessonModal({ courseId, lesson, onClose, onSaved }) {
  const [form, setForm] = useState({ title: lesson?.title || '', content: lesson?.content || '', video_url: lesson?.video_url || '', duration: lesson?.duration || 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      let res;
      if (lesson) res = await api.put(`/lessons/${lesson.id}`, form);
      else res = await api.post('/lessons', { ...form, course_id: courseId });
      onSaved(res.data);
    } catch (err) { setError(err.response?.data?.error || 'Failed to save'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{lesson ? 'Edit Lesson' : 'Add Lesson'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group"><label>Title *</label><input className="form-control" value={form.title} onChange={set('title')} required /></div>
            <div className="form-group"><label>Content</label><textarea className="form-control" rows={6} value={form.content} onChange={set('content')} placeholder="Lesson content (supports plain text)…" /></div>
            <div className="form-group"><label>Video URL (optional)</label><input className="form-control" value={form.video_url} onChange={set('video_url')} placeholder="https://youtube.com/embed/…" /></div>
            <div className="form-group"><label>Duration (minutes)</label><input className="form-control" type="number" min="0" value={form.duration} onChange={set('duration')} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Lesson'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AnnouncementModal({ courseId, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', body: '' });
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await api.post('/announcements', { ...form, course_id: courseId });
      onCreated(res.data);
    } catch {} finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h2>Post Announcement</h2><button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-group"><label>Title *</label><input className="form-control" value={form.title} onChange={set('title')} required /></div>
            <div className="form-group"><label>Message *</label><textarea className="form-control" rows={4} value={form.body} onChange={set('body')} required /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Posting…' : 'Post Announcement'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ManageCourse() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('lessons');
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editLesson, setEditLesson] = useState(null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = async () => {
    const [courseRes, lessonsRes, studentsRes, announcementsRes] = await Promise.all([
      api.get(`/courses/${id}`),
      api.get(`/courses/${id}`),
      api.get(`/courses/${id}/students`).catch(() => ({ data: [] })),
      api.get(`/announcements/course/${id}`).catch(() => ({ data: [] })),
    ]);
    setCourse(courseRes.data);
    setLessons(courseRes.data.lessons || []);
    setStudents(studentsRes.data);
    setAnnouncements(announcementsRes.data);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [id]);

  const togglePublish = async () => {
    await api.patch(`/courses/${id}/publish`);
    refresh();
  };

  const deleteLesson = async (lessonId) => {
    if (!confirm('Delete this lesson?')) return;
    await api.delete(`/lessons/${lessonId}`);
    refresh();
  };

  const deleteCourse = async () => {
    if (!confirm('Delete this entire course? This cannot be undone.')) return;
    await api.delete(`/courses/${id}`);
    navigate('/courses');
  };

  const saveEdit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      await api.put(`/courses/${id}`, editForm);
      setEditForm(null); refresh();
      setMsg('Course updated!');
    } catch { setMsg('Update failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!course) return null;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/courses/${id}`)}>← View Course</button>
          <span className={`badge ${course.published ? 'badge-success' : 'badge-gray'}`}>{course.published ? 'Published' : 'Draft'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{course.title}</h1>
            <p>{course.category} · {lessons.length} lessons · {students.length} students</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditForm({ title: course.title, description: course.description, category: course.category })}>Edit</button>
            <button className={`btn btn-sm ${course.published ? 'btn-ghost' : 'btn-success'}`} onClick={togglePublish}>
              {course.published ? 'Unpublish' : 'Publish'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={deleteCourse}>Delete Course</button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{msg}</div>}

        {editForm && (
          <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditForm(null)}>
            <div className="modal">
              <div className="modal-header"><h2>Edit Course</h2><button className="btn btn-ghost btn-sm" onClick={() => setEditForm(null)}>✕</button></div>
              <form onSubmit={saveEdit}>
                <div className="modal-body">
                  <div className="form-group"><label>Title</label><input className="form-control" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} required /></div>
                  <div className="form-group"><label>Description</label><textarea className="form-control" rows={3} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></div>
                  <div className="form-group">
                    <label>Category</label>
                    <select className="form-control" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                      {['Programming','Design','Business','Marketing','Science','Math','General'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setEditForm(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {['lessons', 'students', 'announcements'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', border: 'none', background: 'none', fontWeight: 500, fontSize: 14, color: tab === t ? 'var(--primary)' : 'var(--text-muted)', borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', marginBottom: -1 }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'lessons' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 className="section-title" style={{ margin: 0 }}>Lessons ({lessons.length})</h2>
              <button className="btn btn-primary" onClick={() => { setEditLesson(null); setShowLessonModal(true); }}>+ Add Lesson</button>
            </div>
            {lessons.length === 0 ? (
              <div className="empty-state"><div className="icon">📖</div><h3>No lessons yet</h3><p>Add your first lesson to get started.</p></div>
            ) : (
              <ul className="lesson-list">
                {lessons.map((l, i) => (
                  <li key={l.id} className="lesson-item" style={{ cursor: 'default' }}>
                    <div className="lesson-number">{i + 1}</div>
                    <div className="lesson-item-title">{l.title}</div>
                    {l.duration > 0 && <div className="lesson-item-duration">{l.duration} min</div>}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditLesson(l); setShowLessonModal(true); }}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteLesson(l.id)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'students' && (
          <>
            <h2 className="section-title">Enrolled Students ({students.length})</h2>
            {students.length === 0 ? (
              <div className="empty-state"><div className="icon">👥</div><h3>No students yet</h3></div>
            ) : (
              <div className="card table-wrap">
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Enrolled</th><th>Progress</th><th>Status</th></tr></thead>
                  <tbody>
                    {students.map(s => {
                      const pct = s.total_lessons > 0 ? Math.round((s.lessons_completed / s.total_lessons) * 100) : 0;
                      return (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>{s.email}</td>
                          <td>{new Date(s.enrolled_at).toLocaleDateString()}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="progress-bar" style={{ width: 80 }}><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pct}%</span>
                            </div>
                          </td>
                          <td><span className={`badge ${s.completed ? 'badge-success' : 'badge-gray'}`}>{s.completed ? 'Done' : 'In Progress'}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'announcements' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 className="section-title" style={{ margin: 0 }}>Announcements</h2>
              <button className="btn btn-primary" onClick={() => setShowAnnouncement(true)}>+ Post Announcement</button>
            </div>
            {announcements.length === 0 ? (
              <div className="empty-state"><div className="icon">📣</div><h3>No announcements yet</h3></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {announcements.map(a => (
                  <div key={a.id} className="card card-body" style={{ position: 'relative' }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{new Date(a.created_at).toLocaleString()}</div>
                    <div style={{ fontSize: 14 }}>{a.body}</div>
                    <button className="btn btn-ghost btn-sm" onClick={async () => { await api.delete(`/announcements/${a.id}`); refresh(); }} style={{ position: 'absolute', top: 16, right: 16 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showLessonModal && (
        <LessonModal courseId={id} lesson={editLesson} onClose={() => setShowLessonModal(false)} onSaved={() => { setShowLessonModal(false); refresh(); }} />
      )}
      {showAnnouncement && (
        <AnnouncementModal courseId={id} onClose={() => setShowAnnouncement(false)} onCreated={() => { setShowAnnouncement(false); refresh(); }} />
      )}
    </div>
  );
}
