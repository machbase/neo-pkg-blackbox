export interface MediaServerConfig {
  ip: string;
  port: number;
  alias: string;
}

export interface CameraItem {
  id: string;
  label?: string;
}

export type CameraStatusType = 'stopped' | 'running';

export interface CameraStatusResponse {
  name: string;
  status: CameraStatusType;
  pid?: number;
  uptime?: string;
  started_at?: string;
}

export interface CameraHealthResponse {
  cameras: CameraStatusResponse[];
  running: number;
  stopped: number;
  total: number;
}

export interface FFmpegOption {
  k: string;
  v: string | number;
}

export interface CameraInfo extends MediaServerConfig {
  table: string;
  camera_id: string;
  name?: string;
  label?: string;
  desc?: string;
  rtsp_url?: string;
  webrtc_url?: string;
  media_url?: string;
  model_id?: number;
  detect_objects?: string[];
  save_objects?: boolean;
  ffmpeg_options?: FFmpegOption[];
  ffmpeg_command?: string;
  output_dir?: string;
  archive_dir?: string;
  enabled?: boolean;
  event_rule?: EventRuleItem[];
}

export interface CameraCreateRequest {
  table: string;
  name: string;
  desc?: string;
  rtsp_url?: string;
  model_id?: number;
  detect_objects?: string[];
  save_objects?: boolean;
  ffmpeg_options?: FFmpegOption[];
  ffmpeg_command?: string;
  output_dir?: string;
  archive_dir?: string;
  server_url?: string;
}

export interface CameraUpdateRequest {
  desc?: string;
  rtsp_url?: string;
  model_id?: number;
  detect_objects?: string[];
  save_objects?: boolean;
  ffmpeg_options?: FFmpegOption[];
  ffmpeg_command?: string;
  output_dir?: string;
  archive_dir?: string;
}

export interface EventRuleItem {
  rule_id: string;
  camera_id?: string;
  name: string;
  alias?: string;
  expression_text: string;
  record_mode: 'ALL_MATCHES' | 'EDGE_ONLY';
  enabled: boolean;
  detect_objects?: string[];
}

export interface EventRuleCreateRequest {
  camera_id: string;
  rule_id?: string;
  name: string;
  expression_text: string;
  record_mode: 'ALL_MATCHES' | 'EDGE_ONLY';
  enabled?: boolean;
  detect_objects?: string[];
}

export type CameraEventType = 'MATCH' | 'TRIGGER' | 'RESOLVE' | 'ERROR';

export interface CameraEvent {
  time: string;
  camera_id: string;
  rule_id: string;
  rule_name?: string;
  name?: string;
  value?: number;
  value_label?: string;
  expression_text?: string;
  used_counts_snapshot?: string;
}

export type CameraPageMode = 'readonly' | 'edit' | 'create';

// ── Video Chunk ──

export interface ChunkInfo {
  camera: string;
  start: Date;
  startIso: string;
  duration: number;
  end: Date;
  lengthMicroseconds: number | null;
  sign: number | string | null;
  cacheToken: string;
}
