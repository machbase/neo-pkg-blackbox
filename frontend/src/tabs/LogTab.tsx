import type { LogSettings } from '../types/settings';
import Icon from '../components/common/Icon';

type LogTabProps = {
  settings: LogSettings;
  onChange: (next: LogSettings) => void;
};

function toNumber(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function LogTab({ settings, onChange }: LogTabProps) {
  return (
    <section className="flex flex-col gap-6">
      <div className="page-title-group">
        <h1 className="page-title">Log Configuration</h1>
        <p className="page-desc">Manage how the server generates, stores, and rotates system log files.</p>
      </div>

      <article className="card">
        <h3 className="card-title">
          <Icon name="description" className="icon-sm" />
          General Logging
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex flex-col gap-2 mt-3">
            <label htmlFor="log-directory" className="form-label">Log Directory</label>
            <input
              id="log-directory"
              name="log-directory"
              value={settings.logDirectory}
              className="w-full"
              onChange={(event) => onChange({ ...settings, logDirectory: event.target.value })}
            />
          </div>

          <div className="flex flex-col gap-2 mt-3">
            <label htmlFor="log-level" className="form-label">Log Level</label>
            <select
              id="log-level"
              name="log-level"
              value={settings.logLevel}
              className="w-full"
              onChange={(event) =>
                onChange({ ...settings, logLevel: event.target.value as LogSettings['logLevel'] })}
            >
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
          </div>

          <div className="flex flex-col gap-2 mt-3">
            <label htmlFor="log-format" className="form-label">Log Format</label>
            <select
              id="log-format"
              name="log-format"
              value={settings.logFormat}
              className="w-full"
              onChange={(event) =>
                onChange({ ...settings, logFormat: event.target.value as LogSettings['logFormat'] })}
            >
              <option value="json">JSON</option>
              <option value="text">Text</option>
            </select>
          </div>

          <div className="flex flex-col gap-2 mt-3">
            <label htmlFor="output-destination" className="form-label">Output Destination</label>
            <select
              id="output-destination"
              name="output-destination"
              value={settings.outputDestination}
              className="w-full"
              onChange={(event) =>
                onChange({ ...settings, outputDestination: event.target.value as LogSettings['outputDestination'] })}
            >
              <option value="stdout">Stdout</option>
              <option value="file">File</option>
              <option value="both">Both</option>
            </select>
          </div>
        </div>
      </article>

      <article className="card">
        <h3 className="card-title">
          <Icon name="folder" className="icon-sm" />
          File Retention &amp; Rotation
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex flex-col gap-2 mt-3">
            <label htmlFor="filename-prefix" className="form-label">Filename Pattern</label>
            <div className="flex items-center w-full">
              <input
                id="filename-prefix"
                name="filename-prefix"
                value={settings.filenamePrefix}
                className="flex-1 min-w-0"
                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: 'none' }}
                onChange={(event) => onChange({ ...settings, filenamePrefix: event.target.value })}
              />
              <span
                className="inline-flex items-center justify-center shrink-0"
                style={{
                  height: 'var(--size-control-height)',
                  padding: '0 12px',
                  fontSize: 'var(--font-size-base)',
                  color: 'var(--color-on-surface-tertiary)',
                  backgroundColor: 'var(--color-surface-input)',
                  border: '1px solid var(--color-border)',
                  borderLeft: 'none',
                  borderRadius: '0 var(--radius-base) var(--radius-base) 0',
                }}
              >.log</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-3">
            <label htmlFor="max-file-size" className="form-label">Max File Size (MB)</label>
            <input
              id="max-file-size"
              name="max-file-size"
              type="number"
              value={settings.maxFileSizeMb}
              className="w-full"
              onChange={(event) =>
                onChange({ ...settings, maxFileSizeMb: toNumber(event.target.value, settings.maxFileSizeMb) })}
            />
          </div>

          <div className="flex flex-col gap-2 mt-3">
            <label htmlFor="max-backups" className="form-label">Max Backups</label>
            <input
              id="max-backups"
              name="max-backups"
              type="number"
              value={settings.maxBackups}
              className="w-full"
              onChange={(event) => onChange({ ...settings, maxBackups: toNumber(event.target.value, settings.maxBackups) })}
            />
          </div>

          <div className="flex flex-col gap-2 mt-3">
            <label htmlFor="max-age-days" className="form-label">Max Age (Days)</label>
            <input
              id="max-age-days"
              name="max-age-days"
              type="number"
              value={settings.maxAgeDays}
              className="w-full"
              onChange={(event) => onChange({ ...settings, maxAgeDays: toNumber(event.target.value, settings.maxAgeDays) })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-4 p-3 rounded-base border border-border bg-surface">
          <div>
            <p className="text-sm font-medium text-on-surface">Compress Old Logs</p>
            <p className="text-xs text-on-surface-hint mt-1">Automatically compress old log files to save disk space.</p>
          </div>
          <div
            className={`switch ${settings.compressOldLogs ? 'active' : ''}`}
            onClick={() => onChange({ ...settings, compressOldLogs: !settings.compressOldLogs })}
          >
            <div className="switch-thumb" />
          </div>
        </div>
      </article>
    </section>
  );
}
