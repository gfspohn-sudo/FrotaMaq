import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, WifiOff, X } from 'lucide-react'
import {
  getSupabaseConfigError,
  getSupabaseHealthCheck,
  resetSupabaseHealthCheck,
  shouldBlockAppOnNetworkError,
  type SupabaseHealthResult,
} from '@/lib/supabase'
import {
  getSupabaseConnectivity,
  subscribeSupabaseConnectivity,
  SUPABASE_UNAVAILABLE_MESSAGE,
  type SupabaseConnectivityState,
} from '@/lib/supabaseResilience'

type BannerKind = 'config' | 'unavailable' | 'database' | null

const DISMISS_NETWORK_KEY = 'frotamaq:dismiss-network-banner'
const RECONNECT_INTERVAL_MS = 10_000

function resolveBanner(
  health: SupabaseHealthResult | null,
  connectivity: SupabaseConnectivityState,
): { kind: BannerKind; message: string } | null {
  const configError = health?.configError ?? getSupabaseConfigError()
  if (configError) {
    return { kind: 'config', message: configError }
  }

  const unavailable = connectivity.unavailable || health?.unavailable || health?.networkError
  if (unavailable) {
    if (typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_NETWORK_KEY) === '1') {
      return null
    }
    return { kind: 'unavailable', message: SUPABASE_UNAVAILABLE_MESSAGE }
  }

  if (health && health.authOk && !health.dbOk && health.messages[0]) {
    return {
      kind: 'database',
      message: `Supabase Auth respondeu, mas o banco retornou erro: ${health.messages[0]}`,
    }
  }

  return null
}

export function SupabaseInit() {
  const [health, setHealth] = useState<SupabaseHealthResult | null>(null)
  const [connectivity, setConnectivity] = useState(getSupabaseConnectivity)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeSupabaseConnectivity(setConnectivity)
    getSupabaseHealthCheck().then(setHealth)
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!connectivity.unavailable && !health?.unavailable && !health?.networkError) return

    const timer = window.setInterval(() => {
      resetSupabaseHealthCheck()
      getSupabaseHealthCheck({ force: true }).then(setHealth)
    }, RECONNECT_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [connectivity.unavailable, health?.unavailable, health?.networkError])

  const banner = dismissed ? null : resolveBanner(health, connectivity)

  useEffect(() => {
    document.documentElement.classList.toggle('supabase-unavailable', banner?.kind === 'unavailable')
    return () => document.documentElement.classList.remove('supabase-unavailable')
  }, [banner?.kind])

  if (!banner) return null

  const isUnavailable = banner.kind === 'unavailable'
  const isConfig = banner.kind === 'config'
  const canDismiss = isUnavailable && !shouldBlockAppOnNetworkError()

  function dismissNetworkBanner() {
    sessionStorage.setItem(DISMISS_NETWORK_KEY, '1')
    setDismissed(true)
  }

  return (
    <>
      <div className="h-11" aria-hidden />
      <div
        className={`fixed inset-x-0 top-0 z-[100] border-b px-4 py-2.5 shadow-sm backdrop-blur ${
          isUnavailable
            ? 'border-amber-500/40 bg-amber-50/95 text-amber-950 dark:bg-amber-950/90 dark:text-amber-50'
            : isConfig
              ? 'border-amber-500 bg-amber-50 text-amber-950'
              : 'border-warning bg-amber-50/90 text-amber-950'
        }`}
        role="status"
      >
        <div className="mx-auto flex max-w-7xl items-start gap-2">
          {isUnavailable ? (
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-amber-700 dark:text-amber-200" />
          ) : isConfig ? (
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          )}
          <p className="min-w-0 flex-1 text-sm font-medium leading-snug">
            {isUnavailable ? SUPABASE_UNAVAILABLE_MESSAGE : banner.message}
          </p>
          {canDismiss && (
            <button
              type="button"
              onClick={dismissNetworkBanner}
              className="shrink-0 rounded p-1 text-amber-800 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900"
              aria-label="Fechar aviso de reconexão"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </>
  )
}
