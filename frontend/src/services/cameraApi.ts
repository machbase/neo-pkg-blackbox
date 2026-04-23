import type {
  CameraItem, CameraHealthResponse, CameraInfo, CameraEvent,
  CameraStatusResponse, CameraCreateRequest, CameraUpdateRequest,
  EventRuleItem, EventRuleCreateRequest, EventRuleUpdateRequest,
} from '../types/server';

function buildBaseUrl(ip: string, port: number): string {
  return `${window.location.protocol}//${ip}:${port}`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.success === false) throw new Error(body.reason || 'Request failed');
  return body.data ?? body;
}

// ── Cameras ──

export async function loadCameras(ip: string, port: number): Promise<CameraItem[]> {
  const base = buildBaseUrl(ip, port);
  const result = await fetchJson<CameraItem[] | { cameras?: CameraItem[] }>(`${base}/api/cameras`);
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.cameras)) return result.cameras;
  return [];
}

export async function getCamera(id: string, ip: string, port: number): Promise<CameraInfo> {
  const base = buildBaseUrl(ip, port);
  return fetchJson<CameraInfo>(`${base}/api/camera/${encodeURIComponent(id)}`);
}

export async function getCameraStatus(id: string, ip: string, port: number): Promise<CameraStatusResponse> {
  const base = buildBaseUrl(ip, port);
  return fetchJson<CameraStatusResponse>(`${base}/api/camera/${encodeURIComponent(id)}/status`);
}

export async function createCamera(data: CameraCreateRequest, ip: string, port: number): Promise<CameraInfo> {
  const base = buildBaseUrl(ip, port);
  return fetchJson<CameraInfo>(`${base}/api/camera`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateCamera(id: string, data: CameraUpdateRequest, ip: string, port: number): Promise<void> {
  const base = buildBaseUrl(ip, port);
  await fetchJson(`${base}/api/camera/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteCamera(id: string, ip: string, port: number): Promise<void> {
  const base = buildBaseUrl(ip, port);
  await fetchJson(`${base}/api/camera/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function enableCamera(id: string, ip: string, port: number): Promise<void> {
  const base = buildBaseUrl(ip, port);
  await fetchJson(`${base}/api/camera/${encodeURIComponent(id)}/enable`, { method: 'POST' });
}

export async function disableCamera(id: string, ip: string, port: number): Promise<void> {
  const base = buildBaseUrl(ip, port);
  await fetchJson(`${base}/api/camera/${encodeURIComponent(id)}/disable`, { method: 'POST' });
}

// ── Health ──

export async function getCamerasHealth(ip: string, port: number): Promise<CameraHealthResponse> {
  const base = buildBaseUrl(ip, port);
  const result = await fetchJson<CameraHealthResponse>(`${base}/api/cameras/health`);
  return {
    cameras: Array.isArray(result.cameras) ? result.cameras : [],
    running: result.running ?? 0,
    stopped: result.stopped ?? 0,
    total: result.total ?? 0,
  };
}

// ── Detect Objects ──

export async function getDetectObjects(ip: string, port: number): Promise<string[]> {
  const base = buildBaseUrl(ip, port);
  const result = await fetchJson<{ detect_objects?: string[] }>(`${base}/api/detect_objects`);
  return result.detect_objects ?? [];
}

export async function getCameraDetectObjects(id: string, ip: string, port: number): Promise<string[]> {
  const base = buildBaseUrl(ip, port);
  const result = await fetchJson<{ detect_objects?: string[] }>(`${base}/api/camera/${encodeURIComponent(id)}/detect_objects`);
  return result.detect_objects ?? [];
}

export async function updateCameraDetectObjects(id: string, objects: string[], ip: string, port: number): Promise<void> {
  const base = buildBaseUrl(ip, port);
  await fetchJson(`${base}/api/camera/${encodeURIComponent(id)}/detect_objects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ detect_objects: objects }),
  });
}

// ── Models ──

export async function getModels(ip: string, port: number): Promise<{ id: number; name: string }[]> {
  const base = buildBaseUrl(ip, port);
  const result = await fetchJson<{ models?: { id: number; name: string }[] }>(`${base}/api/models`);
  return result.models ?? [];
}

// ── Tables ──

export async function getTables(ip: string, port: number): Promise<string[]> {
  const base = buildBaseUrl(ip, port);
  const result = await fetchJson<{ tables?: string[] }>(`${base}/api/tables`);
  return result.tables ?? [];
}

export async function createTable(name: string, ip: string, port: number): Promise<void> {
  const base = buildBaseUrl(ip, port);
  await fetchJson(`${base}/api/table`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

// ── Events ──

export async function getCameraEventCount(ip: string, port: number): Promise<number> {
  const base = buildBaseUrl(ip, port);
  const data = await fetchJson<{ count?: number }>(`${base}/api/camera_events/count`);
  return data.count ?? 0;
}

export interface EventQueryParams {
  camera_id?: string;
  event_type?: string;
  event_name?: string;
  start_time?: string;
  end_time?: string;
  size?: number;
  page?: number;
}

export interface EventQueryResult {
  events: CameraEvent[];
  total_count: number;
  total_pages: number;
}

export async function queryCameraEvents(params: EventQueryParams, ip: string, port: number): Promise<EventQueryResult> {
  const base = buildBaseUrl(ip, port);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const result = await fetchJson<EventQueryResult | CameraEvent[]>(`${base}/api/camera_events?${qs.toString()}`);
  if (Array.isArray(result)) {
    return { events: result, total_count: result.length, total_pages: 1 };
  }
  return {
    events: Array.isArray(result.events) ? result.events : [],
    total_count: result.total_count ?? 0,
    total_pages: result.total_pages ?? 1,
  };
}

// ── Event Rules ──

export async function getEventRules(cameraId: string, ip: string, port: number): Promise<EventRuleItem[]> {
  const base = buildBaseUrl(ip, port);
  const result = await fetchJson<EventRuleItem[] | { event_rules?: EventRuleItem[]; rules?: EventRuleItem[] }>(
    `${base}/api/event_rule/${encodeURIComponent(cameraId)}`
  );
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.event_rules)) return result.event_rules;
  if (result && Array.isArray(result.rules)) return result.rules;
  return [];
}

export async function createEventRule(data: EventRuleCreateRequest, ip: string, port: number): Promise<void> {
  const base = buildBaseUrl(ip, port);
  await fetchJson(`${base}/api/event_rule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateEventRule(
  cameraId: string, ruleId: string, data: EventRuleUpdateRequest, ip: string, port: number,
): Promise<void> {
  const base = buildBaseUrl(ip, port);
  await fetchJson(`${base}/api/event_rule/${encodeURIComponent(cameraId)}/${encodeURIComponent(ruleId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteEventRule(cameraId: string, ruleId: string, ip: string, port: number): Promise<void> {
  const base = buildBaseUrl(ip, port);
  await fetchJson(`${base}/api/event_rule/${encodeURIComponent(cameraId)}/${encodeURIComponent(ruleId)}`, {
    method: 'DELETE',
  });
}

// ── Ping ──

export async function pingCamera(targetIp: string, ip: string, port: number): Promise<{ alive: boolean; latency?: string }> {
  const base = buildBaseUrl(ip, port);
  const result = await fetchJson<{ alive: boolean; latency?: string }>(`${base}/api/camera/ping?ip=${encodeURIComponent(targetIp)}`);
  return result;
}

// ── Heartbeat ──

export async function getHeartbeat(ip: string, port: number): Promise<boolean> {
  const base = buildBaseUrl(ip, port);
  try {
    const result = await fetchJson<{ healthy?: boolean }>(`${base}/api/media/heartbeat`);
    return result.healthy ?? false;
  } catch {
    return false;
  }
}
