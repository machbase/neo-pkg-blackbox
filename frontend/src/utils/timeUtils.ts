// Video Time Utilities — ported from neo-web

/**
 * Parse timestamp string to Date
 */
export function parseTimestamp(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getTime());
  const normalized = typeof value === 'string' ? value.trim() : String(value);
  if (!normalized) return null;
  const iso = normalized.includes('T') ? normalized : normalized.replace(' ', 'T');
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format Date to ISO string with milliseconds (local time)
 */
export function formatIsoWithMs(date: Date | null): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}.${ms}`;
}

/**
 * Format time label (HH:mm:ss)
 */
export function formatTimeLabel(date: Date | null): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '--:--:--';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Get frame duration in milliseconds based on FPS
 */
export function getFrameDurationMs(fps: number | null): number {
  return fps && fps > 0 ? 1000 / fps : 1000 / 30;
}
