// Video Chunk API — ported from neo-web

function buildBaseUrl(ip: string, port: number): string {
  return `${window.location.protocol}//${ip}:${port}`;
}

// ── Chunk Info ──

export interface ChunkInfoResponse {
  camera?: string;
  time: string;
  duration?: number;
  length?: number;
  sign?: string | null;
}

interface ChunkInfoEnvelope {
  success: boolean;
  reason: string;
  data?: ChunkInfoResponse | null;
}

export async function getChunkInfo(
  camera: string, time: string, ip: string, port: number,
): Promise<ChunkInfoResponse | null> {
  const base = buildBaseUrl(ip, port);
  const params = new URLSearchParams({ tagname: camera, time });
  const res = await fetch(`${base}/api/get_chunk_info?${params}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`HTTP ${res.status}`);
  }
  const body: ChunkInfoEnvelope = await res.json();
  const data = body.data;
  return data && typeof data.time === 'string' ? data : null;
}

// ── Chunk Binary Data ──

export async function getChunkData(
  camera: string, time: string, ip: string, port: number,
): Promise<ArrayBuffer | null> {
  const base = buildBaseUrl(ip, port);
  const params = new URLSearchParams({ tagname: camera, time });
  const res = await fetch(`${base}/api/v_get_chunk?${params}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`HTTP ${res.status}`);
  }
  return res.arrayBuffer();
}

// ── Init Segment (time=0) ──

export async function getInitSegment(
  camera: string, ip: string, port: number,
): Promise<ArrayBuffer | null> {
  const base = buildBaseUrl(ip, port);
  const params = new URLSearchParams({ tagname: camera, time: '0' });
  const res = await fetch(`${base}/api/v_get_chunk?${params}`);
  if (!res.ok) return null;
  return res.arrayBuffer();
}

// ── Time Range ──

export interface TimeRangeResponse {
  start: string;
  end: string;
  chunk_duration_seconds?: number;
  fps?: number;
}

interface TimeRangeEnvelope {
  success: boolean;
  reason: string;
  data?: TimeRangeResponse | null;
}

export async function getTimeRange(
  camera: string, ip: string, port: number,
): Promise<TimeRangeResponse | null> {
  const base = buildBaseUrl(ip, port);
  const params = new URLSearchParams({ tagname: camera });
  const res = await fetch(`${base}/api/get_time_range?${params}`);
  if (!res.ok) return null;
  const body: TimeRangeEnvelope = await res.json();
  const data = body.data;
  return data && typeof data.start === 'string' && typeof data.end === 'string' ? data : null;
}

// ── Data Gaps ──

export interface CameraDataGapsResponse {
  camera_id: string;
  start_time: string;
  end_time: string;
  interval: number;
  total_gaps: number;
  missing_times: string[];
}

export async function getCameraDataGaps(
  cameraId: string, startTime: string, endTime: string, intervalSeconds: number,
  ip: string, port: number,
): Promise<CameraDataGapsResponse> {
  const base = buildBaseUrl(ip, port);
  const params = new URLSearchParams({
    camera_id: cameraId, start_time: startTime, end_time: endTime, interval: String(intervalSeconds),
  });
  try {
    const res = await fetch(`${base}/api/data_gaps?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const data = body.data ?? body;
    if (data && Array.isArray(data.missing_times)) return data;
  } catch {}
  return { camera_id: cameraId, start_time: startTime, end_time: endTime, interval: intervalSeconds, total_gaps: 0, missing_times: [] };
}
