import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/auth.js';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Editor from './pages/Editor.jsx';
import Studio from './pages/Studio.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}
export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => { init(); }, [init]);
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/studio" element={<Studio />} />
      <Route path="/editor/:id" element={<Protected><Editor /></Protected>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
