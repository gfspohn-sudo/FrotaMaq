import type { IManutencaoRepository } from '@/domain/repositories/IManutencaoRepository'
import type { IVeiculoRepository } from '@/domain/repositories/IVeiculoRepository'
import { MaintenanceDashboardService, type MaintenanceDashboardResult } from '@/domain/services/MaintenanceDashboardService'
import type { TenantFilter } from '@/domain/types/enums'

export class GetMaintenanceDashboardUseCase {
  private readonly manutencaoRepo: IManutencaoRepository
  private readonly veiculoRepo: IVeiculoRepository

  constructor(manutencaoRepo: IManutencaoRepository, veiculoRepo: IVeiculoRepository) {
    this.manutencaoRepo = manutencaoRepo
    this.veiculoRepo = veiculoRepo
  }

  async execute(filter?: TenantFilter): Promise<{
    data: MaintenanceDashboardResult | null
    error: unknown
  }> {
    const [manutencoesRes, veiculosRes] = await Promise.all([
      this.manutencaoRepo.findAll(filter),
      this.veiculoRepo.findAll(filter),
    ])

    if (manutencoesRes.error || !manutencoesRes.data) {
      return { data: null, error: manutencoesRes.error }
    }

    return {
      data: MaintenanceDashboardService.montar(manutencoesRes.data, veiculosRes.data ?? []),
      error: veiculosRes.error,
    }
  }
}
