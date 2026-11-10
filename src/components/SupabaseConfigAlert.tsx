import { AlertTriangle, WifiOff } from 'lucide-react'
import { getSupabaseConfigError, supabaseConfig, SUPABASE_UNAVAILABLE_MESSAGE } from '@/lib/supabase'
import { isTransientSupabaseError } from '@/lib/supabaseResilience'

interface SupabaseConfigAlertProps {
  connectionError?: string | null
  networkError?: string | null
}

export function SupabaseConfigAlert({ connectionError, networkError }: SupabaseConfigAlertProps) {
  const configError = getSupabaseConfigError()
  const isNetworkError =
    isTransientSupabaseError({ message: networkError ?? connectionError ?? '' })
    || connectionError === SUPABASE_UNAVAILABLE_MESSAGE
    || networkError === SUPABASE_UNAVAILABLE_MESSAGE

  if (isNetworkError) {
    return (
      <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-4 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-50">
        <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-200" />
        <div>
          <p className="font-semibold">Servidor temporariamente indisponível</p>
          <p className="mt-1 text-sm leading-relaxed">
            {SUPABASE_UNAVAILABLE_MESSAGE}
          </p>
        </div>
      </div>
    )
  }

  const message = connectionError ?? configError
  if (!message) return null

  return (
    <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div>
        <p className="font-medium">Erro do Supabase</p>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{message}</p>
        {import.meta.env.DEV && (
          <p className="mt-2 text-xs opacity-70">
            Debug: fonte={supabaseConfig.source} · url={supabaseConfig.url}
          </p>
        )}
      </div>
    </div>
  )
}
