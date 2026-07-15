import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id));
    }, 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'error' ? 'var(--red-dim)' : t.type === 'success' ? 'var(--emerald-dim)' : 'var(--surface-2)',
            border: `1px solid ${t.type === 'error' ? 'var(--red)' : t.type === 'success' ? 'var(--emerald)' : 'var(--line-2)'}`,
            color: 'var(--cream)', padding: '10px 18px', borderRadius: 10,
            fontSize: 14, boxShadow: 'var(--shadow)', maxWidth: 380, textAlign: 'center',
            animation: 'toastIn .2s ease',
          }}>
            {t.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateY(8px);} to {opacity:1; transform:translateY(0);} }`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
