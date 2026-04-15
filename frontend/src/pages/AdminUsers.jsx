import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');

  const refresh = () => {
    api.get('/users').then(r => { setUsers(r.data); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(refresh, []);

  const deleteUser = async (id, name) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    try { await api.delete(`/users/${id}`); setMsg(`User ${name} deleted.`); refresh(); }
    catch (err) { setMsg(err.response?.data?.error || 'Error'); }
  };

  const changeRole = async (id, role) => {
    await api.patch(`/users/${id}/role`, { role });
    refresh();
  };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <p>View and manage all platform users</p>
      </div>
      <div className="page-body">
        {msg && <div className="alert alert-success" style={{ marginBottom: 16 }}>{msg}</div>}

        <div className="filter-bar">
          <div className="search-input-wrap">
            <span className="icon">🔍</span>
            <input className="form-control search-input" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{filtered.length} users</div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div className="card table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                          {u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        {u.name}
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      {u.id === me.id ? (
                        <span className={`badge badge-${u.role === 'admin' ? 'danger' : u.role === 'teacher' ? 'warning' : 'primary'}`}>{u.role}</span>
                      ) : (
                        <select className="form-control" style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }}
                          value={u.role} onChange={e => changeRole(u.id, e.target.value)}>
                          <option value="student">student</option>
                          <option value="teacher">teacher</option>
                          <option value="admin">admin</option>
                        </select>
                      )}
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      {u.id !== me.id && (
                        <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u.id, u.name)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
