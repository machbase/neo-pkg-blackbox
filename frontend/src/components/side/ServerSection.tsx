import { useState } from 'react';
import type { MediaServerConfig, CameraItem as CameraItemType } from '../../types/server';
import { useCameras } from '../../hooks/useCameras';
import Icon from '../common/Icon';
import ServerItem from './ServerItem';

interface ServerSectionProps {
  servers: MediaServerConfig[];
  activeItem: string | null;
  onCameraClick: (camera: CameraItemType, config: MediaServerConfig) => void;
  onAddCamera: (config: MediaServerConfig) => void;
  onEventClick: (config: MediaServerConfig) => void;
  onServerSettings: (config: MediaServerConfig) => void;
  onDeleteServer: (config: MediaServerConfig) => void;
  onAddServer: () => void;
  onRefreshServers: () => Promise<void> | void;
}

export default function ServerSection({
  servers,
  activeItem,
  onCameraClick,
  onAddCamera,
  onEventClick,
  onServerSettings,
  onDeleteServer,
  onAddServer,
  onRefreshServers,
}: ServerSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { cameraMap, healthMap, eventCountMap, errorMap, loadedMap, loading, refresh } = useCameras(servers);

  const handleRefresh = async () => {
    await Promise.all([Promise.resolve(onRefreshServers()), refresh()]);
  };

  return (
    <>
      {/* Section header */}
      <div
        className="side-section-title"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <span
          style={{
            display: 'inline-flex',
            width: 14,
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'transform 0.15s',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
            fontSize: 10,
          }}
        >
          <Icon name="chevron_right" className="icon-sm" />
        </span>
        <span className="flex-1">BLACKBOX SERVER</span>
        <span className="side-item-actions" onClick={(e) => e.stopPropagation()}>
          <button title="Add server" onClick={onAddServer}>
            <Icon name="add" className="icon-sm" />
          </button>
          <button title="Refresh" onClick={handleRefresh} disabled={loading}>
            <Icon name="refresh" className="icon-sm" />
          </button>
        </span>
      </div>

      {/* Server list */}
      {!collapsed && (
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
                onCameraClick={onCameraClick}
                onAddCamera={onAddCamera}
                onEventClick={onEventClick}
                onServerSettings={onServerSettings}
                onDeleteServer={onDeleteServer}
              />
            ))
          ) : (
            <p
              style={{
                padding: '8px 16px',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-on-surface-disabled)',
              }}
            >
              {loading ? 'Loading...' : 'No servers configured'}
            </p>
          )}
        </nav>
      )}
    </>
  );
}
