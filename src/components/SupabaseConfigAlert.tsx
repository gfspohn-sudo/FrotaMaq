import { AlertTriangle, WifiOff } from 'lucide-react'
import { getSupabaseConfigError, supabaseConfig, NETWORK_ERROR_USER_MESSAGE } from '@/lib/supabase'

interface SupabaseConfigAlertProps {
  connectionError?: string | null
  networkError?: string | null
}

export function SupabaseConfigAlert({ connectionError, networkError }: SupabaseConfigAlertProps) {
  const configError = getSupabaseConfigError()
  const isNetworkError =
    networkError === NETWORK_ERROR_USER_MESSAGE ||
    connectionError === NETWORK_ERROR_USER_MESSAGE ||
    connectionError?.toLowerCase().includes('failed to fetch')

  if (isNetworkError) {
    return (
      <div className="flex gap-3 rounded-lg border-2 border-danger bg-red-50 px-4 py-4 text-sm text-red-900">
        <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div>
          <p className="font-bold text-danger">Erro de Conexão de Rede</p>
          <p className="mt-1 text-sm leading-relaxed">
            {NETWORK_ERROR_USER_MESSAGE}
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
