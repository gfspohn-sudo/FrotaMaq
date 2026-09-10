import { Link } from 'react-router-dom'
import { BarChart3, Bell, LogOut, History, Building2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { PERFIL_LABELS } from '@/lib/tenantFilter'

const menuItems = [
  { to: '/historico', icon: History, label: 'Histórico de Manutenções', requireReports: false },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios', requireReports: true },
  { to: '/alertas', icon: Bell, label: 'Alertas', requireReports: false },
]

export function MorePage() {
  const { profile, signOut } = useAuth()
  const { canViewReports, canManageEmpresas } = usePermissions()

  const visibleItems = [
    ...menuItems.filter(item => !item.requireReports || canViewReports),
    ...(canManageEmpresas
      ? [{ to: '/empresas', icon: Building2, label: 'Empresas', requireReports: false }]
      : []),
  ]

  return (
    <div>
      <Header title="Mais" />

      <div className="space-y-4 px-4 py-4">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-action/10 text-action font-semibold">
            {profile?.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="font-medium text-gray-900">{profile?.nome ?? 'Usuário'}</p>
            <p className="text-sm text-gray-500">{profile?.email}</p>
            <p className="text-xs text-action mt-0.5">
              {profile?.perfil ? PERFIL_LABELS[profile.perfil] : ''}
            </p>
          </div>
        </Card>

        <div className="space-y-1">
          {visibleItems.map(item => (
            <Link key={item.to} to={item.to}>
              <Card className="flex items-center gap-3 py-3">
                <item.icon className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </Card>
            </Link>
          ))}
        </div>

        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-gray-100 text-danger hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </div>
  )
}
