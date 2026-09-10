import type { IManutencaoRepository, ManutencaoListFilter } from '@/domain/repositories/IManutencaoRepository'
import { ManutencaoMapper } from '@/infrastructure/mappers/ManutencaoMapper'
import type { Manutencao as ManutencaoDTO } from '@/types/database'
import type { TenantFilter } from '@/domain/types/enums'

export class ListManutencoesUseCase {
  private readonly manutencaoRepo: IManutencaoRepository

  constructor(manutencaoRepo: IManutencaoRepository) {
    this.manutencaoRepo = manutencaoRepo
  }

  async execute(filter?: ManutencaoListFilter): Promise<{
    data: ManutencaoDTO[] | null
    error: unknown
  }> {
    const { data, error } = await this.manutencaoRepo.findAll(filter)
    return { data: ManutencaoMapper.toDTOList(data), error }
  }
}

export class ListProximasManutencoesUseCase {
  private readonly manutencaoRepo: IManutencaoRepository

  constructor(manutencaoRepo: IManutencaoRepository) {
    this.manutencaoRepo = manutencaoRepo
  }

  async execute(limit = 5, filter?: TenantFilter): Promise<{
    data: ManutencaoDTO[] | null
    error: unknown
  }> {
    const { data, error } = await this.manutencaoRepo.findProximas(limit, filter)
    return { data: ManutencaoMapper.toDTOList(data), error }
  }
}
