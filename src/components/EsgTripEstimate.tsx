import { useEffect, useMemo, useState } from 'react'
import { Leaf } from 'lucide-react'
import { Select } from '@/components/ui/Input'
import {
  COMBUSTIVEL_LABELS,
  calculateTripEmissions,
  isTipoCombustivel,
  parseKmInput,
  resolveVehicleFuelType,
  type TipoCombustivel,
} from '@/utils/esgCalculator'
import type { Veiculo } from '@/types/database'

interface EsgTripEstimateProps {
  kmIdaVolta: string
  veiculo?: Veiculo | null
}

const FUEL_OPTIONS = (Object.keys(COMBUSTIVEL_LABELS) as TipoCombustivel[]).map(value => ({
  value,
  label: COMBUSTIVEL_LABELS[value],
}))

export function EsgTripEstimate({ kmIdaVolta, veiculo }: EsgTripEstimateProps) {
  const inferred = resolveVehicleFuelType(veiculo)
  const [combustivel, setCombustivel] = useState<TipoCombustivel>(inferred)
  const km = parseKmInput(kmIdaVolta)
  const fuel = isTipoCombustivel(combustivel) ? combustivel : inferred

  useEffect(() => {
    setCombustivel(inferred)
  }, [veiculo?.id, inferred])

  const estimate = useMemo(() => {
    if (km <= 0) return null
    return calculateTripEmissions(km, fuel)
  }, [km, fuel])

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
      <div className="mb-2 flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
        <Leaf className="h-4 w-4" />
        <p className="text-sm font-semibold">Estimativa ESG da viagem</p>
      </div>

      <Select
        label="Combustível do veículo"
        value={fuel}
        onChange={e => setCombustivel(e.target.value as TipoCombustivel)}
        options={FUEL_OPTIONS}
      />

      {!veiculo?.tipo_combustivel && (
        <p className="mt-2 text-xs text-emerald-800/80 dark:text-emerald-300/80">
          Combustível não informado no cadastro — usando {COMBUSTIVEL_LABELS[fuel]} como padrão.
        </p>
      )}

      {!estimate ? (
        <p className="mt-2 text-xs text-emerald-800/80 dark:text-emerald-300/80">
          Calcule o trajeto no mapa para atualizar a emissão em tempo real.
        </p>
      ) : estimate.zeroEmissao ? (
        <p className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          {estimate.label}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
            {estimate.kgCo2.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg CO₂
          </p>
          <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
            {km.toLocaleString('pt-BR')} km · {COMBUSTIVEL_LABELS[fuel]} · {estimate.litros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L
          </p>
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
            Compensação: {estimate.label.split(' · ')[1] ?? `${estimate.arvores} árvores`}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-emerald-500/20">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${Math.min(100, (estimate.kgCo2 / 80) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
