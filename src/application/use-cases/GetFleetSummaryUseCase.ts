import type { IVeiculoRepository } from '@/domain/repositories/IVeiculoRepository'
import { FleetSummaryService, type FleetSummaryResult } from '@/domain/services/MaintenanceDashboardService'
import type { TenantFilter } from '@/domain/types/enums'

export class GetFleetSummaryUseCase {
  private readonly veiculoRepo: IVeiculoRepository

  constructor(veiculoRepo: IVeiculoRepository) {
    this.veiculoRepo = veiculoRepo
  }

  async execute(filter?: TenantFilter): Promise<{
    data: FleetSummaryResult | null
    error: unknown
  }> {
    const { data, error } = await this.veiculoRepo.findAll(filter)
    if (error || !data) return { data: null, error }
    return { data: FleetSummaryService.calcular(data), error: null }
  }
}
