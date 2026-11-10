import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Info, Clock, CalendarClock, Wrench, Truck, Leaf } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/Button'
import { getAlertas, resolveAlerta } from '@/services/alerts'
import { useAuth } from '@/contexts/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenant } from '@/contexts/TenantContext'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import type { Alerta } from '@/types/database'

export function AlertsPage() {
  const { profile } = useAuth()
  const { canManageAlerts } = usePermissions()
  const { filterEmpresaId } = useTenant()
  const { items: notifications } = useNotifications()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [filter, setFilter] = useState<'todos' | 'vencida' | 'proxima'>('todos')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getAlertas(true, { empresaId: filterEmpresaId }, profile)
    if (data) setAlertas(data)
    setLoading(false)
  }, [filterEmpresaId, profile])

  useEffect(() => { load() }, [load])
  useDataRefresh(load)

  async function handleResolve(id: string) {
    await resolveAlerta(id, profile)
    load()
  }

  const filtered = filter === 'todos'
    ? alertas
    : alertas.filter(a => a.tipo === filter)

  const iconMap = {
    vencida: AlertTriangle,
    proxima: Clock,
  }

  const notificationIcon = {
    alerta: AlertTriangle,
    reserva: CalendarClock,
    preventiva: Wrench,
    viagem_atraso: Truck,
    esg: Leaf,
  }

  return (
    <div>
      <Header title="Alertas" />

      <div className="page-section">
        {notifications.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-fg">Central de notificações</h2>
            <div className="space-y-2">
              {notifications.map(n => {
                const Icon = notificationIcon[n.tipo] ?? Info
                return (
                  <Link key={n.id} to={n.href}>
                    <Card className="flex items-start gap-3 hover:bg-surface-muted">
                      <div className="mt-0.5 rounded-lg bg-action/10 p-2 text-action">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-fg">{n.titulo}</p>
                        <p className="text-sm text-fg-muted">{n.mensagem}</p>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        <div className="flex gap-2">
          {(['todos', 'vencida', 'proxima'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f ? 'bg-action text-white' : 'bg-surface-muted text-fg-muted'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'vencida' ? 'Vencidos' : 'Próximos'}
            </button>
          ))}
        </div>

        {loading ? (
          <ListSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Nenhum alerta ativo"
            description="Não há alertas de manutenção para os filtros selecionados."
          />
        ) : (
          <div className="grid gap-3">
            {filtered.map(a => {
              const Icon = iconMap[a.tipo] ?? Info
              const vehicleName = a.veiculos
                ? `${a.veiculos.modelo} - ${a.veiculos.placa}`
                : 'Veículo'

              return (
                <Card key={a.id}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-lg p-2 ${
                      a.tipo === 'vencida' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-fg">{vehicleName}</p>
                      <p className="text-sm text-fg-muted">{a.mensagem}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <StatusBadge status={a.tipo} type="alerta" />
                        <span className="text-xs text-fg-subtle">
                          {new Date(a.data_vencimento).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>
                  {canManageAlerts && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => handleResolve(a.id)}
                    >
                      Marcar como resolvido
                    </Button>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
