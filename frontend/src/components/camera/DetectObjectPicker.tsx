import { useState, useRef, useEffect } from 'react';

interface DetectObjectPickerProps {
  items: string[];
  options: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onItemClick?: (name: string) => void;
  readonly?: boolean;
}

export default function DetectObjectPicker({ items, options, onAdd, onRemove, onItemClick, readonly = false }: DetectObjectPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((o) => !items.includes(o) && o.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && filtered[highlightIndex]) { onAdd(filtered[highlightIndex]); setSearch(''); setHighlightIndex(0); }
    else if (e.key === 'Escape') { setOpen(false); setSearch(''); }
  };

  const openPicker = () => {
    if (readonly) return;
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        onClick={() => { if (!open) openPicker(); }}
        style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6,
          minHeight: 44, padding: '8px 12px',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-base)',
          backgroundColor: 'var(--color-surface-input)',
          cursor: readonly ? 'default' : 'text',
        }}
      >
        {items.map((item) => (
          <span
            key={item}
            className="badge badge-primary"
            onClick={(e) => {
              if (onItemClick) {
                e.stopPropagation();
                onItemClick(item);
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: onItemClick ? 'pointer' : 'default' }}
          >
            {item}
            {!readonly && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(item); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'inherit', fontSize: 14 }}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!readonly && !open && (
          <span style={{ fontSize: 13, color: 'var(--color-on-surface-muted)' }}>
            {items.length > 0 ? '+ Add more...' : 'Select detect objects'}
          </span>
        )}
        {!readonly && open && (
          <input
            ref={inputRef}
            placeholder="Search..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setHighlightIndex(0); }}
            onKeyDown={handleKeyDown}
            style={{ flex: 1, minWidth: 120, border: 'none', background: 'transparent', padding: 0, outline: 'none', fontSize: 13 }}
          />
        )}
      </div>

      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          maxHeight: 200, overflowY: 'auto',
          backgroundColor: 'var(--color-dropdown)', border: '1px solid var(--color-dropdown-border)',
          borderRadius: 'var(--radius-base)', boxShadow: 'var(--shadow-dropdown)', marginTop: 4,
        }}>
          {filtered.map((item, i) => (
            <div
              key={item}
              onClick={() => { onAdd(item); setSearch(''); setHighlightIndex(0); }}
              style={{
                padding: '6px 12px', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                backgroundColor: i === highlightIndex ? 'var(--color-dropdown-option-hover)' : 'transparent',
              }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
