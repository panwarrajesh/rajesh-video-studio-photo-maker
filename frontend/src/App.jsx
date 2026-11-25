import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/auth.js';
import Dashboard from './pages/Dashboard.jsx';
import Editor from './pages/Editor.jsx';
import Studio from './pages/Studio.jsx';
import PhotoStudio from './pages/PhotoStudio.jsx';
import MusicStudio from './pages/MusicStudio.jsx';
import SoundStudio from './pages/SoundStudio.jsx';
import AiLab from './pages/AiLab.jsx';
import AnimationStudio from './pages/AnimationStudio.jsx';
import DesignStudio from './pages/DesignStudio.jsx';
import PodcastStudio from './pages/PodcastStudio.jsx';
import ScreenStudio from './pages/ScreenStudio.jsx';
import MusicAcademy from './pages/MusicAcademy.jsx';
import Marketplace from './pages/Marketplace.jsx';

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => { init(); }, [init]);
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/studio" element={<Studio />} />
      <Route path="/editor/:id" element={<Editor />} />
      <Route path="/photo-studio" element={<PhotoStudio />} />
      <Route path="/music-studio" element={<MusicStudio />} />
      <Route path="/sound-studio" element={<SoundStudio />} />
      <Route path="/ai-lab" element={<AiLab />} />
      <Route path="/animation-studio" element={<AnimationStudio />} />
      <Route path="/design-studio" element={<DesignStudio />} />
      <Route path="/podcast-studio" element={<PodcastStudio />} />
      <Route path="/screen-studio" element={<ScreenStudio />} />
      <Route path="/music-academy" element={<MusicAcademy />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
