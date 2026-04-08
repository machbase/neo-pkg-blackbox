import { useState, useEffect, useCallback } from 'react';
import { getEventRules, deleteEventRule, updateEventRule } from '../../services/cameraApi';
import type { EventRuleItem, MediaServerConfig } from '../../types/server';
import { useApp } from '../../context/AppContext';
import { useConfirm } from '../../context/ConfirmContext';
import Icon from '../common/Icon';
import EventRuleModal from './EventRuleModal';

interface EventRulesSectionProps {
  cameraId: string;
  config: MediaServerConfig;
  readOnly?: boolean;
}

export default function EventRulesSection({ cameraId, config, readOnly = false }: EventRulesSectionProps) {
  const { notify } = useApp();
  const confirm = useConfirm();
  const [rules, setRules] = useState<EventRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EventRuleItem | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      const data = await getEventRules(cameraId, config.ip, config.port);
      setRules(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [cameraId, config.ip, config.port]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleToggle = async (rule: EventRuleItem) => {
    try {
      await updateEventRule(cameraId, rule.rule_id, { enabled: !rule.enabled } as any, config.ip, config.port);
      setRules((prev) => prev.map((r) => r.rule_id === rule.rule_id ? { ...r, enabled: !r.enabled } : r));
    } catch (err) {
      notify(`Failed to toggle rule: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
    }
  };

  const handleDelete = async (rule: EventRuleItem) => {
    const ok = await confirm({ title: 'Delete Rule', message: `Delete rule "${rule.name}"?`, confirmText: 'Delete' });
    if (!ok) return;
    try {
      await deleteEventRule(cameraId, rule.rule_id, config.ip, config.port);
      setRules((prev) => prev.filter((r) => r.rule_id !== rule.rule_id));
      notify(`Rule "${rule.name}" deleted`, 'success');
    } catch (err) {
      notify(`Failed to delete: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
    }
  };

  const handleEdit = (rule: EventRuleItem) => {
    setEditingRule(rule);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingRule(null);
    setModalOpen(true);
  };

  const handleModalClose = (saved?: boolean) => {
    setModalOpen(false);
    setEditingRule(null);
    if (saved) fetchRules();
  };

  return (
    <article className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="card-title" style={{ marginBottom: 0 }}>
          <Icon name="rule" className="icon-sm" /> Event Rules
        </h3>
        {!readOnly && (
          <button className="btn btn-primary btn-sm" onClick={handleAdd}>
            <Icon name="add" className="icon-sm" /> Add Rule
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ marginTop: 12, color: 'var(--color-on-surface-disabled)', fontSize: 'var(--font-size-sm)' }}>Loading rules...</p>
      ) : rules.length === 0 ? (
        <p style={{ marginTop: 12, color: 'var(--color-on-surface-disabled)', fontSize: 'var(--font-size-sm)' }}>No event rules configured.</p>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map((rule) => (
            <div key={rule.rule_id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              borderRadius: 'var(--radius-base)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)',
            }}>
              <div
                className={`switch ${rule.enabled ? 'active' : ''}`}
                onClick={readOnly ? undefined : () => handleToggle(rule)}
                style={{ cursor: readOnly ? 'default' : 'pointer' }}
              >
                <div className="switch-thumb" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>{rule.name}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-on-surface-tertiary)', fontFamily: 'var(--font-family-mono)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rule.expression_text || '-'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--color-on-surface-disabled)', marginTop: 2 }}>
                  {rule.record_mode}
                </div>
              </div>
              {!readOnly && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(rule)} style={{ padding: '0 6px' }}>
                    <Icon name="edit" className="icon-sm" />
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(rule)} style={{ padding: '0 6px' }}>
                    <Icon name="delete" className="icon-sm" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <EventRuleModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        cameraId={cameraId}
        config={config}
        editRule={editingRule}
      />
    </article>
  );
}
