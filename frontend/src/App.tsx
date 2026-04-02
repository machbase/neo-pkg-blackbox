import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router';
import SettingsPage from './pages/SettingsPage';
import CameraPage from './pages/CameraPage';
import EventPage from './pages/EventPage';
import Toast from './components/common/Toast';

const CHANNEL_NAME = 'app:neo-blackbox';

export default function App() {
  const navigate = useNavigate();
  const channelRef = useRef<BroadcastChannel | null>(null);
  const handlersRef = useRef<Record<string, (payload: any) => void>>({});

  handlersRef.current = {
    navigate: (payload) => {
      navigate(payload.path);
    },
    selectTab: (payload) => {
      navigate(payload.path);
    },
    requestReady: () => {
      channelRef.current?.postMessage({ type: 'ready' });
    },
  };

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = ch;

    ch.onmessage = (e) => {
      const msg = e.data;
      if (!msg || !msg.type) return;
      const handler = handlersRef.current[msg.type];
      if (handler) handler(msg.payload);
    };

    ch.postMessage({ type: 'ready' });
    return () => ch.close();
  }, []);

  return (
    <>
      <div className="bg-surface-alt text-on-surface antialiased">
        <main className="h-screen overflow-hidden bg-surface-alt">
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
