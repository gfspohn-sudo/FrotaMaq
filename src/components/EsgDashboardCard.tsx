import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Leaf, Trees } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { getReservas } from '@/services/reservas'
import { getVeiculos } from '@/services/vehicles'
import { loadOperationalFleet, type FleetDataSource } from '@/lib/fleetSnapshotCache'
import {
  calculateFleetEmissions,
  formatCo2Mass,
  resolveVehicleFuelType,
} from '@/utils/esgCalculator'

export function EsgDashboardCard() {
  const { profile } = useAuth()
  const { filterEmpresaId } = useTenant()
  const { isMotorista } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(() => calculateFleetEmissions([]))
  const [source, setSource] = useState<FleetDataSource>('live')

  const load = useCallback(async () => {
    if (isMotorista) {
      setLoading(false)
      return
    }

    setLoading(true)
    const now = new Date()
    const snapshot = await loadOperationalFleet({
      empresaId: filterEmpresaId,
      veiculos: getVeiculos({ empresaId: filterEmpresaId }, profile),
      reservas: getReservas(profile, { empresaId: filterEmpresaId }),
    })

    const trips = snapshot.reservas
      .filter(reserva => reserva.status !== 'REJEITADO')
      .filter(reserva => {
        const data = new Date(reserva.data_viagem)
        return data.getFullYear() === now.getFullYear() && data.getMonth() === now.getMonth()
      })
      .map(reserva => {
        const veiculo = snapshot.veiculos.find(item => item.id === reserva.veiculo_id)
        const km = reserva.km_percorrido && reserva.km_percorrido > 0
          ? reserva.km_percorrido
          : reserva.km_ida_volta
        return {
          km: km || 0,
          combustivel: resolveVehicleFuelType(veiculo ?? reserva.veiculos),
        }
      })

    setSource(snapshot.source)
    setSummary(calculateFleetEmissions(trips))
    setLoading(false)
  }, [filterEmpresaId, isMotorista, profile])

  useEffect(() => {
    load()
  }, [load])

  useDataRefresh(load)

  if (isMotorista) return null

  const progress = Math.min(100, summary.arvores * 10)

  return (
    <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-surface transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-600/15 p-2 text-emerald-700 dark:text-emerald-300">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
              Pegada de carbono · ESG
            </p>
            <p className="mt-1 text-sm text-fg-muted">Emissões totais da frota neste mês</p>
          </div>
        </div>
        <Trees className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-3xl font-bold text-emerald-800 dark:text-emerald-300">
            {formatCo2Mass(summary.kgCo2)} CO₂
          </p>
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            {summary.compensacao}
          </p>
          <div className="h-2.5 overflow-hidden rounded-full bg-emerald-500/20">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-fg-muted">
            {summary.viagens} viagem(ns) · {summary.kmTotal.toLocaleString('pt-BR')} km
            {summary.zeroEmissao > 0 ? ` · ${summary.zeroEmissao} zero emissão` : ''}
            {source !== 'live' ? ' · estimativa local' : ''}
          </p>
          <Link
            to="/relatorios"
            className="inline-flex text-xs font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
          >
            Exportar relatório ESG em PDF ou CSV
          </Link>
        </div>
      )}
    </Card>
  )
}
