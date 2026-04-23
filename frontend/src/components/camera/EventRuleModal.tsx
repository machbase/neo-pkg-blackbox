import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createEventRule, updateEventRule,
  getDetectObjects, getCameraDetectObjects, updateCameraDetectObjects,
} from '../../services/cameraApi';
import type { EventRuleItem, MediaServerConfig } from '../../types/server';
import { useApp } from '../../context/AppContext';
import Icon from '../common/Icon';
import DetectObjectPicker from './DetectObjectPicker';

interface EventRuleModalProps {
  isOpen: boolean;
  onClose: (saved?: boolean) => void;
  cameraId: string;
  config: MediaServerConfig;
  editRule: EventRuleItem | null;
  ruleCount?: number;
  onDetectObjectsChange?: () => void;
}

const MAX_EXPRESSION_LENGTH = 200;

export default function EventRuleModal({
  isOpen, onClose, cameraId, config, editRule, ruleCount = 0, onDetectObjectsChange,
}: EventRuleModalProps) {
  const { notify } = useApp();
  const isEdit = editRule !== null;

  const [ruleId, setRuleId] = useState('');
  const [name, setName] = useState('');
  const [expression, setExpression] = useState('');
  const [recordMode, setRecordMode] = useState<'ALL_MATCHES' | 'EDGE_ONLY'>('EDGE_ONLY');
  const [expressionError, setExpressionError] = useState('');

  const [targets, setTargets] = useState<string[]>([]);
  const [allDetectObjects, setAllDetectObjects] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const expressionRef = useRef<HTMLInputElement>(null);
  const mouseDownOnOverlayRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editRule) {
      setRuleId(editRule.rule_id);
      setName(editRule.name);
      setExpression(editRule.expression_text ?? '');
      setRecordMode(editRule.record_mode ?? 'EDGE_ONLY');
    } else {
      setRuleId(`R_${Date.now()}`);
      setName(`RULE_${ruleCount}`);
      setExpression('');
      setRecordMode('EDGE_ONLY');
    }
    setExpressionError('');
    setError('');
  }, [isOpen, editRule, ruleCount]);

  useEffect(() => {
    if (!isOpen || !cameraId) {
      setTargets([]); setAllDetectObjects([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      getDetectObjects(config.ip, config.port).catch(() => [] as string[]),
      getCameraDetectObjects(cameraId, config.ip, config.port).catch(() => [] as string[]),
    ]).then(([all, camera]) => {
      if (cancelled) return;
      setAllDetectObjects(all);
      setTargets(camera);
    });
    return () => { cancelled = true; };
  }, [isOpen, cameraId, config.ip, config.port]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  const syncCameraDetectObjects = async (next: string[]) => {
    try {
      await updateCameraDetectObjects(cameraId, next, config.ip, config.port);
      setTargets(next);
      onDetectObjectsChange?.();
    } catch (err) {
      notify(`Failed to update detect objects: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
    }
  };

  const handleAddTarget = (n: string) => {
    if (!n || targets.includes(n)) return;
    void syncCameraDetectObjects([...targets, n]);
  };

  const handleRemoveTarget = (n: string) => {
    void syncCameraDetectObjects(targets.filter((t) => t !== n));
  };

  const handleTargetClick = useCallback((n: string) => {
    const el = expressionRef.current;
    const cursorPos = el?.selectionStart ?? expression.length;
    const before = expression.slice(0, cursorPos);
    const after = expression.slice(cursorPos);
    const next = `${before}${n}${after}`;
    const newCursor = cursorPos + n.length;
    setExpression(next);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.selectionStart = newCursor;
        el.selectionEnd = newCursor;
      }
    });
  }, [expression]);

  const handleExpressionChange = (v: string) => {
    setExpression(v);
    if (v.length > MAX_EXPRESSION_LENGTH) {
      setExpressionError(`Expression must be ${MAX_EXPRESSION_LENGTH} characters or less (current: ${v.length})`);
    } else {
      setExpressionError('');
    }
  };

  const canSave = !!ruleId.trim() && !!name.trim() && !!expression.trim() && !expressionError;

  const handleSave = async () => {
    setError('');
    if (!canSave) {
      if (!ruleId.trim()) { setError('Rule ID is required'); return; }
      if (!name.trim()) { setError('Rule name is required'); return; }
      if (!expression.trim()) { setError('Expression is required'); return; }
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateEventRule(cameraId, editRule!.rule_id, {
          name: name.trim(),
          expression_text: expression.trim(),
          record_mode: recordMode,
          enabled: editRule!.enabled ?? true,
        }, config.ip, config.port);
        notify(`Event rule '${name}' updated successfully.`, 'success');
      } else {
        await createEventRule({
          camera_id: cameraId,
          rule: {
            rule_id: ruleId.trim(),
            name: name.trim(),
            expression_text: expression.trim(),
            record_mode: recordMode,
            enabled: true,
          },
        }, config.ip, config.port);
        notify(`Event rule '${name}' created successfully.`, 'success');
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
    <div
      className="modal-overlay"
      onMouseDown={(e) => { mouseDownOnOverlayRef.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (mouseDownOnOverlayRef.current && e.target === e.currentTarget) onClose();
        mouseDownOnOverlayRef.current = false;
      }}
    >
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Icon name="video_library" className="icon-sm" />
            {isEdit ? 'Edit Event Rule' : 'Create Event Rule'}
          </div>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Configuration Details */}
          <section>
            <SectionLabel icon="settings" text="Configuration Details" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
              <div>
                <div style={fieldLabelStyle}>Rule ID</div>
                <input
                  value={ruleId}
                  onChange={(e) => setRuleId(e.target.value)}
                  placeholder="e.g. safety_check_01"
                  disabled={isEdit}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <div style={fieldLabelStyle}>Rule Name</div>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. PPE Safety Alert"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <div style={fieldLabelStyle}>Record Mode</div>
                <select
                  value={recordMode}
                  onChange={(e) => setRecordMode(e.target.value as 'ALL_MATCHES' | 'EDGE_ONLY')}
                  style={{ width: '100%' }}
                >
                  <option value="EDGE_ONLY">Trigger on change (EDGE)</option>
                  <option value="ALL_MATCHES">Record all matches (ALL)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Idents */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionLabel icon="settings" text="Idents" />
              <span style={{ fontSize: 12, color: 'var(--color-primary)' }}>
                Click a label to insert it, or 'x' to remove it.
              </span>
            </div>
            <div style={{ marginTop: 8 }}>
              <DetectObjectPicker
                items={targets}
                options={allDetectObjects}
                onAdd={handleAddTarget}
                onRemove={handleRemoveTarget}
                onItemClick={handleTargetClick}
              />
            </div>
          </section>

          {/* Rule Logic */}
          <section>
            <SectionLabel icon="code" text="Rule Logic" />
            <input
              ref={expressionRef}
              value={expression}
              onChange={(e) => handleExpressionChange(e.target.value)}
              spellCheck={false}
              style={{ width: '100%', marginTop: 8, fontFamily: 'var(--font-family-mono)' }}
            />
            {expressionError && (
              <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 'var(--radius-base)', backgroundColor: 'var(--color-error-muted)', color: 'var(--color-error)', fontSize: 'var(--font-size-sm)' }}>
                {expressionError}
              </div>
            )}
          </section>

          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-base)', backgroundColor: 'var(--color-error-muted)', color: 'var(--color-error)', fontSize: 'var(--font-size-sm)' }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !canSave}>
            {saving ? 'Saving...' : isEdit ? 'Update Event Rule' : 'Register Event Rule'}
          </button>
          <button className="btn btn-ghost" onClick={() => onClose()}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-on-surface-secondary)',
  marginBottom: 4,
};

function SectionLabel({ icon, text }: { icon: string; text: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 700,
      color: 'var(--color-on-surface-secondary)',
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      <Icon name={icon} className="icon-sm" />
      {text}
    </span>
  );
}
