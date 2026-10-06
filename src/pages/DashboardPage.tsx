import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { TenantSelector } from '@/components/TenantSelector'
import { Card } from '@/components/ui/Card'
import { DashboardCharts } from '@/components/DashboardCharts'
import { getFleetAlerts } from '@/services/vehicles'
import { getAlertasCount } from '@/services/alerts'
import {
  getMaintenanceDashboard,
  getFinancialReport,
  getEmpresaSummaries,
} from '@/services/reports'
import type { EmpresaSummary, MaintenanceDashboard } from '@/services/reports'
import type { FleetPriorityAlert } from '@/domain/services/FleetPriorityAlertService'
import type { FleetSummaryResult } from '@/domain/services/MaintenanceDashboardService'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { usePermissions } from '@/hooks/usePermissions'
import { formatCurrency } from '@/lib/maintenanceStatus'
import { formatPlacaCurta } from '@/lib/vehicleDisplay'
import { PRIORIDADE_ALERTA_LABELS, type PrioridadeAlerta } from '@/types/database'

const PRIORIDADE_STYLES: Record<PrioridadeAlerta, string> = {
  CRITICA: 'border-l-4 border-l-danger bg-danger/10',
  ALTA: 'border-l-4 border-l-orange-500 bg-orange-50',
  MEDIA: 'border-l-4 border-l-warning bg-warning/10',
}

const PRIORIDADE_TEXT: Record<PrioridadeAlerta, string> = {
  CRITICA: 'text-danger',
  ALTA: 'text-orange-700',
  MEDIA: 'text-warning',
}

function EmpresaSummaryTable({ rows }: { rows: EmpresaSummary[] }) {
  if (rows.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-gray-900">Resumo por empresa</h2>
      <div className="space-y-2">
        {rows.map(row => (
          <Card key={row.empresa_id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-gray-900">{row.nome}</p>
              <p className="text-sm text-gray-500">
                {row.totalVeiculos} veículo(s) · {row.veiculosAtivos} disponíveis · {row.emManutencao} em manutenção
              </p>
            </div>
            <p className="text-lg font-semibold text-gray-900">{formatCurrency(row.custoMes)}</p>
          </Card>
        ))}
      </div>
    </section>
  )
}

export function DashboardPage() {
  const { profile } = useAuth()
  const { filterEmpresaId, isViewingAll, empresas, selectedEmpresaId } = useTenant()
  const { canViewGlobalFinancialMetrics, isMotorista, canViewGlobalAlerts, canViewMaintenance } = usePermissions()
  const [summary, setSummary] = useState<FleetSummaryResult>({
    total: 0, disponiveis: 0, emViagem: 0, emManutencao: 0, parados: 0, comAlerta: 0, ativos: 0,
  })
  const [alerts, setAlerts] = useState<FleetPriorityAlert[]>([])
  const [dashboard, setDashboard] = useState<MaintenanceDashboard | null>(null)
  const [totalGeral, setTotalGeral] = useState(0)
  const [periodLabel, setPeriodLabel] = useState('Custo total do mês')
  const [empresaSummaries, setEmpresaSummaries] = useState<EmpresaSummary[]>([])
  const [loading, setLoading] = useState(true)

  const selectedEmpresaNome = empresas.find(e => e.id === selectedEmpresaId)?.nome

  const load = useCallback(async () => {
    const tenant = { empresaId: filterEmpresaId }

    const requests: Promise<unknown>[] = [
      getFleetAlerts(tenant, profile),
      canViewGlobalAlerts ? getAlertasCount(tenant, profile) : Promise.resolve({ count: 0 }),
      isMotorista ? Promise.resolve({ data: null }) : getMaintenanceDashboard(tenant, profile),
      canViewGlobalFinancialMetrics ? getFinancialReport(tenant, profile) : Promise.resolve({ data: null }),
    ]

    if (isViewingAll) {
      requests.push(getEmpresaSummaries(profile))
    }

    const results = await Promise.all(requests)

    const fleetRes = results[0] as Awaited<ReturnType<typeof getFleetAlerts>>
    const dashRes = results[2] as Awaited<ReturnType<typeof getMaintenanceDashboard>>
    const finRes = results[3] as Awaited<ReturnType<typeof getFinancialReport>>

    if (fleetRes.data) {
      setSummary(fleetRes.data.summary)
      setAlerts(canViewMaintenance || canViewGlobalAlerts ? fleetRes.data.alerts : [])
    }
    if (dashRes.data) setDashboard(dashRes.data)
    if (finRes.data) {
      setTotalGeral(finRes.data.totalGeral)
      setPeriodLabel(finRes.data.periodLabel)
    }

    if (isViewingAll) {
      const empRes = results[4] as Awaited<ReturnType<typeof getEmpresaSummaries>>
      if (empRes.data) setEmpresaSummaries(empRes.data)
    } else {
      setEmpresaSummaries([])
    }

    setLoading(false)
  }, [filterEmpresaId, isViewingAll, canViewGlobalFinancialMetrics, isMotorista, canViewGlobalAlerts, canViewMaintenance, profile])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load, profile?.id])

  useDataRefresh(() => {
    setLoading(true)
    load()
  })

  const stats = [
    { label: 'Total de veículos', value: summary.total, color: 'text-gray-900' },
    { label: 'Disponíveis', value: summary.disponiveis, color: 'text-success' },
    { label: 'Em viagem', value: summary.emViagem, color: 'text-action' },
    { label: 'Em manutenção', value: summary.emManutencao, color: 'text-warning' },
    { label: 'Com alerta', value: summary.comAlerta, color: 'text-danger' },
  ]

  const atrasadas = alerts.filter(a => a.atrasada)
  const atencao = alerts.slice(0, 8)

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
      </div>
    )
  }

  return (
    <div>
      <Header showGreeting />
      <TenantSelector />

      <div className="space-y-6 px-4 py-6">
        {isViewingAll ? (
          <div className="rounded-xl bg-action/10 px-4 py-3 text-sm text-action">
            Dashboard Geral Corporativo — visão consolidada de todas as empresas
          </div>
        ) : selectedEmpresaNome ? (
          <div className="rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-700">
            Exibindo dados de: <strong>{selectedEmpresaNome}</strong>
          </div>
        ) : null}

        {canViewMaintenance && atrasadas.length > 0 && (
          <div className="rounded-xl border border-danger bg-danger/10 px-4 py-3">
            <p className="text-sm font-semibold text-danger">
              {atrasadas.length} manutenção(ões) atrasada(s) — atenção imediata
            </p>
          </div>
        )}

        {canViewMaintenance && alerts.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-gray-900">Avisos priorizados</h2>
            <div className="space-y-2">
              {alerts.slice(0, 5).map(alert => (
                <Link key={`${alert.veiculoId}-${alert.prioridade}`} to={`/veiculos/${alert.veiculoId}`}>
                  <Card className={`flex items-center justify-between ${PRIORIDADE_STYLES[alert.prioridade]}`}>
                    <div>
                      <p className="font-medium text-gray-900">
                        •••{formatPlacaCurta(alert.placa)} · {alert.modelo}
                      </p>
                      <p className="text-sm text-gray-600">{alert.mensagem}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${PRIORIDADE_TEXT[alert.prioridade]}`}>
                      {PRIORIDADE_ALERTA_LABELS[alert.prioridade]}
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map(stat => (
            <Card key={stat.label}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="mt-1 text-xs text-gray-500">{stat.label}</p>
            </Card>
          ))}
        </div>

        {dashboard && !isMotorista && (
          <DashboardCharts
            dashboard={dashboard}
            totalGeral={totalGeral}
            periodLabel={periodLabel}
            showCostCard={canViewGlobalFinancialMetrics}
            showStatusCharts={!isMotorista}
            costHref="/relatorios?tab=custos"
          />
        )}

        {isViewingAll && <EmpresaSummaryTable rows={empresaSummaries} />}

        {canViewMaintenance && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-gray-900">Atenção da frota</h2>
            {atencao.length === 0 ? (
              <Card>
                <p className="py-4 text-center text-sm text-gray-500">Nenhum veículo exige atenção agora.</p>
              </Card>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Placa</th>
                      <th className="px-3 py-2">Modelo</th>
                      <th className="px-3 py-2">Prioridade</th>
                      <th className="px-3 py-2">Prazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atencao.map(item => (
                      <tr key={item.veiculoId} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          <Link to={`/veiculos/${item.veiculoId}`} className="font-medium text-action">
                            •••{formatPlacaCurta(item.placa)}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{item.modelo}</td>
                        <td className={`px-3 py-2 font-semibold ${PRIORIDADE_TEXT[item.prioridade]}`}>
                          {PRIORIDADE_ALERTA_LABELS[item.prioridade]}
                        </td>
                        <td className="px-3 py-2 text-gray-600">
                          {item.atrasada
                            ? 'Atrasada'
                            : item.diasRestantes != null
                              ? `${item.diasRestantes} dia(s)`
                              : item.kmRestantes != null
                                ? `${item.kmRestantes.toLocaleString('pt-BR')} km`
                                : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
