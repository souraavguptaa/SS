import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

const categoryEmojis = { Programming: '💻', Design: '🎨', Business: '💼', Marketing: '📢', Science: '🔬', Math: '📐', General: '📚' };

function CourseCard({ course, onClick }) {
  const emoji = categoryEmojis[course.category] || '📚';
  return (
    <div className="course-card" onClick={onClick}>
      <div className="course-thumb" style={{ background: `linear-gradient(135deg, ${hashColor(course.id)})` }}>
        {course.thumbnail ? <img src={course.thumbnail} alt="" className="course-thumb-img" /> : <span>{emoji}</span>}
      </div>
      <div className="course-body">
        <div className="course-meta">
          <span className="badge badge-primary">{course.category}</span>
          {course.enrolled && <span className="badge badge-success">Enrolled</span>}
        </div>
        <div className="course-title">{course.title}</div>
        <div className="course-desc">{course.description}</div>
      </div>
      <div className="course-footer">
        <span>👤 {course.teacher_name}</span>
        <span>📖 {course.lesson_count} lessons · 👥 {course.enrollment_count}</span>
      </div>
    </div>
  );
}

function hashColor(id) {
  const colors = [
    '#667eea, #764ba2', '#f093fb, #f5576c', '#4facfe, #00f2fe',
    '#43e97b, #38f9d7', '#fa709a, #fee140', '#a18cd1, #fbc2eb',
    '#fccb90, #d57eeb', '#a1c4fd, #c2e9fb',
  ];
  return colors[id % colors.length];
}

// New Course Modal
function NewCourseModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'Programming' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const categories = ['Programming', 'Design', 'Business', 'Marketing', 'Science', 'Math', 'General'];

  const submit = async e => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await api.post('/courses', form);
      onCreated(res.data);
    } catch (err) { setError(err.response?.data?.error || 'Failed to create'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>Create New Course</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group"><label>Title *</label><input className="form-control" value={form.title} onChange={set('title')} required /></div>
            <div className="form-group"><label>Description</label><textarea className="form-control" value={form.description} onChange={set('description')} rows={3} /></div>
            <div className="form-group">
              <label>Category</label>
              <select className="form-control" value={form.category} onChange={set('category')}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create Course'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Courses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [showNew, setShowNew] = useState(false);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      const res = await api.get('/courses', { params });
      setCourses(res.data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.get('/courses/meta/categories').then(r => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchCourses(); }, [search, category]);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Course Catalog</h1>
          <p>Browse and enroll in available courses</p>
        </div>
        {(user?.role === 'teacher' || user?.role === 'admin') && (
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Course</button>
        )}
      </div>
      <div className="page-body">
        <div className="filter-bar">
          <div className="search-input-wrap">
            <span className="icon">🔍</span>
            <input className="form-control search-input" placeholder="Search courses…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-control" style={{ width: 160 }} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : courses.length === 0 ? (
          <div className="empty-state"><div className="icon">🔍</div><h3>No courses found</h3><p>Try a different search or category.</p></div>
        ) : (
          <div className="course-grid">
            {courses.map(c => (
              <CourseCard key={c.id} course={c} onClick={() => navigate(`/courses/${c.id}`)} />
            ))}
          </div>
        )}
      </div>

      {showNew && <NewCourseModal onClose={() => setShowNew(false)} onCreated={c => { setShowNew(false); navigate(`/courses/${c.id}/manage`); }} />}
    </div>
  );
}
