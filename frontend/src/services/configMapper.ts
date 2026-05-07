import type { ApiConfigData, ApiConfigPostBody } from '../types/configApi';
import type { SettingsDraft } from '../types/settings';
import { localHHmmToUtc, utcHHmmToLocal } from '../utils/timeUtils';

function cloneApiConfig(data: ApiConfigData): ApiConfigData {
  return JSON.parse(JSON.stringify(data)) as ApiConfigData;
}

function createProbeArgId(index: number): string {
  return `probe-${index}-${Math.random().toString(16).slice(2, 8)}`;
}

function isLogLevel(value: string): value is SettingsDraft['log']['logLevel'] {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error';
}

function isLogFormat(value: string): value is SettingsDraft['log']['logFormat'] {
  return value === 'json' || value === 'text';
}

function isLogOutput(value: string): value is SettingsDraft['log']['outputDestination'] {
  return value === 'stdout' || value === 'file' || value === 'both';
}

function splitFilename(filename: string): { prefix: string; extension: string } {
  const index = filename.lastIndexOf('.');
  if (index <= 0 || index >= filename.length - 1) {
    return { prefix: filename || 'blackbox', extension: 'log' };
  }
  return {
    prefix: filename.slice(0, index),
    extension: filename.slice(index + 1),
  };
}

function readProbeFlag(item: ApiConfigData['ffmpeg']['defaults']['probe_args'][number]): string {
  return item.flag ?? item.Flag ?? '';
}

function readProbeValue(item: ApiConfigData['ffmpeg']['defaults']['probe_args'][number]): string {
  return item.value ?? item.Value ?? '';
}

function hasUppercaseProbeKeys(
  probeArgs: ApiConfigData['ffmpeg']['defaults']['probe_args'],
): boolean {
  return probeArgs.some((item) => 'Flag' in item || 'Value' in item);
}

export function buildFallbackApiConfigData(): ApiConfigData {
  return {
    server: {
      addr: '0.0.0.0:8000',
      camera_dir: '../bin/cameras',
      mvs_dir: '../ai/mvs',
      data_dir: '../bin/data',
    },
    machbase: {
      scheme: 'http',
      host: '127.0.0.1',
      port: 5654,
      timeout_seconds: 30,
      api_token: '',
    },
    ffmpeg: {
      binary: '../tools/ffmpeg',
      defaults: {
        probe_binary: '../tools/ffprobe',
        probe_args: [
          { flag: 'v', value: 'error' },
          { flag: 'select_streams', value: 'v:0' },
          { flag: 'show_entries', value: 'packet=pts_time,duration_time' },
          { flag: 'of', value: 'csv=p=0' },
        ],
      },
    },
    mediamtx: {
      binary: '../tools/mediamtx',
      config_file: '../tools/mediamtx.yml',
      host: '127.0.0.1',
      webrtc_host: '',
      port: 9997,
      webrtc_port: 0,
      rtsp_server_port: 0,
    },
    log: {
      dir: '../logs',
      level: 'info',
      format: 'json',
      output: 'both',
      file: {
        filename: 'blackbox.log',
        max_size: 100,
        max_backups: 10,
        max_age: 30,
        compress: true,
      },
    },
    ai: {
      binary: '../ai/blackbox-ai-manager',
      config_file: '../ai/config.json',
    },
    retention: {
      enabled: false,
      keep_hours: 720,
      start_at_utc: '18:00',
      interval_hours: 24,
      consistency_cleanup: true,
      targets: { database: true, files: true },
    },
  };
}

export function fromApiToDraft(api: ApiConfigData): { draft: SettingsDraft; shadow: ApiConfigData } {
  const filename = splitFilename(api.log.file.filename);
  const token = api.machbase.api_token || '';

  const retentionApi = api.retention ?? buildFallbackApiConfigData().retention!;
  const keepHours = Number.isFinite(retentionApi.keep_hours) ? retentionApi.keep_hours : 0;
  const useDays = keepHours !== 0 && keepHours % 24 === 0;

  const draft: SettingsDraft = {
    general: {
      server: {
        address: api.server.addr,
        cameraDirectory: api.server.camera_dir,
        mvsDirectory: api.server.mvs_dir,
        dataDirectory: api.server.data_dir,
      },
      machbase: {
        host: api.machbase.host,
        port: api.machbase.port,
        timeoutSeconds: api.machbase.timeout_seconds,
        useToken: token.trim() !== '',
        apiToken: token,
      },
      mediaMtx: {
        host: api.mediamtx.host,
        port: api.mediamtx.port,
        binary: api.mediamtx.binary,
      },
      ffmpeg: {
        binary: api.ffmpeg.binary,
        probeBinary: api.ffmpeg.defaults.probe_binary,
      },
    },
    ffmpeg: {
      probeArgs: api.ffmpeg.defaults.probe_args.map((item, index) => ({
        id: createProbeArgId(index),
        flag: readProbeFlag(item),
        value: readProbeValue(item),
      })),
    },
    log: {
      logDirectory: api.log.dir,
      logLevel: isLogLevel(api.log.level) ? api.log.level : 'info',
      logFormat: isLogFormat(api.log.format) ? api.log.format : 'json',
      outputDestination: isLogOutput(api.log.output) ? api.log.output : 'both',
      filenamePrefix: filename.prefix,
      filenameExtension: filename.extension,
      maxFileSizeMb: api.log.file.max_size,
      maxBackups: api.log.file.max_backups,
      maxAgeDays: api.log.file.max_age,
      compressOldLogs: api.log.file.compress,
    },
    retention: {
      enabled: !!retentionApi.enabled,
      keepValue: useDays ? keepHours / 24 : keepHours,
      keepUnit: useDays ? 'days' : 'hours',
      startAtLocal: utcHHmmToLocal(retentionApi.start_at_utc),
      intervalHours: Number.isFinite(retentionApi.interval_hours) ? retentionApi.interval_hours : 24,
      consistencyCleanup: !!retentionApi.consistency_cleanup,
      deleteDatabase: !!retentionApi.targets?.database,
      deleteFiles: !!retentionApi.targets?.files,
    },
  };

  const shadow = cloneApiConfig(api);
  if (!shadow.retention) {
    shadow.retention = { ...retentionApi, targets: { ...retentionApi.targets } };
  }

  return {
    draft,
    shadow,
  };
}

export function toPostPayload(draft: SettingsDraft, shadow: ApiConfigData): ApiConfigPostBody {
  const payload = cloneApiConfig(shadow);
  const uppercaseProbeKeys = hasUppercaseProbeKeys(shadow.ffmpeg.defaults.probe_args);

  payload.server.addr = draft.general.server.address;
  payload.server.camera_dir = draft.general.server.cameraDirectory;
  payload.server.mvs_dir = draft.general.server.mvsDirectory;
  payload.server.data_dir = draft.general.server.dataDirectory;

  payload.machbase.host = draft.general.machbase.host;
  payload.machbase.port = draft.general.machbase.port;
  payload.machbase.timeout_seconds = draft.general.machbase.timeoutSeconds;
  payload.machbase.api_token = draft.general.machbase.useToken ? draft.general.machbase.apiToken : '';

  payload.ffmpeg.binary = draft.general.ffmpeg.binary;
  payload.ffmpeg.defaults.probe_binary = draft.general.ffmpeg.probeBinary;
  payload.ffmpeg.defaults.probe_args = draft.ffmpeg.probeArgs.map((item) =>
    uppercaseProbeKeys
      ? {
          Flag: item.flag,
          Value: item.value,
        }
      : {
          flag: item.flag,
          value: item.value,
        },
  );

  payload.mediamtx.host = draft.general.mediaMtx.host;
  payload.mediamtx.port = draft.general.mediaMtx.port;
  payload.mediamtx.binary = draft.general.mediaMtx.binary;

  payload.log.dir = draft.log.logDirectory;
  payload.log.level = draft.log.logLevel;
  payload.log.format = draft.log.logFormat;
  payload.log.output = draft.log.outputDestination;
  payload.log.file.filename = `${draft.log.filenamePrefix}.log`;
  payload.log.file.max_size = draft.log.maxFileSizeMb;
  payload.log.file.max_backups = draft.log.maxBackups;
  payload.log.file.max_age = draft.log.maxAgeDays;
  payload.log.file.compress = draft.log.compressOldLogs;

  const retentionDraft = draft.retention;
  const rawKeepValue = Number.isFinite(retentionDraft.keepValue) ? retentionDraft.keepValue : 0;
  const keepHours = retentionDraft.keepUnit === 'days' ? rawKeepValue * 24 : rawKeepValue;
  const intervalRaw = Number(retentionDraft.intervalHours);
  const intervalHours =
    !Number.isFinite(intervalRaw) || intervalRaw <= 0 ? 24 : intervalRaw;

  // 정책: targets.database / targets.files / consistency_cleanup 은 사용자 입력과 무관하게
  // 항상 true 로 전송한다 (UI 노출 없음, 백엔드 정책 고정).
  payload.retention = {
    enabled: !!retentionDraft.enabled,
    keep_hours: keepHours,
    start_at_utc: localHHmmToUtc(retentionDraft.startAtLocal),
    interval_hours: intervalHours,
    consistency_cleanup: true,
    targets: {
      database: true,
      files: true,
    },
  };

  return payload;
}

const HM_VALIDATION_PATTERN = /^\d{1,2}:\d{2}(:\d{2})?$/;

/**
 * Validates retention draft. Returns the first error message, or null if all checks pass.
 * Rules:
 *  - keepValue must be >= 1
 *  - intervalHours must be >= 0
 *  - startAtLocal must match HH:mm (or HH:mm:ss) within 0-23 / 0-59 ranges
 *
 * Targets(deleteDatabase / deleteFiles / consistencyCleanup) 는 정책상 항상 true 로 전송되므로
 * 별도 검증 대상이 아니다.
 */
export function validateRetention(draft: SettingsDraft): string | null {
  const r = draft.retention;

  if (!Number.isFinite(r.keepValue) || r.keepValue <= 0) {
    return '보존 기간은 1 이상이어야 합니다.';
  }

  if (!Number.isFinite(r.intervalHours) || r.intervalHours < 0) {
    return '반복 주기는 0 이상이어야 합니다.';
  }

  const startAt = typeof r.startAtLocal === 'string' ? r.startAtLocal.trim() : '';
  if (!HM_VALIDATION_PATTERN.test(startAt)) {
    return '시작 시각 형식이 올바르지 않습니다 (HH:mm).';
  }
  const [hhStr, mmStr] = startAt.split(':');
  const hh = Number.parseInt(hhStr ?? '', 10);
  const mm = Number.parseInt(mmStr ?? '', 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return '시작 시각 형식이 올바르지 않습니다 (HH:mm).';
  }

  return null;
}
