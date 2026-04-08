import { useState, useCallback } from 'react';
import type { MediaServerConfig } from '../types/server';

const STORAGE_KEY = 'blackbox-servers';

function loadFromStorage(): MediaServerConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MediaServerConfig[];
  } catch { /* ignore */ }
  return [];
}

function saveToStorage(configs: MediaServerConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

export function useServers() {
  const [servers, setServers] = useState<MediaServerConfig[]>(loadFromStorage);

  const addServer = useCallback((config: MediaServerConfig) => {
    setServers((prev) => {
      const next = [...prev, config];
      saveToStorage(next);
      return next;
    });
  }, []);

  const updateServer = useCallback((alias: string, config: MediaServerConfig) => {
    setServers((prev) => {
      const next = prev.map((s) => (s.alias === alias ? config : s));
      saveToStorage(next);
      return next;
    });
  }, []);

  const removeServer = useCallback((alias: string) => {
    setServers((prev) => {
      const next = prev.filter((s) => s.alias !== alias);
      saveToStorage(next);
      return next;
    });
  }, []);

  return { servers, addServer, updateServer, removeServer };
}
