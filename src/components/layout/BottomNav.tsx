import { NavLink, useLocation } from 'react-router-dom'
import { Home, Car, Wrench, Menu, Plus } from 'lucide-react'
import { usePermissions } from '@/hooks/usePermissions'

const navItems = [
  { to: '/', icon: Home, label: 'Início' },
  { to: '/veiculos', icon: Car, label: 'Veículos' },
  { to: '/manutencoes/nova', icon: Plus, label: 'Nova', isFab: true },
  { to: '/manutencoes', icon: Wrench, label: 'Manutenções' },
  { to: '/mais', icon: Menu, label: 'Mais' },
]

export function BottomNav() {
  const location = useLocation()
  const { canCreateMaintenance } = usePermissions()

  if (location.pathname === '/login') return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-end justify-around px-2 pb-safe">
        {navItems.map(item => {
          if (item.isFab) {
            if (!canCreateMaintenance) return <div key={item.to} className="w-14" />
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-action text-white shadow-lg hover:bg-blue-700 transition-colors"
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
                isActive ? 'text-action font-medium' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
