import type { CameraItem as CameraItemType, CameraStatusType } from '../../types/server';
import Icon from '../common/Icon';

interface CameraItemProps {
  camera: CameraItemType;
  status: CameraStatusType;
  active: boolean;
  onClick: () => void;
}

export default function CameraItem({ camera, status, active, onClick }: CameraItemProps) {
  return (
    <div
      onClick={onClick}
      className={`side-item ${active ? 'active' : ''}`}
      style={{ paddingLeft: 48 }}
    >
      <Icon name="photo_camera" className="icon-sm" />
      <span className="flex-1 truncate min-w-0">{camera.label || camera.id}</span>
      <span className="side-item-actions">
        <span
          className="side-status-dot"
          style={{ backgroundColor: status === 'running' ? 'var(--color-success)' : 'var(--color-on-surface-disabled)' }}
        />
      </span>
    </div>
  );
}
