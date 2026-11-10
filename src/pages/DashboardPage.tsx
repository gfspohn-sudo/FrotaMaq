import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Car, CircleCheck, PauseCircle, Truck, Wrench } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { KpiCard } from '@/components/ui/KpiCard'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { PlateBadge } from '@/components/ui/PlateBadge'
import { DataTable, DataTableHead, DataTableBody, DataTh, DataTd, DataTr } from '@/components/ui/DataTable'
import { DashboardCharts } from '@/components/DashboardCharts'
import { CostDrillDownDrawer } from '@/components/CostDrillDownDrawer'
import { getFleetAlerts } from '@/services/vehicles'
import { getAlertasCount } from '@/services/alerts'
import {
  getMaintenanceDashboard,
  getFinancialReport,
  getEmpresaSummaries,
} from '@/services/reports'
import type { CostBreakdownItem, EmpresaSummary, MaintenanceDashboard } from '@/services/reports'
import type { FleetPriorityAlert } from '@/domain/services/FleetPriorityAlertService'
import type { FleetSummaryResult } from '@/domain/services/MaintenanceDashboardService'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { usePermissions } from '@/hooks/usePermissions'
import { formatCurrency } from '@/lib/maintenanceStatus'
import { PRIORIDADE_ALERTA_LABELS, type PrioridadeAlerta } from '@/types/database'
import { IaInsightsCard } from '@/components/IaInsightsCard'
import { EsgDashboardCard } from '@/components/EsgDashboardCard'
import { MaintenanceFormModal } from '@/components/MaintenanceFormModal'

const PRIORIDADE_STYLES: Record<PrioridadeAlerta, string> = {
  CRITICA: 'border-l-4 border-l-danger bg-danger/10',
  ALTA: 'border-l-4 border-l-warning bg-warning/10',
  MEDIA: 'border-l-4 border-l-warning/60 bg-warning/5',
}

const PRIORIDADE_TEXT: Record<PrioridadeAlerta, string> = {
  CRITICA: 'text-danger',
  ALTA: 'text-warning',
  MEDIA: 'text-warning',
}

function EmpresaSummaryTable({ rows }: { rows: EmpresaSummary[] }) {
  if (rows.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-fg">Resumo por empresa</h2>
      <DataTable>
        <DataTableHead>
          <tr>
            <DataTh>Empresa</DataTh>
            <DataTh>Frota</DataTh>
            <DataTh>Custo do mês</DataTh>
          </tr>
        </DataTableHead>
        <DataTableBody>
          {rows.map(row => (
            <DataTr key={row.empresa_id}>
              <DataTd>
                <p className="font-medium">{row.nome}</p>
                <p className="text-xs text-fg-muted">
                  {row.veiculosAtivos} disponíveis · {row.emManutencao} em manutenção
                </p>
              </DataTd>
              <DataTd>{row.totalVeiculos} veículo(s)</DataTd>
              <DataTd className="font-semibold">{formatCurrency(row.custoMes)}</DataTd>
            </DataTr>
          ))}
        </DataTableBody>
      </DataTable>
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
  const [totalMao, setTotalMao] = useState(0)
  const [totalPecas, setTotalPecas] = useState(0)
  const [breakdown, setBreakdown] = useState<CostBreakdownItem[]>([])
  const [showCostDrawer, setShowCostDrawer] = useState(false)
  const [periodLabel, setPeriodLabel] = useState('Custo total do mês')
  const [empresaSummaries, setEmpresaSummaries] = useState<EmpresaSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [agendarVeiculoId, setAgendarVeiculoId] = useState<string | null>(null)

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

    try {
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
        setTotalMao(finRes.data.totalMaoDeObra ?? 0)
        setTotalPecas(finRes.data.totalPecas ?? 0)
        setBreakdown(finRes.data.breakdown ?? [])
        setPeriodLabel(finRes.data.periodLabel)
      }

      if (isViewingAll) {
        const empRes = results[4] as Awaited<ReturnType<typeof getEmpresaSummaries>>
        if (empRes.data) setEmpresaSummaries(empRes.data)
      } else {
        setEmpresaSummaries([])
      }
    } catch {
      // Mantém a estrutura da tela com o último estado conhecido enquanto o Supabase reconecta.
    } finally {
      setLoading(false)
    }
  }, [filterEmpresaId, isViewingAll, canViewGlobalFinancialMetrics, isMotorista, canViewGlobalAlerts, canViewMaintenance, profile])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load, profile?.id])

  useDataRefresh(() => {
    setLoading(true)
    load()
  })

  const stats: {
    label: string
    value: number
    tone: 'neutral' | 'success' | 'action' | 'warning' | 'inactive' | 'danger'
    icon: ComponentType<{ className?: string }>
    href?: string
  }[] = [
    { label: 'Total de veículos', value: summary.total, tone: 'neutral', icon: Car, href: '/veiculos' },
    { label: 'Disponíveis', value: summary.disponiveis, tone: 'success', icon: CircleCheck, href: '/veiculos?status=disponivel' },
    { label: 'Em viagem', value: summary.emViagem, tone: 'action', icon: Truck, href: isMotorista ? undefined : '/veiculos?status=em_viagem' },
    { label: 'Em manutenção', value: summary.emManutencao, tone: 'warning', icon: Wrench, href: isMotorista ? undefined : '/veiculos?status=em_manutencao' },
    { label: 'Parados', value: summary.parados, tone: 'inactive', icon: PauseCircle, href: isMotorista ? undefined : '/veiculos?status=parado' },
    { label: 'Com alerta', value: summary.comAlerta, tone: 'danger', icon: AlertTriangle, href: canViewGlobalAlerts ? '/alertas' : undefined },
  ]

  const atrasadas = alerts.filter(a => a.atrasada)
  const atencao = alerts.slice(0, 8)

  if (loading) {
    return (
      <div>
        <Header showGreeting />
        <PageSkeleton />
      </div>
    )
  }

  return (
    <div>
      <Header showGreeting />

      <div className="page-section">
        {isViewingAll ? (
          <div className="rounded-xl border border-action/20 bg-action/10 px-4 py-3 text-sm text-action">
            Dashboard Geral Corporativo — visão consolidada de todas as empresas
          </div>
        ) : selectedEmpresaNome ? (
          <div className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-fg-muted">
            Exibindo dados de: <strong className="text-fg">{selectedEmpresaNome}</strong>
          </div>
        ) : null}

        {canViewMaintenance && atrasadas.length > 0 && (
          <div className="pulse-alert rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
            <p className="text-sm font-semibold text-danger">
              {atrasadas.length} manutenção(ões) atrasada(s) — atenção imediata
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {stats.map(stat => (
            <KpiCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              tone={stat.tone}
              href={stat.href}
            />
          ))}
        </div>

        {!isMotorista && <EsgDashboardCard />}

        {canViewMaintenance && (
          <IaInsightsCard
            scope="dashboard"
            onAgendarManutencao={veiculoId => setAgendarVeiculoId(veiculoId)}
          />
        )}

        {canViewMaintenance && alerts.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-fg">Avisos priorizados</h2>
            <div className="space-y-2">
              {alerts.slice(0, 5).map(alert => (
                <Link key={`${alert.veiculoId}-${alert.prioridade}`} to={`/veiculos/${alert.veiculoId}`}>
                  <Card className={`flex items-center justify-between ${PRIORIDADE_STYLES[alert.prioridade]}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <PlateBadge placa={alert.placa} compact />
                        <p className="font-medium text-fg">{alert.modelo}</p>
                      </div>
                      <p className="mt-1 text-sm text-fg-muted">{alert.mensagem}</p>
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

        {dashboard && !isMotorista && (
          <DashboardCharts
            dashboard={dashboard}
            totalGeral={totalGeral}
            periodLabel={periodLabel}
            showCostCard={canViewGlobalFinancialMetrics}
            showStatusCharts={!isMotorista}
            onCostClick={() => setShowCostDrawer(true)}
          />
        )}

        {isViewingAll && <EmpresaSummaryTable rows={empresaSummaries} />}

        {canViewMaintenance && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-fg">Atenção da frota</h2>
            {atencao.length === 0 ? (
              <EmptyState
                icon={CircleCheck}
                title="Nenhum veículo exige atenção agora"
                description="A frota está operando dentro dos prazos de manutenção."
              />
            ) : (
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTh>Placa</DataTh>
                    <DataTh>Modelo</DataTh>
                    <DataTh>Prioridade</DataTh>
                    <DataTh>Prazo</DataTh>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {atencao.map(item => (
                    <DataTr key={item.veiculoId}>
                      <DataTd>
                        <Link to={`/veiculos/${item.veiculoId}`}>
                          <PlateBadge placa={item.placa} compact />
                        </Link>
                      </DataTd>
                      <DataTd className="text-fg-muted">{item.modelo}</DataTd>
                      <DataTd className={`font-semibold ${PRIORIDADE_TEXT[item.prioridade]}`}>
                        {PRIORIDADE_ALERTA_LABELS[item.prioridade]}
                      </DataTd>
                      <DataTd className="text-fg-muted">
                        {item.atrasada
                          ? 'Atrasada'
                          : item.diasRestantes != null
                            ? `${item.diasRestantes} dia(s)`
                            : item.kmRestantes != null
                              ? `${item.kmRestantes.toLocaleString('pt-BR')} km`
                              : '—'}
                      </DataTd>
                    </DataTr>
                  ))}
                </DataTableBody>
              </DataTable>
            )}
          </section>
        )}
      </div>

      <MaintenanceFormModal
        isOpen={agendarVeiculoId != null}
        onClose={() => setAgendarVeiculoId(null)}
        veiculoId={agendarVeiculoId ?? undefined}
        onSuccess={() => {
          setAgendarVeiculoId(null)
          load()
        }}
      />

      <CostDrillDownDrawer
        isOpen={showCostDrawer}
        onClose={() => setShowCostDrawer(false)}
        periodLabel={periodLabel}
        totalGeral={totalGeral}
        totalMao={totalMao}
        totalPecas={totalPecas}
        breakdown={breakdown}
      />
    </div>
  )
}
