import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';
import { useConfirm } from '../context/ConfirmContext';
import { useServers } from '../hooks/useServers';
import Icon from './common/Icon';
import ServerSection from './side/ServerSection';
import ServerModal, { type ServerModalMode } from './side/ServerModal';
import type { CameraItem, MediaServerConfig } from '../types/server';

export function Sidebar() {
  const navigate = useNavigate();
  const { activeItem, setActiveItem } = useApp();
  const confirm = useConfirm();
  const { servers, addServer, updateServer, removeServer, refresh: refreshServers } = useServers();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ServerModalMode>('new');
  const [modalInitial, setModalInitial] = useState<MediaServerConfig | undefined>();

  const handleCameraClick = (camera: CameraItem, config: MediaServerConfig) => {
    setActiveItem(`${config.alias}::${camera.id}`);
    navigate(`/camera/${encodeURIComponent(config.alias)}/${encodeURIComponent(camera.id)}`);
  };

  const handleAddCamera = (config: MediaServerConfig) => {
    setActiveItem(null);
    navigate(`/camera/${encodeURIComponent(config.alias)}/new`);
  };

  const handleEventClick = (config: MediaServerConfig) => {
    setActiveItem(`${config.alias}::__events__`);
    navigate(`/events/${encodeURIComponent(config.alias)}`);
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

  return (
    <aside className="side w-full shrink-0 lg:fixed lg:left-0 lg:top-0 lg:w-56 lg:h-screen z-40 border-b lg:border-b-0 lg:border-r border-border">
      <div className="side-header">
        <Icon name="videocam" className="icon-sm text-primary shrink-0" />
        <span className="truncate flex-1">Blackbox Admin</span>
        <button
          onClick={() => navigate('/settings')}
          className="inline-flex items-center justify-center w-5 h-5 rounded-base shrink-0 hover:bg-surface-hover transition-colors mr-1"
          title="Settings"
        >
          <Icon name="settings" className="icon-sm" />
        </button>
      </div>

      <div className="side-body">
        <ServerSection
          servers={servers}
          activeItem={activeItem}
          onCameraClick={handleCameraClick}
          onAddCamera={handleAddCamera}
          onEventClick={handleEventClick}
          onServerSettings={handleServerSettings}
          onDeleteServer={handleDeleteServer}
          onAddServer={handleAddServer}
          onRefreshServers={refreshServers}
        />
      </div>

      <ServerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleModalSave}
        mode={modalMode}
        initial={modalInitial}
        existingAliases={servers.map((s) => s.alias)}
      />
    </aside>
  );
}
