import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const icons = {
  dashboard: '⊞',
  courses: '📚',
  myCourses: '🎓',
  users: '👥',
  profile: '👤',
  logout: '→',
};

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          LearnHub
          <span>{user?.role === 'admin' ? 'Admin Portal' : user?.role === 'teacher' ? 'Teacher Portal' : 'Student Portal'}</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Main</div>
            <NavLink to="/dashboard" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <span className="nav-icon">{icons.dashboard}</span> Dashboard
            </NavLink>
            <NavLink to="/courses" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <span className="nav-icon">{icons.courses}</span> All Courses
            </NavLink>
            {user?.role === 'student' && (
              <NavLink to="/my-courses" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                <span className="nav-icon">{icons.myCourses}</span> My Courses
              </NavLink>
            )}
          </div>

          {user?.role === 'admin' && (
            <div className="nav-section">
              <div className="nav-section-title">Admin</div>
              <NavLink to="/admin/users" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                <span className="nav-icon">{icons.users}</span> Manage Users
              </NavLink>
            </div>
          )}

          <div className="nav-section">
            <div className="nav-section-title">Account</div>
            <NavLink to="/profile" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <span className="nav-icon">{icons.profile}</span> Profile
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="avatar">{initials(user?.name)}</div>
          <div className="avatar-info">
            <div className="avatar-name">{user?.name}</div>
            <div className="avatar-role">{user?.role}</div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm" title="Logout" style={{ padding: '6px 10px' }}>
            {icons.logout}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
