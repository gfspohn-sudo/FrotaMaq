import type { IManutencaoRepository } from '@/domain/repositories/IManutencaoRepository'
import { ManutencaoMapper } from '@/infrastructure/mappers/ManutencaoMapper'
import type { NovaManutencao, StatusManutencao } from '@/types/database'

export class CreateManutencaoUseCase {
  private readonly manutencaoRepo: IManutencaoRepository

  constructor(manutencaoRepo: IManutencaoRepository) {
    this.manutencaoRepo = manutencaoRepo
  }

  async execute(input: NovaManutencao) {
    const { data, error } = await this.manutencaoRepo.create(input)
    return { data: data ? ManutencaoMapper.toDTO(data) : null, error }
  }
}

export class UpdateManutencaoStatusUseCase {
  private readonly manutencaoRepo: IManutencaoRepository

  constructor(manutencaoRepo: IManutencaoRepository) {
    this.manutencaoRepo = manutencaoRepo
  }

  async execute(id: string, status: StatusManutencao) {
    const { data, error } = await this.manutencaoRepo.updateStatus(id, status)
    return { data: data ? ManutencaoMapper.toDTO(data) : null, error }
  }
}

export class UpdateManutencaoUseCase {
  private readonly manutencaoRepo: IManutencaoRepository

  constructor(manutencaoRepo: IManutencaoRepository) {
    this.manutencaoRepo = manutencaoRepo
  }

  async execute(id: string, input: Partial<NovaManutencao>) {
    const { data, error } = await this.manutencaoRepo.update(id, input)
    return { data: data ? ManutencaoMapper.toDTO(data) : null, error }
  }
}
