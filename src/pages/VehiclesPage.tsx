import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { solicitarAcessoRelatorio } from '@/services/solicitacoesRelatorio'
import { Link } from 'react-router-dom'
import { Search, Filter as FilterIcon, Car, Plus, Database, Trash2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { VehicleFormModal } from '@/components/VehicleFormModal'
import { getVeiculos, seedTestVeiculos, deleteAllVeiculos } from '@/services/vehicles'
import { getExpectedMockMaintenanceCount } from '@/services/mockSeed'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenant } from '@/contexts/TenantContext'
import type { Veiculo, StatusVeiculo } from '@/types/database'
import { STATUS_VEICULO_LABELS } from '@/types/database'
import { formatVehicleDisplayName, formatVehicleSubtitle } from '@/lib/vehicleDisplay'
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
  } = usePermissions()
  const [reportFeedback, setReportFeedback] = useState('')
  const [requestingReportId, setRequestingReportId] = useState<string | null>(null)
  const { filterEmpresaId, isViewingAll, empresas: tenantEmpresas } = useTenant()
  const [veiculos, setVeiculos] = useState<Veiculo[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusVeiculo | ''>('')
  const [showFilter, setShowFilter] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [deleting, setDeleting] = useState(false)
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
      status: statusFilter || undefined,
      empresaId: filterEmpresaId,
    }, profile)
    if (data) setVeiculos(data)
    setLoading(false)
  }, [search, statusFilter, filterEmpresaId, profile])

  useEffect(() => {
    const timeout = setTimeout(loadVeiculos, 300)
    return () => clearTimeout(timeout)
  }, [loadVeiculos])

  async function handleSeedTestVehicles() {
    setFeedback('')
    setSeeding(true)

    const { inserted, skipped, maintenancesInserted, error } = await seedTestVeiculos(filterEmpresaId, profile)
    setSeeding(false)

    if (error) {
      setFeedback(`Erro ao popular dados: ${formatErrorMessage(error)}`)
      return
    }

    const expected = getExpectedMockMaintenanceCount()
    setFeedback(
      `${inserted > 0 ? `${inserted} veículo(s) criado(s). ` : ''}` +
      `${maintenancesInserted ?? expected} manutenções mock geradas` +
      (skipped > 0 ? ` (${skipped} veículos já existiam).` : '.') +
      ' Dashboards atualizados.',
    )

    await loadVeiculos()
  }

  async function handleDeleteAll() {
    const scope = isViewingAll
      ? 'TODOS os veículos e manutenções vinculadas'
      : 'todos os veículos e manutenções desta empresa'

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir ${scope}? Esta ação não pode ser desfeita.`,
    )
    if (!confirmed) return

    setFeedback('')
    setDeleting(true)

    const { error } = await deleteAllVeiculos(filterEmpresaId, profile)
    setDeleting(false)

    if (error) {
      setFeedback(`Erro ao excluir: ${error.message}`)
      return
    }

    setFeedback('Todos os veículos visíveis foram excluídos. Dashboards atualizados.')
    await loadVeiculos()
  }

  return (
    <div>
      <Header title="Veículos" />

      <div className="space-y-4 px-4 py-4">
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
                    disabled={seeding || deleting}
                  >
                    <Database className="h-4 w-4" />
                    {seeding ? 'Populando...' : 'Popular Veículos de Teste'}
                  </Button>
                  {canDeleteAllVehicles && (
                    <Button
                      variant="danger"
                      className="flex-1 border border-danger"
                      onClick={handleDeleteAll}
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

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar veículo ou placa"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-action focus:outline-none focus:ring-2 focus:ring-action/20"
            />
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`rounded-lg border px-3 py-2.5 transition-colors ${
              statusFilter ? 'border-action bg-action/5 text-action' : 'border-gray-300 bg-white text-gray-600'
            }`}
          >
            <FilterIcon className="h-4 w-4" />
          </button>
        </div>

        {showFilter && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !statusFilter ? 'bg-action text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Todos
            </button>
            {(Object.entries(STATUS_VEICULO_LABELS) as [StatusVeiculo, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === key ? 'bg-action text-white' : 'bg-gray-100 text-gray-600'
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
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
          </div>
        ) : veiculos.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-gray-500">Nenhum veículo encontrado.</p>
            {canManageVehicles && (
              <p className="pb-4 text-center text-xs text-gray-400">
                Cadastre um veículo ou use &quot;Popular Veículos de Teste&quot; para começar.
              </p>
            )}
          </Card>
        ) : (
          <div className="space-y-2">
            {veiculos.map(v => {
              const fotoSrc = safeHttpsUrl(v.foto_url)
              return (
              <Card key={v.id} className="flex items-center gap-4">
                <Link to={`/veiculos/${v.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    {fotoSrc ? (
                      <img src={fotoSrc} alt={v.modelo} className="h-full w-full rounded-lg object-cover" />
                    ) : (
                      <Car className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">
                      {formatVehicleDisplayName(
                        v.empresas?.nome ?? tenantEmpresas.find(e => e.id === v.empresa_id)?.nome ?? 'Frota',
                        v.placa,
                      )}
                    </p>
                    <p className="text-sm text-gray-500">
                      {getVeiculoModelo(v)} · {formatVehicleSubtitle(getVeiculoMarca(v), v.ano_modelo ?? v.ano ?? 0, v.ano_carroceria)}
                    </p>
                  </div>
                </Link>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={v.status} />
                  {canRequestReserva && (
                    <Link
                      to={`/reservas?veiculoId=${v.id}`}
                      className="rounded-lg bg-action px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Reservar/Alugar
                    </Link>
                  )}
                  {canRequestReportAccess && (
                    <button
                      type="button"
                      disabled={requestingReportId === v.id}
                      onClick={() => handlePedirRelatorio(v.id)}
                      className="rounded-lg border border-action px-3 py-1.5 text-xs font-medium text-action hover:bg-action/5 disabled:opacity-50"
                    >
                      {requestingReportId === v.id ? 'Enviando...' : 'Pedir Relatório'}
                    </button>
                  )}
                </div>
              </Card>
              )
            })}
          </div>
        )}
      </div>

      {canManageVehicles && (
        <VehicleFormModal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          onSuccess={loadVeiculos}
        />
      )}
    </div>
  )
}
