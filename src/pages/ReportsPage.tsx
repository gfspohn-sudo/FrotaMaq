import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
} from 'recharts'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { MaintenanceCard } from '@/components/MaintenanceCard'
import { MaintenanceDetailModal } from '@/components/MaintenanceDetailModal'
import { Input, Select } from '@/components/ui/Input'
import { getFinancialReport, getMaintenanceDashboard } from '@/services/reports'
import {
  getSolicitacoesRelatorio,
  aprovarSolicitacaoRelatorio,
  rejeitarSolicitacaoRelatorio,
} from '@/services/solicitacoesRelatorio'
import type { SolicitacaoRelatorio } from '@/services/solicitacoesRelatorio'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { getVeiculos } from '@/services/vehicles'
import { getReservas, getDriverTripHistory } from '@/services/reservas'
import { TIPO_MANUTENCAO_LABELS } from '@/types/database'
import type { Manutencao, Reserva, Veiculo } from '@/types/database'
import type { CostBreakdownItem, CostByType, CostByVehicle, MaintenanceDashboard } from '@/services/reports'
import { formatCurrency, formatDate } from '@/lib/maintenanceStatus'
import { formatPlacaCurta } from '@/lib/vehicleDisplay'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { useTenant } from '@/contexts/TenantContext'
import { usePermissions } from '@/hooks/usePermissions'
import { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'
import { getManutencaoData } from '@/lib/dbCompat'

type ViewMode = 'executadas' | 'proximas' | 'custos' | 'pedidos'

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
          {items.map(m => (
            <MaintenanceCard key={m.id} manutencao={m} onClick={() => onSelect(m)} />
          ))}
        </div>
      )}
    </section>
  )
}

function MotoristaTripHistory() {
  const { profile } = useAuth()
  const [trips, setTrips] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getDriverTripHistory(profile)
    setTrips(data ?? [])
    setLoading(false)
  }, [profile])

  useEffect(() => { load() }, [load])
  useDataRefresh(load)

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
      </div>
    )
  }

  if (trips.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-sm text-gray-500">
          Você ainda não utilizou veículos. Solicite uma reserva na aba Veículos.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Histórico dos veículos que você utilizou</p>
      {trips.map(t => (
        <Card key={t.id}>
          <p className="font-medium text-gray-900">
            {t.veiculos ? `${t.veiculos.modelo ?? ''} · ${t.veiculos.placa}` : 'Veículo'}
          </p>
          <p className="text-sm text-gray-600">{t.destino}</p>
          <p className="mt-1 text-xs text-gray-500">
            {new Date(t.data_viagem).toLocaleString('pt-BR')}
            {t.data_fim ? ` — ${new Date(t.data_fim).toLocaleString('pt-BR')}` : ' — em andamento'}
          </p>
          {t.km_percorrido != null && (
            <p className="text-xs text-gray-500">{t.km_percorrido.toLocaleString('pt-BR')} km percorridos</p>
          )}
        </Card>
      ))}
    </div>
  )
}

function PedidosRelatorioPanel({
  solicitacoes,
  onRefresh,
}: {
  solicitacoes: SolicitacaoRelatorio[]
  onRefresh: () => void
}) {
  const { profile } = useAuth()

  if (solicitacoes.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-sm text-gray-500">Nenhum pedido de relatório pendente.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {solicitacoes.map(s => (
        <Card key={s.id}>
          <p className="font-medium text-gray-900">
            {s.veiculos ? `${s.veiculos.modelo} - ${s.veiculos.placa}` : 'Veículo'}
          </p>
          <p className="text-xs text-gray-500">
            {s.usuarios?.nome ? `Solicitado por ${s.usuarios.nome}` : 'Solicitação de acesso a relatório'}
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => aprovarSolicitacaoRelatorio(profile, s.id).then(onRefresh)}
            >
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="danger"
              className="flex-1"
              onClick={() => rejeitarSolicitacaoRelatorio(profile, s.id).then(onRefresh)}
            >
              Rejeitar
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

export function ReportsPage() {
  const { profile } = useAuth()
  const { filterEmpresaId } = useTenant()
  const { isMotorista, canViewGlobalFinancialMetrics, canApproveReportAccess } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [viewMode, setViewMode] = useState<ViewMode>(
    tabParam === 'custos' && canViewGlobalFinancialMetrics ? 'custos' : 'executadas',
  )
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoRelatorio[]>([])
  const [dashboard, setDashboard] = useState<MaintenanceDashboard | null>(null)
  const [totalGeral, setTotalGeral] = useState(0)
  const [totalMao, setTotalMao] = useState(0)
  const [totalPecas, setTotalPecas] = useState(0)
  const [periodLabel, setPeriodLabel] = useState('Custo total do mês')
  const [costByType, setCostByType] = useState<CostByType[]>([])
  const [costByVehicle, setCostByVehicle] = useState<CostByVehicle[]>([])
  const [breakdown, setBreakdown] = useState<CostBreakdownItem[]>([])
  const [showDrillDown, setShowDrillDown] = useState(false)
  const [selected, setSelected] = useState<Manutencao | null>(null)
  const [loading, setLoading] = useState(true)
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [veiculoId, setVeiculoId] = useState('')
  const [motoristaId, setMotoristaId] = useState('')
  const [startDate, setStartDate] = useState(() => PeriodoFinanceiro.mesAtual().startDate)
  const [endDate, setEndDate] = useState(() => PeriodoFinanceiro.mesAtual().endDate)

  const viewModes = useMemo(() => {
    const modes: { key: ViewMode; label: string }[] = [
      { key: 'executadas', label: 'Manutenções executadas' },
      { key: 'proximas', label: 'Próximas manutenções' },
    ]
    if (canViewGlobalFinancialMetrics) {
      modes.push({ key: 'custos', label: 'Custos por período' })
    }
    if (canApproveReportAccess) {
      modes.push({ key: 'pedidos', label: 'Pedidos' })
    }
    return modes
  }, [canViewGlobalFinancialMetrics, canApproveReportAccess])

  const periodo = useMemo(
    () => PeriodoFinanceiro.fromDates(startDate, endDate),
    [startDate, endDate],
  )

  const motoristaOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of reservas) {
      if (r.motorista_id && !map.has(r.motorista_id)) {
        map.set(r.motorista_id, r.usuarios?.nome ?? r.motorista_id)
      }
    }
    return [
      { value: '', label: 'Todos os motoristas' },
      ...[...map.entries()].map(([id, nome]) => ({ value: id, label: nome })),
    ]
  }, [reservas])

  const load = useCallback(async () => {
    if (isMotorista) {
      setLoading(false)
      return
    }
    setLoading(true)
    const tenant = { empresaId: filterEmpresaId }
    const [dashRes, finRes, solicitacoesRes, veiculosRes, reservasRes] = await Promise.all([
      getMaintenanceDashboard(tenant, profile),
      canViewGlobalFinancialMetrics
        ? getFinancialReport({ ...tenant, period: periodo, veiculoId: veiculoId || undefined }, profile)
        : Promise.resolve({ data: null }),
      canApproveReportAccess
        ? getSolicitacoesRelatorio(profile, { empresaId: filterEmpresaId, status: 'PENDENTE' })
        : Promise.resolve({ data: null }),
      getVeiculos(tenant, profile),
      getReservas(profile, { empresaId: filterEmpresaId }),
    ])
    if (dashRes.data) setDashboard(dashRes.data)
    if (finRes.data) {
      setTotalGeral(finRes.data.totalGeral)
      setTotalMao(finRes.data.totalMaoDeObra ?? 0)
      setTotalPecas(finRes.data.totalPecas ?? 0)
      setPeriodLabel(finRes.data.periodLabel)
      setCostByType(finRes.data.costByType)
      let vehicles = finRes.data.costByVehicle
      if (motoristaId) {
        const ids = new Set(
          (reservasRes.data ?? []).filter(r => r.motorista_id === motoristaId).map(r => r.veiculo_id),
        )
        vehicles = vehicles.filter(v => ids.has(v.veiculo_id))
      }
      setCostByVehicle(vehicles)
      setBreakdown(finRes.data.breakdown ?? [])
    }
    if (solicitacoesRes.data) setSolicitacoes(solicitacoesRes.data)
    if (veiculosRes.data) setVeiculos(veiculosRes.data)
    if (reservasRes.data) setReservas(reservasRes.data)
    setLoading(false)
  }, [
    filterEmpresaId, isMotorista, canViewGlobalFinancialMetrics, canApproveReportAccess,
    profile, periodo, veiculoId, motoristaId,
  ])

  useEffect(() => { load() }, [load])
  useDataRefresh(load)

  function changeTab(mode: ViewMode) {
    setViewMode(mode)
    if (mode === 'custos') setSearchParams({ tab: 'custos' })
    else setSearchParams({})
  }

  const filteredExecutadas = useMemo(() => {
    let items = dashboard?.concluidas ?? []
    if (veiculoId) items = items.filter(m => m.veiculo_id === veiculoId)
    if (motoristaId) {
      const ids = new Set(reservas.filter(r => r.motorista_id === motoristaId).map(r => r.veiculo_id))
      items = items.filter(m => ids.has(m.veiculo_id))
    }
    items = items.filter(m => periodo.contemTimestamp(getManutencaoData(m)))
    return items
  }, [dashboard, veiculoId, motoristaId, reservas, periodo])

  const proximasPorTipo = useMemo(() => {
    const items = [...(dashboard?.proximas30 ?? []), ...(dashboard?.vencidas ?? [])]
    const groups = new Map<string, Manutencao[]>()
    for (const m of items) {
      const tipo = (m.tipo_normalizado ?? m.tipo ?? 'preventiva').toLowerCase()
      const list = groups.get(tipo) ?? []
      list.push(m)
      groups.set(tipo, list)
    }
    return groups
  }, [dashboard])

  const costChartData = costByType.map(item => ({
    name: TIPO_MANUTENCAO_LABELS[item.tipo],
    value: item.total,
  }))

  const rankingData = costByVehicle.slice(0, 8).map(v => ({
    name: formatPlacaCurta(v.placa) || v.modelo,
    total: v.total,
  }))

  return (
    <div>
      <Header title="Relatórios" />

      <div className="space-y-4 px-4 py-4">
        {isMotorista ? (
          <MotoristaTripHistory />
        ) : (
          <>
            {viewModes.length > 1 && (
              <div className="flex flex-wrap rounded-xl bg-gray-100 p-1">
                {viewModes.map(mode => (
                  <button
                    key={mode.key}
                    onClick={() => changeTab(mode.key)}
                    className={`flex-1 rounded-lg py-2 px-2 text-xs font-medium transition-colors sm:text-sm ${
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

            {viewMode !== 'pedidos' && (
              <Card className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Data início" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <Input label="Data fim" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                <Select
                  label="Veículo"
                  value={veiculoId}
                  onChange={e => setVeiculoId(e.target.value)}
                  options={[
                    { value: '', label: 'Todos os veículos' },
                    ...veiculos.map(v => ({ value: v.id, label: `${v.placa} · ${v.modelo ?? ''}` })),
                  ]}
                />
                <Select
                  label="Motorista"
                  value={motoristaId}
                  onChange={e => setMotoristaId(e.target.value)}
                  options={motoristaOptions}
                />
              </Card>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
              </div>
            ) : viewMode === 'pedidos' ? (
              <PedidosRelatorioPanel solicitacoes={solicitacoes} onRefresh={load} />
            ) : viewMode === 'executadas' ? (
              <MaintenanceListSection
                title="Manutenções executadas no período"
                items={filteredExecutadas}
                emptyMessage="Nenhuma manutenção executada no filtro selecionado."
                onSelect={setSelected}
              />
            ) : viewMode === 'proximas' ? (
              <div className="space-y-6">
                <MaintenanceListSection
                  title="Atrasadas / vencidas"
                  items={dashboard?.vencidas ?? []}
                  emptyMessage="Nenhuma manutenção atrasada."
                  onSelect={setSelected}
                />
                {[...proximasPorTipo.entries()].map(([tipo, items]) => (
                  <MaintenanceListSection
                    key={tipo}
                    title={`${TIPO_MANUTENCAO_LABELS[tipo as keyof typeof TIPO_MANUTENCAO_LABELS] ?? tipo} — por km/data`}
                    items={items}
                    emptyMessage="Sem registros."
                    onSelect={setSelected}
                  />
                ))}
              </div>
            ) : (
              canViewGlobalFinancialMetrics && (
                <>
                  <button type="button" className="w-full text-left" onClick={() => setShowDrillDown(true)}>
                    <Card className="text-center hover:bg-gray-50">
                      <p className="text-sm text-gray-500">{periodLabel}</p>
                      <p className="mt-1 text-3xl font-bold text-gray-900">{formatCurrency(totalGeral)}</p>
                      <p className="mt-1 text-xs text-action">Toque para ver peças + mão de obra</p>
                    </Card>
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <Card>
                      <p className="text-xs text-gray-500">Mão de obra</p>
                      <p className="text-lg font-semibold">{formatCurrency(totalMao)}</p>
                    </Card>
                    <Card>
                      <p className="text-xs text-gray-500">Peças</p>
                      <p className="text-lg font-semibold">{formatCurrency(totalPecas)}</p>
                    </Card>
                  </div>

                  {veiculoId && (
                    <Card>
                      <p className="text-sm text-gray-500">Custo do veículo no período</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalGeral)}</p>
                    </Card>
                  )}

                  {rankingData.length > 0 && (
                    <Card>
                      <p className="mb-2 text-sm font-medium text-gray-700">Ranking de custo por veículo</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={rankingData}>
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  )}

                  {costChartData.length > 0 && (
                    <Card>
                      <p className="mb-2 text-sm font-medium text-gray-700">Impacto financeiro por tipo</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={costChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
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
                </>
              )
            )}
          </>
        )}
      </div>

      {showDrillDown && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDrillDown(false)} />
          <div className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h3 className="text-lg font-semibold">Discriminação do custo</h3>
            <p className="text-sm text-gray-500">{periodLabel}</p>
            <div className="mt-3 space-y-2">
              {breakdown.length === 0 ? (
                <p className="text-sm text-gray-500">Sem itens no período.</p>
              ) : breakdown.map(item => (
                <Card key={item.manutencaoId}>
                  <p className="text-sm font-medium">{item.descricao}</p>
                  <p className="text-xs text-gray-500">{item.placa} · {formatDate(item.dataHora)}</p>
                  <p className="mt-1 text-sm">Mão de obra {formatCurrency(item.valorMaoDeObra)} · Peças {formatCurrency(item.valorPecas)}</p>
                  <p className="font-semibold">{formatCurrency(item.valorTotal)}</p>
                </Card>
              ))}
            </div>
            <Button className="mt-4 w-full" variant="secondary" onClick={() => setShowDrillDown(false)}>
              Fechar
            </Button>
          </div>
        </div>
      )}

      <MaintenanceDetailModal
        manutencao={selected}
        onClose={() => setSelected(null)}
        veiculoKm={
          selected?.veiculos
            ? (selected.veiculos.quilometragem_atual ?? selected.veiculos.km_atual ?? undefined)
            : undefined
        }
      />
    </div>
  )
}
