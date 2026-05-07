import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getConfig, postConfig } from '../services/configApi';
import {
  buildFallbackApiConfigData,
  fromApiToDraft,
  toPostPayload,
  validateRetention,
} from '../services/configMapper';
import type { ConfigShadow, RetentionSettings, SettingsDraft } from '../types/settings';

function buildInitialState() {
  return fromApiToDraft(buildFallbackApiConfigData());
}

const INITIAL = buildInitialState();

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function useConfig() {
  const { notify } = useApp();
  const [draft, setDraft] = useState<SettingsDraft>(INITIAL.draft);
  const [shadow, setShadow] = useState<ConfigShadow>(INITIAL.shadow);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const apiData = await getConfig();
        if (cancelled) return;
        if (apiData) {
          const mapped = fromApiToDraft(apiData);
          setDraft(mapped.draft);
          setShadow(mapped.shadow);
        }
        // apiData === null: 백엔드에 config 없음 → INITIAL fallback 유지 (토스트 안 띄움)
      } catch (error) {
        if (cancelled) return;
        notify(`Failed to load config: ${errorMessage(error, 'unknown error')}. Using fallback values.`, 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadConfig();
    return () => { cancelled = true; };
  }, [notify]);

  const updateGeneral = (nextGeneral: SettingsDraft['general']) => {
    setDraft((prev) => ({ ...prev, general: nextGeneral }));
  };

  const updateFFmpeg = (nextFFmpeg: SettingsDraft['ffmpeg']) => {
    setDraft((prev) => ({ ...prev, ffmpeg: nextFFmpeg }));
  };

  const updateLog = (nextLog: SettingsDraft['log']) => {
    setDraft((prev) => ({ ...prev, log: nextLog }));
  };

  const updateRetention = (nextRetention: RetentionSettings) => {
    setDraft((prev) => ({ ...prev, retention: nextRetention }));
  };

  const save = async () => {
    if (saving) return;
    // ★ outer try/catch 진입 전에 validation 수행 — 실패 시 notify + early return
    // (throw 시 outer catch에서 중복 notify 발생 가능 → early return으로 토스트 중복 방지)
    const validationError = validateRetention(draft);
    if (validationError) {
      notify(validationError, 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = toPostPayload(draft, shadow);
      const response = await postConfig(payload);
      notify(response.reason || 'Settings saved successfully.', 'success');
    } catch (error) {
      notify(`Failed to save settings: ${errorMessage(error, 'unknown error')}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return { draft, loading, saving, save, updateGeneral, updateFFmpeg, updateLog, updateRetention };
}
