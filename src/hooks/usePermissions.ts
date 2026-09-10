import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { PermissionService } from '@/application/services/PermissionService'

export function usePermissions() {
  const { profile } = useAuth()

  return useMemo(() => {
    const usuario = PermissionService.resolve(profile)
    return PermissionService.toViewModel(usuario)
  }, [profile])
}

export { PermissionService }
