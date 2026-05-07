import { NavLink, Routes, Route, Navigate } from 'react-router';
import { useConfig } from '../hooks/useConfig';
import { GeneralTab } from '../tabs/GeneralTab';
import { FFmpegTab } from '../tabs/FFmpegTab';
import { LogTab } from '../tabs/LogTab';
import { RetentionTab } from '../tabs/RetentionTab';
import Icon from '../components/common/Icon';

const tabs = [
  { path: '/settings/general', label: 'General', icon: 'tune' },
  { path: '/settings/ffmpeg', label: 'FFmpeg Default', icon: 'movie' },
  { path: '/settings/log', label: 'Log Configuration', icon: 'description' },
  { path: '/settings/retention', label: 'Retention', icon: 'timer' },
];

export default function SettingsPage() {
  const { draft, loading, saving, save, updateGeneral, updateFFmpeg, updateLog, updateRetention } = useConfig();

if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-on-surface-disabled">
        Loading...
      </div>
    );
  }

  return (
    <div className="page">
      {/* Tab bar */}
      <div className="page-header">
        <nav className="tab-bar">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) => `tab-item${isActive ? ' active' : ''}`}
            >
              <Icon name={tab.icon} className="icon-sm" />
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Tab content */}
      <div className="page-body">
        <div className="page-body-inner">
          <Routes>
            <Route index element={<Navigate to="/settings/general" replace />} />
            <Route path="general" element={<GeneralTab settings={draft.general} onChange={updateGeneral} />} />
            <Route path="ffmpeg" element={<FFmpegTab settings={draft.ffmpeg} onChange={updateFFmpeg} />} />
            <Route path="log" element={<LogTab settings={draft.log} onChange={updateLog} />} />
            <Route path="retention" element={<RetentionTab settings={draft.retention} onChange={updateRetention} />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
