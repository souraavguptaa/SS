import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', avatar: user?.avatar || '' });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const saveProfile = async e => {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      const res = await api.put('/auth/me', form);
      updateUser(res.data);
      setMsg('Profile updated successfully!');
    } catch { setMsg('Update failed'); }
    finally { setSaving(false); }
  };

  const changePassword = async e => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) { setPwMsg('Passwords do not match'); return; }
    if (pwForm.new_password.length < 6) { setPwMsg('Password must be at least 6 characters'); return; }
    setChangingPw(true); setPwMsg('');
    try {
      await api.put('/auth/me/password', { current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwMsg('Password changed successfully!');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) { setPwMsg(err.response?.data?.error || 'Failed'); }
    finally { setChangingPw(false); }
  };

  const roleColor = { admin: '#ef4444', teacher: '#f59e0b', student: '#4f46e5' };

  return (
    <div>
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Manage your account information</p>
      </div>
      <div className="page-body">
        <div className="two-col">
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><h2 style={{ fontSize: 16, fontWeight: 600 }}>Profile Information</h2></div>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <div className="avatar avatar-lg">{initials(user?.name)}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{user?.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{user?.email}</div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', marginTop: 4, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: roleColor[user?.role] + '20', color: roleColor[user?.role] }}>
                      {user?.role}
                    </span>
                  </div>
                </div>

                {msg && <div className={`alert ${msg.includes('success') ? 'alert-success' : 'alert-error'}`}>{msg}</div>}

                <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label>Email address</label>
                    <input className="form-control" value={user?.email} disabled style={{ background: 'var(--bg)', color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Email cannot be changed</span>
                  </div>
                  <div className="form-group">
                    <label>Member since</label>
                    <input className="form-control" value={new Date(user?.created_at).toLocaleDateString()} disabled style={{ background: 'var(--bg)', color: 'var(--text-muted)' }} />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
                </form>
              </div>
            </div>
          </div>

          <div>
            <div className="card">
              <div className="card-header"><h2 style={{ fontSize: 16, fontWeight: 600 }}>Change Password</h2></div>
              <div className="card-body">
                {pwMsg && <div className={`alert ${pwMsg.includes('success') ? 'alert-success' : 'alert-error'}`}>{pwMsg}</div>}
                <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label>Current Password</label>
                    <input className="form-control" type="password" value={pwForm.current_password} onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label>New Password</label>
                    <input className="form-control" type="password" value={pwForm.new_password} onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <input className="form-control" type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={changingPw}>{changingPw ? 'Changing…' : 'Change Password'}</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
