import { useState, useEffect, useRef } from 'react';
import { useServers } from './hooks/useServers';
import { useCameras } from './hooks/useCameras';
import { ConfirmProvider, useConfirm } from './context/ConfirmContext';
import Icon from './components/common/Icon';
import ServerItem from './components/side/ServerItem';
import ServerModal, { type ServerModalMode } from './components/side/ServerModal';
import type { CameraItem, MediaServerConfig } from './types/server';

const CHANNEL_NAME = 'app:neo-blackbox';

export default function SideApp() {
  return (
    <ConfirmProvider>
      <SideAppInner />
    </ConfirmProvider>
  );
}

function SideAppInner() {
  const confirm = useConfirm();
  const [ready, setReady] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [sectionCollapsed, setSectionCollapsed] = useState(false);
  const { servers, addServer, updateServer, removeServer } = useServers();
  const { cameraMap, healthMap, eventCountMap, errorMap, loadedMap, loading, refresh } = useCameras(servers);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ServerModalMode>('new');
  const [modalInitial, setModalInitial] = useState<MediaServerConfig | undefined>();

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = ch;
    ch.onmessage = (e) => {
      const msg = e.data;
      if (!msg || !msg.type) return;
      if (msg.type === 'ready') setReady(true);
    };
    ch.postMessage({ type: 'requestReady' });
    return () => ch.close();
  }, []);

  const send = (type: string, payload: unknown) => {
    channelRef.current?.postMessage({ type, payload });
  };

  const handleCameraClick = (camera: CameraItem, config: MediaServerConfig) => {
    setActiveItem(`${config.alias}::${camera.id}`);
    send('navigate', { path: `/camera/${encodeURIComponent(config.alias)}/${encodeURIComponent(camera.id)}` });
  };

  const handleAddCamera = (config: MediaServerConfig) => {
    setActiveItem(null);
    send('navigate', { path: `/camera/${encodeURIComponent(config.alias)}/new` });
  };

  const handleEventClick = (config: MediaServerConfig) => {
    setActiveItem(`${config.alias}::__events__`);
    send('navigate', { path: `/events/${encodeURIComponent(config.alias)}` });
  };

  const handleAddServer = () => {
    setModalMode('new');
    setModalInitial(undefined);
    setModalOpen(true);
  };

  const handleDeleteServer = async (config: MediaServerConfig) => {
    const ok = await confirm({ title: 'Delete Server', message: `Delete server "${config.alias}"?`, confirmText: 'Delete' });
    if (ok) removeServer(config.alias);
  };

  const handleServerSettings = (config: MediaServerConfig) => {
    setModalMode('edit');
    setModalInitial(config);
    setModalOpen(true);
  };

  const handleModalSave = (config: MediaServerConfig) => {
    if (modalMode === 'new') {
      addServer(config);
    } else if (modalInitial) {
      updateServer(modalInitial.alias, config);
    }
  };

  if (!ready) {
    return (
      <div className="side h-screen opacity-50">
        <div className="side-header">
          <Icon name="videocam" className="icon-sm text-primary shrink-0" />
          <span>Blackbox Admin</span>
        </div>
        <p style={{ padding: '12px 16px', fontSize: 'var(--font-size-sm)', color: 'var(--color-on-surface-disabled)' }}>
          Loading...
        </p>
      </div>
    );
  }

  return (
    <div className="side h-screen">
      <div className="side-header">
        <Icon name="videocam" className="icon-sm text-primary shrink-0" />
        <span className="truncate flex-1">Blackbox Admin</span>
        <button
          onClick={() => send('navigate', { path: '/settings' })}
          className="inline-flex items-center justify-center w-5 h-5 rounded-base shrink-0 hover:bg-surface-hover transition-colors mr-1"
          title="Settings"
        >
          <Icon name="settings" className="icon-sm" />
        </button>
      </div>

      <div className="side-body">
        {/* Section header */}
        <div
          className="side-section-title"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setSectionCollapsed((v) => !v)}
        >
          <span
            style={{
              display: 'inline-flex',
              width: 14,
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'transform 0.15s',
              transform: sectionCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              fontSize: 10,
            }}
          >
            <Icon name="chevron_right" className="icon-sm" />
          </span>
          <span className="flex-1">BLACKBOX SERVER</span>
          <span className="side-item-actions" onClick={(e) => e.stopPropagation()}>
            <button title="Add server" onClick={handleAddServer}>
              <Icon name="add" className="icon-sm" />
            </button>
            <button title="Refresh" onClick={refresh} disabled={loading}>
              <Icon name="refresh" className="icon-sm" />
            </button>
          </span>
        </div>

        {/* Server list */}
        {!sectionCollapsed && (
          <nav className="flex-1 overflow-y-auto">
            {servers.length > 0 ? (
              servers.map((config) => (
                <ServerItem
                  key={config.alias}
                  config={config}
                  cameras={cameraMap[config.alias] || []}
                  healthMap={healthMap[config.alias] || {}}
                  eventCount={eventCountMap[config.alias] || 0}
                  hasError={errorMap[config.alias] ?? false}
                  isLoaded={loadedMap[config.alias] ?? false}
                  activeItem={activeItem}
                  onCameraClick={handleCameraClick}
                  onAddCamera={handleAddCamera}
                  onEventClick={handleEventClick}
                  onServerSettings={handleServerSettings}
                  onDeleteServer={handleDeleteServer}
                />
              ))
            ) : (
              <p style={{ padding: '8px 16px', fontSize: 'var(--font-size-sm)', color: 'var(--color-on-surface-disabled)' }}>
                {loading ? 'Loading...' : 'No servers configured'}
              </p>
            )}
          </nav>
        )}
      </div>

      <ServerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleModalSave}
        mode={modalMode}
        initial={modalInitial}
        existingAliases={servers.map((s) => s.alias)}
      />
    </div>
  );
}
