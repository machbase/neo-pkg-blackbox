import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: 'danger' | 'primary';
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    state?.resolve(true);
    setState(null);
  };

  const handleCancel = () => {
    state?.resolve(false);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{state.title}</div>
            <div className="modal-body">{state.message}</div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={handleCancel}>Cancel</button>
              <button
                className={`btn ${state.confirmVariant === 'primary' ? 'btn-primary' : 'btn-danger'}`}
                onClick={handleConfirm}
              >
                {state.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}
