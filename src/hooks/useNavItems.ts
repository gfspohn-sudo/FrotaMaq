import {
  LayoutDashboard,
  Car,
  CalendarClock,
  Wrench,
  BarChart3,
  History,
  Bell,
  Building2,
  Menu,
} from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import type { MessageKey } from '@/contexts/I18nContext'

export interface AppNavItem {
  to: string
  icon: typeof LayoutDashboard
  labelKey: MessageKey
  end?: boolean
}

export function useNavItems(): AppNavItem[] {
  const {
    canRequestReserva,
    canApproveReserva,
    canViewMaintenance,
    canViewReports,
    canViewScopedReports,
    canViewGeneralHistory,
    canViewGlobalAlerts,
    canManageEmpresas,
  } = usePermissions()

  const items: AppNavItem[] = [
    { to: '/', icon: LayoutDashboard, labelKey: 'nav.home', end: true },
    { to: '/veiculos', icon: Car, labelKey: 'nav.vehicles' },
  ]

  if (canRequestReserva || canApproveReserva) {
    items.push({ to: '/reservas', icon: CalendarClock, labelKey: 'nav.reservas' })
  }
  if (canViewMaintenance) {
    items.push({ to: '/manutencoes', icon: Wrench, labelKey: 'nav.maintenance' })
  }
  if (canViewReports || canViewScopedReports) {
    items.push({ to: '/relatorios', icon: BarChart3, labelKey: 'nav.reports' })
  }
  if (canViewGeneralHistory) {
    items.push({ to: '/historico', icon: History, labelKey: 'nav.history' })
  }
  if (canViewGlobalAlerts) {
    items.push({ to: '/alertas', icon: Bell, labelKey: 'nav.alerts' })
  }
  if (canManageEmpresas) {
    items.push({ to: '/empresas', icon: Building2, labelKey: 'nav.companies' })
  }

  items.push({ to: '/mais', icon: Menu, labelKey: 'nav.more' })
  return items
}
