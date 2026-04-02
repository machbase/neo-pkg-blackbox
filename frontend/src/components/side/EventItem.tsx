import Icon from '../common/Icon';

interface EventItemProps {
  active: boolean;
  eventCount: number;
  onClick: () => void;
  hasCameras: boolean;
}

export default function EventItem({ active, eventCount, onClick, hasCameras }: EventItemProps) {
  return (
    <div
      onClick={onClick}
      className={`side-item ${active ? 'active' : ''}`}
      style={{
        paddingLeft: 48,
        ...(hasCameras ? { borderTop: '1px solid var(--color-border)' } : {}),
      }}
    >
      <Icon name="notifications" className="icon-sm" />
      <span className="flex-1 truncate min-w-0">Events</span>
      {eventCount > 0 && (
        <span className="side-count-badge">{eventCount > 99 ? '99+' : eventCount}</span>
      )}
    </div>
  );
}
