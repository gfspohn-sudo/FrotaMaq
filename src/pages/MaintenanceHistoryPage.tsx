import { useCallback, useEffect, useState, useMemo } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { MaintenanceCard } from '@/components/MaintenanceCard'
import { MaintenanceDetailModal } from '@/components/MaintenanceDetailModal'
import { getManutencoes } from '@/services/maintenance'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { useTenant } from '@/contexts/TenantContext'
import type { Manutencao, TipoManutencao } from '@/types/database'

type FilterTipo = 'todos' | TipoManutencao

const FILTERS: { key: FilterTipo; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'preventiva', label: 'Preventiva' },
  { key: 'corretiva', label: 'Corretiva' },
  { key: 'preditiva', label: 'Preditiva' },
]

export function MaintenanceHistoryPage() {
  const { filterEmpresaId } = useTenant()
  const [manutencoes, setManutencoes] = useState<Manutencao[]>([])
  const [filter, setFilter] = useState<FilterTipo>('todos')
  const [selected, setSelected] = useState<Manutencao | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getManutencoes({ empresaId: filterEmpresaId })
    if (data) {
      setManutencoes(data.filter(m => m.status === 'concluida'))
    }
    setLoading(false)
  }, [filterEmpresaId])

  useEffect(() => { load() }, [load])
  useDataRefresh(load)

  const filtered = useMemo(() => {
    if (filter === 'todos') return manutencoes
    return manutencoes.filter(m => m.tipo === filter)
  }, [manutencoes, filter])

  return (
    <div>
      <Header title="Histórico de Manutenções" />

      <div className="px-4 pt-4">
        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-action text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-action border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-gray-500">
              Nenhuma manutenção encontrada para este filtro.
            </p>
          </Card>
        ) : (
          <div className="space-y-3 px-4 pb-4">
            {filtered.map(m => (
              <MaintenanceCard
                key={m.id}
                manutencao={m}
                onClick={() => setSelected(m)}
              />
            ))}
          </div>
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
