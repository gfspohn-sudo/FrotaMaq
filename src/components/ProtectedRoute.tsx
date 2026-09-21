import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { PermissionService } from '@/application/services/PermissionService'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireReports?: boolean
  /** @deprecated use requireReports */
  requireFinancial?: boolean
  requireSuperAdmin?: boolean
  /** Relatórios com escopo (motorista) ou globais (gestor). */
  requireScopedReports?: boolean
  requireHistory?: boolean
  requireGlobalAlerts?: boolean
  /** Bloqueia motorista (ex.: rotas de manutenção). */
  requireMaintenance?: boolean
}

export function ProtectedRoute({
  children,
  requireReports = false,
  requireFinancial = false,
  requireSuperAdmin = false,
  requireScopedReports = false,
  requireHistory = false,
  requireGlobalAlerts = false,
  requireMaintenance = false,
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
  const vm = PermissionService.toViewModel(usuario)

  if (needsReports && !usuario.podeVisualizarRelatorios()) {
    return <Navigate to="/" replace />
  }

  if (requireScopedReports && !vm.canViewScopedReports) {
    return <Navigate to="/" replace />
  }

  if (requireHistory && !usuario.podeVisualizarHistoricoGeral()) {
    return <Navigate to="/" replace />
  }

  if (requireGlobalAlerts && !usuario.podeVisualizarAlertasGlobais()) {
    return <Navigate to="/" replace />
  }

  if (requireMaintenance && !vm.canViewMaintenance) {
    return <Navigate to="/" replace />
  }

  if (requireSuperAdmin && !usuario.podeGerenciarEmpresas()) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
