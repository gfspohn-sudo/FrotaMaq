import type { Manutencao, Reserva, StatusVeiculo, Veiculo } from '@/types/database'
import {
  STATUS_MANUTENCAO_LABELS,
  STATUS_VEICULO_LABELS,
  TIPO_MANUTENCAO_LABELS,
} from '@/types/database'
import { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'
import { Money } from '@/domain/value-objects/Money'
import {
  getManutencaoData,
  getManutencaoProximaData,
  getManutencaoStatus,
  getManutencaoValor,
  getVeiculoKm,
  getVeiculoMarca,
  getVeiculoModelo,
  normalizeTipoManutencao,
} from '@/lib/dbCompat'
import { formatDate } from '@/lib/maintenanceStatus'
import { analyzeVehicleHeuristic, buildVehicleTelemetry, type NivelRiscoIa } from '@/services/aiService'
import {
  COMBUSTIVEL_LABELS,
  calculateFleetEmissions,
  calculateTripEmissions,
  formatArvores,
  formatCo2Mass,
  resolveVehicleFuelType,
  type TipoCombustivel,
} from '@/utils/esgCalculator'
import { toCsvWithMeta } from '@/lib/csvFile'

export type ExecutiveReportKind = 'frota' | 'esg' | 'manutencoes'

export const SAUDE_LABELS: Record<NivelRiscoIa, string> = {
  baixo: 'Em dia',
  medio: 'Atenção',
  alto: 'Crítico',
}

export const REPORT_TITLES: Record<ExecutiveReportKind, string> = {
  frota: 'Relatório Geral da Frota',
  esg: 'Relatório ESG e Emissões',
  manutencoes: 'Histórico de Manutenções',
}

export interface ExecutiveReportMeta {
  title: string
  periodLabel: string
  emittedAt: Date
  userName: string
  userRole: string
  tenantName: string
}

export interface ReportKpi {
  label: string
  value: string
  tone: 'navy' | 'success' | 'action' | 'warning' | 'danger' | 'slate'
}

export interface FleetReportRow {
  placa: string
  modelo: string
  marca: string
  status: string
  statusKey: StatusVeiculo
  km: number
  kmLabel: string
  combustivel: string
  saude: string
  saudeKey: NivelRiscoIa
  resumo: string
}

export interface FleetReport {
  rows: FleetReportRow[]
  kpis: ReportKpi[]
  statusCounts: Record<StatusVeiculo, number>
  healthCounts: Record<NivelRiscoIa, number>
}

export interface EsgFuelRow {
  combustivel: string
  combustivelKey: TipoCombustivel
  viagens: number
  km: number
  kmLabel: string
  kgCo2: number
  co2Label: string
  arvores: number
  arvoresLabel: string
}

export interface EsgReport {
  rows: EsgFuelRow[]
  kpis: ReportKpi[]
  totals: {
    viagens: number
    kmTotal: number
    kgCo2: number
    arvores: number
    zeroEmissao: number
  }
  compensacao: string
}

export interface MaintenanceReportRow {
  os: string
  data: string
  placa: string
  modelo: string
  tipo: string
  descricao: string
  pecas: string
  custo: number
  custoLabel: string
  preventiva: string
  status: string
}

export interface MaintenanceReport {
  rows: MaintenanceReportRow[]
  kpis: ReportKpi[]
  totalCusto: number
}

export interface ExecutiveReportFilters {
  period: PeriodoFinanceiro
  veiculoId?: string
  motoristaId?: string
  includeCosts?: boolean
}

const FILE_SLUGS: Record<ExecutiveReportKind, string> = {
  frota: 'Frota_Geral',
  esg: 'ESG_Emissoes',
  manutencoes: 'Historico_Manutencoes',
}

function formatKm(value: number): string {
  return `${Math.round(value).toLocaleString('pt-BR')} km`
}

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function safeFormatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return formatDate(value)
}

function formatPecas(pecas: Manutencao['pecas_trocadas']): string {
  if (!pecas?.length) return '—'
  return pecas
    .map(peca => `${peca.descricao} (${peca.quantidade}x)`)
    .join(', ')
}

function vehicleIdsForDriver(reservas: Reserva[], motoristaId?: string): Set<string> | null {
  if (!motoristaId) return null
  return new Set(reservas.filter(r => r.motorista_id === motoristaId).map(r => r.veiculo_id))
}

function filterVehicles(
  veiculos: Veiculo[],
  reservas: Reserva[],
  filters?: Pick<ExecutiveReportFilters, 'veiculoId' | 'motoristaId'>,
): Veiculo[] {
  const driverVehicles = vehicleIdsForDriver(reservas, filters?.motoristaId)
  return veiculos.filter(veiculo => {
    if (filters?.veiculoId && veiculo.id !== filters.veiculoId) return false
    if (driverVehicles && !driverVehicles.has(veiculo.id)) return false
    return true
  })
}

function filterReservas(reservas: Reserva[], filters: ExecutiveReportFilters): Reserva[] {
  return reservas.filter(reserva => {
    if (reserva.status === 'REJEITADO') return false
    if (!filters.period.contemTimestamp(reserva.data_viagem)) return false
    if (filters.veiculoId && reserva.veiculo_id !== filters.veiculoId) return false
    if (filters.motoristaId && reserva.motorista_id !== filters.motoristaId) return false
    return true
  })
}

function filterManutencoes(
  manutencoes: Manutencao[],
  reservas: Reserva[],
  filters: ExecutiveReportFilters,
): Manutencao[] {
  const driverVehicles = vehicleIdsForDriver(reservas, filters.motoristaId)
  return manutencoes.filter(manutencao => {
    if (!filters.period.contemTimestamp(getManutencaoData(manutencao))) return false
    if (filters.veiculoId && manutencao.veiculo_id !== filters.veiculoId) return false
    if (driverVehicles && !driverVehicles.has(manutencao.veiculo_id)) return false
    return true
  })
}

function csvMeta(meta: ExecutiveReportMeta): Array<readonly [string, string]> {
  return [
    ['Relatório', meta.title],
    ['Período', meta.periodLabel],
    ['Emitido em', formatEmittedAt(meta.emittedAt)],
    ['Usuário', `${meta.userName} (${meta.userRole})`],
    ['Empresa', meta.tenantName],
  ]
}

export function formatEmittedAt(date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function formatPeriodRange(period: PeriodoFinanceiro): string {
  const start = new Date(`${period.startDate}T00:00:00`).toLocaleDateString('pt-BR')
  const end = new Date(`${period.endDate}T00:00:00`).toLocaleDateString('pt-BR')
  return `${start} a ${end}`
}

/** Domain Service — monta os três relatórios executivos (frota, ESG, manutenções). */
export class ExecutiveReportService {
  static fileName(kind: ExecutiveReportKind, ext: 'pdf' | 'csv', date = new Date()): string {
    const stamp = date.toISOString().slice(0, 10)
    return `FrotaMaq_${FILE_SLUGS[kind]}_${stamp}.${ext}`
  }

  static buildFleetReport(
    veiculos: Veiculo[],
    manutencoes: Manutencao[],
    reservas: Reserva[],
    filters?: Pick<ExecutiveReportFilters, 'veiculoId' | 'motoristaId'>,
    now = new Date(),
  ): FleetReport {
    const scoped = filterVehicles(veiculos, reservas, filters)
    const statusCounts: Record<StatusVeiculo, number> = {
      disponivel: 0,
      em_viagem: 0,
      em_manutencao: 0,
      parado: 0,
    }
    const healthCounts: Record<NivelRiscoIa, number> = { baixo: 0, medio: 0, alto: 0 }

    const rows = scoped.map(veiculo => {
      const telemetry = buildVehicleTelemetry(veiculo, manutencoes, reservas)
      const insight = analyzeVehicleHeuristic(telemetry, now)
      statusCounts[veiculo.status] += 1
      healthCounts[insight.nivelRisco] += 1
      const km = getVeiculoKm(veiculo)
      return {
        placa: veiculo.placa,
        modelo: getVeiculoModelo(veiculo),
        marca: getVeiculoMarca(veiculo),
        status: STATUS_VEICULO_LABELS[veiculo.status],
        statusKey: veiculo.status,
        km,
        kmLabel: formatKm(km),
        combustivel: COMBUSTIVEL_LABELS[resolveVehicleFuelType(veiculo)],
        saude: SAUDE_LABELS[insight.nivelRisco],
        saudeKey: insight.nivelRisco,
        resumo: insight.resumo,
      } satisfies FleetReportRow
    })

    return {
      rows,
      statusCounts,
      healthCounts,
      kpis: [
        { label: 'Veículos', value: String(rows.length), tone: 'navy' },
        { label: 'Disponíveis', value: String(statusCounts.disponivel), tone: 'success' },
        { label: 'Em viagem', value: String(statusCounts.em_viagem), tone: 'action' },
        { label: 'Manutenção', value: String(statusCounts.em_manutencao), tone: 'warning' },
        { label: 'Saúde crítica', value: String(healthCounts.alto), tone: healthCounts.alto > 0 ? 'danger' : 'slate' },
      ],
    }
  }

  static fleetToCsv(report: FleetReport, meta: ExecutiveReportMeta): string {
    return toCsvWithMeta(
      csvMeta(meta),
      ['Placa', 'Modelo', 'Marca', 'Status', 'KM acumulado', 'Combustível', 'Saúde', 'Resumo'],
      report.rows.map(row => [
        row.placa,
        row.modelo,
        row.marca,
        row.status,
        row.km,
        row.combustivel,
        row.saude,
        row.resumo,
      ]),
    )
  }

  static buildEsgReport(
    veiculos: Veiculo[],
    reservas: Reserva[],
    filters: ExecutiveReportFilters,
  ): EsgReport {
    const trips = filterReservas(reservas, filters).map(reserva => {
      const veiculo = veiculos.find(item => item.id === reserva.veiculo_id)
      const km = reserva.km_percorrido && reserva.km_percorrido > 0
        ? reserva.km_percorrido
        : reserva.km_ida_volta
      return {
        km: km || 0,
        combustivel: resolveVehicleFuelType(veiculo ?? reserva.veiculos),
      }
    })

    const grouped = new Map<TipoCombustivel, { km: number; viagens: number }>()
    for (const trip of trips) {
      const current = grouped.get(trip.combustivel) ?? { km: 0, viagens: 0 }
      current.km += trip.km
      current.viagens += 1
      grouped.set(trip.combustivel, current)
    }

    const order: TipoCombustivel[] = ['diesel', 'gasolina', 'etanol', 'eletrico']
    const rows: EsgFuelRow[] = order
      .filter(key => grouped.has(key))
      .map(key => {
        const group = grouped.get(key)!
        const estimate = calculateTripEmissions(group.km, key)
        return {
          combustivel: COMBUSTIVEL_LABELS[key],
          combustivelKey: key,
          viagens: group.viagens,
          km: estimate.km,
          kmLabel: formatKm(estimate.km),
          kgCo2: estimate.kgCo2,
          co2Label: formatCo2Mass(estimate.kgCo2),
          arvores: estimate.arvores,
          arvoresLabel: formatArvores(estimate.arvores),
        }
      })

    const totals = calculateFleetEmissions(trips)

    return {
      rows,
      totals,
      compensacao: totals.compensacao,
      kpis: [
        { label: 'Viagens', value: String(totals.viagens), tone: 'action' },
        { label: 'KM rodados', value: formatKm(totals.kmTotal), tone: 'navy' },
        { label: 'CO2 emitido', value: `${formatCo2Mass(totals.kgCo2)} CO2`, tone: 'warning' },
        { label: 'Árvores p/ compensar', value: formatArvores(totals.arvores), tone: 'success' },
      ],
    }
  }

  static esgToCsv(report: EsgReport, meta: ExecutiveReportMeta): string {
    return toCsvWithMeta(
      [
        ...csvMeta(meta),
        ['Total CO2', formatCo2Mass(report.totals.kgCo2)],
        ['Árvores para compensação', formatArvores(report.totals.arvores)],
      ],
      ['Combustível', 'Viagens', 'KM rodados', 'CO2 (kg)', 'Árvores para compensar'],
      report.rows.map(row => [
        row.combustivel,
        row.viagens,
        formatNumber(row.km, 1),
        formatNumber(row.kgCo2, 2),
        formatNumber(row.arvores, 2),
      ]),
    )
  }

  static buildMaintenanceReport(
    manutencoes: Manutencao[],
    veiculos: Veiculo[],
    reservas: Reserva[],
    filters: ExecutiveReportFilters,
  ): MaintenanceReport {
    const scoped = filterManutencoes(manutencoes, reservas, filters)
      .slice()
      .sort((a, b) => new Date(getManutencaoData(a)).getTime() - new Date(getManutencaoData(b)).getTime())

    const includeCosts = filters.includeCosts !== false
    let pecasCount = 0
    let preventivas = 0
    let totalCusto = 0

    const rows = scoped.map((manutencao, index) => {
      const veiculo = veiculos.find(item => item.id === manutencao.veiculo_id)
      const tipo = normalizeTipoManutencao(manutencao.tipo_normalizado ?? manutencao.tipo)
      if (tipo === 'preventiva') preventivas += 1
      pecasCount += manutencao.pecas_trocadas?.length ?? 0
      const custo = getManutencaoValor(manutencao)
      totalCusto += custo
      const placa = veiculo?.placa ?? manutencao.veiculos?.placa ?? '—'
      const modelo = veiculo
        ? getVeiculoModelo(veiculo)
        : (manutencao.veiculos?.modelo ?? manutencao.veiculos?.nome_exibicao ?? '—')

      return {
        os: `OS-${String(index + 1).padStart(3, '0')}`,
        data: safeFormatDate(getManutencaoData(manutencao)),
        placa,
        modelo,
        tipo: TIPO_MANUTENCAO_LABELS[tipo],
        descricao: manutencao.descricao,
        pecas: formatPecas(manutencao.pecas_trocadas),
        custo,
        custoLabel: includeCosts ? Money.from(custo).format() : '—',
        preventiva: safeFormatDate(getManutencaoProximaData(manutencao)),
        status: STATUS_MANUTENCAO_LABELS[getManutencaoStatus(manutencao)],
      } satisfies MaintenanceReportRow
    })

    const kpis: ReportKpi[] = [
      { label: 'OS no período', value: String(rows.length), tone: 'navy' },
      { label: 'Preventivas', value: String(preventivas), tone: 'success' },
      { label: 'Peças registradas', value: String(pecasCount), tone: 'action' },
    ]
    if (includeCosts) {
      kpis.push({ label: 'Custo total', value: Money.from(totalCusto).format(), tone: 'warning' })
    }

    return { rows, kpis, totalCusto }
  }

  static maintenanceToCsv(report: MaintenanceReport, meta: ExecutiveReportMeta, includeCosts = true): string {
    const headers = includeCosts
      ? ['OS', 'Data', 'Placa', 'Modelo', 'Tipo', 'Descrição', 'Peças trocadas', 'Custo (R$)', 'Preventiva', 'Status']
      : ['OS', 'Data', 'Placa', 'Modelo', 'Tipo', 'Descrição', 'Peças trocadas', 'Preventiva', 'Status']

    return toCsvWithMeta(
      csvMeta(meta),
      headers,
      report.rows.map(row => includeCosts
        ? [
            row.os,
            row.data,
            row.placa,
            row.modelo,
            row.tipo,
            row.descricao,
            row.pecas,
            formatNumber(row.custo, 2),
            row.preventiva,
            row.status,
          ]
        : [
            row.os,
            row.data,
            row.placa,
            row.modelo,
            row.tipo,
            row.descricao,
            row.pecas,
            row.preventiva,
            row.status,
          ]),
    )
  }
}
