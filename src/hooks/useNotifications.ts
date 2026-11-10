import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { getNotifications } from '@/services/notifications'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import type { NotificationItem } from '@/services/notifications'

export const NOTIFICATION_POLL_MS = 30_000

export function useNotifications() {
  const { profile } = useAuth()
  const { filterEmpresaId } = useTenant()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const hasLoaded = useRef(false)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent && hasLoaded.current)
    if (!silent) setLoading(true)
    const { data, count: total } = await getNotifications(profile, filterEmpresaId)
    setItems(data ?? [])
    setCount(total)
    hasLoaded.current = true
    setLoading(false)
  }, [profile, filterEmpresaId])

  useEffect(() => {
    hasLoaded.current = false
    setItems([])
    setCount(0)
    void load()
  }, [load, profile?.id])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load({ silent: true })
    }, NOTIFICATION_POLL_MS)

    function onVisibility() {
      if (document.visibilityState === 'visible') void load({ silent: true })
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  const silentReload = useCallback(() => {
    void load({ silent: true })
  }, [load])

  useDataRefresh(silentReload)

  return { items, count, loading, reload: load }
}
