import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router';
import { useApp } from '../context/AppContext';
import { queryCameraEvents, loadCameras, type EventQueryParams, type EventQueryResult } from '../services/cameraApi';
import { getServer } from '../services/serversApi';
import type { CameraEvent, CameraItem, MediaServerConfig } from '../types/server';
import Icon from '../components/common/Icon';
import EventDetailModal from '../components/camera/EventDetailModal';

const EVENT_TYPES = ['ALL', 'MATCH', 'TRIGGER', 'RESOLVE', 'ERROR'] as const;
const PAGE_SIZE = 20;

function formatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function daysAgo(days: number): string {
  const d = new Date(); d.setDate(d.getDate() - days);
  return formatDate(d);
}

function parseUsedCounts(snapshot?: string): Record<string, number> {
  if (!snapshot) return {};
  try {
    const parsed = JSON.parse(snapshot);
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed).reduce<Record<string, number>>((acc, [k, v]) => {
        if (typeof v === 'number') acc[k] = v;
        return acc;
      }, {});
    }
  } catch { /* ignore */ }
  return {};
}

export default function EventPage() {
  const { alias } = useParams<{ alias: string }>();
  const { notify } = useApp();

  const [config, setConfig] = useState<MediaServerConfig | null>(null);
  const [events, setEvents] = useState<CameraEvent[]>([]);
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [startTime, setStartTime] = useState(daysAgo(7));
  const [endTime, setEndTime] = useState(formatDate(new Date()));
  const [selectedCamera, setSelectedCamera] = useState('');
  const [eventType, setEventType] = useState<string>('ALL');
  const [eventName, setEventName] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<CameraEvent | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Use refs for fetch functions to avoid dependency loops
  const filtersRef = useRef({ selectedCamera, eventType, eventName, startTime, endTime });
  filtersRef.current = { selectedCamera, eventType, eventName, startTime, endTime };

  const fetchEvents = async (p = 1, cfg: MediaServerConfig | null = config) => {
    if (!cfg) return;
    setLoading(true);
    try {
      const f = filtersRef.current;
      const params: EventQueryParams = { size: PAGE_SIZE, page: p };
      if (f.selectedCamera) params.camera_id = f.selectedCamera;
      if (f.eventType !== 'ALL') params.event_type = f.eventType;
      if (f.eventName) params.event_name = f.eventName;
      if (f.startTime) params.start_time = String(BigInt(new Date(f.startTime).getTime()) * 1000000n);
      if (f.endTime) params.end_time = String(BigInt(new Date(f.endTime).getTime()) * 1000000n);

      const result: EventQueryResult = await queryCameraEvents(params, cfg.ip, cfg.port);
      setEvents(result.events);
      setTotalCount(result.total_count);
      setTotalPages(result.total_pages);
    } catch (err) {
      notify(`Failed to load events: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
      setEvents([]);
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
    if (!config) return;
    loadCameras(config.ip, config.port).then(setCameras).catch(() => {});
    fetchEvents(1, config);
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => { setPage(1); fetchEvents(1); };
  const handleReset = () => { setStartTime(daysAgo(7)); setEndTime(formatDate(new Date())); setSelectedCamera(''); setEventType('ALL'); setEventName(''); setPage(1); };
  const handlePage = (p: number) => { setPage(p); fetchEvents(p); };

  return (
    <div className="page"><div className="page-body-full">
      <div className="page-body-inner">
        <div className="page-title-group">
          <h1 className="page-title">Events</h1>
          <p className="page-desc">{alias} &mdash; {config ? `${config.ip}:${config.port}` : ''}</p>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 16, flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <FilterField label="From"><input type="datetime-local" value={startTime.replace(' ', 'T')} onChange={(e) => setStartTime(e.target.value.replace('T', ' '))} /></FilterField>
          <FilterField label="To"><input type="datetime-local" value={endTime.replace(' ', 'T')} onChange={(e) => setEndTime(e.target.value.replace('T', ' '))} /></FilterField>
          <FilterField label="Camera">
            <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
              <option value="">All</option>
              {cameras.map((c) => <option key={c.id} value={c.id}>{c.label || c.id}</option>)}
            </select>
          </FilterField>
          <FilterField label="Type">
            <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FilterField>
          <FilterField label="Event Name">
            <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Search name..." />
          </FilterField>
          <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSearch}>Search</button>
            <button className="btn btn-ghost" onClick={handleReset}>Reset</button>
          </div>
        </div>

        {/* Table */}
        <article className="table-card">
          <div className="table-card-body">
            {loading ? <Empty>Loading events...</Empty> : events.length === 0 ? <Empty>No events found</Empty> : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th><th>Camera</th><th>Rule</th><th>Expression</th><th>Type</th><th>Content</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, i) => {
                    const counts = parseUsedCounts(ev.used_counts_snapshot);
                    return (
                      <tr key={i} onClick={() => { setSelectedEvent(ev); setDetailOpen(true); }}>
                        <td>{ev.time}</td>
                        <td>{ev.camera_id}</td>
                        <td>{ev.rule_name || '-'}</td>
                        <td className="mono">{ev.expression_text || '-'}</td>
                        <td><TypeBadge type={ev.value_label || ''} /></td>
                        <td>
                          {Object.keys(counts).length > 0 ? (
                            <div className="flex gap-1 flex-nowrap">
                              {Object.entries(counts).map(([k, v]) => (
                                <span key={k} className="badge badge-primary text-xs">{k}: {v}</span>
                              ))}
                            </div>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="pagination">
            {totalCount > 0 && <span className="pagination-info">Total {totalCount}</span>}
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => handlePage(page - 1)}><Icon name="chevron_left" className="icon-sm" /></button>
            <span className="pagination-current">Page {page}{totalPages > 1 ? ` / ${totalPages}` : ''}</span>
            <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => handlePage(page + 1)}><Icon name="chevron_right" className="icon-sm" /></button>
          </div>
        </article>

        <EventDetailModal
          isOpen={detailOpen}
          onClose={() => { setDetailOpen(false); setSelectedEvent(null); }}
          event={selectedEvent}
          alias={alias || ''}
        />
      </div>
    </div></div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-field"><label className="form-label">{label}</label>{children}</div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
function TypeBadge({ type }: { type: string }) {
  const variant: Record<string, string> = { ERROR: 'tag-error', MATCH: 'tag-match', TRIGGER: 'tag-trigger', RESOLVE: 'tag-resolve' };
  if (!type) return <span>-</span>;
  return <span className={`tag ${variant[type] || ''}`}>{type}</span>;
}
