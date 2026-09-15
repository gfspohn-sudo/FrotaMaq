import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
} from 'recharts'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { MaintenanceCard } from '@/components/MaintenanceCard'
import { MaintenanceDetailModal } from '@/components/MaintenanceDetailModal'
import { Select } from '@/components/ui/Input'
import { getFinancialReport, getMaintenanceDashboard } from '@/services/reports'
import { getVeiculoReport } from '@/services/vehicleReports'
import { getVeiculosEscopoMotorista } from '@/services/solicitacoesRelatorio'
import { getVeiculos } from '@/services/vehicles'
import { TIPO_MANUTENCAO_LABELS } from '@/types/database'
import type { Manutencao, Veiculo } from '@/types/database'
import type { CostByType, CostByVehicle, MaintenanceDashboard } from '@/services/reports'
import { formatCurrency } from '@/lib/maintenanceStatus'
import { formatVehicleDisplayName } from '@/lib/vehicleDisplay'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { useTenant } from '@/contexts/TenantContext'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { VehicleReportAuthorizationService } from '@/domain/services/VehicleReportAuthorizationService'

type ViewMode = 'geral' | 'manutencoes' | 'custos'

const STATUS_COLORS = { concluidas: '#22c55e', proximas: '#f97316', vencidas: '#ef4444' }
const TYPE_COLORS = ['#2563eb', '#22c55e', '#f97316']

function MaintenanceListSection({
  title,
  items,
  emptyMessage,
  onSelect,
}: {
  title: string
  items: Manutencao[]
  emptyMessage: string
  onSelect: (m: Manutencao) => void
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>
      {items.length === 0 ? (
        <Card>
          <p className="py-4 text-center text-sm text-gray-500">{emptyMessage}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 5).map(m => (
            <MaintenanceCard key={m.id} manutencao={m} onClick={() => onSelect(m)} />
          ))}
          {items.length > 5 && (
            <p className="text-center text-xs text-gray-400">+ {items.length - 5} registros</p>
          )}
        </div>
      )}
    </section>
  )
}

function MotoristaScopedReports() {
  const { profile } = useAuth()
  const { filterEmpresaId, empresas } = useTenant()
  const [escopoIds, setEscopoIds] = useState<string[]>([])
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [nomeExibicao, setNomeExibicao] = useState('')
  const [totalGeral, setTotalGeral] = useState(0)
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)

  const loadEscopo = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data: ids } = await getVeiculosEscopoMotorista(profile.id)
    const escopo = ids ?? []
    setEscopoIds(escopo)

    const { data: allVeiculos } = await getVeiculos({ empresaId: filterEmpresaId })
    const filtered = VehicleReportAuthorizationService.filtrarVeiculosMotorista(allVeiculos ?? [], escopo)
    setVeiculos(filtered)
    if (filtered.length > 0 && !selectedId) {
      setSelectedId(filtered[0].id)
    }
    setLoading(false)
  }, [profile?.id, filterEmpresaId])

  const loadReport = useCallback(async (veiculoId: string) => {
    if (!veiculoId) return
    setLoadingReport(true)
    setError('')
    const { data, error: reportError } = await getVeiculoReport(profile, veiculoId)
    setLoadingReport(false)
    if (reportError) {
      setError(reportError.message)
      setManutencoes([])
      return
    }
    if (data) {
      setNomeExibicao(data.nomeExibicao)
      setTotalGeral(data.totalGeral)
      setManutencoes(data.manutencoes ?? [])
    }
  }, [profile])

  useEffect(() => { loadEscopo() }, [loadEscopo])
  useEffect(() => {
    if (selectedId) loadReport(selectedId)
  }, [selectedId, loadReport])
  useDataRefresh(loadEscopo)

  const vehicleOptions = useMemo(() => [
    { value: '', label: veiculos.length === 0 ? 'Nenhum veículo no seu histórico' : 'Selecione o veículo' },
    ...veiculos.map(v => ({
      value: v.id,
      label: formatVehicleDisplayName(
        v.empresas?.nome ?? empresas.find(e => e.id === v.empresa_id)?.nome ?? 'Frota',
        v.placa,
      ),
    })),
  ], [veiculos, empresas])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Select
        label="Veículo (seu histórico de uso)"
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        options={vehicleOptions}
        disabled={veiculos.length === 0}
      />

      {escopoIds.length === 0 && (
        <Card>
          <p className="py-6 text-center text-sm text-gray-500">
            Você ainda não possui reservas ou aluguéis. Solicite uma reserva na aba Veículos.
          </p>
        </Card>
      )}

      {loadingReport ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
        </div>
      ) : error ? (
        <Card>
          <p className="py-6 text-center text-sm text-danger">{error}</p>
        </Card>
      ) : selectedId && (
        <>
          <Card className="text-center">
            <p className="text-sm text-gray-500">{nomeExibicao}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{formatCurrency(totalGeral)}</p>
            <p className="mt-1 text-xs text-gray-400">Valor total em manutenções deste veículo</p>
          </Card>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-gray-900">
              Manutenções ({manutencoes.length})
            </h2>
            {manutencoes.length === 0 ? (
              <Card>
                <p className="py-4 text-center text-sm text-gray-500">Nenhuma manutenção registrada.</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {manutencoes.map(m => (
                  <MaintenanceCard key={m.id} manutencao={m} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export function ReportsPage() {
  const { filterEmpresaId } = useTenant()
  const { isMotorista, canViewGlobalFinancialMetrics } = usePermissions()
  const [viewMode, setViewMode] = useState<ViewMode>('geral')
  const [dashboard, setDashboard] = useState<MaintenanceDashboard | null>(null)
  const [totalGeral, setTotalGeral] = useState(0)
  const [periodLabel, setPeriodLabel] = useState('Custo total do mês')
  const [costByType, setCostByType] = useState<CostByType[]>([])
  const [costByVehicle, setCostByVehicle] = useState<CostByVehicle[]>([])
  const [selected, setSelected] = useState<Manutencao | null>(null)
  const [loading, setLoading] = useState(true)

  const viewModes = useMemo(() => {
    const modes: { key: ViewMode; label: string }[] = [
      { key: 'geral', label: 'Visualização Geral' },
      { key: 'manutencoes', label: 'Manutenções' },
    ]
    if (canViewGlobalFinancialMetrics) {
      modes.push({ key: 'custos', label: 'Custos' })
    }
    return modes
  }, [canViewGlobalFinancialMetrics])

  const load = useCallback(async () => {
    if (isMotorista) {
      setLoading(false)
      return
    }
    setLoading(true)
    const tenant = { empresaId: filterEmpresaId }
    const [dashRes, finRes] = await Promise.all([
      getMaintenanceDashboard(tenant),
      canViewGlobalFinancialMetrics ? getFinancialReport(tenant) : Promise.resolve({ data: null }),
    ])
    if (dashRes.data) setDashboard(dashRes.data)
    if (finRes.data) {
      setTotalGeral(finRes.data.totalGeral)
      setPeriodLabel(finRes.data.periodLabel)
      setCostByType(finRes.data.costByType)
      setCostByVehicle(finRes.data.costByVehicle)
    }
    setLoading(false)
  }, [filterEmpresaId, isMotorista, canViewGlobalFinancialMetrics])

  useEffect(() => { load() }, [load])
  useDataRefresh(load)

  const statusChartData = dashboard
    ? [
        { name: 'Concluídas', value: dashboard.statusCounts.concluidas, color: STATUS_COLORS.concluidas },
        { name: 'Próximas', value: dashboard.statusCounts.proximas, color: STATUS_COLORS.proximas },
        { name: 'Vencidas', value: dashboard.statusCounts.vencidas, color: STATUS_COLORS.vencidas },
      ].filter(d => d.value > 0)
    : []

  const typeChartData = dashboard
    ? [
        { name: 'Preventiva', value: dashboard.typeCounts.preventiva, color: TYPE_COLORS[0] },
        { name: 'Corretiva', value: dashboard.typeCounts.corretiva, color: TYPE_COLORS[1] },
        { name: 'Preditiva', value: dashboard.typeCounts.preditiva, color: TYPE_COLORS[2] },
      ].filter(d => d.value > 0)
    : []

  const costChartData = costByType.map(item => ({
    name: TIPO_MANUTENCAO_LABELS[item.tipo],
    value: item.total,
  }))

  const showMaintenance = viewMode === 'geral' || viewMode === 'manutencoes'
  const showCosts = canViewGlobalFinancialMetrics && (viewMode === 'geral' || viewMode === 'custos')

  return (
    <div>
      <Header title="Relatórios" />

      <div className="space-y-4 px-4 py-4">
        {isMotorista ? (
          <MotoristaScopedReports />
        ) : (
          <>
            {viewModes.length > 1 && (
              <div className="flex rounded-xl bg-gray-100 p-1">
                {viewModes.map(mode => (
                  <button
                    key={mode.key}
                    onClick={() => setViewMode(mode.key)}
                    className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors sm:text-sm ${
                      viewMode === mode.key
                        ? 'bg-white text-action shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
              </div>
            ) : (
              <>
                {showCosts && (
                  <Card className="text-center">
                    <p className="text-sm text-gray-500">{periodLabel}</p>
                    <p className="mt-1 text-3xl font-bold text-gray-900">{formatCurrency(totalGeral)}</p>
                  </Card>
                )}

                {showMaintenance && dashboard && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {statusChartData.length > 0 && (
                      <Card>
                        <p className="mb-2 text-sm font-medium text-gray-700">Status das manutenções</p>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={statusChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {statusChartData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </Card>
                    )}

                    {typeChartData.length > 0 && (
                      <Card>
                        <p className="mb-2 text-sm font-medium text-gray-700">Distribuição por tipo de manutenção</p>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={typeChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {typeChartData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </Card>
                    )}
                  </div>
                )}

                {showCosts && costChartData.length > 0 && (
                  <Card>
                    <p className="mb-2 text-sm font-medium text-gray-700">Impacto financeiro por tipo</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={costChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {costChartData.map((_, i) => (
                            <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {showMaintenance && dashboard && (
                  <div className="space-y-6">
                    <MaintenanceListSection
                      title="Manutenções vencidas"
                      items={dashboard.vencidas}
                      emptyMessage="Nenhuma manutenção vencida."
                      onSelect={setSelected}
                    />
                    <MaintenanceListSection
                      title="Veículos em manutenção"
                      items={dashboard.emManutencao}
                      emptyMessage="Nenhum veículo em manutenção no momento."
                      onSelect={setSelected}
                    />
                    <MaintenanceListSection
                      title="Próximas manutenções (30 dias)"
                      items={dashboard.proximas30}
                      emptyMessage="Nenhuma manutenção prevista para os próximos 30 dias."
                      onSelect={setSelected}
                    />
                    <MaintenanceListSection
                      title="Manutenções concluídas"
                      items={dashboard.concluidas}
                      emptyMessage="Nenhuma manutenção concluída registrada."
                      onSelect={setSelected}
                    />
                  </div>
                )}

                {showCosts && (
                  <section>
                    <h2 className="mb-3 text-sm font-semibold text-gray-900">Gasto por veículo</h2>
                    {costByVehicle.length === 0 ? (
                      <Card>
                        <p className="py-4 text-center text-sm text-gray-500">Sem dados no período.</p>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {costByVehicle.map(v => (
                          <Card key={v.veiculo_id} className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{v.modelo}</p>
                              <p className="text-sm text-gray-500">{v.placa}</p>
                            </div>
                            <p className="font-semibold text-gray-900">{formatCurrency(v.total)}</p>
                          </Card>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>

      <MaintenanceDetailModal
        manutencao={selected}
        onClose={() => setSelected(null)}
        veiculoKm={selected?.veiculos?.km_atual}
      />
    </div>
  )
}
