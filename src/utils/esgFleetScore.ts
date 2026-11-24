import { calculateFleetEmissions, type TipoCombustivel } from '@/utils/esgCalculator'
import { dieselKgPorKm } from '@/utils/esgTransition'

export type EsgScoreClassificacao =
  | 'Excelente — Operação Sustentável'
  | 'Atenção — Oportunidade de Otimização'
  | 'Crítico — Alto Passivo'

export interface EsgScoreVehicleInput {
  id: string
  kmAtual: number
  proximaManutencaoData: string | null
  proximaManutencaoKm: number | null
}

export interface EsgScoreMaintenanceInput {
  veiculoId: string
  tipo: string
  status?: string | null
  dataHora: string
  proximaManutencaoData?: string | null
  proximaManutencaoKm?: number | null
}

export interface EsgFleetScore {
  nota: number
  classificacao: EsgScoreClassificacao
  tom: 'excelente' | 'atencao' | 'critico'
  preventivaEmDiaPct: number
  preventivaVsCorretivaPct: number
  emissaoPorKmScore: number
  kgCo2PorKm: number | null
  veiculosEmDia: number
  totalVeiculos: number
  preventivas: number
  corretivas: number
}

const WEIGHT_PREVENTIVA = 0.4
const WEIGHT_MIX = 0.3
const WEIGHT_EMISSAO = 0.3

export function classifyEsgScore(nota: number): { classificacao: EsgScoreClassificacao; tom: EsgFleetScore['tom'] } {
  if (nota >= 80) return { classificacao: 'Excelente — Operação Sustentável', tom: 'excelente' }
  if (nota >= 50) return { classificacao: 'Atenção — Oportunidade de Otimização', tom: 'atencao' }
  return { classificacao: 'Crítico — Alto Passivo', tom: 'critico' }
}

export function isPreventivaEmDia(
  veiculo: EsgScoreVehicleInput,
  now = new Date(),
): boolean {
  const hasSchedule = Boolean(veiculo.proximaManutencaoData) || veiculo.proximaManutencaoKm != null
  if (!hasSchedule) return false

  const today = startOfDay(now)

  if (veiculo.proximaManutencaoData) {
    const due = startOfDay(new Date(veiculo.proximaManutencaoData))
    if (due.getTime() < today.getTime()) return false
  }

  if (veiculo.proximaManutencaoKm != null && Number.isFinite(veiculo.proximaManutencaoKm)) {
    if (veiculo.kmAtual > veiculo.proximaManutencaoKm) return false
  }

  return true
}

export function latestScheduleByVehicle(
  manutencoes: EsgScoreMaintenanceInput[],
): Map<string, { data: string | null; km: number | null }> {
  const latest = new Map<string, { data: string | null; km: number | null; at: number }>()

  for (const item of manutencoes) {
    const at = Date.parse(item.dataHora) || 0
    const current = latest.get(item.veiculoId)
    if (current && current.at >= at) continue
    latest.set(item.veiculoId, {
      at,
      data: item.proximaManutencaoData ?? null,
      km: item.proximaManutencaoKm ?? null,
    })
  }

  return new Map(
    [...latest.entries()].map(([id, value]) => [id, { data: value.data, km: value.km }]),
  )
}

export function calculateEsgFleetScore(input: {
  veiculos: Array<{ id: string; kmAtual: number }>
  manutencoes: EsgScoreMaintenanceInput[]
  trips: Array<{ km: number; combustivel: TipoCombustivel }>
  now?: Date
}): EsgFleetScore {
  const schedules = latestScheduleByVehicle(input.manutencoes)
  const scoredVehicles: EsgScoreVehicleInput[] = input.veiculos.map(veiculo => {
    const schedule = schedules.get(veiculo.id)
    return {
      id: veiculo.id,
      kmAtual: veiculo.kmAtual,
      proximaManutencaoData: schedule?.data ?? null,
      proximaManutencaoKm: schedule?.km ?? null,
    }
  })

  const veiculosEmDia = scoredVehicles.filter(item => isPreventivaEmDia(item, input.now)).length
  const totalVeiculos = scoredVehicles.length
  const preventivaEmDiaPct = totalVeiculos === 0 ? 50 : round1((veiculosEmDia / totalVeiculos) * 100)

  const osAtivas = input.manutencoes.filter(item => (item.status ?? '').toLowerCase() !== 'cancelada')
  const preventivas = osAtivas.filter(item => {
    const tipo = item.tipo.toLowerCase()
    return tipo === 'preventiva' || tipo === 'preditiva'
  }).length
  const corretivas = osAtivas.filter(item => item.tipo.toLowerCase() === 'corretiva').length
  const totalOs = preventivas + corretivas
  const preventivaVsCorretivaPct = totalOs === 0 ? 50 : round1((preventivas / totalOs) * 100)

  const emissions = calculateFleetEmissions(input.trips)
  const kgCo2PorKm = emissions.kmTotal > 0 ? emissions.kgCo2 / emissions.kmTotal : null
  const baseline = dieselKgPorKm()
  const emissaoPorKmScore = kgCo2PorKm == null
    ? 50
    : round1(clamp((1 - kgCo2PorKm / baseline) * 100, 0, 100))

  const nota = round1(
    preventivaEmDiaPct * WEIGHT_PREVENTIVA
      + preventivaVsCorretivaPct * WEIGHT_MIX
      + emissaoPorKmScore * WEIGHT_EMISSAO,
  )
  const { classificacao, tom } = classifyEsgScore(nota)

  return {
    nota,
    classificacao,
    tom,
    preventivaEmDiaPct,
    preventivaVsCorretivaPct,
    emissaoPorKmScore,
    kgCo2PorKm: kgCo2PorKm == null ? null : round4(kgCo2PorKm),
    veiculosEmDia,
    totalVeiculos,
    preventivas,
    corretivas,
  }
}

function startOfDay(value: Date): Date {
  const copy = new Date(value)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}
