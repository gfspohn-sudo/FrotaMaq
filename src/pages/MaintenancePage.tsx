import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { MaintenanceFormModal } from '@/components/MaintenanceFormModal'
import { MaintenanceCard } from '@/components/MaintenanceCard'
import { MaintenanceDetailModal } from '@/components/MaintenanceDetailModal'
import { getManutencoes } from '@/services/maintenance'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { useTenant } from '@/contexts/TenantContext'
import type { Manutencao } from '@/types/database'
import { History, Wrench } from 'lucide-react'

export function MaintenancePage() {
  const { profile } = useAuth()
  const { canCreateMaintenance } = usePermissions()
  const { filterEmpresaId } = useTenant()
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Manutencao | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getManutencoes({ empresaId: filterEmpresaId }, profile)
    if (data) setManutencoes(data)
    setLoading(false)
  }, [filterEmpresaId, profile])

  useEffect(() => { load() }, [load])
  useDataRefresh(load)

  return (
    <div>
      <Header title="Manutenções" />

      <div className="page-section">
        <Link to="/historico">
          <Card interactive className="flex items-center gap-3 py-3">
            <History className="h-5 w-5 text-action" />
            <div>
              <p className="text-sm font-medium text-fg">Histórico geral</p>
              <p className="text-xs text-fg-muted">Ver todas as manutenções concluídas com filtros</p>
            </div>
          </Card>
        </Link>

        {loading ? (
          <ListSkeleton rows={4} />
        ) : manutencoes.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Nenhuma manutenção registrada"
            description="Quando os serviços forem lançados, eles aparecerão aqui."
          />
        ) : (
          <div className="grid gap-3">
          {manutencoes.map(m => (
            <MaintenanceCard
              key={m.id}
              manutencao={m}
              onClick={() => setSelected(m)}
            />
          ))}
          </div>
        )}
      </div>

      {canCreateMaintenance && (
        <MaintenanceFormModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load() }}
        />
      )}

      <MaintenanceDetailModal
        manutencao={selected}
        onClose={() => setSelected(null)}
        veiculoKm={selected?.veiculos?.quilometragem_atual ?? selected?.veiculos?.km_atual}
      />
    </div>
  )
}

export function NewMaintenancePage() {
  const { canCreateMaintenance } = usePermissions()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(true)

  function handleClose() {
    setShowModal(false)
    navigate(-1)
  }

  if (!canCreateMaintenance) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-fg-muted">Você não tem permissão para criar manutenções.</p>
      </div>
    )
  }

  return (
    <MaintenanceFormModal
      isOpen={showModal}
      onClose={handleClose}
      onSuccess={handleClose}
    />
  )
}
