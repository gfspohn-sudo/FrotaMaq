import type { IManutencaoRepository } from '@/domain/repositories/IManutencaoRepository'
import type { IVeiculoRepository } from '@/domain/repositories/IVeiculoRepository'
import { FleetPriorityAlertService, type FleetPriorityAlert } from '@/domain/services/FleetPriorityAlertService'
import { FleetSummaryService, type FleetSummaryResult } from '@/domain/services/MaintenanceDashboardService'
import type { TenantFilter } from '@/domain/types/enums'

export class GetFleetAlertsUseCase {
  private readonly veiculoRepo: IVeiculoRepository
  private readonly manutencaoRepo: IManutencaoRepository

  constructor(veiculoRepo: IVeiculoRepository, manutencaoRepo: IManutencaoRepository) {
    this.veiculoRepo = veiculoRepo
    this.manutencaoRepo = manutencaoRepo
  }

  async execute(filter?: TenantFilter): Promise<{
    data: { alerts: FleetPriorityAlert[]; summary: FleetSummaryResult } | null
    error: unknown
  }> {
    const [veiculosRes, manutencoesRes] = await Promise.all([
      this.veiculoRepo.findAll(filter),
      this.manutencaoRepo.findAll(filter),
    ])

    if (veiculosRes.error || !veiculosRes.data) {
      return { data: null, error: veiculosRes.error }
    }

    const veiculos = veiculosRes.data
    const manutencoes = manutencoesRes.data ?? []
    const alerts = FleetPriorityAlertService.montar(veiculos, manutencoes)
    const comAlerta = new Set(alerts.map(a => a.veiculoId)).size

    return {
      data: {
        alerts,
        summary: FleetSummaryService.calcular(veiculos, comAlerta),
      },
      error: null,
    }
  }
}
