// Event Playback Utilities — ported from neo-web

export const DEFAULT_FPS = 30;
export type SeekUnit = 'frame' | 'sec' | 'min';

export function resolveEffectiveFps(fps: number | null | undefined): number {
  return Number.isFinite(fps) && (fps as number) > 0 ? (fps as number) : DEFAULT_FPS;
}

export function getEventMarkerPercent(eventTime: Date | null, rangeStart: Date | null, rangeEnd: Date | null): number | null {
  if (!eventTime || !rangeStart || !rangeEnd) return null;
  const s = rangeStart.getTime(), e = rangeEnd.getTime(), ev = eventTime.getTime();
  if (e <= s || ev < s || ev > e) return null;
  return ((ev - s) / (e - s)) * 100;
}

export function buildEventCenteredRange(eventTime: Date, rangeMs: number, now = new Date()) {
  const start = new Date(eventTime.getTime() - rangeMs);
  const end = new Date(Math.min(eventTime.getTime() + rangeMs, now.getTime()));
  return { start, end: new Date(Math.max(start.getTime(), end.getTime())) };
}

export function formatTimeWithMs(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return '--:--:--.---';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function formatTimeForSeekUnit(date: Date | null, unit: SeekUnit): string {
  if (!date || Number.isNaN(date.getTime())) return unit === 'frame' ? '--:--:--.---' : '--:--:--';
  if (unit === 'frame') return formatTimeWithMs(date);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
