import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  RetentionConflictError,
  getRetentionStatus,
  runRetention,
} from '../services/retentionApi';
import type { RetentionRunResult, RetentionStatus } from '../types/retention';

interface UseRetentionResult {
  status: RetentionStatus | null;
  statusLoading: boolean;
  statusError: string | null;
  fetchStatus: () => Promise<void>;
  runManual: (dryRun: boolean) => Promise<void>;
  running: boolean;
  lastRunResult: RetentionRunResult | null;
}

export function useRetention(): UseRetentionResult {
  const { notify } = useApp();
  const [status, setStatus] = useState<RetentionStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<RetentionRunResult | null>(null);

  // 컴포넌트 언마운트 시 stale state set 방지를 위한 cancel flag
  const cancelledRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const next = await getRetentionStatus();
      if (!cancelledRef.current) setStatus(next);
    } catch (e) {
      if (!cancelledRef.current) {
        setStatusError(e instanceof Error ? e.message : 'Failed to load status');
      }
    } finally {
      if (!cancelledRef.current) setStatusLoading(false);
    }
  }, []);

  const runManual = useCallback(
    async (dryRun: boolean) => {
      setRunning(true);
      let shouldRefresh = false;
      try {
        const result = await runRetention(dryRun);
        if (cancelledRef.current) return;
        setLastRunResult(result);
        notify(
          dryRun ? 'Dry-run finished — see preview' : 'Retention run finished',
          'success',
        );
        shouldRefresh = true;
      } catch (e) {
        if (cancelledRef.current) return;
        if (e instanceof RetentionConflictError) {
          // NotificationType union 미확장 — 409 conflict 는 'info' 로 매핑
          notify('Retention is already running — see Status card for progress', 'info');
          shouldRefresh = true; // conflict 후에도 최신 status 는 받아둠
        } else {
          notify(e instanceof Error ? e.message : 'Run failed', 'error');
        }
      } finally {
        if (!cancelledRef.current) setRunning(false);
      }
      // run 직후 1번만 즉시 갱신 — 이후는 background interval(5s) 에 맡김.
      if (shouldRefresh && !cancelledRef.current) {
        void fetchStatus();
      }
    },
    [notify, fetchStatus],
  );

  useEffect(() => {
    cancelledRef.current = false;
    void fetchStatus();
    // 스케줄러가 자체 트리거한 run 도 뱃지에 반영되도록 주기 폴링.
    // 탭이 보이지 않을 땐 새 fetch 를 건너뛰어 불필요한 부하를 줄인다.
    const interval = setInterval(() => {
      if (cancelledRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void fetchStatus();
    }, 5000);
    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, [fetchStatus]);

  return {
    status,
    statusLoading,
    statusError,
    fetchStatus,
    runManual,
    running,
    lastRunResult,
  };
}
