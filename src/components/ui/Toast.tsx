import { useEffect } from 'react'
import { CheckCircle2, X, XCircle } from 'lucide-react'

interface ToastProps {
  message: string
  variant?: 'error' | 'success'
  onClose: () => void
}

export function Toast({ message, variant = 'error', onClose }: ToastProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, 7000)
    return () => window.clearTimeout(timeout)
  }, [message, onClose])

  const isError = variant === 'error'

  return (
    <div
      role="status"
      className={`fixed bottom-24 right-4 z-[120] max-w-sm rounded-xl border px-4 py-3 shadow-md lg:bottom-6 ${
        isError
          ? 'border-danger/30 bg-surface text-danger'
          : 'border-success/30 bg-surface text-success'
      }`}
    >
      <div className="flex items-start gap-2">
        {isError ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
        <p className="flex-1 text-sm font-medium text-fg">{message}</p>
        <button type="button" onClick={onClose} className="rounded p-0.5 text-fg-muted hover:bg-surface-muted" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
