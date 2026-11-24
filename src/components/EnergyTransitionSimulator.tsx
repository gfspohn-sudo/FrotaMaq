import { useMemo, useState } from 'react'
import { Leaf, Zap } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/maintenanceStatus'
import { COMBUSTIVEL_LABELS, formatCo2Mass, type TipoCombustivel } from '@/utils/esgCalculator'
import {
  simulateEnergyTransition,
  type TransitionTarget,
} from '@/utils/esgTransition'

export interface SimulatorVehicleOption {
  id: string
  label: string
  combustivel: TipoCombustivel
  kmMes: number
}

interface EnergyTransitionSimulatorProps {
  fleetKmMes: number
  fleetFuel: TipoCombustivel
  vehicles: SimulatorVehicleOption[]
}

export function EnergyTransitionSimulator({
  fleetKmMes,
  fleetFuel,
  vehicles,
}: EnergyTransitionSimulatorProps) {
  const combustionVehicles = vehicles.filter(item => item.combustivel === 'diesel' || item.combustivel === 'gasolina')
  const [selectedId, setSelectedId] = useState('fleet')
  const [alvo, setAlvo] = useState<TransitionTarget>('eletrico')
  const [percentual, setPercentual] = useState(40)
  const [kmOverride, setKmOverride] = useState('')

  const selected = selectedId === 'fleet'
    ? { combustivel: fleetFuel, kmMes: fleetKmMes, label: 'Frota (combustão)' }
    : combustionVehicles.find(item => item.id === selectedId) ?? {
      combustivel: fleetFuel,
      kmMes: fleetKmMes,
      label: 'Frota (combustão)',
    }

  const kmMes = useMemo(() => {
    const typed = Number(kmOverride.replace(',', '.'))
    if (kmOverride.trim() && Number.isFinite(typed) && typed >= 0) return typed
    return selected.kmMes
  }, [kmOverride, selected.kmMes])

  const result = simulateEnergyTransition({
    kmMes,
    combustivelAtual: selected.combustivel === 'eletrico' || selected.combustivel === 'etanol'
      ? 'diesel'
      : selected.combustivel,
    alvo,
    percentual,
  })

  const combustaoLabel = COMBUSTIVEL_LABELS[
    selected.combustivel === 'eletrico' || selected.combustivel === 'etanol' ? 'diesel' : selected.combustivel
  ]

  return (
    <Card className="border-action/25 bg-gradient-to-br from-slate-900 to-emerald-950 text-slate-50 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-400/15 p-2 text-emerald-300">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
              ROI Verde
            </p>
            <h3 className="mt-1 text-base font-semibold text-white">
              Simulador de Transição & Economia
            </h3>
            <p className="mt-1 text-xs text-slate-300">
              Compare combustão com elétrico ou etanol a partir do KM da operação — sem gravar nada no banco.
            </p>
          </div>
        </div>
        <Leaf className="h-5 w-5 text-emerald-400" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-slate-300">
          Escopo
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
          >
            <option value="fleet">Frota (combustão)</option>
            {combustionVehicles.map(item => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-300">
          Alternativa
          <select
            value={alvo}
            onChange={e => setAlvo(e.target.value as TransitionTarget)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
          >
            <option value="eletrico">Elétrico</option>
            <option value="etanol">Etanol</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-300">
          KM mensal (estimado)
          <input
            type="number"
            min={0}
            placeholder={String(Math.round(selected.kmMes) || 0)}
            value={kmOverride}
            onChange={e => setKmOverride(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
          />
        </label>
      </div>

      <label className="mt-4 block text-xs font-medium text-slate-300">
        E se eu eletrificar/converter {percentual}% desta rota?
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={percentual}
          onChange={e => setPercentual(Number(e.target.value))}
          className="mt-2 w-full accent-emerald-400"
        />
      </label>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ScenarioPanel
          title={`Atual · ${combustaoLabel}`}
          cost={result.atual.custoMes}
          costYear={result.atual.custoAno}
          co2={result.atual.kgCo2}
          tone="combustion"
        />
        <ScenarioPanel
          title={`Alternativo · ${COMBUSTIVEL_LABELS[alvo]} (${percentual}%)`}
          cost={result.alternativo.custoMes}
          costYear={result.alternativo.custoAno}
          co2={result.alternativo.kgCo2}
          tone="green"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Economia / mês"
          value={formatSignedCurrency(result.economiaMes)}
          positive={result.economiaMes >= 0}
        />
        <Metric
          label="Economia / ano"
          value={formatSignedCurrency(result.economiaAno)}
          positive={result.economiaAno >= 0}
        />
        <Metric
          label="Redução de CO₂"
          value={`${result.reducaoCo2Pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
          hint={`${formatCo2Mass(Math.max(0, result.kgCo2Evitado))} evitados / mês`}
          positive={result.reducaoCo2Pct >= 0}
        />
      </div>
    </Card>
  )
}

function ScenarioPanel({
  title,
  cost,
  costYear,
  co2,
  tone,
}: {
  title: string
  cost: number
  costYear: number
  co2: number
  tone: 'combustion' | 'green'
}) {
  return (
    <div className={`rounded-xl border p-4 ${
      tone === 'green'
        ? 'border-emerald-400/30 bg-emerald-400/10'
        : 'border-white/10 bg-white/5'
    }`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">{title}</p>
      <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(cost)}</p>
      <p className="text-xs text-slate-300">{formatCurrency(costYear)} / ano</p>
      <p className="mt-3 text-sm font-medium text-emerald-200">{formatCo2Mass(co2)} CO₂ / mês</p>
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
  positive,
}: {
  label: string
  value: string
  hint?: string
  positive: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${positive ? 'text-emerald-300' : 'text-amber-300'}`}>{value}</p>
      {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  )
}

function formatSignedCurrency(value: number): string {
  const formatted = formatCurrency(Math.abs(value))
  if (value > 0) return `+ ${formatted}`
  if (value < 0) return `− ${formatted}`
  return formatted
}
