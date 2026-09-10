import type { TipoManutencao } from '@/domain/types/enums'
import type { Manutencao } from '@/domain/entities/Manutencao'
import { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'

export interface CostByType {
  tipo: TipoManutencao
  total: number
}

export interface CostByVehicle {
  veiculoId: string
  placa: string
  modelo: string
  total: number
}

export interface FinancialReportResult {
  totalGeral: number
  costByType: CostByType[]
  costByVehicle: CostByVehicle[]
  periodLabel: string
  recordCount: number
  usedFallbackPeriod: boolean
}

/** Domain Service — cálculos e agregações financeiras. */
export class FinancialReportService {
  static filtrarPorPeriodo(manutencoes: Manutencao[], periodo: PeriodoFinanceiro): Manutencao[] {
    return manutencoes.filter(m =>
      m.entraEmRelatorioFinanceiro() &&
      m.possuiValorFinanceiro() &&
      m.estaNoPeriodo(m.dataHora, m.createdAt, periodo),
    )
  }

  static gerarRelatorio(
    manutencoes: Manutencao[],
    periodo: PeriodoFinanceiro,
    usedFallbackPeriod = false,
  ): FinancialReportResult {
    const totalGeral = manutencoes.reduce((sum, m) => sum + m.valor.value, 0)

    const byType = manutencoes.reduce<Record<string, number>>((acc, m) => {
      acc[m.tipo] = (acc[m.tipo] ?? 0) + m.valor.value
      return acc
    }, {})

    const costByType: CostByType[] = Object.entries(byType).map(([tipo, total]) => ({
      tipo: tipo as TipoManutencao,
      total,
    }))

    const byVehicle = manutencoes.reduce<Record<string, CostByVehicle>>((acc, m) => {
      if (!acc[m.veiculoId]) {
        acc[m.veiculoId] = {
          veiculoId: m.veiculoId,
          placa: m.veiculoResumo?.placa ?? '',
          modelo: m.veiculoResumo?.modelo ?? '',
          total: 0,
        }
      }
      acc[m.veiculoId].total += m.valor.value
      return acc
    }, {})

    const costByVehicle = Object.values(byVehicle).sort((a, b) => b.total - a.total)

    return {
      totalGeral,
      costByType,
      costByVehicle,
      periodLabel: periodo.label,
      recordCount: manutencoes.length,
      usedFallbackPeriod,
    }
  }

  static resolverPeriodoComFallback(
    todas: Manutencao[],
    periodoForcado?: PeriodoFinanceiro,
  ): { periodo: PeriodoFinanceiro; rows: Manutencao[]; usedFallback: boolean } {
    const mes = periodoForcado ?? PeriodoFinanceiro.mesAtual()
    let rows = FinancialReportService.filtrarPorPeriodo(todas, mes)
    let usedFallback = false
    let periodo = mes

    if (rows.length === 0 && !periodoForcado) {
      const fallback = PeriodoFinanceiro.ultimos30Dias()
      const fallbackRows = FinancialReportService.filtrarPorPeriodo(todas, fallback)
      if (fallbackRows.length > 0) {
        rows = fallbackRows
        periodo = fallback
        usedFallback = true
      }
    }

    return { periodo, rows, usedFallback }
  }
}
