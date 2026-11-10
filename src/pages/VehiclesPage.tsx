import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { solicitarAcessoRelatorio } from '@/services/solicitacoesRelatorio'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Car, Plus, Database, Trash2, Eye, Pencil, History } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { DataTable, DataTableHead, DataTableBody, DataTh, DataTd, DataTr } from '@/components/ui/DataTable'
import { VehicleFormModal } from '@/components/VehicleFormModal'
import { getVeiculos, seedTestVeiculos, deleteAllVeiculos } from '@/services/vehicles'
import { getExpectedMockMaintenanceCount, getExpectedMockReservaCount } from '@/services/mockSeed'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenant } from '@/contexts/TenantContext'
import type { Veiculo, StatusVeiculo } from '@/types/database'
import { STATUS_VEICULO_LABELS } from '@/types/database'
import { formatVehicleSubtitle, parseVehicleStatusParam } from '@/lib/vehicleDisplay'
import { PlateBadge } from '@/components/ui/PlateBadge'
import { getVeiculoMarca, getVeiculoModelo } from '@/lib/dbCompat'
import { formatErrorMessage } from '@/lib/formatError'
import { safeHttpsUrl } from '@/lib/safeMediaUrl'

export function VehiclesPage() {
  const { profile } = useAuth()
  const {
    canManageVehicles,
    canSeedTestData,
    canDeleteAllVehicles,
    canRequestReserva,
    canRequestReportAccess,
    isMotorista,
  } = usePermissions()
  const [reportFeedback, setReportFeedback] = useState('')
  const [requestingReportId, setRequestingReportId] = useState<string | null>(null)
  const { filterEmpresaId, empresas: tenantEmpresas } = useTenant()
  const [searchParams, setSearchParams] = useSearchParams()
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [search, setSearch] = useState('')
  const statusFilter = isMotorista ? '' : parseVehicleStatusParam(searchParams.get('status'))

  function setStatusFilter(status: StatusVeiculo | '') {
    const next = new URLSearchParams(searchParams)
    if (status) next.set('status', status)
    else next.delete('status')
    setSearchParams(next, { replace: true })
  }
  const [showForm, setShowForm] = useState(false)
  const [editingVeiculo, setEditingVeiculo] = useState<Veiculo | null>(null)
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [feedback, setFeedback] = useState('')

  async function handlePedirRelatorio(veiculoId: string) {
    setReportFeedback('')
    setRequestingReportId(veiculoId)
    const { error } = await solicitarAcessoRelatorio(profile, veiculoId)
    setRequestingReportId(null)
    if (error) {
      setReportFeedback(error.message)
    } else {
      setReportFeedback('Pedido de relatório enviado. Aguardando aprovação do gestor.')
    }
  }

  const loadVeiculos = useCallback(async () => {
    setLoading(true)
    const { data } = await getVeiculos({
      search: search || undefined,
      status: isMotorista ? undefined : (statusFilter || undefined),
      empresaId: filterEmpresaId,
    }, profile)
    if (data) setVeiculos(data)
    setLoading(false)
  }, [search, statusFilter, filterEmpresaId, profile, isMotorista])

  useEffect(() => {
    const timeout = setTimeout(loadVeiculos, 300)
    return () => clearTimeout(timeout)
  }, [loadVeiculos])

  async function handleSeedTestVehicles() {
    setFeedback('')
    setSeeding(true)

    const { inserted, skipped, maintenancesInserted, reservasInserted, error } = await seedTestVeiculos(filterEmpresaId, profile)
    setSeeding(false)

    if (error) {
      setFeedback(`Erro ao popular dados: ${formatErrorMessage(error)}`)
      return
    }

    const expectedMaint = getExpectedMockMaintenanceCount()
    const expectedReservas = getExpectedMockReservaCount()
    setFeedback(
      `${inserted > 0 ? `${inserted} veículo(s) criado(s). ` : ''}` +
      `${maintenancesInserted ?? expectedMaint} manutenção(ões) e ${reservasInserted ?? expectedReservas} reserva(s)/viagem(ns) geradas` +
      (skipped > 0 ? ` (${skipped} veículos já existiam).` : '.') +
      ' Dashboards atualizados.',
    )

    await loadVeiculos()
  }

  async function handleDeleteAll() {
    setShowDeleteConfirm(false)
    setFeedback('')
    setDeleting(true)

    const { error } = await deleteAllVeiculos(filterEmpresaId, profile)
    setDeleting(false)

    if (error) {
      setFeedback(`Erro ao excluir: ${error.message}`)
      return
    }

    setFeedback('Todos os veículos e históricos desta empresa foram excluídos.')
    await loadVeiculos()
  }

  return (
    <div>
      <Header title="Veículos" />

      <div className="page-section">
        {canManageVehicles && (
          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Cadastrar Novo Veículo
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              {canSeedTestData && (
                <>
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={handleSeedTestVehicles}
                    loading={seeding}
                    disabled={seeding || deleting}
                  >
                    <Database className="h-4 w-4" />
                    {seeding ? 'Populando...' : 'Popular Veículos de Teste'}
                  </Button>
                  {canDeleteAllVehicles && (
                    <Button
                      variant="danger"
                      className="flex-1 border border-danger"
                      onClick={() => setShowDeleteConfirm(true)}
                      loading={deleting}
                      disabled={seeding || deleting}
                    >
                      <Trash2 className="h-4 w-4" />
                      {deleting ? 'Excluindo...' : 'Excluir Todos os Veículos'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {feedback && (
          <p className="rounded-lg bg-action/10 px-3 py-2 text-sm text-action">{feedback}</p>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            type="text"
            placeholder="Buscar veículo ou placa"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-fg placeholder:text-fg-subtle focus:border-action focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {!isMotorista && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter('')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                !statusFilter ? 'bg-action text-white' : 'bg-surface-muted text-fg-muted hover:text-fg'
              }`}
            >
              Todos
            </button>
            {(Object.entries(STATUS_VEICULO_LABELS) as [StatusVeiculo, string][]).map(([key, label]) => (
              <button
                type="button"
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === key ? 'bg-action text-white' : 'bg-surface-muted text-fg-muted hover:text-fg'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {reportFeedback && (
          <p className="rounded-lg bg-action/10 px-3 py-2 text-sm text-action">{reportFeedback}</p>
        )}

        {loading ? (
          <ListSkeleton rows={5} />
        ) : veiculos.length === 0 ? (
          <EmptyState
            icon={Car}
            title="Nenhum veículo encontrado"
            description={
              canManageVehicles
                ? 'Cadastre o primeiro veículo da frota ou use os dados de teste para começar.'
                : 'Não há veículos para exibir com os filtros atuais.'
            }
            action={
              canManageVehicles ? (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4" />
                  Cadastrar Primeiro Veículo
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <DataTable>
                <DataTableHead>
                  <tr>
                    <DataTh>Veículo</DataTh>
                    <DataTh>Empresa</DataTh>
                    <DataTh>Status</DataTh>
                    <DataTh className="text-right">Ações</DataTh>
                  </tr>
                </DataTableHead>
                <DataTableBody>
                  {veiculos.map(v => {
                    const empresaNome = v.empresas?.nome ?? tenantEmpresas.find(e => e.id === v.empresa_id)?.nome ?? 'Frota'
                    return (
                      <DataTr key={v.id}>
                        <DataTd>
                          <div className="flex items-center gap-3">
                            <VehicleThumb veiculo={v} />
                            <div className="min-w-0">
                              <PlateBadge placa={v.placa} compact />
                              <p className="mt-1 truncate text-sm text-fg-muted">
                                {getVeiculoModelo(v)} · {formatVehicleSubtitle(getVeiculoMarca(v), v.ano_modelo ?? v.ano ?? 0, v.ano_carroceria)}
                              </p>
                            </div>
                          </div>
                        </DataTd>
                        <DataTd className="text-fg-muted">{empresaNome}</DataTd>
                        <DataTd><StatusBadge status={v.status} /></DataTd>
                        <DataTd>
                          <VehicleActions
                            veiculo={v}
                            canManageVehicles={canManageVehicles}
                            canRequestReserva={canRequestReserva}
                            canRequestReportAccess={canRequestReportAccess}
                            requestingReportId={requestingReportId}
                            onEdit={setEditingVeiculo}
                            onPedirRelatorio={handlePedirRelatorio}
                          />
                        </DataTd>
                      </DataTr>
                    )
                  })}
                </DataTableBody>
              </DataTable>
            </div>

            <div className="grid gap-4 lg:hidden">
              {veiculos.map(v => {
                const empresaNome = v.empresas?.nome ?? tenantEmpresas.find(e => e.id === v.empresa_id)?.nome ?? 'Frota'
                return (
                  <Card key={v.id} interactive className="flex flex-col gap-4">
                    <Link to={`/veiculos/${v.id}`} className="flex min-w-0 items-center gap-4">
                      <VehicleThumb veiculo={v} />
                      <div className="min-w-0 flex-1">
                        <PlateBadge placa={v.placa} compact />
                        <p className="mt-1 text-sm text-fg-muted">
                          {getVeiculoModelo(v)} · {formatVehicleSubtitle(getVeiculoMarca(v), v.ano_modelo ?? v.ano ?? 0, v.ano_carroceria)}
                        </p>
                        <p className="text-xs text-fg-subtle">{empresaNome}</p>
                      </div>
                      <StatusBadge status={v.status} />
                    </Link>
                    <VehicleActions
                      veiculo={v}
                      canManageVehicles={canManageVehicles}
                      canRequestReserva={canRequestReserva}
                      canRequestReportAccess={canRequestReportAccess}
                      requestingReportId={requestingReportId}
                      onEdit={setEditingVeiculo}
                      onPedirRelatorio={handlePedirRelatorio}
                    />
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </div>

      {canManageVehicles && (
        <VehicleFormModal
          isOpen={showForm || Boolean(editingVeiculo)}
          onClose={() => {
            setShowForm(false)
            setEditingVeiculo(null)
          }}
          onSuccess={() => {
            setShowForm(false)
            setEditingVeiculo(null)
            loadVeiculos()
          }}
          veiculo={editingVeiculo}
        />
      )}

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Excluir todos os veículos"
        description="Esta ação remove veículos e históricos da empresa selecionada."
      >
        <p className="text-sm text-fg">
          Tem certeza que deseja excluir todos os veículos e históricos?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDeleteAll} disabled={deleting}>
            {deleting ? 'Excluindo...' : 'Excluir'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function VehicleThumb({ veiculo }: { veiculo: Veiculo }) {
  const fotoSrc = safeHttpsUrl(veiculo.foto_url)

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted">
      {fotoSrc ? (
        <img src={fotoSrc} alt={veiculo.modelo} className="h-full w-full object-cover" />
      ) : (
        <Car className="h-5 w-5 text-fg-subtle" />
      )}
    </div>
  )
}

function VehicleActions({
  veiculo,
  canManageVehicles,
  canRequestReserva,
  canRequestReportAccess,
  requestingReportId,
  onEdit,
  onPedirRelatorio,
}: {
  veiculo: Veiculo
  canManageVehicles: boolean
  canRequestReserva: boolean
  canRequestReportAccess: boolean
  requestingReportId: string | null
  onEdit: (veiculo: Veiculo) => void
  onPedirRelatorio: (veiculoId: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link
        to={`/veiculos/${veiculo.id}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
      >
        <Eye className="h-3.5 w-3.5" />
        Ver detalhes
      </Link>
      {canManageVehicles && (
        <button
          type="button"
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            onEdit(veiculo)
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </button>
      )}
      <Link
        to={`/veiculos/${veiculo.id}?tab=historico`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
      >
        <History className="h-3.5 w-3.5" />
        Histórico
      </Link>
      {canRequestReserva && (
        <Link
          to={`/reservas?veiculoId=${veiculo.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-action px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
        >
          Reservar
        </Link>
      )}
      {canRequestReportAccess && (
        <button
          type="button"
          disabled={requestingReportId === veiculo.id}
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            onPedirRelatorio(veiculo.id)
          }}
          className="inline-flex items-center rounded-lg border border-action px-2.5 py-1.5 text-xs font-medium text-action transition-colors hover:bg-action/5 disabled:opacity-50"
        >
          {requestingReportId === veiculo.id ? 'Enviando...' : 'Pedir Relatório'}
        </button>
      )}
    </div>
  )
}
