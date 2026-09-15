import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Car, Gauge, Pencil, Trash2, Droplets, Filter, CircleDot } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Timeline } from '@/components/ui/Timeline'
import { MaintenanceFormModal } from '@/components/MaintenanceFormModal'
import { MaintenanceDetailModal } from '@/components/MaintenanceDetailModal'
import { MaintenanceCard } from '@/components/MaintenanceCard'
import { VehicleFormModal } from '@/components/VehicleFormModal'
import { getVeiculoById, deleteVeiculo, updateVeiculo } from '@/services/vehicles'
import { getManutencoes } from '@/services/maintenance'
import {
  solicitarAcessoRelatorio,
  getSolicitacoesRelatorio,
} from '@/services/solicitacoesRelatorio'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import type { Veiculo, Manutencao } from '@/types/database'
import {
  URGENCY_BORDER,
  URGENCY_BG,
  URGENCY_TEXT,
  URGENCY_LABELS,
} from '@/types/database'
import { getMaintenanceUrgency, formatDate } from '@/lib/maintenanceStatus'
import { formatVehicleDisplayName, formatVehicleSubtitle } from '@/lib/vehicleDisplay'

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
      m.status === 'concluida' &&
      (terms.some(t => m.descricao.toLowerCase().includes(t)) ||
        terms.some(t => (m.proxima_manutencao_previsao ?? '').toLowerCase().includes(t))),
    )

    const latest = related[0]
    if (!latest) {
      return { label, status: 'warning' as const, icon }
    }

    const urgency = getMaintenanceUrgency(latest, kmAtual)
    return { label, status: urgency, icon }
  })
}

export function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const {
    canCreateMaintenance,
    canManageVehicles,
    canUpdateKm,
    canOpenReportDirectly,
    canRequestReportAccess,
  } = usePermissions()
  const [reportAccessStatus, setReportAccessStatus] = useState<'none' | 'PENDENTE' | 'APROVADO' | 'REJEITADO'>('none')
  const [requestingReport, setRequestingReport] = useState(false)
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null)
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [tab, setTab] = useState<Tab>('resumo')
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
    const [veiculoRes, manutencoesRes] = await Promise.all([
      getVeiculoById(id),
      getManutencoes({ veiculoId: id }),
    ])
    if (veiculoRes.data) setVeiculo(veiculoRes.data)
    if (manutencoesRes.data) setManutencoes(manutencoesRes.data)
    await loadReportAccessStatus(id)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  const ativas = useMemo(
    () => manutencoes.filter(m => ['agendada', 'em_andamento'].includes(m.status)),
    [manutencoes],
  )

  const historico = useMemo(
    () => manutencoes.filter(m => m.status === 'concluida'),
    [manutencoes],
  )

  const proximaManutencao = ativas[0] ?? historico.find(m => {
    const u = getMaintenanceUrgency(m, veiculo?.km_atual)
    return u === 'warning' || u === 'overdue'
  })

  const ultimaManutencao = historico[0]
  const reviewItems = veiculo ? deriveReviewItems(manutencoes, veiculo.km_atual) : []

  async function handleDelete() {
    if (!veiculo) return
    setDeleting(true)
    setError('')

    const { error: deleteError } = await deleteVeiculo(veiculo.id)
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
    const { error: updateError } = await updateVeiculo(veiculo.id, { km_atual: parsed })
    setSavingKm(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setEditingKm(false)
    loadData()
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
      </div>
    )
  }

  if (!veiculo) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-gray-500">Veículo não encontrado.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/veiculos')}>
          Voltar
        </Button>
      </div>
    )
  }

  const proximaUrgency = proximaManutencao
    ? getMaintenanceUrgency(proximaManutencao, veiculo.km_atual)
    : null

  return (
    <div>
      <div className="bg-navy-900 px-4 py-4 text-white">
        <button onClick={() => navigate('/veiculos')} className="mb-3 flex items-center gap-1 text-sm text-gray-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-white/10">
              {veiculo.foto_url ? (
                <img src={veiculo.foto_url} alt={veiculo.modelo} className="h-full w-full rounded-xl object-cover" />
              ) : (
                <Car className="h-8 w-8" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-semibold">
                {formatVehicleDisplayName(veiculo.empresas?.nome ?? 'Frota', veiculo.placa)}
              </h1>
              <p className="text-sm text-gray-300">
                {veiculo.modelo} · {formatVehicleSubtitle(veiculo.marca, veiculo.ano_modelo ?? veiculo.ano, veiculo.ano_carroceria)}
              </p>
              <div className="mt-2">
                <StatusBadge status={veiculo.status} />
              </div>
            </div>
          </div>

          {canManageVehicles && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="rounded-lg bg-white/10 p-2 hover:bg-white/20 transition-colors"
                title="Editar veículo"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg bg-white/10 p-2 hover:bg-red-500/30 transition-colors"
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

      <div className="flex border-b border-gray-200 bg-white">
        {([
          { key: 'resumo' as Tab, label: 'Resumo' },
          { key: 'manutencoes' as Tab, label: 'Manutenções' },
          { key: 'historico' as Tab, label: 'Histórico' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === key ? 'border-b-2 border-action text-action' : 'text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4 px-4 py-4">
        {tab === 'resumo' && (
          <>
            <Card className="flex items-center gap-3">
              <Gauge className="h-8 w-8 text-action" />
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 uppercase">Quilometragem Atual</p>
                {editingKm ? (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="number"
                      min={0}
                      value={kmValue}
                      onChange={e => setKmValue(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-action focus:outline-none focus:ring-2 focus:ring-action/20 sm:max-w-[160px]"
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
                    <p className="text-xl font-bold text-gray-900">{veiculo.km_atual.toLocaleString('pt-BR')} km</p>
                    {canUpdateKm && (
                      <button
                        type="button"
                        onClick={() => {
                          setKmValue(String(veiculo.km_atual))
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
              <Link to={`/veiculos/${id}/relatorio`}>
                <Card className="text-center text-sm font-medium text-action hover:bg-action/5">
                  Ver relatório individual (acesso aprovado)
                </Card>
              </Link>
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
                {requestingReport ? 'Enviando...' : 'Solicitar acesso ao relatório'}
              </Button>
            )}

            {ultimaManutencao && (
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedMaintenance(ultimaManutencao)}
              >
                <p className="text-xs font-medium text-gray-500 uppercase">Última manutenção</p>
                <p className="mt-1 font-medium text-gray-900">{ultimaManutencao.descricao}</p>
                <p className="text-sm text-gray-500">{formatDate(ultimaManutencao.data_hora)}</p>
              </Card>
            )}

            {proximaManutencao && proximaUrgency && (
              <Card
                className={`cursor-pointer hover:shadow-md transition-shadow ${URGENCY_BORDER[proximaUrgency]} ${URGENCY_BG[proximaUrgency]}`}
                onClick={() => setSelectedMaintenance(proximaManutencao)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Próxima manutenção</p>
                    <p className="mt-1 font-medium text-gray-900">{proximaManutencao.descricao}</p>
                    <p className={`text-sm mt-0.5 ${URGENCY_TEXT[proximaUrgency]}`}>
                      {formatDate(proximaManutencao.data_hora)}
                    </p>
                    {proximaManutencao.proxima_manutencao_previsao && (
                      <p className="text-xs text-gray-500 mt-1">
                        {proximaManutencao.proxima_manutencao_previsao}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold ${URGENCY_TEXT[proximaUrgency]}`}>
                    {URGENCY_LABELS[proximaUrgency]}
                  </span>
                </div>
              </Card>
            )}

            <section>
              <h2 className="mb-2 text-sm font-semibold text-gray-900">Resumo de revisões</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {reviewItems.map(item => (
                  <Card key={item.label} className={`flex items-center gap-3 ${URGENCY_BG[item.status]} ${URGENCY_BORDER[item.status]}`}>
                    <span className={URGENCY_TEXT[item.status]}>{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className={`text-xs ${URGENCY_TEXT[item.status]}`}>
                        {URGENCY_LABELS[item.status]}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'manutencoes' && (
          ativas.length === 0 ? (
            <Card>
              <p className="py-6 text-center text-sm text-gray-500">Nenhuma manutenção ativa ou agendada.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {ativas.map(m => (
                <MaintenanceCard
                  key={m.id}
                  manutencao={m}
                  veiculoKm={veiculo.km_atual}
                  showVehicle={false}
                  onClick={() => setSelectedMaintenance(m)}
                />
              ))}
            </div>
          )
        )}

        {tab === 'historico' && (
          <Timeline
            items={historico}
            veiculoKm={veiculo.km_atual}
            onItemClick={setSelectedMaintenance}
          />
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Excluir veículo?</h3>
            <p className="mt-2 text-sm text-gray-600">
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

      <MaintenanceDetailModal
        manutencao={selectedMaintenance}
        onClose={() => setSelectedMaintenance(null)}
        veiculoKm={veiculo.km_atual}
      />

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
