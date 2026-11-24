import {
  CONSUMO_LITROS_POR_KM,
  FATORES_EMISSAO_KG_POR_LITRO,
  calculateTripEmissions,
  type TipoCombustivel,
} from '@/utils/esgCalculator'

export type TransitionTarget = 'eletrico' | 'etanol'

/** Preços médios de referência (R$/L) para simulação gerencial — não são cotações em tempo real. */
export const PRECO_LITRO_BRL: Record<Exclude<TipoCombustivel, 'eletrico'>, number> = {
  diesel: 6.2,
  gasolina: 6.5,
  etanol: 4.2,
}

export const KWH_POR_KM = 0.2
export const CUSTO_KWH_BRL = 0.9

export interface TransitionScenario {
  km: number
  combustivel: TipoCombustivel
  custoMes: number
  custoAno: number
  kgCo2: number
  toneladas: number
}

export interface EnergyTransitionResult {
  percentual: number
  kmMes: number
  kmConvertido: number
  atual: TransitionScenario
  alternativo: TransitionScenario
  economiaMes: number
  economiaAno: number
  kgCo2Evitado: number
  reducaoCo2Pct: number
}

export function custoMedioPorKm(tipo: TipoCombustivel): number {
  if (tipo === 'eletrico') return round2(KWH_POR_KM * CUSTO_KWH_BRL)
  return round2(CONSUMO_LITROS_POR_KM[tipo] * PRECO_LITRO_BRL[tipo])
}

export function custoCombustivelReais(km: number, tipo: TipoCombustivel): number {
  return round2(Math.max(0, km) * custoMedioPorKm(tipo))
}

export function dieselKgPorKm(): number {
  return CONSUMO_LITROS_POR_KM.diesel * FATORES_EMISSAO_KG_POR_LITRO.diesel
}

export function simulateEnergyTransition(input: {
  kmMes: number
  combustivelAtual: TipoCombustivel
  alvo: TransitionTarget
  percentual: number
}): EnergyTransitionResult {
  const kmMes = Math.max(0, Number.isFinite(input.kmMes) ? input.kmMes : 0)
  const percentual = clamp(input.percentual, 0, 100)
  const share = percentual / 100
  const kmConvertido = round2(kmMes * share)
  const kmRestante = round2(kmMes - kmConvertido)

  const atual = scenario(kmMes, input.combustivelAtual)
  const mistoKg = round2(
    calculateTripEmissions(kmRestante, input.combustivelAtual).kgCo2
      + calculateTripEmissions(kmConvertido, input.alvo).kgCo2,
  )
  const mistoCustoMes = round2(
    custoCombustivelReais(kmRestante, input.combustivelAtual)
      + custoCombustivelReais(kmConvertido, input.alvo),
  )

  const alternativo: TransitionScenario = {
    km: kmMes,
    combustivel: percentual >= 100 ? input.alvo : input.combustivelAtual,
    custoMes: mistoCustoMes,
    custoAno: round2(mistoCustoMes * 12),
    kgCo2: mistoKg,
    toneladas: round4(mistoKg / 1000),
  }

  const kgCo2Evitado = round2(atual.kgCo2 - mistoKg)
  const reducaoCo2Pct = atual.kgCo2 <= 0
    ? 0
    : round2((kgCo2Evitado / atual.kgCo2) * 100)

  return {
    percentual,
    kmMes,
    kmConvertido,
    atual,
    alternativo,
    economiaMes: round2(atual.custoMes - mistoCustoMes),
    economiaAno: round2(atual.custoAno - alternativo.custoAno),
    kgCo2Evitado,
    reducaoCo2Pct,
  }
}

function scenario(km: number, combustivel: TipoCombustivel): TransitionScenario {
  const emissions = calculateTripEmissions(km, combustivel)
  const custoMes = custoCombustivelReais(km, combustivel)
  return {
    km,
    combustivel,
    custoMes,
    custoAno: round2(custoMes * 12),
    kgCo2: emissions.kgCo2,
    toneladas: emissions.toneladas,
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}
