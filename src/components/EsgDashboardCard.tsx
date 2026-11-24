import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Leaf, Trees } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EnergyTransitionSimulator, type SimulatorVehicleOption } from '@/components/EnergyTransitionSimulator'
import { EsgFleetScoreCard } from '@/components/EsgFleetScoreCard'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/contexts/TenantContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useDataRefresh } from '@/hooks/useDataRefresh'
import { getReservas } from '@/services/reservas'
import { getVeiculos } from '@/services/vehicles'
import { getManutencoes } from '@/services/maintenance'
import { loadOperationalFleet, type FleetDataSource } from '@/lib/fleetSnapshotCache'
import {
  calculateFleetEmissions,
  formatCo2Mass,
  resolveVehicleFuelType,
  type TipoCombustivel,
} from '@/utils/esgCalculator'
import { calculateEsgFleetScore, type EsgFleetScore } from '@/utils/esgFleetScore'

function tripKm(reserva: { km_percorrido?: number | null; km_ida_volta: number }): number {
  if (reserva.km_percorrido && reserva.km_percorrido > 0) return reserva.km_percorrido
  return reserva.km_ida_volta || 0
}

function isCurrentMonth(iso: string, now: Date): boolean {
  const data = new Date(iso)
  return data.getFullYear() === now.getFullYear() && data.getMonth() === now.getMonth()
}

export function EsgDashboardCard() {
  const { profile } = useAuth()
  const { filterEmpresaId } = useTenant()
  const { isMotorista } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(() => calculateFleetEmissions([]))
  const [score, setScore] = useState<EsgFleetScore>(() => calculateEsgFleetScore({
    veiculos: [],
    manutencoes: [],
    trips: [],
  }))
  const [vehicles, setVehicles] = useState<SimulatorVehicleOption[]>([])
  const [fleetKmMes, setFleetKmMes] = useState(0)
  const [fleetFuel, setFleetFuel] = useState<TipoCombustivel>('diesel')
  const [source, setSource] = useState<FleetDataSource>('live')

  const load = useCallback(async () => {
    if (isMotorista) {
      setLoading(false)
      return
    }

    setLoading(true)
    const now = new Date()
    try {
      const snapshot = await loadOperationalFleet({
        empresaId: filterEmpresaId,
        veiculos: getVeiculos({ empresaId: filterEmpresaId }, profile),
        reservas: getReservas(profile, { empresaId: filterEmpresaId }),
        manutencoes: getManutencoes({ empresaId: filterEmpresaId }, profile),
      })

      const monthReservas = snapshot.reservas
        .filter(reserva => reserva.status !== 'REJEITADO')
        .filter(reserva => isCurrentMonth(reserva.data_viagem, now))

      const trips = monthReservas.map(reserva => {
        const veiculo = snapshot.veiculos.find(item => item.id === reserva.veiculo_id)
        return {
          km: tripKm(reserva),
          combustivel: resolveVehicleFuelType(veiculo ?? reserva.veiculos),
          veiculoId: reserva.veiculo_id,
        }
      })

      const kmByVehicle = new Map<string, { km: number; combustivel: TipoCombustivel }>()
      for (const trip of trips) {
        const current = kmByVehicle.get(trip.veiculoId) ?? { km: 0, combustivel: trip.combustivel }
        kmByVehicle.set(trip.veiculoId, {
          km: current.km + trip.km,
          combustivel: trip.combustivel,
        })
      }

      const simulatorVehicles: SimulatorVehicleOption[] = snapshot.veiculos.map(veiculo => {
        const stats = kmByVehicle.get(veiculo.id)
        return {
          id: veiculo.id,
          label: veiculo.placa,
          combustivel: stats?.combustivel ?? resolveVehicleFuelType(veiculo),
          kmMes: stats?.km ?? 0,
        }
      })

      const combustionTrips = trips.filter(trip => trip.combustivel === 'diesel' || trip.combustivel === 'gasolina')
      const combustionKm = combustionTrips.reduce((sum, trip) => sum + trip.km, 0)
      const dieselKm = combustionTrips.filter(trip => trip.combustivel === 'diesel').reduce((sum, trip) => sum + trip.km, 0)

      setSource(snapshot.source)
      setSummary(calculateFleetEmissions(trips))
      setVehicles(simulatorVehicles)
      setFleetKmMes(combustionKm)
      setFleetFuel(dieselKm >= combustionKm / 2 ? 'diesel' : 'gasolina')
      setScore(calculateEsgFleetScore({
        veiculos: snapshot.veiculos.map(veiculo => ({
          id: veiculo.id,
          kmAtual: veiculo.quilometragem_atual ?? veiculo.km_atual ?? 0,
        })),
        manutencoes: snapshot.manutencoes.map(item => ({
          veiculoId: item.veiculo_id,
          tipo: item.tipo,
          status: item.status,
          dataHora: item.data_hora ?? item.data_manutencao ?? item.created_at,
          proximaManutencaoData: item.data_proxima_manutencao ?? item.proxima_manutencao_data ?? null,
          proximaManutencaoKm: item.proxima_manutencao_km ?? null,
        })),
        trips,
        now,
      }))
    } finally {
      setLoading(false)
    }
  }, [filterEmpresaId, isMotorista, profile])

  useEffect(() => {
    load()
  }, [load])

  useDataRefresh(load)

  const progress = useMemo(() => Math.min(100, summary.arvores * 10), [summary.arvores])

  if (isMotorista) return null

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <EsgFleetScoreCard score={score} />
      )}

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

      {loading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <EnergyTransitionSimulator
          fleetKmMes={fleetKmMes}
          fleetFuel={fleetFuel}
          vehicles={vehicles}
        />
      )}
    </div>
  )
}
