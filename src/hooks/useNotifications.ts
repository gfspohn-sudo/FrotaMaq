import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { getNotifications } from '@/services/notifications'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import type { NotificationItem } from '@/services/notifications'

export function useNotifications() {
  const { profile } = useAuth()
  const { filterEmpresaId } = useTenant()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, count: total } = await getNotifications(profile, filterEmpresaId)
    setItems(data ?? [])
    setCount(total)
    setLoading(false)
  }, [profile, filterEmpresaId])

  useEffect(() => {
    setItems([])
    setCount(0)
    load()
  }, [load, profile?.id])

  useDataRefresh(load)

  return { items, count, loading, reload: load }
}
