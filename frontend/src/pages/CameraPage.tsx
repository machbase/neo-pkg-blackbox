import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useApp } from '../context/AppContext';
import {
  getCamera, createCamera as apiCreateCamera, updateCamera as apiUpdateCamera,
  deleteCamera, enableCamera, disableCamera, getTables, getDetectObjects, pingCamera, updateCameraDetectObjects,
} from '../services/cameraApi';
import { getServer } from '../services/serversApi';
import type { CameraInfo, MediaServerConfig, CameraCreateRequest, CameraUpdateRequest } from '../types/server';
import { useConfirm } from '../context/ConfirmContext';
import Icon from '../components/common/Icon';
import FFmpegConfig, { type FFmpegConfigType, FFMPEG_DEFAULT_CONFIG, ffmpegConfigToOptions, optionsToFFmpegConfig } from '../components/camera/FFmpegConfig';
import DetectObjectPicker from '../components/camera/DetectObjectPicker';
import EventRulesSection from '../components/camera/EventRulesSection';
import CreateTableModal from '../components/camera/CreateTableModal';
import CameraLivePreview from '../components/camera/CameraLivePreview';

// Must match CHANNEL_NAME in App.tsx / SideApp.tsx
const SIDE_CHANNEL = 'app:neo-blackbox';

function notifySideCameraChanged() {
  try {
    const ch = new BroadcastChannel(SIDE_CHANNEL);
    ch.postMessage({ type: 'cameraChanged' });
    ch.close();
  } catch { /* BroadcastChannel unsupported */ }
}

export default function CameraPage() {
  const { alias, id } = useParams<{ alias: string; id: string }>();
  const navigate = useNavigate();
  const { notify, setActiveItem } = useApp();
  const confirm = useConfirm();
  const isNew = id === 'new';
  const [config, setConfig] = useState<MediaServerConfig | null>(null);

  const [camera, setCamera] = useState<CameraInfo | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'running' | 'stopped'>('stopped');

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRtsp, setFormRtsp] = useState('');
  const [formTable, setFormTable] = useState('');
  const [formDetectObjects, setFormDetectObjects] = useState<string[]>([]);
  const [formSaveObjects, setFormSaveObjects] = useState(false);
  const [formOutputDir, setFormOutputDir] = useState('');
  const [formArchiveDir, setFormArchiveDir] = useState('');
  const [ffmpegConfig, setFfmpegConfig] = useState<FFmpegConfigType>(FFMPEG_DEFAULT_CONFIG);

  // Data lists
  const [tableList, setTableList] = useState<string[]>([]);
  const [detectList, setDetectList] = useState<string[]>([]);
  const [createTableOpen, setCreateTableOpen] = useState(false);

  // Ping
  const [pingResult, setPingResult] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);
  const [pinging, setPinging] = useState(false);

  const fetchCamera = async (cfg: MediaServerConfig | null = config) => {
    if (!cfg || !id || isNew) return;
    try {
      const data = await getCamera(id, cfg.ip, cfg.port);
      setCamera(data);
      setFormName(data.name ?? '');
      setFormDesc(data.desc ?? '');
      setFormRtsp(data.rtsp_url ?? '');
      setFormTable(data.table ?? '');
      setFormDetectObjects(data.detect_objects ?? []);
      setFormSaveObjects(data.save_objects ?? false);
      setFormOutputDir(data.output_dir ?? '');
      setFormArchiveDir(data.archive_dir ?? '');
      setCameraStatus(data.enabled ? 'running' : 'stopped');
      if (data.ffmpeg_options) {
        setFfmpegConfig(optionsToFFmpegConfig(data.ffmpeg_options, {
          ffmpeg_command: data.ffmpeg_command,
          output_dir: data.output_dir,
          archive_dir: data.archive_dir,
        }));
      }
    } catch (err) {
      notify(`Failed to load camera: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!alias) { setConfig(null); setLoading(false); return; }
    let cancelled = false;
    getServer(alias)
      .then((s) => { if (!cancelled) setConfig(s); })
      .catch(() => { if (!cancelled) { setConfig(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [alias]);

  useEffect(() => {
    if (!isNew) return;
    setCamera(null);
    setEditMode(false);
    setLoading(false);
    setSaving(false);
    setCameraStatus('stopped');
    setFormName('');
    setFormDesc('');
    setFormRtsp('');
    setFormTable('');
    setFormDetectObjects([]);
    setFormSaveObjects(false);
    setFormOutputDir('');
    setFormArchiveDir('');
    setFfmpegConfig(FFMPEG_DEFAULT_CONFIG);
    setPingResult(null);
  }, [isNew, alias]);

  useEffect(() => {
    if (!config) return;
    if (!isNew) fetchCamera(config);
    Promise.all([getTables(config.ip, config.port), getDetectObjects(config.ip, config.port)])
      .then(([tables, detects]) => {
        setTableList(tables);
        setDetectList(detects);
        if (isNew && tables.length === 0) setCreateTableOpen(true);
        if (isNew && tables.length > 0) setFormTable((prev) => prev || tables[0]);
      })
      .catch(() => { /* ignore */ });
  }, [config, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePing = async () => {
    if (!config || !formRtsp) return;
    const match = formRtsp.match(/rtsp:\/\/(?:[^@]+@)?([^:/]+)/i);
    if (!match) { setPingResult({ variant: 'error', message: 'Cannot extract IP from RTSP URL' }); return; }
    setPinging(true);
    setPingResult(null);
    try {
      const res = await pingCamera(match[1], config.ip, config.port);
      setPingResult(res.alive
        ? { variant: 'success', message: `${match[1]} reachable${res.latency ? ` (${res.latency})` : ''}` }
        : { variant: 'error', message: `${match[1]} unreachable` });
    } catch {
      setPingResult({ variant: 'error', message: 'Ping failed' });
    } finally {
      setPinging(false);
    }
  };

  const handleCreate = async () => {
    if (!config) return;
    if (!formName.trim()) { notify('Camera name is required', 'error'); return; }
    if (!formTable) { notify('Please select a table', 'error'); return; }
    setSaving(true);
    try {
      const payload: CameraCreateRequest = {
        table: formTable,
        name: formName.trim(),
        desc: formDesc || undefined,
        rtsp_url: formRtsp || undefined,
        detect_objects: formDetectObjects.length > 0 ? formDetectObjects : undefined,
        save_objects: formSaveObjects,
        ffmpeg_options: ffmpegConfigToOptions(ffmpegConfig),
        ffmpeg_command: ffmpegConfig.ffmpegCommand || undefined,
        output_dir: formOutputDir || undefined,
        archive_dir: formArchiveDir || undefined,
        server_url: config.ip,
      };
      const created = await apiCreateCamera(payload, config.ip, config.port);
      notify(`Camera "${formName}" created`, 'success');
      notifySideCameraChanged();
      setActiveItem(`${alias}::${created.camera_id || formName}`);
      navigate(`/camera/${encodeURIComponent(alias!)}/${encodeURIComponent(created.camera_id || formName)}`);
    } catch (err) {
      notify(`Failed: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!config || !id) return;
    setSaving(true);
    try {
      const payload: CameraUpdateRequest = {
        desc: formDesc || undefined,
        rtsp_url: formRtsp || undefined,
        detect_objects: formDetectObjects.length > 0 ? formDetectObjects : undefined,
        save_objects: formSaveObjects,
        ffmpeg_options: ffmpegConfigToOptions(ffmpegConfig),
        ffmpeg_command: ffmpegConfig.ffmpegCommand || undefined,
        output_dir: formOutputDir || undefined,
        archive_dir: formArchiveDir || undefined,
      };
      await apiUpdateCamera(id, payload, config.ip, config.port);
      notify('Camera saved', 'success');
      notifySideCameraChanged();
      setEditMode(false);
      await fetchCamera();
    } catch (err) {
      notify(`Failed: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!config || !id) return;
    const ok = await confirm({ title: 'Delete Camera', message: `Delete camera "${id}"?`, confirmText: 'Delete' });
    if (!ok) return;
    try {
      await deleteCamera(id, config.ip, config.port);
      notify(`Camera "${id}" deleted`, 'success');
      notifySideCameraChanged();
      setActiveItem(null);
      navigate('/');
    } catch (err) {
      notify(`Failed: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
    }
  };

  const handleToggleStatus = async () => {
    if (!config || !id) return;
    try {
      if (cameraStatus === 'running') await disableCamera(id, config.ip, config.port);
      else await enableCamera(id, config.ip, config.port);
      setCameraStatus((s) => (s === 'running' ? 'stopped' : 'running'));
      notify(`Camera ${cameraStatus === 'running' ? 'disabled' : 'enabled'}`, 'success');
    } catch (err) {
      notify(`Failed: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
    }
  };

  if (loading) {
    return <Shell><p style={{ color: 'var(--color-on-surface-disabled)' }}>Loading...</p></Shell>;
  }

  // ── Create mode ──
  if (isNew) {
    return (
      <Shell>
        <div className="page-title-group">
          <h1 className="page-title">New Camera</h1>
          <p className="page-desc">Add a new camera to {alias}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Basic Info */}
          <article className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 className="card-title"><Icon name="info" className="icon-sm" /> Basic Information</h3>
            <div>
              <label className="form-label">Table *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={formTable} onChange={(e) => setFormTable(e.target.value)} style={{ flex: 1 }}>
                  {tableList.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="btn btn-ghost" onClick={() => setCreateTableOpen(true)}>New Table</button>
              </div>
            </div>
            <FormField label="Camera Name *" value={formName} onChange={setFormName} placeholder="CAM-01" />
            <FormField label="Description" value={formDesc} onChange={setFormDesc} placeholder="Enter description" />
          </article>

          {/* Connection */}
          <article className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 className="card-title"><Icon name="link" className="icon-sm" /> Connection</h3>
            <div>
              <label className="form-label">RTSP URL</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={formRtsp} onChange={(e) => { setFormRtsp(e.target.value); setPingResult(null); }} placeholder="rtsp://user:pass@ip:port/live" style={{ flex: 1 }} />
                <button className="btn btn-ghost" onClick={handlePing} disabled={pinging}>{pinging ? 'Pinging...' : 'Ping'}</button>
              </div>
              {pingResult && (
                <div style={{ marginTop: 4, fontSize: 'var(--font-size-sm)', color: pingResult.variant === 'success' ? 'var(--color-success)' : 'var(--color-error)' }}>
                  {pingResult.message}
                </div>
              )}
            </div>
          </article>

          {/* Detection */}
          <article className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 className="card-title"><Icon name="visibility" className="icon-sm" /> Detection</h3>
            <div>
              <label className="form-label">Detect Objects</label>
              <DetectObjectPicker items={formDetectObjects} options={detectList} onAdd={(n) => setFormDetectObjects((p) => [...p, n])} onRemove={(n) => setFormDetectObjects((p) => p.filter((x) => x !== n))} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
              <input type="checkbox" checked={formSaveObjects} onChange={(e) => setFormSaveObjects(e.target.checked)} /> Save detection results
            </label>
          </article>

          {/* FFmpeg */}
          <FFmpegConfig value={ffmpegConfig} onChange={setFfmpegConfig} />

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create'}</button>
          </div>
        </div>

        {config && <CreateTableModal isOpen={createTableOpen} onClose={() => setCreateTableOpen(false)} onCreated={(n) => { setTableList((p) => [...p, n]); setFormTable(n); }} ip={config.ip} port={config.port} />}
      </Shell>
    );
  }

  // ── Readonly / Edit mode ──
  const isEditing = editMode;

  return (
    <Shell>
      {/* Header */}
      <div className="page-title-group">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{camera?.name || id}</h1>
            <div className={`switch ${cameraStatus === 'running' ? 'active' : ''}`} onClick={handleToggleStatus}>
              <div className="switch-thumb" />
            </div>
            <span className={`text-sm ${cameraStatus === 'running' ? 'text-success' : 'text-on-surface-disabled'}`}>
              {cameraStatus === 'running' ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <CameraLivePreview webrtcUrl={cameraStatus === 'running' ? camera?.webrtc_url : undefined} />
                <button className="btn btn-ghost" onClick={() => setEditMode(true)}><Icon name="edit" className="icon-sm" /> Edit</button>
                <button className="btn btn-danger" onClick={handleDelete}><Icon name="delete" className="icon-sm" /> Delete</button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => { setEditMode(false); fetchCamera(); }}>Cancel</button>
                <button className="btn btn-primary" onClick={handleUpdate} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
              </>
            )}
          </div>
        </div>
        <p className="page-desc">{alias} &mdash; {config ? `${config.ip}:${config.port}` : ''}</p>
      </div>

      {camera ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Basic Info */}
          <article className="card">
            <h3 className="card-title"><Icon name="info" className="icon-sm" /> Basic Info</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: '12px 16px' }}>
              <InfoField label="Camera ID" value={camera.camera_id || id || ''} />
              <InfoField label="Table" value={camera.table || ''} />
              {isEditing ? <FormField label="Description" value={formDesc} onChange={setFormDesc} /> : <InfoField label="Description" value={camera.desc || ''} />}
              <InfoField label="Label" value={camera.label || ''} />
            </div>
          </article>

          {/* Connection */}
          <article className="card">
            <h3 className="card-title"><Icon name="link" className="icon-sm" /> Connection</h3>
            {isEditing ? (
              <div>
                <label className="form-label">RTSP URL</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={formRtsp} onChange={(e) => { setFormRtsp(e.target.value); setPingResult(null); }} style={{ flex: 1 }} />
                  <button className="btn btn-ghost" onClick={handlePing} disabled={pinging}>{pinging ? '...' : 'Ping'}</button>
                </div>
                {pingResult && <div style={{ marginTop: 4, fontSize: 'var(--font-size-sm)', color: pingResult.variant === 'success' ? 'var(--color-success)' : 'var(--color-error)' }}>{pingResult.message}</div>}
              </div>
            ) : (
              <div className="grid grid-cols-1" style={{ gap: 12 }}>
                <InfoField label="RTSP URL" value={camera.rtsp_url || ''} />
                {camera.webrtc_url && <InfoField label="WebRTC URL" value={camera.webrtc_url} />}
              </div>
            )}
          </article>

          {/* Detection */}
          <article className="card">
            <h3 className="card-title"><Icon name="visibility" className="icon-sm" /> Detection</h3>
            <div style={{ marginBottom: 8 }}>
              <label className="form-label">Detect Objects</label>
              <DetectObjectPicker
                items={isEditing ? formDetectObjects : (camera.detect_objects ?? [])}
                options={detectList}
                onAdd={(n) => {
                  const next = [...formDetectObjects, n];
                  setFormDetectObjects(next);
                  if (editMode && config && id) updateCameraDetectObjects(id, next, config.ip, config.port).catch(() => {});
                }}
                onRemove={(n) => {
                  const next = formDetectObjects.filter((x) => x !== n);
                  setFormDetectObjects(next);
                  if (editMode && config && id) updateCameraDetectObjects(id, next, config.ip, config.port).catch(() => {});
                }}
                readonly={!isEditing}
              />
            </div>
            {isEditing ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}>
                <input type="checkbox" checked={formSaveObjects} onChange={(e) => setFormSaveObjects(e.target.checked)} /> Save detection results
              </label>
            ) : (
              <InfoField label="Save Objects" value={camera.save_objects ? 'Yes' : 'No'} />
            )}
          </article>

          {/* Event Rules */}
          {config && !isNew && <EventRulesSection cameraId={id!} config={config} readOnly={!isEditing} />}

          {/* FFmpeg */}
          <FFmpegConfig value={ffmpegConfig} onChange={setFfmpegConfig} readOnly={!isEditing} />
        </div>
      ) : (
        <p style={{ color: 'var(--color-on-surface-disabled)' }}>Camera not found.</p>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page">
      <div className="page-body">
        <div className="page-body-inner">
          {children}
        </div>
      </div>
    </div>
  );
}
function InfoField({ label, value }: { label: string; value: string }) {
  return <div><div className="form-label">{label}</div><div className="dash-field-box">{value || '-'}</div></div>;
}
function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <div><label className="form-label">{label}</label><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: '100%' }} /></div>;
}
