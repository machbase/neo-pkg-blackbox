import { useRef, useEffect, useState, useCallback } from 'react';
import { getCamera } from '../../services/cameraApi';
import { getServer } from '../../services/serversApi';
import { getTimeRange } from '../../services/videoApi';
import { useChunkPlayer } from '../../hooks/useChunkPlayer';
import { useCameraGaps } from '../../hooks/useCameraGaps';
import { formatTimeLabel } from '../../utils/timeUtils';
import {
  type SeekUnit, resolveEffectiveFps, getEventMarkerPercent,
  buildEventCenteredRange, formatTimeForSeekUnit,
} from '../../utils/eventPlaybackUtils';
import type { CameraEvent, CameraInfo, MediaServerConfig } from '../../types/server';
import Icon from '../common/Icon';
import EventSyncChart from './EventSyncChart';

function parseUsedCounts(snapshot?: string): Record<string, number> {
  if (!snapshot) return {};
  try {
    const p = JSON.parse(snapshot);
    if (p && typeof p === 'object') return Object.entries(p).reduce<Record<string, number>>((a, [k, v]) => { if (typeof v === 'number') a[k] = v; return a; }, {});
  } catch {}
  return {};
}

function parseEventTime(time: string): Date {
  return /^\d+$/.test(time) ? new Date(Number(BigInt(time) / 1000000n)) : new Date(time);
}

const RANGE_MS = 5 * 60 * 1000; // ±5min
const MISSING_SEGMENT_ALPHA = 0.4;

// ════════════════════════════════════════════════════════════════════
// EventMediaSection — video + timeline + controls + chart
// ════════════════════════════════════════════════════════════════════

function EventMediaSection({ cameraId, timestamp, cameraDetail, event, config, alias, onChartToggle }: {
  cameraId: string; timestamp: Date; cameraDetail: CameraInfo | null;
  event: CameraEvent; config: MediaServerConfig; alias: string;
  onChartToggle?: (show: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  // DOM refs for direct updates (bypass React render)
  const thumbRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const timeBadgeRef = useRef<HTMLDivElement>(null);
  // Keep range in refs so onPlaybackTick can read without re-creating
  const rangeStartRef = useRef<number>(0);
  const rangeEndRef = useRef<number>(0);

  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [rangeStart, setRangeStart] = useState(() => new Date(timestamp.getTime() - RANGE_MS));
  const [rangeEnd, setRangeEnd] = useState(() => new Date(Math.min(timestamp.getTime() + RANGE_MS, Date.now())));
  const [seekStep, setSeekStep] = useState(5);
  const [seekStepDraft, setSeekStepDraft] = useState('5');
  const [seekUnit, setSeekUnit] = useState<SeekUnit>('frame');
  const [probePreviewTime, setProbePreviewTime] = useState<Date | null>(null);
  const [syntheticTime, setSyntheticTime] = useState<Date | null>(null);
  const syntheticRef = useRef<Date | null>(null);
  const [cameraFps, setCameraFps] = useState<number | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [hoverTime, setHoverTime] = useState<Date | null>(null);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);

  const handleProbeProgress = useCallback((t: Date) => { if (!isDragging) setProbePreviewTime(t); }, [isDragging]);
  const handleProbeStateChange = useCallback((p: boolean) => { if (!p) setProbePreviewTime(null); }, []);
  const handleTimeUpdate = useCallback((t: Date) => {
    setCurrentTime(t);
    // Also sync DOM refs on throttled updates (for paused/seek states)
    const s = rangeStartRef.current;
    const e = rangeEndRef.current;
    if (e > s) {
      const pct = Math.min(100, Math.max(0, ((t.getTime() - s) / (e - s)) * 100));
      if (thumbRef.current) thumbRef.current.style.left = `${pct}%`;
      if (progressRef.current) progressRef.current.style.width = `${pct}%`;
    }
  }, []);

  // High-frequency DOM-direct update — no React render
  const handlePlaybackTick = useCallback((timeMs: number) => {
    const s = rangeStartRef.current;
    const e = rangeEndRef.current;
    if (e <= s) return;
    const pct = Math.min(100, Math.max(0, ((timeMs - s) / (e - s)) * 100));
    if (thumbRef.current) thumbRef.current.style.left = `${pct}%`;
    if (progressRef.current) progressRef.current.style.width = `${pct}%`;
    if (timeBadgeRef.current) {
      timeBadgeRef.current.style.left = `${pct}%`;
      const d = new Date(timeMs);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      const ms = String(d.getMilliseconds()).padStart(3, '0');
      timeBadgeRef.current.textContent = `${hh}:${mm}:${ss}.${ms}`;
    }
  }, []);

  const player = useChunkPlayer(videoRef, cameraId, rangeEnd, config.ip, config.port, {
    onPlaybackTick: handlePlaybackTick, onTimeUpdate: handleTimeUpdate,
    onProbeProgress: handleProbeProgress, onProbeStateChange: handleProbeStateChange,
  });

  const effectiveFps = resolveEffectiveFps(cameraFps ?? player.fps);
  const missingSegments = useCameraGaps(cameraId, rangeStart, rangeEnd, config.ip, config.port);

  // Load FPS
  useEffect(() => {
    let c = false;
    if (!cameraId) { setCameraFps(null); return; }
    getTimeRange(cameraId, config.ip, config.port).then(r => { if (!c) { const f = Number(r?.fps); setCameraFps(Number.isFinite(f) && f > 0 ? f : null); } });
    return () => { c = true; };
  }, [cameraId, config.ip, config.port]);

  // Auto-load event time
  useEffect(() => { player.loadChunk(timestamp); }, [cameraId]);

  // Range update
  useEffect(() => {
    const s = new Date(timestamp.getTime() - RANGE_MS);
    const e = new Date(Math.min(timestamp.getTime() + RANGE_MS, Date.now()));
    setRangeStart(s); setRangeEnd(e);
    rangeStartRef.current = s.getTime(); rangeEndRef.current = e.getTime();
  }, [timestamp]);

  // Keep refs in sync when range changes
  useEffect(() => {
    rangeStartRef.current = rangeStart.getTime();
    rangeEndRef.current = rangeEnd.getTime();
  }, [rangeStart, rangeEnd]);

  // Synthetic timer for probe gaps
  useEffect(() => {
    if (!player.isProbing || player.isPlaying) { syntheticRef.current = null; setSyntheticTime(null); return; }
    const st = probePreviewTime || player.currentTime || currentTime || rangeStart;
    syntheticRef.current = st; setSyntheticTime(st);
    const iv = setInterval(() => {
      if (!syntheticRef.current) return;
      const n = new Date(syntheticRef.current.getTime() + 1000);
      if (n.getTime() > rangeEnd.getTime()) { clearInterval(iv); return; }
      syntheticRef.current = n; setSyntheticTime(n);
    }, 1000);
    return () => clearInterval(iv);
  }, [player.isProbing, player.isPlaying]);

  // Track width observer
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const update = () => setTrackWidth(el.getBoundingClientRect().width);
    update();
    if (typeof ResizeObserver !== 'undefined') { const o = new ResizeObserver(update); o.observe(el); return () => o.disconnect(); }
    window.addEventListener('resize', update); return () => window.removeEventListener('resize', update);
  }, []);

  // Auto-shift timeline when playback reaches near the end of the range
  const lastShiftRef = useRef(0);
  useEffect(() => {
    if (!player.isPlaying || !currentTime) return;
    const now = Date.now();
    // Throttle: don't shift within 2 seconds of the last shift
    if (now - lastShiftRef.current < 2000) return;
    const rangeDur = rangeEnd.getTime() - rangeStart.getTime();
    const progress = (currentTime.getTime() - rangeStart.getTime()) / rangeDur;
    // Only shift when very close to the end (>90%), not at 75%
    if (progress > 0.9) {
      lastShiftRef.current = now;
      const half = rangeDur / 2;
      setRangeStart(new Date(currentTime.getTime() - half));
      setRangeEnd(new Date(currentTime.getTime() + half));
    }
  }, [player.isPlaying, currentTime]);

  // ── Seek logic ──
  const getSeekMs = useCallback(() => {
    switch (seekUnit) {
      case 'frame': return seekStep * (1000 / effectiveFps);
      case 'sec': return seekStep * 1000;
      case 'min': return seekStep * 60_000;
    }
  }, [seekStep, seekUnit, effectiveFps]);

  const handlePrev = useCallback(() => {
    const ct = player.currentTime || currentTime; if (!ct) return;
    player.seekToTime(new Date(Math.max(rangeStart.getTime(), ct.getTime() - getSeekMs())));
  }, [player, currentTime, rangeStart, getSeekMs]);

  const handleNext = useCallback(() => {
    const ct = player.currentTime || currentTime; if (!ct) return;
    player.seekToTime(new Date(Math.min(rangeEnd.getTime(), ct.getTime() + getSeekMs())));
  }, [player, currentTime, rangeEnd, getSeekMs]);

  const handlePlayToggle = useCallback(() => {
    if (player.isProbing || player.isLoading) return;
    player.isPlaying ? player.pause() : player.play();
  }, [player]);

  const handleShiftWindow = useCallback(async (dir: 'prev' | 'next') => {
    const dur = rangeEnd.getTime() - rangeStart.getTime();
    const shift = dir === 'prev' ? -dur : dur;
    const ns = new Date(rangeStart.getTime() + shift);
    const ne = new Date(rangeEnd.getTime() + shift);
    player.pause(); setRangeStart(ns); setRangeEnd(ne); setCurrentTime(ns);
    await player.loadChunk(ns);
  }, [rangeStart, rangeEnd, player]);

  const handleJumpToEvent = useCallback(async () => {
    if (player.isLoading || player.isProbing) return;
    if (player.isPlaying) player.pause();
    const inRange = getEventMarkerPercent(timestamp, rangeStart, rangeEnd) !== null;
    if (!inRange) {
      const { start, end } = buildEventCenteredRange(timestamp, RANGE_MS, new Date());
      setRangeStart(start); setRangeEnd(end);
    }
    setCurrentTime(timestamp);
    await player.seekToTime(timestamp);
  }, [player, timestamp, rangeStart, rangeEnd]);

  const ratioFromMouse = useCallback((e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
    const el = timelineRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return Math.min(1, Math.max(0, ((e as MouseEvent).clientX - rect.left) / rect.width));
  }, []);

  const timeFromRatio = useCallback((ratio: number) => {
    return new Date(rangeStart.getTime() + ratio * (rangeEnd.getTime() - rangeStart.getTime()));
  }, [rangeStart, rangeEnd]);

  const handleTimelineMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const ratio = ratioFromMouse(e);
    if (ratio === null) return;
    setHoverTime(timeFromRatio(ratio));
    setHoverPct(ratio * 100);
    if (isDragging) {
      const t = timeFromRatio(ratio);
      player.seekToTime(t);
    }
  }, [ratioFromMouse, timeFromRatio, isDragging, player]);

  const handleTimelineMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    if (player.isPlaying) player.pause();
    const ratio = ratioFromMouse(e);
    if (ratio !== null) player.seekToTime(timeFromRatio(ratio));

    const handleMove = (me: MouseEvent) => {
      const r = ratioFromMouse(me);
      if (r !== null) {
        const t = timeFromRatio(r);
        setHoverTime(t);
        setHoverPct(r * 100);
        player.seekToTime(t);
      }
    };
    const handleUp = (me: MouseEvent) => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      setIsDragging(false);
      const r = ratioFromMouse(me);
      if (r !== null) player.loadChunk(timeFromRatio(r));
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [ratioFromMouse, timeFromRatio, player]);

  // ── Computed display ──
  const sliderMin = rangeStart.getTime();
  const sliderMax = rangeEnd.getTime();
  const baseDisplay = player.currentTime || currentTime;
  const displayTime = !isDragging && syntheticTime ? syntheticTime : !isDragging && probePreviewTime ? probePreviewTime : baseDisplay;
  const sliderValue = Math.min(sliderMax, Math.max(sliderMin, displayTime?.getTime() ?? sliderMin));
  const eventMarkerPct = getEventMarkerPercent(timestamp, rangeStart, rangeEnd);
  const showSeekControls = !player.isPlaying && !player.isLoading && !player.isProbing;

  const baseUrl = `${window.location.protocol}//${config.ip}:${config.port}`;
  const hasChartData = !!cameraDetail?.save_objects;
  const eventTime = timestamp;

  return (
    <div className="flex flex-col gap-3" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
      <div className="flex flex-wrap gap-3" style={{ minHeight: 0 }}>
        {/* Video + Controls */}
        <div style={{ flex: '1 1 400px', minWidth: 0, display: 'flex', flexDirection: 'column', height: 420 }}>
          {/* Video */}
          <div style={{ position: 'relative', flex: 1, minHeight: 0, backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-base)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', display: player.currentChunkInfo ? 'block' : 'none' }} />
            {player.isLoading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="text-sm text-on-surface-disabled">Loading...</span>
              </div>
            )}
            {!player.currentChunkInfo && !player.isLoading && (
              <span className="text-sm text-on-surface-disabled">No recorded data at this time</span>
            )}
          </div>

          {/* Timeline + Controls */}
          <div className="mt-4" style={{ flexShrink: 0 }}>
            {/* Track row */}
            <div className="flex items-center gap-2 text-xs text-on-surface-disabled">
              <span>{formatTimeLabel(rangeStart)}</span>
              <div
                ref={timelineRef}
                className="relative flex-1"
                style={{ height: 16, cursor: 'pointer' }}
                onMouseDown={handleTimelineMouseDown}
                onMouseMove={handleTimelineMouseMove}
                onMouseLeave={() => { if (!isDragging) { setHoverTime(null); setHoverPct(null); } }}
              >
                {/* Tooltips above track */}
                {/* Current time badge — position controlled exclusively by ref */}
                <div ref={timeBadgeRef} style={{
                  position: 'absolute', bottom: '100%', left: '0%', transform: 'translateX(-50%)',
                  padding: '2px 6px', borderRadius: 3, fontSize: 10, whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-family-mono)', letterSpacing: 0,
                  backgroundColor: 'var(--color-primary)', color: '#fff', pointerEvents: 'none', marginBottom: 4,
                  zIndex: 3,
                }} />

                {/* Hover tooltip — only when hovering, above current badge if overlapping */}
                {hoverPct !== null && hoverTime && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 20px)', left: `${hoverPct}%`, transform: 'translateX(-50%)',
                    padding: '2px 6px', borderRadius: 3, fontSize: 10, whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-family-mono)', letterSpacing: 0,
                    backgroundColor: 'var(--color-surface-elevated)', color: 'var(--color-on-surface-secondary)',
                    border: '1px solid var(--color-border)', pointerEvents: 'none', zIndex: 4,
                  }}>
                    {formatTimeForSeekUnit(hoverTime, seekUnit)}
                  </div>
                )}

                {/* Track background */}
                <div style={{
                  position: 'absolute', top: '50%', marginTop: -2, left: 0, right: 0, height: 4,
                  backgroundColor: 'var(--color-surface-input)', borderRadius: 2, pointerEvents: 'none',
                }} />

                {/* Missing segments — same height as track, slightly different shade so visible behind progress */}
                {missingSegments.map((seg, i) => (
                  <span key={i} style={{
                    position: 'absolute', top: '50%', marginTop: -2, height: 4,
                    left: `${seg.left}%`, width: `${seg.width}%`,
                    backgroundColor: 'rgba(248, 113, 113, 0.5)',
                    borderRadius: 2, pointerEvents: 'none',
                  }} />
                ))}

                {/* Progress bar — position controlled exclusively by ref */}
                <div ref={progressRef} style={{
                  position: 'absolute', top: '50%', marginTop: -2, left: 0, height: 4,
                  width: '0%', backgroundColor: 'rgba(0, 108, 210, 0.5)',
                  borderRadius: 2, pointerEvents: 'none',
                }} />

                {/* Thumb — position controlled exclusively by ref */}
                <div ref={thumbRef} style={{
                  position: 'absolute', top: '50%', marginTop: -6, width: 12, height: 12,
                  left: '0%', transform: 'translateX(-50%)',
                  borderRadius: '50%', backgroundColor: 'var(--color-primary-hover)',
                  border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                  pointerEvents: 'none', zIndex: 2,
                }} />

                {/* Event marker */}
                {eventMarkerPct !== null && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void handleJumpToEvent(); }}
                    disabled={player.isLoading || player.isProbing}
                    style={{
                      position: 'absolute', top: -2, width: 8, height: 20,
                      left: `${eventMarkerPct}%`, transform: 'translateX(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0, zIndex: 3,
                    }}
                    title={formatTimeForSeekUnit(timestamp, seekUnit)}
                  >
                    <span style={{
                      display: 'block', width: 0, height: 0, margin: '0 auto',
                      borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
                      borderTop: '6px solid var(--color-warning)',
                    }} />
                  </button>
                )}
              </div>
              <span>{formatTimeLabel(rangeEnd)}</span>
            </div>

            {/* Controls — single row, 3-column grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginTop: 10 }}>
              {/* Left: Seek step — visibility toggle, no unmount */}
              <div className="flex items-center gap-2" style={{ visibility: showSeekControls ? 'visible' : 'hidden' }}>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={handlePrev} title={`-${seekStep} ${seekUnit}`}>
                  <Icon name="keyboard_double_arrow_left" className="icon-sm" />
                </button>
                <input
                  type="number" min={1} value={seekStepDraft}
                  onChange={e => { const v = e.target.value; if (v === '' || /^\d+$/.test(v)) setSeekStepDraft(v); }}
                  onBlur={() => { const n = Math.max(1, parseInt(seekStepDraft) || seekStep); setSeekStep(n); setSeekStepDraft(String(n)); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                  style={{ width: 44, height: 'var(--size-control-height-sm)', padding: '0 4px', fontSize: 11, textAlign: 'center' }}
                />
                <select
                  value={seekUnit} onChange={e => setSeekUnit(e.target.value as SeekUnit)}
                  style={{ height: 'var(--size-control-height-sm)', padding: '0 2px', fontSize: 10, paddingRight: 16, backgroundSize: '0.6rem' }}
                >
                  <option value="frame">FRM</option>
                  <option value="sec">SEC</option>
                  <option value="min">MIN</option>
                </select>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={handleNext} title={`+${seekStep} ${seekUnit}`}>
                  <Icon name="keyboard_double_arrow_right" className="icon-sm" />
                </button>
              </div>

              {/* Center: Playback — always centered */}
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleShiftWindow('prev')} title="Previous window">
                  <Icon name="skip_previous" className="icon-sm" />
                </button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { const ct = player.currentTime || currentTime; if (ct) player.seekToTime(new Date(Math.max(rangeStart.getTime(), ct.getTime() - 1000))); }} disabled={player.isProbing || player.isLoading} title="-1s">
                  <Icon name="keyboard_double_arrow_left" className="icon-sm" />
                </button>
                <button className="btn btn-primary btn-sm btn-icon" onClick={handlePlayToggle} disabled={player.isProbing}>
                  <Icon name={player.isPlaying ? 'pause' : 'play_arrow'} className="icon-sm" />
                </button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { const ct = player.currentTime || currentTime; if (ct) player.seekToTime(new Date(Math.min(rangeEnd.getTime(), ct.getTime() + 1000))); }} disabled={player.isProbing || player.isLoading} title="+1s">
                  <Icon name="keyboard_double_arrow_right" className="icon-sm" />
                </button>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleShiftWindow('next')} title="Next window">
                  <Icon name="skip_next" className="icon-sm" />
                </button>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 justify-self-end">
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => void handleJumpToEvent()} disabled={player.isProbing || player.isLoading} title="Jump to event">
                  <Icon name="timer" className="icon-sm" />
                </button>
                {hasChartData && (
                  <button className={`btn btn-sm btn-icon ${showChart ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setShowChart(v => { const next = !v; onChartToggle?.(next); return next; }); }} title="Toggle chart">
                    <Icon name="show_chart" className="icon-sm" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Chart (collapsible) */}
        {hasChartData && (
          <div style={{
            flex: showChart ? '1 1 400px' : '0 0 0px', minWidth: 0, overflow: 'hidden',
            opacity: showChart ? 1 : 0, transition: 'flex 0.3s ease, opacity 0.3s ease',
            display: 'flex', flexDirection: 'column', height: showChart ? 420 : 0,
          }}>
            {showChart && (
              <div style={{ flex: 1, minHeight: 0 }}>
                <EventSyncChart
                  cameraId={cameraId}
                  event={event}
                  eventTimestamp={eventTime}
                  currentTime={currentTime}
                  isPlaying={player.isPlaying}
                  cameraDetail={cameraDetail!}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  baseUrl={baseUrl}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// EventDetailModal
// ════════════════════════════════════════════════════════════════════

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CameraEvent | null;
  alias: string;
}

export default function EventDetailModal({ isOpen, onClose, event, alias }: EventDetailModalProps) {
  const [cameraDetail, setCameraDetail] = useState<CameraInfo | null>(null);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [config, setConfig] = useState<MediaServerConfig | null>(null);

  useEffect(() => {
    if (!alias) { setConfig(null); return; }
    let cancelled = false;
    getServer(alias)
      .then((s) => { if (!cancelled) setConfig(s); })
      .catch(() => { if (!cancelled) setConfig(null); });
    return () => { cancelled = true; };
  }, [alias]);

  useEffect(() => {
    if (!isOpen || !event?.camera_id) { setCameraDetail(null); return; }
    if (!config) return;
    getCamera(event.camera_id, config.ip, config.port).then(setCameraDetail).catch(() => setCameraDetail(null));
  }, [isOpen, event?.camera_id, config]);

  useEffect(() => {
    if (!isOpen) setIsChartOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  if (!isOpen || !event) return null;

  const counts = parseUsedCounts(event.used_counts_snapshot);
  const typeLabel = event.value_label || '';
  const eventTime = parseEventTime(event.time);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: isChartOpen ? '90vw' : 960, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', transition: 'max-width 0.3s ease' }}>
        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div className="modal-title">
            {typeLabel && <span className={`tag tag-${typeLabel.toLowerCase()}`}>{typeLabel}</span>}
            Event Detail
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '0 4px' }}>
            <Icon name="close" className="icon-sm" />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 'var(--font-size-sm)', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {/* Metadata */}
          <div className="data-list">
            <MetaItem label="Camera" value={event.camera_id} />
            <MetaItem label="Time" value={event.time} />
            {event.rule_name && <MetaItem label="Rule" value={event.rule_name} />}
          </div>
          {event.expression_text && (
            <div><span className="data-list-label">Expression</span> <code className="font-mono text-warning text-sm">{event.expression_text}</code></div>
          )}
          {Object.keys(counts).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="data-list-label">Detected</span>
              {Object.entries(counts).map(([k, v]) => <span key={k} className="badge badge-primary text-xs">{k}: {v}</span>)}
            </div>
          )}
          {cameraDetail && (
            <div className="data-list" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
              <MetaItem label="Camera Name" value={cameraDetail.name || '-'} />
              <MetaItem label="Status" value={cameraDetail.enabled ? 'Running' : 'Stopped'} />
              {cameraDetail.rtsp_url && <MetaItem label="RTSP" value={cameraDetail.rtsp_url} />}
            </div>
          )}

          {/* Video + Timeline + Controls + Chart */}
          {config && (
            <EventMediaSection
              cameraId={event.camera_id} timestamp={eventTime}
              cameraDetail={cameraDetail} event={event}
              config={config} alias={alias}
              onChartToggle={setIsChartOpen}
            />
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ marginTop: 16, flexShrink: 0 }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return <span className="inline-flex items-center gap-1"><span className="data-list-label">{label}</span><span>{value}</span></span>;
}
