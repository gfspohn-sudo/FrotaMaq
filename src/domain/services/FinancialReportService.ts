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
  valorMaoDeObra: number
  valorPecas: number
}

export interface CostBreakdownItem {
  manutencaoId: string
  veiculoId: string
  placa: string
  descricao: string
  dataHora: string
  valorMaoDeObra: number
  valorPecas: number
  valorTotal: number
  pecas: { descricao: string; quantidade: number; valor_unitario: number }[]
}

export interface FinancialReportResult {
  totalGeral: number
  totalMaoDeObra: number
  totalPecas: number
  costByType: CostByType[]
  costByVehicle: CostByVehicle[]
  breakdown: CostBreakdownItem[]
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
    const totalMaoDeObra = manutencoes.reduce((sum, m) => sum + m.valorMaoDeObra.value, 0)
    const totalPecas = manutencoes.reduce((sum, m) => sum + m.valorPecas.value, 0)

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
          valorMaoDeObra: 0,
          valorPecas: 0,
        }
      }
      acc[m.veiculoId].total += m.valor.value
      acc[m.veiculoId].valorMaoDeObra += m.valorMaoDeObra.value
      acc[m.veiculoId].valorPecas += m.valorPecas.value
      return acc
    }, {})

    const costByVehicle = Object.values(byVehicle).sort((a, b) => b.total - a.total)

    const breakdown: CostBreakdownItem[] = manutencoes.map(m => ({
      manutencaoId: m.id,
      veiculoId: m.veiculoId,
      placa: m.veiculoResumo?.placa ?? '',
      descricao: m.descricao,
      dataHora: m.dataHora,
      valorMaoDeObra: m.valorMaoDeObra.value,
      valorPecas: m.valorPecas.value,
      valorTotal: m.valor.value,
      pecas: m.pecasTrocadas,
    }))

    return {
      totalGeral,
      totalMaoDeObra,
      totalPecas,
      costByType,
      costByVehicle,
      breakdown,
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
