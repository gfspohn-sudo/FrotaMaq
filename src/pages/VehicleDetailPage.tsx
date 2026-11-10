import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Car, Download, Gauge, Pencil, Trash2, Droplets, Filter, CircleDot, Wrench } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageSkeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { PlateBadge } from '@/components/ui/PlateBadge'
import { Timeline } from '@/components/ui/Timeline'
import { MaintenanceFormModal } from '@/components/MaintenanceFormModal'
import { MaintenanceDetailModal } from '@/components/MaintenanceDetailModal'
import { MaintenanceCard } from '@/components/MaintenanceCard'
import { VehicleFormModal } from '@/components/VehicleFormModal'
import { getVeiculoById, deleteVeiculo, updateVeiculo } from '@/services/vehicles'
import { safeHttpsUrl } from '@/lib/safeMediaUrl'
import { getManutencoes } from '@/services/maintenance'
import {
  solicitarAcessoRelatorio,
  getSolicitacoesRelatorio,
} from '@/services/solicitacoesRelatorio'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import type { AuditLog, Veiculo, Manutencao } from '@/types/database'
import {
  URGENCY_BORDER,
  URGENCY_BG,
  URGENCY_TEXT,
  URGENCY_LABELS,
} from '@/types/database'
import { getMaintenanceUrgency, formatDate, formatCurrency } from '@/lib/maintenanceStatus'
import { formatVehicleDisplayName, formatVehicleSubtitle } from '@/lib/vehicleDisplay'
import {
  getManutencaoData,
  getManutencaoProximaData,
  getManutencaoStatus,
  getVeiculoKm,
  getVeiculoMarca,
  getVeiculoModelo,
  isManutencaoAtiva,
} from '@/lib/dbCompat'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { downloadVehicleReportCsv } from '@/services/vehicleReportExport'
import { IaInsightsCard } from '@/components/IaInsightsCard'
import { AuditTimeline } from '@/components/AuditTimeline'
import { getAuditLogs } from '@/services/auditLog'

type Tab = 'resumo' | 'manutencoes' | 'historico'

interface ReviewItem {
  label: string
  status: 'ok' | 'warning' | 'overdue'
  icon: React.ReactNode
}

function deriveReviewItems(manutencoes: Manutencao[], kmAtual: number): ReviewItem[] {
  const keywords = [
    { label: 'Troca de óleo', terms: ['oleo', 'óleo', 'lubrific'], icon: <Droplets className="h-4 w-4" /> },
    { label: 'Filtros', terms: ['filtro'], icon: <Filter className="h-4 w-4" /> },
    { label: 'Pneus', terms: ['pneu', 'pneus', 'rodizio', 'rodízio'], icon: <CircleDot className="h-4 w-4" /> },
  ]

  return keywords.map(({ label, terms, icon }) => {
    const related = manutencoes.filter(m =>
      getManutencaoStatus(m) === 'concluida' &&
      (terms.some(t => m.descricao.toLowerCase().includes(t)) ||
        terms.some(t => (getManutencaoProximaData(m) ?? m.descricao).toLowerCase().includes(t))),
    )

    const latest = related[0]
    if (!latest) {
      return { label, status: 'warning' as const, icon }
    }

    const urgency = getMaintenanceUrgency(latest, kmAtual)
    return { label, status: urgency, icon }
  })
}

function parseVehicleTab(value: string | null): Tab {
  return value === 'historico' || value === 'manutencoes' || value === 'resumo' ? value : 'resumo'
}

export function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()
  const {
    canCreateMaintenance,
    canManageVehicles,
    canUpdateKm,
    canOpenReportDirectly,
    canRequestReportAccess,
    canViewMaintenance,
  } = usePermissions()
  const [reportAccessStatus, setReportAccessStatus] = useState<'none' | 'PENDENTE' | 'APROVADO' | 'REJEITADO'>('none')
  const [requestingReport, setRequestingReport] = useState(false)
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null)
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [tab, setTab] = useState<Tab>(() => parseVehicleTab(searchParams.get('tab')))
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedMaintenance, setSelectedMaintenance] = useState<Manutencao | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editingKm, setEditingKm] = useState(false)
  const [kmValue, setKmValue] = useState('')
  const [savingKm, setSavingKm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [auditEvents, setAuditEvents] = useState<AuditLog[]>([])
  const [auditLoading, setAuditLoading] = useState(true)

  async function loadReportAccessStatus(veiculoId: string) {
    if (!canRequestReportAccess || !profile) return
    const { data } = await getSolicitacoesRelatorio(profile, { status: 'APROVADO' })
    if (data?.some(s => s.veiculo_id === veiculoId)) {
      setReportAccessStatus('APROVADO')
      return
    }
    const { data: pendentes } = await getSolicitacoesRelatorio(profile, { status: 'PENDENTE' })
    if (pendentes?.some(s => s.veiculo_id === veiculoId)) {
      setReportAccessStatus('PENDENTE')
      return
    }
    setReportAccessStatus('none')
  }

  async function handleSolicitarRelatorio() {
    if (!id) return
    setRequestingReport(true)
    const { error } = await solicitarAcessoRelatorio(profile, id)
    setRequestingReport(false)
    if (!error) {
      setReportAccessStatus('PENDENTE')
    } else {
      setError(error.message)
    }
  }

  async function loadData() {
    if (!id) return
    setLoading(true)
    setAuditLoading(true)
    const [veiculoRes, manutencoesRes, auditRes] = await Promise.all([
      getVeiculoById(id, profile),
      canViewMaintenance
        ? getManutencoes({ veiculoId: id }, profile)
        : Promise.resolve({ data: null as Manutencao[] | null }),
      getAuditLogs({ veiculoId: id, limit: 20 }),
    ])
    if (veiculoRes.data) setVeiculo(veiculoRes.data)
    setManutencoes(manutencoesRes.data ?? [])
    setAuditEvents(auditRes.data)
    setAuditLoading(false)
    await loadReportAccessStatus(id)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])
  useDataRefresh(loadData)

  const canViewMaintenanceDetails =
    !canRequestReportAccess || reportAccessStatus === 'APROVADO'

  const showMaintenanceTabs = canViewMaintenance && (!canRequestReportAccess || reportAccessStatus === 'APROVADO')

  function handleSelectMaintenance(m: Manutencao) {
    if (!canViewMaintenanceDetails) return
    setSelectedMaintenance(m)
  }

  function handleDownloadReport() {
    if (!veiculo || !canViewMaintenanceDetails) return
    downloadVehicleReportCsv(veiculo, manutencoes)
  }

  const ativas = useMemo(
    () => manutencoes.filter(m => isManutencaoAtiva(getManutencaoStatus(m))),
    [manutencoes],
  )

  const historico = useMemo(
    () => manutencoes.filter(m => getManutencaoStatus(m) === 'concluida'),
    [manutencoes],
  )

  const veiculoKm = veiculo ? getVeiculoKm(veiculo) : 0

  const proximaManutencao = ativas[0] ?? historico.find(m => {
    const u = getMaintenanceUrgency(m, veiculoKm)
    return u === 'warning' || u === 'overdue'
  })

  const ultimaManutencao = historico[0]
  const reviewItems = veiculo ? deriveReviewItems(manutencoes, veiculoKm) : []

  async function handleDelete() {
    if (!veiculo) return
    setDeleting(true)
    setError('')

    const { error: deleteError } = await deleteVeiculo(veiculo.id, profile)
    setDeleting(false)

    if (deleteError) {
      setError(deleteError.message)
      setShowDeleteConfirm(false)
      return
    }

    navigate('/veiculos')
  }

  async function handleSaveKm() {
    if (!veiculo) return
    const parsed = Number(kmValue)
    if (Number.isNaN(parsed) || parsed < 0) {
      setError('Informe uma quilometragem válida.')
      return
    }

    setSavingKm(true)
    setError('')
    const { error: updateError } = await updateVeiculo(veiculo.id, { km_atual: parsed }, profile)
    setSavingKm(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setEditingKm(false)
    loadData()
  }

  if (loading) {
    return <PageSkeleton cards={3} />
  }

  if (!veiculo) {
    return (
      <div className="page-section">
        <EmptyState
          icon={Car}
          title="Veículo não encontrado"
          description="O veículo pode ter sido removido ou você não tem permissão para visualizá-lo."
          action={
            <Button variant="secondary" onClick={() => navigate('/veiculos')}>
              Voltar para a frota
            </Button>
          }
        />
      </div>
    )
  }

  const proximaUrgency = proximaManutencao
    ? getMaintenanceUrgency(proximaManutencao, veiculoKm)
    : null
  const fotoSrc = safeHttpsUrl(veiculo.foto_url)

  return (
    <div>
      <div className="border-b border-border bg-surface px-4 py-4 lg:px-8">
        <button onClick={() => navigate('/veiculos')} className="mb-3 flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-surface-muted">
              {fotoSrc ? (
                <img src={fotoSrc} alt={veiculo.modelo} className="h-full w-full rounded-xl object-cover" />
              ) : (
                <Car className="h-8 w-8 text-fg-subtle" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-fg">
                {formatVehicleDisplayName(veiculo.empresas?.nome ?? 'Frota', veiculo.placa)}
              </h1>
              <p className="text-sm text-fg-muted">
                {getVeiculoModelo(veiculo)} · {formatVehicleSubtitle(getVeiculoMarca(veiculo), veiculo.ano_modelo ?? veiculo.ano ?? 0, veiculo.ano_carroceria)}
              </p>
              <div className="mt-2">
                <PlateBadge placa={veiculo.placa} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={veiculo.status} />
                <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-fg-muted">
                  {veiculoKm.toLocaleString('pt-BR')} km
                </span>
              </div>
            </div>
          </div>

          {canManageVehicles && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="rounded-lg bg-surface-muted p-2 text-fg-muted transition-colors hover:bg-border hover:text-fg"
                title="Editar veículo"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg bg-surface-muted p-2 text-danger transition-colors hover:bg-danger/15"
                title="Excluir veículo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex border-b border-border bg-surface">
        {([
          { key: 'resumo' as Tab, label: 'Resumo' },
          ...(showMaintenanceTabs
            ? [
                { key: 'manutencoes' as Tab, label: 'Manutenções' },
                { key: 'historico' as Tab, label: 'Histórico' },
              ]
            : []),
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === key ? 'border-b-2 border-action text-action' : 'text-fg-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="page-section">
        {tab === 'resumo' && (
          <>
            {canViewMaintenance && (
              <IaInsightsCard
                scope="veiculo"
                veiculo={veiculo}
                manutencoes={manutencoes}
                onAgendarManutencao={canCreateMaintenance ? () => setShowMaintenanceModal(true) : undefined}
              />
            )}

            <AuditTimeline
              events={auditEvents}
              loading={auditLoading}
              title="Histórico de auditoria"
              emptyDescription="Viagens criadas, envio para manutenção e liberações deste veículo aparecem aqui."
            />

            <Card className="flex items-center gap-3">
              <Gauge className="h-8 w-8 text-action" />
              <div className="flex-1">
                <p className="text-xs font-medium text-fg-muted uppercase">Quilometragem Atual</p>
                {editingKm ? (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="number"
                      min={0}
                      value={kmValue}
                      onChange={e => setKmValue(e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-action focus:outline-none focus:ring-2 focus:ring-action/20 sm:max-w-[160px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveKm} disabled={savingKm}>
                        {savingKm ? 'Salvando...' : 'Salvar'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingKm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xl font-bold text-fg">{veiculoKm.toLocaleString('pt-BR')} km</p>
                    {canUpdateKm && (
                      <button
                        type="button"
                        onClick={() => {
                          setKmValue(String(veiculoKm))
                          setEditingKm(true)
                        }}
                        className="mt-1 text-xs font-medium text-action hover:underline"
                      >
                        Atualizar medição
                      </button>
                    )}
                  </>
                )}
              </div>
            </Card>

            {canOpenReportDirectly && id && (
              <Link to={`/veiculos/${id}/relatorio`}>
                <Card className="text-center text-sm font-medium text-action hover:bg-action/5">
                  Ver relatório individual deste veículo
                </Card>
              </Link>
            )}

            {canRequestReportAccess && id && reportAccessStatus === 'APROVADO' && (
              <div className="space-y-2">
                <Button className="w-full" onClick={handleDownloadReport}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar Relatório (Excel/CSV)
                </Button>
                <Link to={`/veiculos/${id}/relatorio`}>
                  <Card className="text-center text-sm font-medium text-action hover:bg-action/5">
                    Ver relatório completo na tela
                  </Card>
                </Link>
              </div>
            )}

            {canRequestReportAccess && id && reportAccessStatus === 'PENDENTE' && (
              <Card className="text-center text-sm text-warning">
                Solicitação de acesso ao relatório aguardando aprovação do gestor.
              </Card>
            )}

            {canRequestReportAccess && id && reportAccessStatus === 'none' && (
              <Button
                className="w-full"
                variant="secondary"
                disabled={requestingReport}
                onClick={handleSolicitarRelatorio}
              >
                {requestingReport ? 'Enviando...' : 'Pedir Relatório'}
              </Button>
            )}

            {canViewMaintenance && ultimaManutencao && (
              <Card
                className={`${canViewMaintenanceDetails ? 'cursor-pointer hover:shadow-md' : ''} transition-shadow`}
                onClick={canViewMaintenanceDetails ? () => handleSelectMaintenance(ultimaManutencao) : undefined}
              >
                <p className="text-xs font-medium text-fg-muted uppercase">Última manutenção</p>
                <p className="mt-1 font-medium text-fg">{ultimaManutencao.descricao}</p>
                <p className="text-sm text-fg-muted">{formatDate(getManutencaoData(ultimaManutencao))}</p>
              </Card>
            )}

            {canViewMaintenance && proximaManutencao && proximaUrgency && (
              <Card
                className={`${canViewMaintenanceDetails ? 'cursor-pointer hover:shadow-md' : ''} transition-shadow ${URGENCY_BORDER[proximaUrgency]} ${URGENCY_BG[proximaUrgency]}`}
                onClick={canViewMaintenanceDetails ? () => handleSelectMaintenance(proximaManutencao) : undefined}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-fg-muted uppercase">Próxima manutenção</p>
                    <p className="mt-1 font-medium text-fg">{proximaManutencao.descricao}</p>
                    <p className={`text-sm mt-0.5 ${URGENCY_TEXT[proximaUrgency]}`}>
                      {formatDate(getManutencaoData(proximaManutencao))}
                    </p>
                    {getManutencaoProximaData(proximaManutencao) && (
                      <p className="text-xs text-fg-muted mt-1">
                        Próxima revisão: {formatDate(getManutencaoProximaData(proximaManutencao)!)}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold ${URGENCY_TEXT[proximaUrgency]}`}>
                    {URGENCY_LABELS[proximaUrgency]}
                  </span>
                </div>
              </Card>
            )}

            {canViewMaintenance && !canRequestReportAccess && (
              <section>
                <h2 className="mb-2 text-sm font-semibold text-fg">Resumo de revisões</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {reviewItems.map(item => (
                    <Card key={item.label} className={`flex items-center gap-3 ${URGENCY_BG[item.status]} ${URGENCY_BORDER[item.status]}`}>
                      <span className={URGENCY_TEXT[item.status]}>{item.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-fg">{item.label}</p>
                        <p className={`text-xs ${URGENCY_TEXT[item.status]}`}>
                          {URGENCY_LABELS[item.status]}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {showMaintenanceTabs && tab === 'manutencoes' && (
          ativas.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="Nenhuma manutenção pendente"
              description="Este veículo não tem serviços em andamento no momento."
            />
          ) : (
            <div className="space-y-3">
              {ativas.map(m => (
                <MaintenanceCard
                  key={m.id}
                  manutencao={m}
                  veiculoKm={veiculoKm}
                  showVehicle={false}
                  onClick={canViewMaintenanceDetails ? () => handleSelectMaintenance(m) : undefined}
                  showFinancialDetails={canViewMaintenanceDetails}
                />
              ))}
            </div>
          )
        )}

        {showMaintenanceTabs && tab === 'historico' && (
          <div className="space-y-4">
            <Card>
              <p className="text-xs font-medium uppercase text-fg-muted">Gastos acumulados</p>
              <p className="mt-1 text-2xl font-bold text-fg">
                {formatCurrency(historico.reduce((sum, m) => sum + (m.valor_total ?? m.valor ?? 0), 0))}
              </p>
              <p className="text-xs text-fg-muted">
                Mão de obra {formatCurrency(historico.reduce((sum, m) => sum + (m.valor_mao_de_obra ?? 0), 0))}
                {' · '}
                Peças {formatCurrency(historico.reduce((sum, m) => sum + (m.valor_pecas ?? 0), 0))}
              </p>
            </Card>
            <section>
              <h2 className="mb-2 text-sm font-semibold text-fg">Trocas de óleo</h2>
              {historico.filter(m => /oleo|óleo|lubrific/i.test(m.descricao)).length === 0 ? (
                <p className="text-sm text-fg-muted">Nenhuma troca de óleo registrada.</p>
              ) : (
                historico.filter(m => /oleo|óleo|lubrific/i.test(m.descricao)).map(m => (
                  <MaintenanceCard
                    key={m.id}
                    manutencao={m}
                    veiculoKm={veiculoKm}
                    showVehicle={false}
                    onClick={canViewMaintenanceDetails ? () => handleSelectMaintenance(m) : undefined}
                    showFinancialDetails={canViewMaintenanceDetails}
                  />
                ))
              )}
            </section>
            <section>
              <h2 className="mb-2 text-sm font-semibold text-fg">Substituição de peças</h2>
              {historico.filter(m => (m.pecas_trocadas?.length ?? 0) > 0).length === 0 ? (
                <p className="text-sm text-fg-muted">Nenhuma peça discriminada.</p>
              ) : (
                historico.filter(m => (m.pecas_trocadas?.length ?? 0) > 0).map(m => (
                  <Card key={m.id} className="mb-2">
                    <p className="text-sm font-medium text-fg">{formatDate(getManutencaoData(m))}</p>
                    <ul className="mt-1 text-sm text-fg-muted">
                      {m.pecas_trocadas!.map((peca, i) => (
                        <li key={i}>
                          {peca.quantidade}× {peca.descricao} — {formatCurrency(peca.quantidade * peca.valor_unitario)}
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))
              )}
            </section>
            <h2 className="text-sm font-semibold text-fg">Todas as manutenções</h2>
            <Timeline
              items={historico}
              veiculoKm={veiculoKm}
              onItemClick={canViewMaintenanceDetails ? handleSelectMaintenance : undefined}
              showFinancialDetails={canViewMaintenanceDetails}
            />
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-fg">Excluir veículo?</h3>
            <p className="mt-2 text-sm text-fg-muted">
              Tem certeza que deseja excluir <strong>{veiculo.modelo} ({veiculo.placa})</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="mt-4 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>
                Cancelar
              </Button>
              <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {canCreateMaintenance && (
        <div className="fixed bottom-20 left-0 right-0 px-4">
          <div className="mx-auto max-w-3xl">
            <Button className="w-full" size="lg" onClick={() => setShowMaintenanceModal(true)}>
              + Nova manutenção
            </Button>
          </div>
        </div>
      )}

      <MaintenanceFormModal
        isOpen={showMaintenanceModal}
        onClose={() => setShowMaintenanceModal(false)}
        veiculoId={veiculo.id}
        onSuccess={() => { setShowMaintenanceModal(false); loadData() }}
      />

      {canViewMaintenanceDetails && (
        <MaintenanceDetailModal
          manutencao={selectedMaintenance}
          onClose={() => setSelectedMaintenance(null)}
          veiculoKm={veiculoKm}
        />
      )}

      {canManageVehicles && (
        <VehicleFormModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          veiculo={veiculo}
          onSuccess={loadData}
        />
      )}
    </div>
  )
}
