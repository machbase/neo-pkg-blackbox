// Backend response is described by the actual /api/retention/run payload — see issue #1287.
// dry_run=true 와 실제 실행 모두 동일한 shape 을 사용하며, 차이는 deleted_files / candidate_rows 의
// 의미와 dry_run flag 뿐이다.

// 백엔드는 일부 필드를 null 로 반환할 수 있음(특히 cameras / tables 등 배열류).
// 타입을 nullable 로 정의하여 UI 가드를 강제한다.

export interface RetentionCameraResult {
  camera_id: string;
  tag_names?: string[] | null;
  archive_dir?: string;
  active: boolean;
  candidate_rows?: number | null;
  deleted_files?: number | null;
  missing_files?: number | null;
  skipped_files?: number | null;
  metadata_deleted?: boolean;
}

export interface RetentionTableResult {
  table: string;
  kind: string; // "main" | "log" 등
  cameras?: RetentionCameraResult[] | null;
  candidate_rows?: number | null;
  deleted_files?: number | null;
  missing_files?: number | null;
  skipped_files?: number | null;
  deleted_metadata?: number | null;
}

export interface RetentionRunResult {
  started_at?: string;
  finished_at?: string;
  dry_run: boolean;
  cutoff?: string;
  cutoff_ns?: number;
  tables?: RetentionTableResult[] | null;
  candidate_rows?: number | null;
  deleted_files?: number | null;
  missing_files?: number | null;
  skipped_files?: number | null;
  deleted_metadata?: number | null;
}

// /api/retention/status 의 last_run 은 RetentionRunResult shape 과 동일하다.
export type RetentionLastResult = RetentionRunResult;

export interface RetentionStatus {
  running: boolean;
  next_run_at?: string; // ISO UTC
  last_run?: RetentionLastResult | null;
  config?: {
    enabled: boolean;
    keep_hours: number;
    start_at_utc: string;
    interval_hours: number;
    consistency_cleanup: boolean;
    targets: { database: boolean; files: boolean };
  };
}
