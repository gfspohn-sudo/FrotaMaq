import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MaintenanceFormModal } from '@/components/MaintenanceFormModal'
import { MaintenanceCard } from '@/components/MaintenanceCard'
import { MaintenanceDetailModal } from '@/components/MaintenanceDetailModal'
import { getManutencoes, updateManutencaoStatus } from '@/services/maintenance'
import { usePermissions } from '@/hooks/usePermissions'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { useTenant } from '@/contexts/TenantContext'
import type { Manutencao, StatusManutencao } from '@/types/database'
import { History } from 'lucide-react'

export function MaintenancePage() {
  const { canCreateMaintenance, canCompleteMaintenance } = usePermissions()
  const { filterEmpresaId } = useTenant()
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Manutencao | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getManutencoes({ empresaId: filterEmpresaId })
    if (data) setManutencoes(data)
    setLoading(false)
  }, [filterEmpresaId])

  useEffect(() => { load() }, [load])
  useDataRefresh(load)

  async function handleStatusChange(id: string, status: StatusManutencao) {
    await updateManutencaoStatus(id, status)
    load()
  }

  return (
    <div>
      <Header title="Manutenções" />

      <div className="space-y-3 px-4 py-4">
        <Link to="/historico">
          <Card className="flex items-center gap-3 py-3 hover:shadow-md transition-shadow">
            <History className="h-5 w-5 text-action" />
            <div>
              <p className="text-sm font-medium text-gray-900">Histórico geral</p>
              <p className="text-xs text-gray-500">Ver todas as manutenções concluídas com filtros</p>
            </div>
          </Card>
        </Link>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
          </div>
        ) : manutencoes.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-gray-500">Nenhuma manutenção registrada.</p>
          </Card>
        ) : (
          manutencoes.map(m => (
            <MaintenanceCard
              key={m.id}
              manutencao={m}
              onClick={() => setSelected(m)}
              actions={
                <>
                  {canCompleteMaintenance && m.status === 'agendada' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleStatusChange(m.id, 'em_andamento')}>
                        Iniciar
                      </Button>
                      <Button size="sm" className="flex-1" onClick={() => handleStatusChange(m.id, 'concluida')}>
                        Concluir
                      </Button>
                    </div>
                  )}
                  {canCompleteMaintenance && m.status === 'em_andamento' && (
                    <Button size="sm" className="w-full" onClick={() => handleStatusChange(m.id, 'concluida')}>
                      Concluir manutenção
                    </Button>
                  )}
                </>
              }
            />
          ))
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
        veiculoKm={selected?.veiculos?.km_atual}
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
        <p className="text-gray-500">Você não tem permissão para criar manutenções.</p>
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
