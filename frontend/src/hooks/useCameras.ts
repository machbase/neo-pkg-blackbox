import { useState, useEffect, useCallback, useRef } from 'react';
import type { MediaServerConfig, CameraItem, CameraStatusType } from '../types/server';
import { loadCameras, getCamerasHealth, getCameraEventCount } from '../services/cameraApi';

type HealthMap = Record<string, Record<string, CameraStatusType>>;
type CameraMap = Record<string, CameraItem[]>;
type CountMap = Record<string, number>;
type BoolMap = Record<string, boolean>;

export function useCameras(servers: MediaServerConfig[]) {
  const [cameraMap, setCameraMap] = useState<CameraMap>({});
  const [healthMap, setHealthMap] = useState<HealthMap>({});
  const [eventCountMap, setEventCountMap] = useState<CountMap>({});
  const [errorMap, setErrorMap] = useState<BoolMap>({});
  const [loadedMap, setLoadedMap] = useState<BoolMap>({});
  const [loading, setLoading] = useState(false);
  const serversRef = useRef(servers);
  serversRef.current = servers;

  const fetchHealth = useCallback(async (config: MediaServerConfig): Promise<boolean> => {
    try {
      const res = await getCamerasHealth(config.ip, config.port);
      const map: Record<string, CameraStatusType> = {};
      if (res.cameras) {
        for (const c of res.cameras) {
          map[c.name] = c.status;
        }
      }
      setHealthMap((prev) => ({ ...prev, [config.alias]: map }));
      setErrorMap((prev) => ({ ...prev, [config.alias]: false }));
      return true;
    } catch {
      setErrorMap((prev) => ({ ...prev, [config.alias]: true }));
      return false;
    }
  }, []);

  const fetchCameras = useCallback(async (config: MediaServerConfig) => {
    try {
      const cameras = await loadCameras(config.ip, config.port);
      setCameraMap((prev) => ({ ...prev, [config.alias]: Array.isArray(cameras) ? cameras : [] }));
      setLoadedMap((prev) => ({ ...prev, [config.alias]: true }));
    } catch {
      setCameraMap((prev) => ({ ...prev, [config.alias]: [] }));
      setLoadedMap((prev) => ({ ...prev, [config.alias]: true }));
    }
  }, []);

  const fetchEventCount = useCallback(async (config: MediaServerConfig) => {
    try {
      const count = await getCameraEventCount(config.ip, config.port);
      setEventCountMap((prev) => ({ ...prev, [config.alias]: count }));
    } catch {
      // ignore
    }
  }, []);

  const fetchAll = useCallback(async (configs: MediaServerConfig[]) => {
    setLoading(true);
    await Promise.all(
      configs.map(async (config) => {
        const healthy = await fetchHealth(config);
        if (!healthy) return;
        await fetchCameras(config);
        await fetchEventCount(config);
      }),
    );
    setLoading(false);
  }, [fetchHealth, fetchCameras, fetchEventCount]);

  const refresh = useCallback(() => {
    if (serversRef.current.length > 0) {
      void fetchAll(serversRef.current);
    }
  }, [fetchAll]);

  // Initial load
  useEffect(() => {
    if (servers.length > 0) {
      void fetchAll(servers);
    }
  }, [servers, fetchAll]);

  // Polling: health + event count every 10s
  useEffect(() => {
    if (servers.length === 0) return;
    const poll = async () => {
      await Promise.all(
        serversRef.current.map(async (config) => {
          const healthy = await fetchHealth(config);
          if (healthy) await fetchEventCount(config);
        }),
      );
    };
    const timer = setInterval(poll, 10_000);
    return () => clearInterval(timer);
  }, [servers, fetchHealth, fetchEventCount]);

  const clearEventCount = useCallback((alias: string) => {
    setEventCountMap((prev) => ({ ...prev, [alias]: 0 }));
  }, []);

  return {
    cameraMap,
    healthMap,
    eventCountMap,
    errorMap,
    loadedMap,
    loading,
    refresh,
    clearEventCount,
  };
}
