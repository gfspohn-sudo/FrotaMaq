export type TipoCombustivel = 'diesel' | 'gasolina' | 'etanol' | 'eletrico'

export const FATORES_EMISSAO_KG_POR_LITRO: Record<TipoCombustivel, number> = {
  diesel: 2.68,
  gasolina: 2.27,
  etanol: 1.5,
  eletrico: 0,
}

/** Consumo médio de frota (L/km) para converter distância OSM em litros. */
export const CONSUMO_LITROS_POR_KM: Record<TipoCombustivel, number> = {
  diesel: 0.25,
  gasolina: 0.1,
  etanol: 0.125,
  eletrico: 0,
}

export const ARVORES_POR_TONELADA_CO2 = 7

export const COMBUSTIVEL_LABELS: Record<TipoCombustivel, string> = {
  diesel: 'Diesel',
  gasolina: 'Gasolina',
  etanol: 'Etanol',
  eletrico: 'Elétrico',
}

export interface EsgEstimate {
  km: number
  combustivel: TipoCombustivel
  litros: number
  kgCo2: number
  toneladas: number
  arvores: number
  zeroEmissao: boolean
  label: string
}

export interface EsgFleetSummary {
  viagens: number
  kmTotal: number
  kgCo2: number
  toneladas: number
  arvores: number
  zeroEmissao: number
  label: string
  compensacao: string
}

const TIPOS: TipoCombustivel[] = ['diesel', 'gasolina', 'etanol', 'eletrico']

export function isTipoCombustivel(value: string | null | undefined): value is TipoCombustivel {
  return TIPOS.includes((value ?? '').toLowerCase() as TipoCombustivel)
}

/** Converte o campo de km do formulário (string) em número válido, aceitando vírgula. */
export function parseKmInput(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const normalized = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return 0
  const parsed = parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function resolveVehicleFuelType(veiculo?: {
  tipo_combustivel?: string | null
  marca?: string | null
  modelo?: string | null
  nome_exibicao?: string | null
} | null): TipoCombustivel {
  if (isTipoCombustivel(veiculo?.tipo_combustivel ?? '')) {
    return (veiculo!.tipo_combustivel as string).toLowerCase() as TipoCombustivel
  }

  const blob = `${veiculo?.marca ?? ''} ${veiculo?.modelo ?? ''} ${veiculo?.nome_exibicao ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (/eletr|ev\b|hibrid|byd|leaf|tesla|bolt|dolphin|yuan/.test(blob)) return 'eletrico'
  if (/etanol/.test(blob)) return 'etanol'
  if (/gasolina|petrol/.test(blob)) return 'gasolina'
  return 'diesel'
}

export function calculateTripEmissions(distanceKm: number, combustivel?: TipoCombustivel | string | null): EsgEstimate {
  const km = Math.max(0, parseKmInput(distanceKm))
  const tipo = isTipoCombustivel(combustivel) ? combustivel : 'diesel'
  const litrosPorKm = CONSUMO_LITROS_POR_KM[tipo] ?? CONSUMO_LITROS_POR_KM.diesel
  const fator = FATORES_EMISSAO_KG_POR_LITRO[tipo] ?? FATORES_EMISSAO_KG_POR_LITRO.diesel
  const litros = round2(km * litrosPorKm)
  const kgCo2 = round2(litros * fator)
  const toneladas = round4(kgCo2 / 1000)
  const arvores = round2(toneladas * ARVORES_POR_TONELADA_CO2)
  const zeroEmissao = tipo === 'eletrico' || kgCo2 === 0

  return {
    km,
    combustivel: tipo,
    litros,
    kgCo2,
    toneladas,
    arvores,
    zeroEmissao,
    label: zeroEmissao
      ? '0 kg CO2 (Veículo Zero Emissão)'
      : `${formatCo2Mass(kgCo2)} CO₂ · ${formatArvores(arvores)} para compensar`,
  }
}

export function calculateFleetEmissions(
  trips: Array<{ km: number; combustivel: TipoCombustivel }>,
): EsgFleetSummary {
  const estimates = trips.map(trip => calculateTripEmissions(trip.km, trip.combustivel))
  const kgCo2 = round2(estimates.reduce((sum, item) => sum + item.kgCo2, 0))
  const kmTotal = round2(estimates.reduce((sum, item) => sum + item.km, 0))
  const toneladas = round4(kgCo2 / 1000)
  const arvores = round2(toneladas * ARVORES_POR_TONELADA_CO2)
  const zeroEmissao = estimates.filter(item => item.zeroEmissao).length

  return {
    viagens: trips.length,
    kmTotal,
    kgCo2,
    toneladas,
    arvores,
    zeroEmissao,
    label: formatCo2Mass(kgCo2),
    compensacao: `Sua frota precisa de ${formatArvores(arvores)} para neutralizar o impacto este mês`,
  }
}

export function formatCo2Mass(kgCo2: number): string {
  if (kgCo2 >= 1000) {
    return `${(kgCo2 / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t`
  }
  return `${kgCo2.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`
}

export function formatArvores(arvores: number): string {
  if (arvores <= 0) return '0 árvores'
  if (arvores < 1) return `${arvores.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} árvore`
  const rounded = Math.round(arvores)
  return `${rounded.toLocaleString('pt-BR')} ${rounded === 1 ? 'árvore' : 'árvores'}`
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}
