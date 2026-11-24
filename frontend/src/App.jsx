import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/auth.js';
import Dashboard from './pages/Dashboard.jsx';
import Editor from './pages/Editor.jsx';
import Studio from './pages/Studio.jsx';

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => { init(); }, [init]);
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/studio" element={<Studio />} />
      <Route path="/editor/:id" element={<Editor />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
