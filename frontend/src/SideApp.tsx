import { useState, useEffect, useRef, useCallback } from 'react';
import { useServers } from './hooks/useServers';
import { useCameras } from './hooks/useCameras';
import Icon from './components/common/Icon';
import ServerItem from './components/side/ServerItem';
import type { CameraItem, MediaServerConfig } from './types/server';

const CHANNEL_NAME = 'app:neo-blackbox';

let confirmIdCounter = 0;

export default function SideApp() {
  const [ready, setReady] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [sectionCollapsed, setSectionCollapsed] = useState(false);
  const { servers, addServer, updateServer, removeServer, refresh: refreshServers } = useServers();
  const { cameraMap, healthMap, eventCountMap, errorMap, loadedMap, loading, refresh } = useCameras(servers);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const pendingConfirmRef = useRef<{ id: string; resolve: (v: boolean) => void } | null>(null);

  useEffect(() => {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = ch;
    ch.onmessage = (e) => {
      const msg = e.data;
      if (!msg || !msg.type) return;
      if (msg.type === 'ready') setReady(true);
      if (msg.type === 'serverModalResult') {
        const { action, config, mode, initialAlias } = msg.payload;
        if (action === 'save') {
          if (mode === 'new') {
            addServer(config);
          } else if (mode === 'edit' && initialAlias) {
            updateServer(initialAlias, config);
          }
        }
      }
      if (msg.type === 'confirmResult') {
        const pending = pendingConfirmRef.current;
        if (pending && pending.id === msg.payload.id) {
          pending.resolve(msg.payload.confirmed);
          pendingConfirmRef.current = null;
        }
      }
    };
    ch.postMessage({ type: 'requestReady' });
    return () => ch.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((type: string, payload?: unknown) => {
    channelRef.current?.postMessage({ type, payload });
  }, []);

  const confirmViaMain = useCallback((title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const id = `confirm-${++confirmIdCounter}`;
      pendingConfirmRef.current = { id, resolve };
      send('openConfirm', { title, message, id });
    });
  }, [send]);

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
    send('openServerModal', { mode: 'new', existingAliases: servers.map((s) => s.alias) });
  };

  const handleDeleteServer = async (config: MediaServerConfig) => {
    const ok = await confirmViaMain('Delete Server', `Delete server "${config.alias}"?`);
    if (ok) removeServer(config.alias);
  };

  const handleServerSettings = (config: MediaServerConfig) => {
    send('openServerModal', { mode: 'edit', initial: config, existingAliases: servers.map((s) => s.alias) });
  };

  const handleRefresh = async () => {
    await Promise.all([refreshServers(), Promise.resolve(refresh())]);
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
            <button title="Refresh" onClick={handleRefresh} disabled={loading}>
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
    </div>
  );
}
