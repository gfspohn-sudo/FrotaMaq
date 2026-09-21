import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { TenantProvider } from '@/contexts/TenantContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { SupabaseInit } from '@/components/SupabaseInit'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { VehiclesPage } from '@/pages/VehiclesPage'
import { VehicleDetailPage } from '@/pages/VehicleDetailPage'
import { MaintenancePage, NewMaintenancePage } from '@/pages/MaintenancePage'
import { MaintenanceHistoryPage } from '@/pages/MaintenanceHistoryPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { AlertsPage } from '@/pages/AlertsPage'
import { MorePage } from '@/pages/MorePage'
import { EmpresasPage } from '@/pages/EmpresasPage'
import { ReservasPage } from '@/pages/ReservasPage'
import { VehicleReportPage } from '@/pages/VehicleReportPage'

function ScopedReportsRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requireScopedReports>{children}</ProtectedRoute>
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requireSuperAdmin>{children}</ProtectedRoute>
}

export default function App() {
  return (
    <BrowserRouter>
      <SupabaseInit />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute><TenantProvider><AppLayout /></TenantProvider></ProtectedRoute>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/veiculos" element={<VehiclesPage />} />
            <Route path="/veiculos/:id" element={<VehicleDetailPage />} />
            <Route path="/veiculos/:id/relatorio" element={<VehicleReportPage />} />
            <Route path="/reservas" element={<ReservasPage />} />
            <Route path="/manutencoes" element={<ProtectedRoute requireMaintenance><MaintenancePage /></ProtectedRoute>} />
            <Route path="/manutencoes/nova" element={<ProtectedRoute requireMaintenance><NewMaintenancePage /></ProtectedRoute>} />
            <Route path="/historico" element={<ProtectedRoute requireHistory><MaintenanceHistoryPage /></ProtectedRoute>} />
            <Route path="/alertas" element={<ProtectedRoute requireGlobalAlerts><AlertsPage /></ProtectedRoute>} />
            <Route path="/mais" element={<MorePage />} />
            <Route path="/empresas" element={<SuperAdminRoute><EmpresasPage /></SuperAdminRoute>} />
            <Route path="/relatorios" element={<ScopedReportsRoute><ReportsPage /></ScopedReportsRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
