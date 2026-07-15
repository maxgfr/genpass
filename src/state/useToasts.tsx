import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface Toast {
  id: number
  message: string
  kind: 'info' | 'error'
}

interface ToastApi {
  toast: (message: string, kind?: Toast['kind']) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const TOAST_DURATION_MS = 2_600

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const toast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, kind }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_DURATION_MS)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => (
          <p key={t.id} className={t.kind === 'error' ? 'toast toast--error' : 'toast'}>
            {t.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToasts(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToasts must be used inside <ToastProvider>')
  return api
}
