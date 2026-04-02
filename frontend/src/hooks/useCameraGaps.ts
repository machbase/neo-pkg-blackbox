// Camera Data Gaps Hook — ported from neo-web useCameraRollupGaps

import { useEffect, useMemo, useState } from 'react';
import { getCameraDataGaps } from '../services/videoApi';
import { parseTimestamp } from '../utils/timeUtils';

export interface TimelineGapSegment {
  left: number;
  width: number;
}

function getIntervalSeconds(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (ms <= 3600_000) return 8;
  if (ms <= 3 * 3600_000) return 15;
  if (ms <= 12 * 3600_000) return 60;
  if (ms <= 24 * 3600_000) return 120;
  if (ms <= 3 * 24 * 3600_000) return 300;
  return 900;
}

function buildSegments(missingTimes: string[], start: Date, end: Date, intervalSec: number): TimelineGapSegment[] {
  const totalMs = end.getTime() - start.getTime();
  const intervalMs = Math.max(1, intervalSec) * 1000;
  if (totalMs <= 0 || !missingTimes.length) return [];

  const points = missingTimes.map(parseTimestamp).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
  if (!points.length) return [];

  const segments: TimelineGapSegment[] = [];
  let segStart = points[0].getTime();
  let prev = points[0].getTime();

  const push = (s: number, e: number) => {
    const rs = Math.max(s, start.getTime());
    const re = Math.min(e, end.getTime());
    if (re > rs) {
      const left = ((rs - start.getTime()) / totalMs) * 100;
      const width = ((re - rs) / totalMs) * 100;
      segments.push({ left: Math.max(0, Math.min(100, left)), width: Math.max(0.2, Math.min(100, width)) });
    }
  };

  for (let i = 1; i < points.length; i++) {
    const cur = points[i].getTime();
    if (cur - prev > intervalMs) {
      push(segStart, prev + intervalMs);
      segStart = cur;
    }
    prev = cur;
  }
  push(segStart, prev + intervalMs);

  return segments;
}

export function useCameraGaps(
  cameraId: string | null, start: Date | null, end: Date | null,
  ip: string, port: number, enabled = true,
): TimelineGapSegment[] {
  const [missingTimes, setMissingTimes] = useState<string[]>([]);
  const [interval, setInterval_] = useState(8);

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !cameraId || !start || !end || end.getTime() <= start.getTime()) {
      setMissingTimes([]); return;
    }
    const reqInterval = getIntervalSeconds(start, end);
    getCameraDataGaps(cameraId, start.toISOString(), end.toISOString(), reqInterval, ip, port)
      .then((res) => {
        if (cancelled) return;
        const effectiveInterval = Number.isFinite(res.interval) && res.interval > 0 ? res.interval : reqInterval;
        setMissingTimes(Array.isArray(res.missing_times) ? res.missing_times : []);
        setInterval_(effectiveInterval);
      });
    return () => { cancelled = true; };
  }, [cameraId, start?.getTime(), end?.getTime(), enabled, ip, port]);

  return useMemo(() => {
    if (!enabled || !start || !end || end.getTime() <= start.getTime()) return [];
    return buildSegments(missingTimes, start, end, interval);
  }, [missingTimes, interval, start?.getTime(), end?.getTime(), enabled]);
}
