// Chunk-based Video Player Hook — ported from neo-web useVideoPlayer
// MSE (Media Source Extensions) playback with chunk management

import { useRef, useCallback, useEffect, useState } from 'react';
import type { ChunkInfo } from '../types/server';
import { getChunkInfo as apiGetChunkInfo, getChunkData, getInitSegment } from '../services/videoApi';
import { parseTimestamp, formatIsoWithMs } from '../utils/timeUtils';

interface ChunkPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  isProbing: boolean;
  currentTime: Date | null;
  currentChunkInfo: ChunkInfo | null;
  fps: number | null;
}

interface BufferedChunk {
  startIso: string;
  chunkInfo: ChunkInfo;
  bufferStart: number;
  bufferEnd: number;
}

interface UseChunkPlayerOptions {
  /** High-frequency callback for DOM-direct updates (every timeupdate, ~4-60Hz). Never triggers React render. */
  onPlaybackTick?: (timeMs: number, rangeStartMs: number, rangeEndMs: number) => void;
  /** Low-frequency callback for React state consumers (chart marker, etc). Throttled to ~200ms. */
  onTimeUpdate?: (time: Date) => void;
  onProbeProgress?: (time: Date) => void;
  onProbeStateChange?: (isProbing: boolean) => void;
}

export function useChunkPlayer(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  camera: string | null,
  endTime: Date | null,
  ip: string,
  port: number,
  options: UseChunkPlayerOptions = {},
) {
  const NEGATIVE_CACHE_TTL = 5000;
  const THROTTLE_MS = 300;
  const STATE_SYNC_MS = 200;
  const { onPlaybackTick, onTimeUpdate, onProbeProgress, onProbeStateChange } = options;

  const [state, setState] = useState<ChunkPlayerState>({
    isPlaying: false, isLoading: false, isProbing: false,
    currentTime: null, currentChunkInfo: null, fps: null,
  });

  // Refs
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const chunkCacheRef = useRef<Map<string, ArrayBuffer>>(new Map());
  const chunkNegCacheRef = useRef<Map<string, number>>(new Map());
  const chunkInfoCacheRef = useRef<Map<string, ChunkInfo>>(new Map());
  const initSegRef = useRef<ArrayBuffer | null>(null);
  const bufferedChunksRef = useRef<BufferedChunk[]>([]);
  const baselineRef = useRef(0);
  const objUrlRef = useRef<string | null>(null);
  const tokenRef = useRef(0);
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTimeRef = useRef<Date | null>(null);
  const prefetchedRef = useRef(false);
  const noMoreRef = useRef(false);
  const isPlayingRef = useRef(false);
  const playInFlightRef = useRef(false);
  const lastStateSyncRef = useRef(0);
  const probeCancelRef = useRef(0);
  const probeCountRef = useRef(0);

  // ── Helpers ──

  const parseChunkResponse = useCallback((cam: string, raw: any): ChunkInfo | null => {
    if (!raw?.time) return null;
    const start = parseTimestamp(raw.time);
    if (!start) return null;
    let dur = Number(raw.duration) || 0;
    let lenUs = Number(raw.length) || 0;
    if (lenUs > 1000) dur = lenUs / 1_000_000;
    else if (dur <= 0 && lenUs > 0) { dur = lenUs; lenUs = Math.round(lenUs * 1_000_000); }
    const startIso = formatIsoWithMs(start);
    return {
      camera: cam, start, startIso, duration: dur,
      end: new Date(start.getTime() + Math.max(dur, 0) * 1000),
      lengthMicroseconds: lenUs, sign: raw.sign ?? null, cacheToken: startIso,
    };
  }, []);

  const fetchInfo = useCallback(async (cam: string, t: Date): Promise<ChunkInfo | null> => {
    const iso = formatIsoWithMs(t);
    const key = `${cam}::${iso}`;
    const cached = chunkInfoCacheRef.current.get(key);
    if (cached) return cached;
    try {
      const data = await apiGetChunkInfo(cam, iso, ip, port);
      const info = parseChunkResponse(cam, data);
      if (info) { chunkInfoCacheRef.current.set(key, info); chunkInfoCacheRef.current.set(`${cam}::${info.startIso}`, info); }
      return info;
    } catch (e: any) {
      if (e.message?.includes('404')) return null;
      throw e;
    }
  }, [ip, port, parseChunkResponse]);

  const fetchBuffer = useCallback(async (cam: string, chunkIso: string): Promise<ArrayBuffer | null> => {
    const key = `${cam}::${chunkIso}`;
    const cached = chunkCacheRef.current.get(key);
    if (cached) return cached;
    const blocked = chunkNegCacheRef.current.get(key);
    if (blocked && blocked > Date.now()) return null;
    const buf = await getChunkData(cam, chunkIso, ip, port);
    if (buf) { chunkCacheRef.current.set(key, buf); chunkNegCacheRef.current.delete(key); }
    else chunkNegCacheRef.current.set(key, Date.now() + NEGATIVE_CACHE_TTL);
    return buf;
  }, [ip, port]);

  const fetchInit = useCallback(async (cam: string): Promise<ArrayBuffer | null> => {
    if (initSegRef.current) return initSegRef.current;
    const buf = await getInitSegment(cam, ip, port);
    if (buf) initSegRef.current = buf;
    return buf;
  }, [ip, port]);

  const appendBuf = useCallback((sb: SourceBuffer, data: ArrayBuffer): Promise<void> => {
    return new Promise((resolve, reject) => {
      const ok = () => { sb.removeEventListener('updateend', ok); sb.removeEventListener('error', fail); resolve(); };
      const fail = () => { sb.removeEventListener('updateend', ok); sb.removeEventListener('error', fail); reject(new Error('SourceBuffer error')); };
      sb.addEventListener('updateend', ok); sb.addEventListener('error', fail);
      try { sb.appendBuffer(data); } catch (e) { sb.removeEventListener('updateend', ok); sb.removeEventListener('error', fail); reject(e); }
    });
  }, []);

  const resetPipeline = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (objUrlRef.current) { try { URL.revokeObjectURL(objUrlRef.current); } catch {} objUrlRef.current = null; }
    v.pause(); v.removeAttribute('src'); v.src = ''; v.load();
    mediaSourceRef.current = null; sourceBufferRef.current = null; bufferedChunksRef.current = [];
  }, [videoRef]);

  // ── Load Chunk ──

  const loadChunk = useCallback(async (targetTime: Date): Promise<boolean> => {
    if (!camera || !videoRef.current) return false;
    const token = ++tokenRef.current;
    // Only set isLoading; don't override currentTime — during playback the
    // timeupdate handler owns currentTime and jumping it here causes the
    // thumb to flicker forward then snap back.
    setState(p => ({ ...p, isLoading: true }));

    try {
      resetPipeline();
      await new Promise(r => setTimeout(r, 10));
      if (token !== tokenRef.current) return false;

      const info = await fetchInfo(camera, targetTime);
      if (!info) { if (token === tokenRef.current) setState(p => ({ ...p, isLoading: false, currentChunkInfo: null })); return false; }
      if (token !== tokenRef.current) return false;

      const [initSeg, chunkData] = await Promise.all([fetchInit(camera), fetchBuffer(camera, info.startIso)]);
      if (!initSeg || !chunkData || token !== tokenRef.current) { if (token === tokenRef.current) setState(p => ({ ...p, isLoading: false })); return false; }

      const ms = new MediaSource();
      const url = URL.createObjectURL(ms);
      objUrlRef.current = url; mediaSourceRef.current = ms;
      videoRef.current.src = url;

      await new Promise<void>((res, rej) => {
        const t = setTimeout(() => rej(new Error('MediaSource timeout')), 5000);
        ms.addEventListener('sourceopen', () => { clearTimeout(t); res(); }, { once: true });
      });
      if (token !== tokenRef.current) return false;

      const mime = 'video/mp4; codecs="avc1.4d401f"';
      if (!MediaSource.isTypeSupported(mime)) throw new Error('Unsupported codec');
      const sb = ms.addSourceBuffer(mime);
      sourceBufferRef.current = sb;
      try { sb.mode = 'sequence'; } catch { sb.timestampOffset = 0; }

      await appendBuf(sb, initSeg.slice(0));
      await appendBuf(sb, chunkData.slice(0));

      const bStart = sb.buffered.length > 0 ? sb.buffered.start(0) : 0;
      const bEnd = sb.buffered.length > 0 ? sb.buffered.end(0) : 0;
      baselineRef.current = bStart;

      let seek = bStart + Math.max(0, (targetTime.getTime() - info.start.getTime()) / 1000);
      seek = Math.min(Math.max(bStart, bEnd - 0.05), Math.max(bStart, seek));
      if (Number.isFinite(seek) && videoRef.current) videoRef.current.currentTime = seek;

      try { ms.endOfStream(); } catch {}

      bufferedChunksRef.current = [{ startIso: info.startIso, chunkInfo: info, bufferStart: bStart, bufferEnd: bEnd }];
      noMoreRef.current = false;

      if (token === tokenRef.current) setState(p => ({ ...p, currentChunkInfo: info, currentTime: targetTime, isLoading: false }));
      onTimeUpdate?.(targetTime);
      return true;
    } catch {
      if (token === tokenRef.current) setState(p => ({ ...p, isLoading: false }));
      return false;
    }
  }, [camera, videoRef, fetchInfo, fetchInit, fetchBuffer, appendBuf, resetPipeline, onTimeUpdate]);

  // ── Seek ──

  // Use ref for currentChunkInfo to avoid stale closure in seekToTime
  const currentChunkInfoRef = useRef(state.currentChunkInfo);
  useEffect(() => { currentChunkInfoRef.current = state.currentChunkInfo; }, [state.currentChunkInfo]);

  const seekToTime = useCallback(async (targetTime: Date) => {
    // Always update displayed time immediately
    setState(p => ({ ...p, currentTime: targetTime }));
    onTimeUpdate?.(targetTime);
    if (!camera || !videoRef.current) return;

    // Check if target is within current chunk (use ref to avoid stale closure)
    const cur = currentChunkInfoRef.current;
    if (cur && sourceBufferRef.current?.buffered.length && videoRef.current.readyState >= 2) {
      const tMs = targetTime.getTime();
      if (tMs >= cur.start.getTime() && tMs < cur.end.getTime()) {
        const off = (tMs - cur.start.getTime()) / 1000;
        const bEnd = sourceBufferRef.current.buffered.end(0);
        const target = Math.min(Math.max(baselineRef.current, bEnd - 0.05), baselineRef.current + off);
        if (Number.isFinite(target)) videoRef.current.currentTime = target;
        return;
      }
    }

    // Cross-chunk seek — throttle to prevent rapid loadChunk calls during drag
    pendingTimeRef.current = targetTime;
    if (!throttleRef.current) {
      pendingTimeRef.current = null;
      loadChunk(targetTime);
      throttleRef.current = setTimeout(() => {
        const pending = pendingTimeRef.current;
        throttleRef.current = null;
        pendingTimeRef.current = null;
        if (pending) loadChunk(pending);
      }, THROTTLE_MS);
    }
    // If throttle is active, pendingTimeRef holds the latest value.
    // When throttle fires, it will loadChunk with the most recent pending time.
  }, [camera, videoRef, loadChunk, onTimeUpdate]);

  // ── Probe next chunk ──

  const findNextChunk = useCallback(async (fromTime: Date): Promise<ChunkInfo | null> => {
    if (!camera) return null;
    const cancelToken = probeCancelRef.current;
    probeCountRef.current += 1;
    setState(p => ({ ...p, isProbing: true }));
    onProbeStateChange?.(true);

    let ms = fromTime.getTime() + 1000;
    const endMs = endTime ? endTime.getTime() : ms + 3600_000;

    try {
      while (ms <= endMs) {
        if (cancelToken !== probeCancelRef.current) return null;
        onProbeProgress?.(new Date(ms));
        const info = await fetchInfo(camera, new Date(ms));
        if (cancelToken !== probeCancelRef.current) return null;
        if (!info) { ms += 1000; continue; }
        const buf = await fetchBuffer(camera, info.startIso);
        if (cancelToken !== probeCancelRef.current) return null;
        if (buf) return info;
        ms = Math.max(ms + 1000, info.end.getTime() + 1000);
      }
      return null;
    } finally {
      probeCountRef.current = Math.max(0, probeCountRef.current - 1);
      if (probeCountRef.current === 0) {
        setState(p => ({ ...p, isProbing: false }));
        onProbeStateChange?.(false);
      }
    }
  }, [camera, endTime, fetchInfo, fetchBuffer, onProbeProgress, onProbeStateChange]);

  // ── Append next chunk (seamless) ──

  const appendNext = useCallback(async (nextInfo: ChunkInfo): Promise<boolean> => {
    if (!camera || !videoRef.current || !sourceBufferRef.current || !mediaSourceRef.current) return false;
    // Don't set isLoading — seamless append shouldn't pause timeupdate tracking
    try {
      const data = await fetchBuffer(camera, nextInfo.startIso);
      if (!data) return false;
      const prevEnd = sourceBufferRef.current.buffered.length > 0
        ? sourceBufferRef.current.buffered.end(sourceBufferRef.current.buffered.length - 1) : 0;
      await appendBuf(sourceBufferRef.current, data);
      const newEnd = sourceBufferRef.current.buffered.length > 0
        ? sourceBufferRef.current.buffered.end(sourceBufferRef.current.buffered.length - 1) : prevEnd;
      bufferedChunksRef.current.push({ startIso: nextInfo.startIso, chunkInfo: nextInfo, bufferStart: prevEnd, bufferEnd: newEnd });
      noMoreRef.current = false;
      return true;
    } catch {
      return false;
    }
  }, [camera, videoRef, fetchBuffer, appendBuf]);

  // ── Play / Pause ──

  const play = useCallback(async () => {
    if (!videoRef.current || !camera || playInFlightRef.current) return;
    playInFlightRef.current = true;
    try {
      const t = state.currentTime ?? endTime;
      if (!t) return;
      const cur = state.currentChunkInfo;
      const inChunk = !!cur && t.getTime() >= cur.start.getTime() && t.getTime() < cur.end.getTime();
      if (!inChunk) {
        const loaded = await loadChunk(t);
        if (!loaded) {
          const next = await findNextChunk(t);
          if (!next) { setState(p => ({ ...p, isPlaying: false })); return; }
          const ok = await loadChunk(next.start);
          if (!ok) return;
        }
      }
      await videoRef.current.play();
      setState(p => ({ ...p, isPlaying: true }));
    } catch {} finally { playInFlightRef.current = false; }
  }, [videoRef, camera, state.currentTime, state.currentChunkInfo, endTime, loadChunk, findNextChunk]);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setState(p => p.isPlaying ? { ...p, isPlaying: false } : p);
  }, [videoRef]);

  // ── Time update handler ──
  // Split into two paths:
  // 1. onPlaybackTick — every timeupdate, for DOM-direct updates (no React render)
  // 2. setState + onTimeUpdate — throttled to STATE_SYNC_MS, for React consumers

  const resolveVideoTime = useCallback((): { timeMs: number; chunk: BufferedChunk } | null => {
    const v = videoRef.current;
    if (!v) return null;
    const ct = v.currentTime;
    const chunks = bufferedChunksRef.current;
    let chunk = chunks.find(c => ct >= c.bufferStart && ct < c.bufferEnd);
    if (!chunk) chunk = chunks.find(c => ct >= c.bufferStart - 0.1 && ct < c.bufferEnd + 0.1);
    if (!chunk) return null;
    const elapsed = Math.max(0, ct - chunk.bufferStart);
    return { timeMs: chunk.chunkInfo.start.getTime() + elapsed * 1000, chunk };
  }, [videoRef]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handle = () => {
      if (state.isLoading) return;
      const resolved = resolveVideoTime();
      if (!resolved) return;
      const { timeMs, chunk } = resolved;

      // 1. High-frequency: DOM-direct update (no React render)
      onPlaybackTick?.(timeMs, 0, 0);

      // 2. Low-frequency: React state sync (throttled)
      const now = Date.now();
      if (now - lastStateSyncRef.current >= STATE_SYNC_MS) {
        lastStateSyncRef.current = now;
        const videoTime = new Date(timeMs);
        setState(p => ({ ...p, currentTime: videoTime, currentChunkInfo: chunk.chunkInfo }));
        onTimeUpdate?.(videoTime);
      }

      // End-of-range check
      if (endTime && timeMs >= endTime.getTime()) {
        v.pause();
        setState(p => ({ ...p, isPlaying: false, currentTime: endTime }));
        return;
      }

      // Prefetch logic
      if (isPlayingRef.current) {
        const ct = v.currentTime;
        const remaining = chunk.bufferEnd - ct;
        const last = bufferedChunksRef.current[bufferedChunksRef.current.length - 1];
        const isLast = chunk.startIso === last.startIso;
        if (isLast && noMoreRef.current && remaining <= 0.05) {
          v.pause(); setState(p => ({ ...p, isPlaying: false })); return;
        }
        if (isLast && remaining <= 3 && !prefetchedRef.current) prefetchNext();
      }
    };
    v.addEventListener('timeupdate', handle);
    return () => v.removeEventListener('timeupdate', handle);
  }, [videoRef, state.isLoading, endTime, resolveVideoTime, onPlaybackTick, onTimeUpdate]);

  const prefetchNext = useCallback(async () => {
    if (!camera || prefetchedRef.current || bufferedChunksRef.current.length === 0) return;
    const last = bufferedChunksRef.current[bufferedChunksRef.current.length - 1];
    prefetchedRef.current = true;
    try {
      const info = await findNextChunk(last.chunkInfo.end);
      if (info && !bufferedChunksRef.current.some(c => c.startIso === info.startIso)) {
        await appendNext(info);
      } else {
        noMoreRef.current = true;
        try { if (mediaSourceRef.current?.readyState === 'open') mediaSourceRef.current.endOfStream(); } catch {}
      }
    } catch {} finally { prefetchedRef.current = false; }
  }, [camera, findNextChunk, appendNext]);

  // ── Ended handler ──

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handle = async () => {
      const wasPlaying = isPlayingRef.current;
      const last = bufferedChunksRef.current[bufferedChunksRef.current.length - 1];
      if (last && endTime && last.chunkInfo.end.getTime() >= endTime.getTime()) {
        setState(p => ({ ...p, isPlaying: false })); return;
      }
      if (wasPlaying && last) {
        const next = await findNextChunk(last.chunkInfo.end);
        if (next) {
          const ok = await loadChunk(next.start);
          if (ok && videoRef.current) { try { await videoRef.current.play(); setState(p => ({ ...p, isPlaying: true })); } catch {} }
          return;
        }
      }
      setState(p => ({ ...p, isPlaying: false }));
    };
    v.addEventListener('ended', handle);
    return () => v.removeEventListener('ended', handle);
  }, [videoRef, endTime, findNextChunk, loadChunk]);

  useEffect(() => { isPlayingRef.current = state.isPlaying; }, [state.isPlaying]);

  // ── Cleanup ──

  useEffect(() => {
    return () => {
      if (throttleRef.current) clearTimeout(throttleRef.current);
      probeCancelRef.current += 1; probeCountRef.current = 0;
      resetPipeline();
    };
  }, [resetPipeline]);

  useEffect(() => {
    chunkCacheRef.current.clear(); chunkNegCacheRef.current.clear(); chunkInfoCacheRef.current.clear();
    initSegRef.current = null; noMoreRef.current = false;
    probeCancelRef.current += 1; probeCountRef.current = 0;
    resetPipeline();
    setState({ isPlaying: false, isLoading: false, isProbing: false, currentTime: null, currentChunkInfo: null, fps: null });
  }, [camera, resetPipeline]);

  return { ...state, play, pause, loadChunk, seekToTime };
}
