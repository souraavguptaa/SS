import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const demoLogin = async (email, pw) => {
    setForm({ email, password: pw });
    setError(''); setLoading(true);
    try { await login(email, pw); navigate('/dashboard'); }
    catch { setError('Demo login failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>LearnHub</h1>
          <p>Sign in to your account</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email address</label>
            <input className="form-control" type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input className="form-control" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required />
          </div>
          <button className="btn btn-primary w-full btn-lg" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="auth-divider" style={{ margin: '20px 0 16px' }}>Demo accounts</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => demoLogin('admin@lms.com', 'admin123')}>Admin</button>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => demoLogin('teacher@lms.com', 'teacher123')}>Teacher</button>
          <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => demoLogin('student@lms.com', 'student123')}>Student</button>
        </div>

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}
