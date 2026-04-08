import { useState, useEffect } from 'react';
import type { MediaServerConfig } from '../../types/server';
import Icon from '../common/Icon';

const ALIAS_REGEX = /^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\-_.]+$/;

export type ServerModalMode = 'new' | 'edit';

interface ServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: MediaServerConfig) => void;
  mode: ServerModalMode;
  initial?: MediaServerConfig;
  existingAliases: string[];
}

export default function ServerModal({ isOpen, onClose, onSave, mode, initial, existingAliases }: ServerModalProps) {
  const [alias, setAlias] = useState('');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('');
  const [error, setError] = useState('');
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (isOpen) {
      setAlias(initial?.alias ?? '');
      setIp(initial?.ip ?? (mode === 'new' ? window.location.hostname : ''));
      setPort(initial?.port ? String(initial.port) : (mode === 'new' ? '8000' : ''));
      setError('');
      setConnStatus('idle');
    }
  }, [isOpen, initial, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleTestConnection = async () => {
    if (!ip) { setError('IP Address is required'); return; }
    setConnStatus('testing');
    setError('');
    try {
      const baseUrl = `${window.location.protocol}//${ip}:${Number(port) || 8000}`;
      const res = await fetch(`${baseUrl}/api/cameras/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setConnStatus('success');
    } catch {
      setConnStatus('error');
    }
  };

  const handleSave = () => {
    setError('');
    if (!alias.trim()) { setError('Alias is required'); return; }
    if (!ALIAS_REGEX.test(alias)) { setError('Alias can only contain letters, numbers, Korean, and -_.'); return; }
    if (mode === 'new' && existingAliases.includes(alias)) { setError(`Alias "${alias}" already exists`); return; }
    if (!ip.trim()) { setError('IP Address is required'); return; }

    onSave({ alias: alias.trim(), ip: ip.trim(), port: Number(port) || 8000 });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-title">{mode === 'new' ? 'New Blackbox Server' : 'Edit Blackbox Server'}</div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Alias" placeholder="BlackBox Server 1" value={alias} onChange={setAlias} />
          <Field label="IP Address" placeholder="192.168.1.100" value={ip} onChange={setIp} />
          <Field label="Port" placeholder="8000" value={port} onChange={setPort} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleTestConnection}
              disabled={connStatus === 'testing'}
            >
              {connStatus === 'testing' ? 'Testing...' : 'Test Connection'}
            </button>
            {connStatus === 'success' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-size-sm)', color: 'var(--color-success)' }}>
                <Icon name="check_circle" className="icon-sm" /> Connected
              </span>
            )}
            {connStatus === 'error' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-size-sm)', color: 'var(--color-error)' }}>
                <Icon name="error" className="icon-sm" /> Connection failed
              </span>
            )}
          </div>

          {error && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-base)',
              backgroundColor: 'var(--color-error-muted)',
              color: 'var(--color-error)',
              fontSize: 'var(--font-size-sm)',
            }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        className="w-full"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%' }}
      />
    </div>
  );
}
