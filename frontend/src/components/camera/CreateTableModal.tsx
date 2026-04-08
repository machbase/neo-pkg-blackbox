import { useState, useEffect } from 'react';
import { createTable } from '../../services/cameraApi';
import { useApp } from '../../context/AppContext';

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: (created?: boolean) => void;
  onCreated: (name: string) => void;
  ip: string;
  port: number;
}

export default function CreateTableModal({ isOpen, onClose, onCreated, ip, port }: CreateTableModalProps) {
  const { notify } = useApp();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) { setName(''); setError(''); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  const handleCreate = async () => {
    setError('');
    if (!name.trim()) { setError('Table name is required'); return; }
    setSaving(true);
    try {
      await createTable(name.trim(), ip, port);
      notify(`Table "${name}" created`, 'success');
      onCreated(name.trim());
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
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-title">Create Table</div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="form-label">Table Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my_camera_table" style={{ width: '100%' }} />
          </div>
          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-base)', backgroundColor: 'var(--color-error-muted)', color: 'var(--color-error)', fontSize: 'var(--font-size-sm)' }}>
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => onClose()}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
