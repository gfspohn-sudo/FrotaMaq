import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { PermissionService } from '@/application/services/PermissionService'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireReports?: boolean
  /** @deprecated use requireReports */
  requireFinancial?: boolean
  requireSuperAdmin?: boolean
}

export function ProtectedRoute({
  children,
  requireReports = false,
  requireFinancial = false,
  requireSuperAdmin = false,
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const needsReports = requireReports || requireFinancial

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const usuario = PermissionService.resolve(profile)
  if (needsReports && !usuario.podeVisualizarRelatorios()) {
    return <Navigate to="/" replace />
  }

  if (requireSuperAdmin && !usuario.podeGerenciarEmpresas()) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
