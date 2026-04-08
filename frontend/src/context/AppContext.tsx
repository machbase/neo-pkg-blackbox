import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextValue {
  notifications: Notification[];
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissNotification: (id: number) => void;
  activeItem: string | null;
  setActiveItem: (id: string | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

let notifId = 0;

export function AppProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeItem, setActiveItem] = useState<string | null>(null);

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++notifId;
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const dismissNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <AppContext.Provider value={{ notifications, notify, dismissNotification, activeItem, setActiveItem }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
