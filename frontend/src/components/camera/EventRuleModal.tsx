import { useState, useEffect } from 'react';
import { createEventRule, updateEventRule, getDetectObjects } from '../../services/cameraApi';
import type { EventRuleItem, MediaServerConfig } from '../../types/server';
import { useApp } from '../../context/AppContext';
import DetectObjectPicker from './DetectObjectPicker';

interface EventRuleModalProps {
  isOpen: boolean;
  onClose: (saved?: boolean) => void;
  cameraId: string;
  config: MediaServerConfig;
  editRule: EventRuleItem | null;
}

export default function EventRuleModal({ isOpen, onClose, cameraId, config, editRule }: EventRuleModalProps) {
  const { notify } = useApp();
  const isEdit = editRule !== null;
  const [name, setName] = useState('');
  const [expression, setExpression] = useState('');
  const [recordMode, setRecordMode] = useState<'ALL_MATCHES' | 'EDGE_ONLY'>('EDGE_ONLY');
  const [detectObjects, setDetectObjects] = useState<string[]>([]);
  const [detectOptions, setDetectOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(editRule?.name ?? '');
      setExpression(editRule?.expression_text ?? '');
      setRecordMode(editRule?.record_mode ?? 'EDGE_ONLY');
      setDetectObjects(editRule?.detect_objects ?? []);
      setError('');
      getDetectObjects(config.ip, config.port).then(setDetectOptions).catch(() => {});
    }
  }, [isOpen, editRule, config.ip, config.port]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    setError('');
    if (!name.trim()) { setError('Rule name is required'); return; }
    if (!expression.trim()) { setError('Expression is required'); return; }
    if (expression.length > 200) { setError('Expression must be 200 characters or less'); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await updateEventRule(cameraId, editRule!.rule_id, {
          name: name.trim(),
          expression_text: expression.trim(),
          record_mode: recordMode,
          detect_objects: detectObjects.length > 0 ? detectObjects : undefined,
        }, config.ip, config.port);
        notify('Rule updated', 'success');
      } else {
        await createEventRule({
          camera_id: cameraId,
          name: name.trim(),
          expression_text: expression.trim(),
          record_mode: recordMode,
          detect_objects: detectObjects.length > 0 ? detectObjects : undefined,
        }, config.ip, config.port);
        notify('Rule created', 'success');
      }
      onClose(true);
    } catch (err) {
      setError(`Failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={() => onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-title">{isEdit ? 'Edit Event Rule' : 'New Event Rule'}</div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="form-label">Rule Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Rule" style={{ width: '100%' }} />
          </div>
          <div>
            <label className="form-label">Expression (max 200 chars)</label>
            <input value={expression} onChange={(e) => setExpression(e.target.value)} placeholder="person > 5 AND car >= 2" style={{ width: '100%', fontFamily: 'var(--font-family-mono)' }} />
            <div style={{ textAlign: 'right', fontSize: 10, color: expression.length > 200 ? 'var(--color-error)' : 'var(--color-on-surface-disabled)', marginTop: 2 }}>
              {expression.length}/200
            </div>
          </div>
          <div>
            <label className="form-label">Record Mode</label>
            <select value={recordMode} onChange={(e) => setRecordMode(e.target.value as any)} style={{ width: '100%' }}>
              <option value="EDGE_ONLY">Edge Only — trigger on state change</option>
              <option value="ALL_MATCHES">All Matches — record every match</option>
            </select>
          </div>
          <div>
            <label className="form-label">Detect Objects</label>
            <DetectObjectPicker
              items={detectObjects}
              options={detectOptions}
              onAdd={(n) => setDetectObjects((p) => [...p, n])}
              onRemove={(n) => setDetectObjects((p) => p.filter((x) => x !== n))}
            />
          </div>
          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-base)', backgroundColor: 'var(--color-error-muted)', color: 'var(--color-error)', fontSize: 'var(--font-size-sm)' }}>
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => onClose()}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
