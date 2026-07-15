// web/src/features/shared/toast.tsx — app-wide toasts per DESIGN §8: top, 2.5 s, one at a time.
// A new toast replaces the current one (no stacking). Mounted above the router so dockless
// subpages get it too. Same provider+hook shape as lib/auth.tsx.
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

type ShowToast = (message: string, tone?: ToastTone) => void

const ToastContext = createContext<ShowToast>(() => {})

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ShowToast {
  return useContext(ToastContext)
}

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'alert-success',
  error: 'alert-error',
  info: 'alert-info',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback<ShowToast>((message, tone = 'info') => {
    window.clearTimeout(timer.current)
    setToast({ message, tone })
    timer.current = window.setTimeout(() => setToast(null), 2500)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          className="toast toast-top toast-center z-50"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
        >
          {/* Keyed so a replacing toast re-runs base.css's toast-pop entrance. */}
          <div
            key={`${toast.tone}:${toast.message}`}
            role="status"
            className={`alert ${TONE_CLASS[toast.tone]}`}
          >
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
