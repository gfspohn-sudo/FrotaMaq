import type { IManutencaoRepository } from '@/domain/repositories/IManutencaoRepository'
import { MaintenanceDashboardService, type MaintenanceDashboardResult } from '@/domain/services/MaintenanceDashboardService'
import type { TenantFilter } from '@/domain/types/enums'

export class GetMaintenanceDashboardUseCase {
  private readonly manutencaoRepo: IManutencaoRepository

  constructor(manutencaoRepo: IManutencaoRepository) {
    this.manutencaoRepo = manutencaoRepo
  }

  async execute(filter?: TenantFilter): Promise<{
    data: MaintenanceDashboardResult | null
    error: unknown
  }> {
    const { data, error } = await this.manutencaoRepo.findAll(filter)
    if (error || !data) return { data: null, error }
    return { data: MaintenanceDashboardService.montar(data), error: null }
  }
}
