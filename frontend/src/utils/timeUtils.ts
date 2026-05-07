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

const HM_PATTERN = /^\d{1,2}:\d{2}(:\d{2})?$/;

/**
 * Parse "HH:mm" or "HH:mm:ss" into [hh, mm] tuple, or null on invalid input.
 * Seconds are intentionally ignored (this util operates at minute precision).
 */
function parseHm(input: string): [number, number] | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!HM_PATTERN.test(trimmed)) return null;
  const parts = trimmed.split(':');
  const hh = Number.parseInt(parts[0] ?? '', 10);
  const mm = Number.parseInt(parts[1] ?? '', 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return [hh, mm];
}

function formatHm(hh: number, mm: number): string {
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * UTC HH:mm (or HH:mm:ss) → user local HH:mm.
 * Uses an epoch-fixed reference (1970-01-01) for DST-independent conversion.
 * Invalid input → "00:00".
 */
export function utcHHmmToLocal(input: string): string {
  const parsed = parseHm(input);
  if (!parsed) return '00:00';
  const [hh, mm] = parsed;
  const utcDate = new Date(Date.UTC(1970, 0, 1, hh, mm, 0));
  return formatHm(utcDate.getHours(), utcDate.getMinutes());
}

/**
 * User local HH:mm (or HH:mm:ss) → UTC HH:mm.
 * Uses an epoch-fixed reference (1970-01-01) for DST-independent conversion.
 * Invalid input → "00:00".
 */
export function localHHmmToUtc(input: string): string {
  const parsed = parseHm(input);
  if (!parsed) return '00:00';
  const [hh, mm] = parsed;
  const localDate = new Date(1970, 0, 1, hh, mm, 0);
  return formatHm(localDate.getUTCHours(), localDate.getUTCMinutes());
}

/**
 * Returns the current user timezone offset in "UTC+09:00" / "UTC-05:30" / "UTC" format.
 * Handles fractional offsets (e.g. India +05:30) via minute-level precision.
 */
export function getLocalTimezoneLabel(): string {
  const offsetMinutes = -new Date().getTimezoneOffset();
  if (offsetMinutes === 0) return 'UTC';
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = Math.floor(abs / 60);
  const mm = abs % 60;
  return `UTC${sign}${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
