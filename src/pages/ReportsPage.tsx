import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
} from 'recharts'
import { CalendarClock, Inbox } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { MaintenanceCard } from '@/components/MaintenanceCard'
import { MaintenanceDetailModal } from '@/components/MaintenanceDetailModal'
import { CostDrillDownDrawer } from '@/components/CostDrillDownDrawer'
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
import { formatCurrency } from '@/lib/maintenanceStatus'
import { formatPlacaCurta } from '@/lib/vehicleDisplay'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { useTenant } from '@/contexts/TenantContext'
import { usePermissions } from '@/hooks/usePermissions'
import { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'
import { getManutencaoData } from '@/lib/dbCompat'
import { ExecutiveExportCard } from '@/components/ExecutiveExportCard'

type ViewMode = 'executadas' | 'proximas' | 'custos' | 'pedidos'

const TYPE_COLORS = ['#2563eb', '#059669', '#d97706']

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
      <h2 className="mb-3 text-sm font-semibold text-fg">{title}</h2>
      {items.length === 0 ? (
        <EmptyState title={emptyMessage} />
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
    return <ListSkeleton rows={3} />
  }

  if (trips.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Sem viagens este mês"
        description="Você ainda não utilizou veículos. Solicite uma reserva na aba Veículos."
      />
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-muted">Histórico dos veículos que você utilizou</p>
      {trips.map(t => (
        <Card key={t.id}>
          <p className="font-medium text-fg">
            {t.veiculos ? `${t.veiculos.modelo ?? ''} · ${t.veiculos.placa}` : 'Veículo'}
          </p>
          <p className="text-sm text-fg-muted">{t.destino}</p>
          <p className="mt-1 text-xs text-fg-muted">
            {new Date(t.data_viagem).toLocaleString('pt-BR')}
            {t.data_fim ? ` — ${new Date(t.data_fim).toLocaleString('pt-BR')}` : ' — em andamento'}
          </p>
          {t.km_percorrido != null && (
            <p className="text-xs text-fg-muted">{t.km_percorrido.toLocaleString('pt-BR')} km percorridos</p>
          )}
          {t.status === 'REJEITADO' && (t.motivo_recusa || t.observacao_gestor) && (
            <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              Motivo da recusa: {t.motivo_recusa || t.observacao_gestor}
            </p>
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
      <EmptyState
        icon={Inbox}
        title="Nenhum pedido de relatório pendente"
        description="Quando um motorista solicitar acesso, o pedido aparecerá aqui."
      />
    )
  }

  return (
    <div className="space-y-2">
      {solicitacoes.map(s => (
        <Card key={s.id}>
          <p className="font-medium text-fg">
            {s.veiculos ? `${s.veiculos.modelo} - ${s.veiculos.placa}` : 'Veículo'}
          </p>
          <p className="text-xs text-fg-muted">
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
  const { filterEmpresaId, empresas, isViewingAll } = useTenant()
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

  const tenantName = isViewingAll
    ? 'Todas as empresas'
    : empresas.find(e => e.id === filterEmpresaId)?.nome
      ?? veiculos.find(v => v.empresas?.nome)?.empresas?.nome
      ?? 'FrotaMaq'

  return (
    <div>
      <Header title="Relatórios" />

      <div className="page-section">
        {isMotorista ? (
          <MotoristaTripHistory />
        ) : (
          <>
            {viewModes.length > 1 && (
              <div className="flex flex-wrap rounded-xl bg-surface-muted p-1">
                {viewModes.map(mode => (
                  <button
                    key={mode.key}
                    onClick={() => changeTab(mode.key)}
                    className={`flex-1 rounded-lg py-2 px-2 text-xs font-medium transition-colors sm:text-sm ${
                      viewMode === mode.key
                        ? 'bg-surface text-action shadow-sm'
                        : 'text-fg-muted hover:text-fg'
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

            {viewMode !== 'pedidos' && (
              <ExecutiveExportCard
                profile={profile}
                empresaId={filterEmpresaId}
                tenantName={tenantName}
                period={periodo}
                veiculoId={veiculoId}
                motoristaId={motoristaId}
                includeCosts={canViewGlobalFinancialMetrics}
              />
            )}

            {loading ? (
              <ListSkeleton rows={4} />
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
                    <Card className="text-center hover:border-action/40">
                      <p className="text-sm text-fg-muted">{periodLabel}</p>
                      <p className="mt-1 text-3xl font-bold text-fg">{formatCurrency(totalGeral)}</p>
                      <p className="mt-1 text-xs text-action">Toque para ver peças + mão de obra</p>
                    </Card>
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <Card>
                      <p className="text-xs text-fg-muted">Mão de obra</p>
                      <p className="text-lg font-semibold">{formatCurrency(totalMao)}</p>
                    </Card>
                    <Card>
                      <p className="text-xs text-fg-muted">Peças</p>
                      <p className="text-lg font-semibold">{formatCurrency(totalPecas)}</p>
                    </Card>
                  </div>

                  {veiculoId && (
                    <Card>
                      <p className="text-sm text-fg-muted">Custo do veículo no período</p>
                      <p className="text-2xl font-bold text-fg">{formatCurrency(totalGeral)}</p>
                    </Card>
                  )}

                  {rankingData.length > 0 && (
                    <Card>
                      <p className="mb-2 text-sm font-medium text-fg">Ranking de custo por veículo</p>
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
                      <p className="mb-2 text-sm font-medium text-fg">Impacto financeiro por tipo</p>
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
                    <h2 className="mb-3 text-sm font-semibold text-fg">Gasto por veículo</h2>
                    {costByVehicle.length === 0 ? (
                      <EmptyState title="Sem dados no período" description="Ajuste as datas ou o veículo para ver o ranking de custos." />
                    ) : (
                      <div className="space-y-2">
                        {costByVehicle.map(v => (
                          <Card key={v.veiculo_id} className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-fg">{v.modelo}</p>
                              <p className="text-sm text-fg-muted">{v.placa}</p>
                            </div>
                            <p className="font-semibold text-fg">{formatCurrency(v.total)}</p>
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

      <CostDrillDownDrawer
        isOpen={showDrillDown}
        onClose={() => setShowDrillDown(false)}
        periodLabel={periodLabel}
        totalGeral={totalGeral}
        totalMao={totalMao}
        totalPecas={totalPecas}
        breakdown={breakdown}
      />

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
