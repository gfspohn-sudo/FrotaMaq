import { useCallback, useEffect, useState, useMemo } from 'react'
import { Wrench } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { MaintenanceCard } from '@/components/MaintenanceCard'
import { MaintenanceDetailModal } from '@/components/MaintenanceDetailModal'
import { concluirManutencao, getManutencoes } from '@/services/maintenance'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { useTenant } from '@/contexts/TenantContext'
import { formatErrorMessage } from '@/lib/formatError'
import { getManutencaoStatus, isManutencaoAtiva, normalizeTipoManutencao } from '@/lib/dbCompat'
import type { Manutencao, TipoManutencao } from '@/types/database'

type FilterTipo = 'todos' | TipoManutencao

const FILTERS: { key: FilterTipo; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'preventiva', label: 'Preventiva' },
  { key: 'corretiva', label: 'Corretiva' },
  { key: 'preditiva', label: 'Preditiva' },
]

export function MaintenanceHistoryPage() {
  const { profile } = useAuth()
  const { canCompleteMaintenance } = usePermissions()
  const { filterEmpresaId } = useTenant()
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [filter, setFilter] = useState<FilterTipo>('todos')
  const [selected, setSelected] = useState<Manutencao | null>(null)
  const [loading, setLoading] = useState(true)
  const [concluindoId, setConcluindoId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getManutencoes({ empresaId: filterEmpresaId }, profile)
    if (data) setManutencoes(data)
    setLoading(false)
  }, [filterEmpresaId, profile])

  useEffect(() => { load() }, [load])
  useDataRefresh(load)

  const filtered = useMemo(() => {
    if (filter === 'todos') return manutencoes
    return manutencoes.filter(
      m => normalizeTipoManutencao(m.tipo_normalizado ?? m.tipo) === filter,
    )
  }, [manutencoes, filter])

  async function handleConcluir(id: string) {
    setFeedback('')
    setConcluindoId(id)

    const { error } = await concluirManutencao(id, profile)
    setConcluindoId(null)

    if (error) {
      setFeedback(formatErrorMessage(error))
      return
    }

    setSelected(null)
    await load()
  }

  return (
    <div>
      <Header title="Histórico de Manutenções" />

      <div className="page-section">
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-action text-white'
                  : 'bg-surface-muted text-fg-muted hover:bg-border'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {feedback && (
          <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{feedback}</p>
        )}

        {loading ? (
          <ListSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Nenhuma manutenção encontrada"
            description="Ajuste o filtro ou registre um novo serviço para este período."
          />
        ) : (
          <div className="grid gap-3">
            {filtered.map(m => {
              const status = getManutencaoStatus(m)
              const podeConcluir = canCompleteMaintenance && isManutencaoAtiva(status)

              return (
                <MaintenanceCard
                  key={m.id}
                  manutencao={m}
                  onClick={() => setSelected(m)}
                  actions={podeConcluir ? (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={concluindoId === m.id}
                      onClick={() => handleConcluir(m.id)}
                    >
                      {concluindoId === m.id ? 'Concluindo...' : 'Concluir Manutenção'}
                    </Button>
                  ) : undefined}
                />
              )
            })}
          </div>
        )}
      </div>

      <MaintenanceDetailModal
        manutencao={selected}
        onClose={() => setSelected(null)}
        veiculoKm={
          selected?.veiculos
            ? (selected.veiculos.quilometragem_atual ?? selected.veiculos.km_atual ?? undefined)
            : undefined
        }
        canConcluir={canCompleteMaintenance}
        onConcluir={handleConcluir}
        concluindo={selected ? concluindoId === selected.id : false}
      />
    </div>
  )
}
