import { Routes, Route, Navigate } from 'react-router';
import { Sidebar } from './components/Sidebar';
import SettingsPage from './pages/SettingsPage';
import CameraPage from './pages/CameraPage';
import EventPage from './pages/EventPage';
import Toast from './components/common/Toast';

export default function IndexApp() {
  return (
    <>
      <div className="flex flex-col lg:flex-row overflow-hidden bg-surface-alt text-on-surface antialiased">
        <Sidebar />
        <main className="flex-1 h-screen overflow-hidden bg-surface-alt lg:ml-56">
          <Routes>
            <Route path="/" element={<Navigate to="/settings" replace />} />
            <Route path="/settings/*" element={<SettingsPage />} />
            <Route path="/camera/:alias/:id" element={<CameraPage />} />
            <Route path="/events/:alias" element={<EventPage />} />
          </Routes>
        </main>
      </div>
      <Toast />
    </>
  );
}
