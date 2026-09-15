import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { TenantSelector } from '@/components/TenantSelector'
import { Card } from '@/components/ui/Card'
import { DashboardCharts } from '@/components/DashboardCharts'
import { getFleetSummary } from '@/services/vehicles'
import { getProximasManutencoes } from '@/services/maintenance'
import { getAlertasCount } from '@/services/alerts'
import {
  getMaintenanceDashboard,
  getFinancialReport,
  getEmpresaSummaries,
} from '@/services/reports'
import type { EmpresaSummary, MaintenanceDashboard } from '@/services/reports'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { useTenant } from '@/contexts/TenantContext'
import { usePermissions } from '@/hooks/usePermissions'
import { formatCurrency } from '@/lib/maintenanceStatus'
import type { Manutencao } from '@/types/database'

function daysUntil(dateStr: string) {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return diff
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
                {row.totalVeiculos} veículo(s) · {row.veiculosAtivos} ativos · {row.emManutencao} em manutenção
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
  const { filterEmpresaId, isViewingAll, empresas, selectedEmpresaId } = useTenant()
  const { canViewGlobalFinancialMetrics, isMotorista, canViewGlobalAlerts } = usePermissions()
  const [summary, setSummary] = useState({ ativos: 0, emManutencao: 0, parados: 0, total: 0 })
  const [alertasCount, setAlertasCount] = useState(0)
  const [proximas, setProximas] = useState<Manutencao[]>([])
  const [dashboard, setDashboard] = useState<MaintenanceDashboard | null>(null)
  const [totalGeral, setTotalGeral] = useState(0)
  const [periodLabel, setPeriodLabel] = useState('Custo total do mês')
  const [empresaSummaries, setEmpresaSummaries] = useState<EmpresaSummary[]>([])
  const [loading, setLoading] = useState(true)

  const selectedEmpresaNome = empresas.find(e => e.id === selectedEmpresaId)?.nome

  const load = useCallback(async () => {
    const tenant = { empresaId: filterEmpresaId }

    const requests: Promise<unknown>[] = [
      getFleetSummary(tenant),
      canViewGlobalAlerts ? getAlertasCount(tenant) : Promise.resolve({ count: 0 }),
      getProximasManutencoes(5, tenant),
      isMotorista ? Promise.resolve({ data: null }) : getMaintenanceDashboard(tenant),
      canViewGlobalFinancialMetrics ? getFinancialReport(tenant) : Promise.resolve({ data: null }),
    ]

    if (isViewingAll) {
      requests.push(getEmpresaSummaries())
    }

    const results = await Promise.all(requests)

    const fleetRes = results[0] as Awaited<ReturnType<typeof getFleetSummary>>
    const alertasRes = results[1] as Awaited<ReturnType<typeof getAlertasCount>>
    const manutencoesRes = results[2] as Awaited<ReturnType<typeof getProximasManutencoes>>
    const dashRes = results[3] as Awaited<ReturnType<typeof getMaintenanceDashboard>>
    const finRes = results[4] as Awaited<ReturnType<typeof getFinancialReport>>

    if (fleetRes.data) setSummary(fleetRes.data)
    setAlertasCount(alertasRes.count)
    if (manutencoesRes.data) setProximas(manutencoesRes.data)
    if (dashRes.data) setDashboard(dashRes.data)
    if (finRes.data) {
      setTotalGeral(finRes.data.totalGeral)
      setPeriodLabel(finRes.data.periodLabel)
    }

    if (isViewingAll) {
      const empRes = results[5] as Awaited<ReturnType<typeof getEmpresaSummaries>>
      if (empRes.data) setEmpresaSummaries(empRes.data)
    } else {
      setEmpresaSummaries([])
    }

    setLoading(false)
  }, [filterEmpresaId, isViewingAll, canViewGlobalFinancialMetrics, isMotorista, canViewGlobalAlerts])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useDataRefresh(() => {
    setLoading(true)
    load()
  })

  const stats = [
    { label: 'Veículos ativos', value: summary.ativos, color: 'text-success' },
    { label: 'Em manutenção', value: summary.emManutencao, color: 'text-warning' },
    { label: 'Parados', value: summary.parados, color: 'text-danger' },
    ...(canViewGlobalAlerts
      ? [{ label: 'Alertas ativos', value: alertasCount, color: 'text-danger' }]
      : []),
  ]

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

        <div className="grid grid-cols-2 gap-3">
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
          />
        )}

        {isViewingAll && <EmpresaSummaryTable rows={empresaSummaries} />}

        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-900">Próximas manutenções</h2>
          {proximas.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-500 text-center py-4">Nenhuma manutenção agendada.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {proximas.map(m => {
                const days = daysUntil(m.data_hora)
                const vehicleName = m.veiculos
                  ? `${m.veiculos.modelo} - ${m.veiculos.placa}`
                  : 'Veículo'

                return (
                  <Link key={m.id} to={`/veiculos/${m.veiculo_id}`}>
                    <Card className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{vehicleName}</p>
                        <p className="text-sm text-gray-500">{m.descricao}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(m.data_hora).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        days <= 3 ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
                      }`}>
                        {days <= 0 ? 'Hoje' : `${days} dias`}
                      </span>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
