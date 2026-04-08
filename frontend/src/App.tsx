import { useEffect, useRef, useState, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router';
import SettingsPage from './pages/SettingsPage';
import CameraPage from './pages/CameraPage';
import EventPage from './pages/EventPage';
import Toast from './components/common/Toast';
import ServerModal, { type ServerModalMode } from './components/side/ServerModal';
import ConfirmDialog from './components/common/ConfirmDialog';
import type { MediaServerConfig } from './types/server';

const CHANNEL_NAME = 'app:neo-blackbox';

export default function App() {
  const navigate = useNavigate();
  const channelRef = useRef<BroadcastChannel | null>(null);
  const handlersRef = useRef<Record<string, (payload: any) => void>>({});

  // Server modal state (delegated from side panel)
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [serverModalMode, setServerModalMode] = useState<ServerModalMode>('new');
  const [serverModalInitial, setServerModalInitial] = useState<MediaServerConfig | undefined>();
  const [serverModalAliases, setServerModalAliases] = useState<string[]>([]);

  // Confirm dialog state (delegated from side panel)
  const [confirmState, setConfirmState] = useState<{ title: string; message: string; id: string } | null>(null);

  const send = useCallback((type: string, payload?: unknown) => {
    channelRef.current?.postMessage({ type, payload });
  }, []);

  handlersRef.current = {
    navigate: (payload) => navigate(payload.path),
    selectTab: (payload) => navigate(payload.path),
    requestReady: () => send('ready'),
    // Side panel requests server modal
    openServerModal: (payload) => {
      setServerModalMode(payload.mode);
      setServerModalInitial(payload.initial);
      setServerModalAliases(payload.existingAliases || []);
      setServerModalOpen(true);
    },
    // Side panel requests confirm dialog
    openConfirm: (payload) => {
      setConfirmState({ title: payload.title, message: payload.message, id: payload.id });
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

  const handleServerModalSave = useCallback((config: MediaServerConfig) => {
    send('serverModalResult', { action: 'save', config, mode: serverModalMode, initialAlias: serverModalInitial?.alias });
    setServerModalOpen(false);
  }, [send, serverModalMode, serverModalInitial]);

  const handleConfirm = useCallback(() => {
    if (confirmState) send('confirmResult', { id: confirmState.id, confirmed: true });
    setConfirmState(null);
  }, [send, confirmState]);

  const handleConfirmCancel = useCallback(() => {
    if (confirmState) send('confirmResult', { id: confirmState.id, confirmed: false });
    setConfirmState(null);
  }, [send, confirmState]);

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
      <ServerModal
        isOpen={serverModalOpen}
        onClose={() => setServerModalOpen(false)}
        onSave={handleServerModalSave}
        mode={serverModalMode}
        initial={serverModalInitial}
        existingAliases={serverModalAliases}
      />
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={handleConfirm}
          onCancel={handleConfirmCancel}
        />
      )}
    </>
  );
}
