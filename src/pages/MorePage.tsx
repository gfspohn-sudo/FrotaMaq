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
      <Header title="Menu" />

      <div className="page-section">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-action/10 text-action font-semibold">
            {profile?.nome?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="font-medium text-fg">{profile?.nome ?? 'Usuário'}</p>
            <p className="text-sm text-fg-muted">{profile?.email}</p>
            <p className="text-xs text-action mt-0.5">
              {profile?.perfil ? PERFIL_LABELS[profile.perfil] : ''}
            </p>
          </div>
        </Card>

        {canApproveReportAccess && chaves.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
              <KeyRound className="h-4 w-4" />
              Chaves de Convite da Empresa
            </h2>
            <div className="space-y-2">
              {chaves.map(chave => (
                <Card key={chave.id}>
                  <p className="text-xs font-medium uppercase text-fg-muted">
                    {chave.perfil === 'motorista' ? 'Motorista' : 'Mecânico'}
                  </p>
                  <p className="mt-1 break-all font-mono text-sm text-fg">{chave.token}</p>
                </Card>
              ))}
            </div>
            <p className="mt-2 text-xs text-fg-muted">
              Compartilhe estas chaves para auto-cadastro de motoristas e mecânicos.
            </p>
          </section>
        )}

        <div className="grid gap-3">
          {visibleItems.map(item => (
            <Link key={item.to} to={item.to}>
              <Card interactive className="flex items-center gap-3 py-3">
                <item.icon className="h-5 w-5 text-fg-muted" />
                <span className="text-sm font-medium text-fg">{item.label}</span>
              </Card>
            </Link>
          ))}
        </div>

        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-danger shadow-sm transition-colors hover:bg-danger/10"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </div>
  )
}
