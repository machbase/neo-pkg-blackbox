import { useEffect, useRef, useState } from 'react';
import type { GeneralSettings } from '../types/settings';
import Icon from '../components/common/Icon';
import { listDatabases } from '../services/configApi';
import type { DatabaseInfo } from '../types/configApi';
import { useApp } from '../context/AppContext';

type GeneralTabProps = {
  settings: GeneralSettings;
  onChange: (next: GeneralSettings) => void;
};

type FieldProps = {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'password' | 'number';
  disabled?: boolean;
};

function Field({ id, label, value, onChange, type = 'text', disabled = false }: FieldProps) {
  return (
    <div className="flex flex-col gap-2 mt-3">
      <label htmlFor={id} className="form-label">{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full"
      />
    </div>
  );
}

function toNumber(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function databaseErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  const lower = message.toLowerCase();
  if (!message
    || lower.includes('loading private key from virtual filesystem is not supported yet')
    || lower.includes('failed to fetch')
    || lower.includes('invalid api response')) {
    return '';
  }
  return message;
}

function resolveDatabaseSelection(current: string, databases: DatabaseInfo[]): string {
  const writable = databases.filter((database) => database.writable);
  const currentName = String(current || '').trim().toUpperCase();
  const currentDatabase = writable.find((database) => database.name === currentName);
  if (currentDatabase) return currentDatabase.name;
  const defaultDatabase = writable.find((database) => database.name === 'MACHBASEDB');
  if (defaultDatabase) return defaultDatabase.name;
  return writable[0]?.name || '';
}

export function GeneralTab({ settings, onChange }: GeneralTabProps) {
  const { notify } = useApp();
  const [showToken, setShowToken] = useState(false);
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const databasePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (databasePickerRef.current && !databasePickerRef.current.contains(event.target as Node)) {
        setDatabaseOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const loadDatabaseList = async () => {
    setLoadingDatabases(true);
    try {
      const data = await listDatabases({
        scheme: 'http',
        host: settings.machbase.host,
        port: settings.machbase.port,
        database: settings.machbase.database || 'MACHBASEDB',
        timeout_seconds: settings.machbase.timeoutSeconds,
        api_token: settings.machbase.useToken ? settings.machbase.apiToken : '',
      });
      const nextDatabases = Array.isArray(data?.databases) ? data.databases : [];
      setDatabases(nextDatabases);
      onChange({
        ...settings,
        machbase: {
          ...settings.machbase,
          database: resolveDatabaseSelection(settings.machbase.database, nextDatabases),
        },
      });
    } catch (error) {
      setDatabases([]);
      setDatabaseOpen(false);
      const message = databaseErrorMessage(error);
      if (message) notify(message, 'error');
    } finally {
      setLoadingDatabases(false);
    }
  };

  const toggleDatabaseList = () => {
    if (databaseOpen) {
      setDatabaseOpen(false);
      return;
    }
    setDatabaseOpen(true);
    loadDatabaseList();
  };

  const handleDatabaseKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && databaseOpen) {
      event.preventDefault();
      event.stopPropagation();
      setDatabaseOpen(false);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="page-title-group">
        <h1 className="page-title">General Settings</h1>
        <p className="page-desc">Configure core server paths and third-party integrations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <article className="card">
          <h3 className="card-title">
            <Icon name="dns" className="icon-sm" />
            Server
          </h3>
          <Field
            id="server-address"
            label="Address"
            value={settings.server.address}
            disabled
            onChange={(value) =>
              onChange({ ...settings, server: { ...settings.server, address: value } })}
          />
          <Field
            id="server-camera-dir"
            label="Camera Directory"
            value={settings.server.cameraDirectory}
            onChange={(value) =>
              onChange({ ...settings, server: { ...settings.server, cameraDirectory: value } })}
          />
          <Field
            id="server-mvs-dir"
            label="MVS Directory"
            value={settings.server.mvsDirectory}
            onChange={(value) =>
              onChange({ ...settings, server: { ...settings.server, mvsDirectory: value } })}
          />
          <Field
            id="server-data-dir"
            label="Data Directory"
            value={settings.server.dataDirectory}
            onChange={(value) =>
              onChange({ ...settings, server: { ...settings.server, dataDirectory: value } })}
          />
        </article>

        <article className="card">
          <h3 className="card-title">
            <Icon name="database" className="icon-sm" />
            Machbase
          </h3>
          <Field
            id="machbase-host"
            label="Host"
            value={settings.machbase.host}
            onChange={(value) =>
              onChange({ ...settings, machbase: { ...settings.machbase, host: value } })}
          />
          <Field
            id="machbase-port"
            label="Port"
            type="number"
            value={settings.machbase.port}
            onChange={(value) =>
              onChange({ ...settings, machbase: { ...settings.machbase, port: toNumber(value, settings.machbase.port) } })}
          />
          <div className="flex flex-col gap-2 mt-3">
            <label htmlFor="machbase-database" className="form-label">Database</label>
            <div ref={databasePickerRef} className={`database-picker ${databaseOpen ? 'database-picker--open' : ''}`}>
              <Icon name="database" className="database-picker__database-icon" />
              <input
                id="machbase-database"
                name="machbase-database"
                type="text"
                value={settings.machbase.database}
                onChange={(event) => onChange({
                  ...settings,
                  machbase: { ...settings.machbase, database: event.target.value },
                })}
                onKeyDown={handleDatabaseKeyDown}
                role="combobox"
                aria-autocomplete="none"
                aria-expanded={databaseOpen}
                aria-controls="blackbox-database-list"
                className="w-full database-picker__input"
              />
              <button
                type="button"
                className="database-picker__trigger"
                onClick={toggleDatabaseList}
                disabled={loadingDatabases}
                aria-label="Show available databases"
                aria-expanded={databaseOpen}
              >
                <Icon name={loadingDatabases ? 'progress_activity' : 'expand_more'} className={`database-picker__trigger-icon ${loadingDatabases ? 'animate-spin' : ''}`} />
              </button>
              {databaseOpen && (
                <div
                  id="blackbox-database-list"
                  role="listbox"
                  className="database-picker__menu"
                >
                  {loadingDatabases && (
                    <div className="database-picker__message">Loading databases...</div>
                  )}
                  {!loadingDatabases && databases.length === 0 && (
                    <div className="database-picker__message">No available databases</div>
                  )}
                  {!loadingDatabases && databases.map((database) => {
                    const selected = database.name === settings.machbase.database;
                    return (
                      <button
                        key={database.name}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={!database.writable}
                        className="database-picker__option"
                        onClick={() => {
                          onChange({
                            ...settings,
                            machbase: { ...settings.machbase, database: database.name },
                          });
                          setDatabaseOpen(false);
                        }}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Icon name={selected ? 'check' : 'database'} className={selected ? 'text-primary' : 'text-on-surface-tertiary'} />
                          <span className="truncate">{database.name}</span>
                          {database.isDefault && <span className="text-xs text-on-surface-tertiary">default</span>}
                        </span>
                        <span className="text-xs text-on-surface-secondary shrink-0">{database.accessMode}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-xs text-on-surface-secondary">Only READ_WRITE databases can be selected and saved.</p>
          </div>
          <Field
            id="machbase-timeout"
            label="Timeout Seconds"
            type="number"
            value={settings.machbase.timeoutSeconds}
            onChange={(value) =>
              onChange({ ...settings, machbase: { ...settings.machbase, timeoutSeconds: toNumber(value, settings.machbase.timeoutSeconds) } })}
          />

          <div className="flex items-center justify-between gap-2 mt-4 p-3 rounded-base border border-border bg-surface">
            <div>
              <p className="text-sm font-medium text-on-surface">Use Token</p>
              <p className="text-xs text-on-surface-hint mt-1">Enable token-based authentication for Machbase requests.</p>
            </div>
            <div
              className={`switch ${settings.machbase.useToken ? 'active' : ''}`}
              onClick={() => {
                const nextUseToken = !settings.machbase.useToken;
                if (!nextUseToken) setShowToken(false);
                onChange({ ...settings, machbase: { ...settings.machbase, useToken: nextUseToken } });
              }}
            >
              <div className="switch-thumb" />
            </div>
          </div>

          {settings.machbase.useToken && (
            <div className="flex flex-col gap-2 mt-3">
              <label htmlFor="machbase-api-token" className="form-label">Token</label>
              <div className="flex items-center gap-2">
                <input
                  id="machbase-api-token"
                  name="machbase-api-token"
                  type={showToken ? 'text' : 'password'}
                  value={settings.machbase.apiToken}
                  className="flex-1"
                  onChange={(event) =>
                    onChange({ ...settings, machbase: { ...settings.machbase, apiToken: event.target.value } })}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowToken((current) => !current)}
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}
        </article>

        <article className="card">
          <h3 className="card-title">
            <Icon name="videocam" className="icon-sm" />
            MediaMTX
          </h3>
          <Field
            id="mediamtx-host"
            label="Host"
            value={settings.mediaMtx.host}
            onChange={(value) =>
              onChange({ ...settings, mediaMtx: { ...settings.mediaMtx, host: value } })}
          />
          <Field
            id="mediamtx-port"
            label="Port"
            type="number"
            value={settings.mediaMtx.port}
            onChange={(value) =>
              onChange({ ...settings, mediaMtx: { ...settings.mediaMtx, port: toNumber(value, settings.mediaMtx.port) } })}
          />
          <Field
            id="mediamtx-binary"
            label="Binary"
            value={settings.mediaMtx.binary}
            onChange={(value) =>
              onChange({ ...settings, mediaMtx: { ...settings.mediaMtx, binary: value } })}
          />
        </article>

        <article className="card">
          <h3 className="card-title">
            <Icon name="movie" className="icon-sm" />
            FFmpeg
          </h3>
          <Field
            id="ffmpeg-binary"
            label="Binary"
            value={settings.ffmpeg.binary}
            onChange={(value) =>
              onChange({ ...settings, ffmpeg: { ...settings.ffmpeg, binary: value } })}
          />
          <Field
            id="ffmpeg-probe-binary"
            label="FFprobe Binary"
            value={settings.ffmpeg.probeBinary}
            onChange={(value) =>
              onChange({ ...settings, ffmpeg: { ...settings.ffmpeg, probeBinary: value } })}
          />
        </article>
      </div>
    </section>
  );
}
