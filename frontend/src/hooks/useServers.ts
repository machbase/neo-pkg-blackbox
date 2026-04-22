import { useState, useEffect, useCallback } from 'react';
import type { MediaServerConfig } from '../types/server';
import {
  listServers,
  createServer,
  updateServer as apiUpdateServer,
  deleteServer,
} from '../services/serversApi';

export function useServers() {
  const [servers, setServers] = useState<MediaServerConfig[]>([]);

  const refresh = useCallback(async () => {
    try {
      const list = await listServers();
      setServers(list);
    } catch (err) {
      console.error('Failed to load servers', err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addServer = useCallback(async (config: MediaServerConfig) => {
    try {
      const created = await createServer(config);
      setServers((prev) => [...prev, created]);
    } catch (err) {
      console.error('Failed to create server', err);
    }
  }, []);

  const updateServer = useCallback(async (alias: string, config: MediaServerConfig) => {
    try {
      const updated = await apiUpdateServer(alias, config);
      setServers((prev) => prev.map((s) => (s.alias === alias ? updated : s)));
    } catch (err) {
      console.error('Failed to update server', err);
    }
  }, []);

  const removeServer = useCallback(async (alias: string) => {
    try {
      await deleteServer(alias);
      setServers((prev) => prev.filter((s) => s.alias !== alias));
    } catch (err) {
      console.error('Failed to delete server', err);
    }
  }, []);

  return { servers, addServer, updateServer, removeServer, refresh };
}
