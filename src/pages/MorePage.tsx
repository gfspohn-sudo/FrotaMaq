import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Bell, LogOut, History, Building2, CalendarClock, KeyRound } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { PERFIL_LABELS } from '@/lib/tenantFilter'
import { getChavesConviteEmpresa } from '@/services/inviteKeys'
import type { ChaveConvite } from '@/types/database'

export function MorePage() {
  const { profile, signOut } = useAuth()
  const {
    canViewReports,
    canManageEmpresas,
    canRequestReserva,
    canApproveReserva,
    canViewScopedReports,
    canViewGeneralHistory,
    canViewGlobalAlerts,
    canApproveReportAccess,
  } = usePermissions()
  const [chaves, setChaves] = useState<ChaveConvite[]>([])

  useEffect(() => {
    if (!canApproveReportAccess || !profile?.empresa_id) return
    getChavesConviteEmpresa(profile.empresa_id, profile).then(({ data }) => {
      if (data) setChaves(data)
    })
  }, [canApproveReportAccess, profile])

  const visibleItems = [
    ...(canViewGeneralHistory
      ? [{ to: '/historico', icon: History, label: 'Histórico de Manutenções' }]
      : []),
    ...((canViewReports || canViewScopedReports)
      ? [{ to: '/relatorios', icon: BarChart3, label: 'Relatórios' }]
      : []),
    ...(canViewGlobalAlerts
      ? [{ to: '/alertas', icon: Bell, label: 'Alertas' }]
      : []),
    ...((canRequestReserva || canApproveReserva)
      ? [{ to: '/reservas', icon: CalendarClock, label: 'Reservas' }]
      : []),
    ...(canManageEmpresas
      ? [{ to: '/empresas', icon: Building2, label: 'Empresas' }]
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

        {canApproveReportAccess && chaves.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <KeyRound className="h-4 w-4" />
              Chaves de Convite da Empresa
            </h2>
            <div className="space-y-2">
              {chaves.map(chave => (
                <Card key={chave.id}>
                  <p className="text-xs font-medium uppercase text-gray-500">
                    {chave.perfil === 'motorista' ? 'Motorista' : 'Mecânico'}
                  </p>
                  <p className="mt-1 break-all font-mono text-sm text-gray-900">{chave.token}</p>
                </Card>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Compartilhe estas chaves para auto-cadastro de motoristas e mecânicos.
            </p>
          </section>
        )}

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
