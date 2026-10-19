import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Check, CircleAlert } from 'lucide-react'

type Toast = { message: string; tone: 'success' | 'error' }

const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)

  const show = useCallback((message: string, tone: Toast['tone'] = 'success') => setToast({ message, tone }), [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className={`admin-toast ${toast.tone === 'error' ? 'admin-toast-error' : ''}`} role="status">
          {toast.tone === 'error' ? <CircleAlert size={16} /> : <Check size={16} />}
          {toast.message}
          <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}
