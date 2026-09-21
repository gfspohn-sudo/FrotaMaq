import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Info, Clock, CalendarClock, Wrench } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
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
  }

  return (
    <div>
      <Header title="Alertas" />

      <div className="space-y-4 px-4 py-4">
        {notifications.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Central de notificações</h2>
            <div className="space-y-2">
              {notifications.map(n => {
                const Icon = notificationIcon[n.tipo] ?? Info
                return (
                  <Link key={n.id} to={n.href}>
                    <Card className="flex items-start gap-3 hover:bg-gray-50">
                      <div className="mt-0.5 rounded-lg bg-action/10 p-2 text-action">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{n.titulo}</p>
                        <p className="text-sm text-gray-600">{n.mensagem}</p>
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
                filter === f ? 'bg-action text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'vencida' ? 'Vencidos' : 'Próximos'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-gray-500">Nenhum alerta ativo no banco.</p>
          </Card>
        ) : (
          <div className="space-y-2">
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
                      <p className="font-medium text-gray-900">{vehicleName}</p>
                      <p className="text-sm text-gray-600">{a.mensagem}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <StatusBadge status={a.tipo} type="alerta" />
                        <span className="text-xs text-gray-400">
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
