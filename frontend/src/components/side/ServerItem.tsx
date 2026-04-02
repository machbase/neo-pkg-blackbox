import { useState } from 'react';
import type { MediaServerConfig, CameraItem as CameraItemType, CameraStatusType } from '../../types/server';
import Icon from '../common/Icon';
import CameraItem from './CameraItem';
import EventItem from './EventItem';

interface ServerItemProps {
  config: MediaServerConfig;
  cameras: CameraItemType[];
  healthMap: Record<string, CameraStatusType>;
  eventCount: number;
  hasError: boolean;
  isLoaded: boolean;
  activeItem: string | null;
  onCameraClick: (camera: CameraItemType, config: MediaServerConfig) => void;
  onAddCamera: (config: MediaServerConfig) => void;
  onEventClick: (config: MediaServerConfig) => void;
  onServerSettings: (config: MediaServerConfig) => void;
  onDeleteServer: (config: MediaServerConfig) => void;
}

export default function ServerItem({
  config,
  cameras,
  healthMap,
  eventCount,
  hasError,
  isLoaded,
  activeItem,
  onCameraClick,
  onAddCamera,
  onEventClick,
  onServerSettings,
  onDeleteServer,
}: ServerItemProps) {
  const [expanded, setExpanded] = useState(true);
  const isActiveServer = activeItem?.startsWith(`${config.alias}::`) ?? false;

  return (
    <div>
      {/* Server row */}
      <div
        onClick={hasError ? undefined : () => setExpanded((v) => !v)}
        className="side-item"
        style={{
          cursor: hasError ? 'default' : 'pointer',
          ...(isActiveServer && !activeItem?.includes('::')
            ? { boxShadow: 'inset 2px 0 0 0 var(--color-primary)', backgroundColor: 'var(--color-surface-hover-block)' }
            : {}),
        }}
      >
        {/* Arrow */}
        {!hasError && isLoaded ? (
          <span
            style={{
              display: 'inline-flex',
              width: 16,
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'transform 0.15s',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              fontSize: 12,
            }}
          >
            <Icon name="chevron_right" className="icon-sm" />
          </span>
        ) : (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}

        <Icon name="dns" className="icon-sm" />
        <span className="flex-1 truncate min-w-0">
          {config.alias || `${config.ip}:${config.port}`}
        </span>

        {/* Actions */}
        <span className="side-item-actions" onClick={(e) => e.stopPropagation()}>
          {!hasError && (
            <button title="Add camera" onClick={() => onAddCamera(config)}>
              <Icon name="add" className="icon-sm" />
            </button>
          )}
          <button title="Server settings" onClick={() => onServerSettings(config)}>
            <Icon name="settings" className="icon-sm" />
          </button>
          <button title="Delete server" onClick={() => onDeleteServer(config)}>
            <Icon name="delete" className="icon-sm" />
          </button>
          <span
            className="side-status-dot"
            style={{ backgroundColor: hasError ? 'var(--color-error)' : 'var(--color-success)' }}
          />
        </span>
      </div>

      {/* Children: cameras + events */}
      {!hasError && isLoaded && expanded && (
        <div className="side-children">
          {cameras.map((cam) => (
            <CameraItem
              key={cam.id}
              camera={cam}
              status={healthMap[cam.id] ?? 'stopped'}
              active={activeItem === `${config.alias}::${cam.id}`}
              onClick={() => onCameraClick(cam, config)}
            />
          ))}
          <EventItem
            active={activeItem === `${config.alias}::__events__`}
            eventCount={eventCount}
            onClick={() => onEventClick(config)}
            hasCameras={cameras.length > 0}
          />
        </div>
      )}
    </div>
  );
}
