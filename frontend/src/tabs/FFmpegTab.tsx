import type { FFmpegDefaults } from '../types/settings';
import Icon from '../components/common/Icon';

type FFmpegTabProps = {
  settings: FFmpegDefaults;
  onChange: (next: FFmpegDefaults) => void;
};

function createProbeArgId(): string {
  return `arg-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}

export function FFmpegTab({ settings, onChange }: FFmpegTabProps) {
  const updateProbeArg = (id: string, key: 'flag' | 'value', value: string) => {
    onChange({
      ...settings,
      probeArgs: settings.probeArgs.map((item) => (
        item.id === id ? { ...item, [key]: value } : item
      )),
    });
  };

  const addProbeArg = () => {
    onChange({
      ...settings,
      probeArgs: [
        ...settings.probeArgs,
        { id: createProbeArgId(), flag: '', value: '' },
      ],
    });
  };

  const removeProbeArg = (id: string) => {
    onChange({
      ...settings,
      probeArgs: settings.probeArgs.filter((item) => item.id !== id),
    });
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="page-title-group">
        <h1 className="page-title">FFmpeg Default Settings</h1>
        <p className="page-desc">Configure default probe arguments for optimized media processing.</p>
      </div>

      <article className="card">
        <div className="flex items-center justify-between gap-3">
          <h3 className="card-title mb-0">
            <Icon name="terminal" className="icon-sm" />
            probe_args
          </h3>
          <button type="button" className="btn btn-primary" onClick={addProbeArg}>
            <Icon name="add" className="icon-sm" />
            Add Argument
          </button>
        </div>
        <p className="text-xs text-on-surface-hint mt-2">Default command line flags used when analyzing media streams.</p>

        <div className="flex flex-col gap-3 mt-4">
          {settings.probeArgs.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_32px] gap-3 items-end p-3 rounded-base border border-border bg-surface">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`flag-${item.id}`} className="form-label">FLAG</label>
                  <input
                    id={`flag-${item.id}`}
                    name={`flag-${item.id}`}
                    value={item.flag}
                    className="w-full font-mono"
                    onChange={(event) => updateProbeArg(item.id, 'flag', event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`value-${item.id}`} className="form-label">VALUE</label>
                  <input
                    id={`value-${item.id}`}
                    name={`value-${item.id}`}
                    value={item.value}
                    className="w-full font-mono"
                    onChange={(event) => updateProbeArg(item.id, 'value', event.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost p-0 w-8"
                aria-label={`delete-${item.id}`}
                onClick={() => removeProbeArg(item.id)}
              >
                <Icon name="delete" className="icon-sm text-error" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-base border border-primary/30 bg-primary/10 text-sm text-on-surface-secondary">
          Probing arguments directly affect metadata extraction performance. Using JSON output format is recommended for programmatic parsing.
        </div>
      </article>
    </section>
  );
}
