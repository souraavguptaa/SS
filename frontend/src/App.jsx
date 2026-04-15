import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Courses from './pages/Courses.jsx';
import CourseDetail from './pages/CourseDetail.jsx';
import LessonView from './pages/LessonView.jsx';
import MyCourses from './pages/MyCourses.jsx';
import ManageCourse from './pages/ManageCourse.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import Profile from './pages/Profile.jsx';
import Layout from './components/Layout.jsx';

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="courses" element={<Courses />} />
            <Route path="courses/:id" element={<CourseDetail />} />
            <Route path="courses/:id/manage" element={<PrivateRoute roles={['teacher','admin']}><ManageCourse /></PrivateRoute>} />
            <Route path="lessons/:id" element={<LessonView />} />
            <Route path="my-courses" element={<PrivateRoute roles={['student']}><MyCourses /></PrivateRoute>} />
            <Route path="admin/users" element={<PrivateRoute roles={['admin']}><AdminUsers /></PrivateRoute>} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
