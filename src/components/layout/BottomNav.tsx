import { NavLink, useLocation } from 'react-router-dom'
import { Home, Car, Wrench, Menu, Plus, BarChart3 } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'
import { useI18n } from '@/contexts/I18nContext'

interface NavItem {
  to: string
  icon: typeof Home
  labelKey: 'nav.home' | 'nav.vehicles' | 'nav.new' | 'nav.reports' | 'nav.maintenance' | 'nav.more'
  isFab?: boolean
}

export function BottomNav() {
  const location = useLocation()
  const { t } = useI18n()
  const { canCreateMaintenance, canViewScopedReports, isMotorista, canViewMaintenance } = usePermissions()

  if (location.pathname === '/login') return null

  const items: NavItem[] = [
    { to: '/', icon: Home, labelKey: 'nav.home' },
    { to: '/veiculos', icon: Car, labelKey: 'nav.vehicles' },
  ]

  if (canCreateMaintenance) {
    items.push({ to: '/manutencoes/nova', icon: Plus, labelKey: 'nav.new', isFab: true })
  } else if (isMotorista && canViewScopedReports) {
    items.push({ to: '/relatorios', icon: BarChart3, labelKey: 'nav.reports' })
  }

  if (canViewMaintenance) {
    items.push({ to: '/manutencoes', icon: Wrench, labelKey: 'nav.maintenance' })
  }

  items.push({ to: '/mais', icon: Menu, labelKey: 'nav.more' })

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/90 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-around px-2 pb-safe">
        {items.map(item => {
          if (item.isFab) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-action text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg active:scale-95"
              >
                <item.icon className="h-6 w-6" />
              </NavLink>
            )
          }

          const isActive = item.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.to)

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors ${
                isActive ? 'font-medium text-action' : 'text-fg-muted hover:text-fg'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
