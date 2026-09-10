import type { IManutencaoRepository } from '@/domain/repositories/IManutencaoRepository'
import { FinancialReportService, type FinancialReportResult } from '@/domain/services/FinancialReportService'
import { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'
import type { TenantFilter } from '@/domain/types/enums'
import type { CostByType, CostByVehicle } from '@/services/reports'

export interface GetFinancialReportInput extends TenantFilter {
  period?: PeriodoFinanceiro
}

export interface GetFinancialReportOutput {
  totalGeral: number
  costByType: CostByType[]
  costByVehicle: CostByVehicle[]
  periodLabel: string
  recordCount: number
  usedFallbackPeriod: boolean
}

export class GetFinancialReportUseCase {
  private readonly manutencaoRepo: IManutencaoRepository

  constructor(manutencaoRepo: IManutencaoRepository) {
    this.manutencaoRepo = manutencaoRepo
  }

  async execute(input: GetFinancialReportInput = {}): Promise<{
    data: GetFinancialReportOutput | null
    error: unknown
  }> {
    const { data: candidates, error } = await this.manutencaoRepo.findWithFinancialValue({
      empresaId: input.empresaId,
    })

    if (error || !candidates) return { data: null, error }

    const { periodo, rows, usedFallback } = FinancialReportService.resolverPeriodoComFallback(
      candidates,
      input.period,
    )

    const report: FinancialReportResult = FinancialReportService.gerarRelatorio(rows, periodo, usedFallback)

    return {
      data: {
        totalGeral: report.totalGeral,
        costByType: report.costByType,
        costByVehicle: report.costByVehicle.map(c => ({
          veiculo_id: c.veiculoId,
          placa: c.placa,
          modelo: c.modelo,
          total: c.total,
        })),
        periodLabel: report.periodLabel,
        recordCount: report.recordCount,
        usedFallbackPeriod: report.usedFallbackPeriod,
      },
      error: null,
    }
  }
}
