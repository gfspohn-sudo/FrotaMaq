import type { IVeiculoRepository, VeiculoListFilter } from '@/domain/repositories/IVeiculoRepository'
import { VeiculoMapper } from '@/infrastructure/mappers/VeiculoMapper'
import type { NovoVeiculo } from '@/types/database'

export class ListVeiculosUseCase {
  private readonly veiculoRepo: IVeiculoRepository

  constructor(veiculoRepo: IVeiculoRepository) {
    this.veiculoRepo = veiculoRepo
  }

  async execute(filter?: VeiculoListFilter) {
    const { data, error } = await this.veiculoRepo.findAll(filter)
    return { data: VeiculoMapper.toDTOList(data), error }
  }
}

export class GetVeiculoByIdUseCase {
  private readonly veiculoRepo: IVeiculoRepository

  constructor(veiculoRepo: IVeiculoRepository) {
    this.veiculoRepo = veiculoRepo
  }

  async execute(id: string) {
    const { data, error } = await this.veiculoRepo.findById(id)
    return { data: data?.toDTO() ?? null, error }
  }
}

export class CreateVeiculoUseCase {
  private readonly veiculoRepo: IVeiculoRepository

  constructor(veiculoRepo: IVeiculoRepository) {
    this.veiculoRepo = veiculoRepo
  }

  async execute(input: NovoVeiculo) {
    const { data, error } = await this.veiculoRepo.create(input)
    return { data: data?.toDTO() ?? null, error }
  }
}

export class UpdateVeiculoUseCase {
  private readonly veiculoRepo: IVeiculoRepository

  constructor(veiculoRepo: IVeiculoRepository) {
    this.veiculoRepo = veiculoRepo
  }

  async execute(id: string, input: Partial<NovoVeiculo>) {
    const { data, error } = await this.veiculoRepo.update(id, input)
    return { data: data?.toDTO() ?? null, error }
  }
}

export class DeleteVeiculoUseCase {
  private readonly veiculoRepo: IVeiculoRepository

  constructor(veiculoRepo: IVeiculoRepository) {
    this.veiculoRepo = veiculoRepo
  }

  async execute(id: string) {
    return this.veiculoRepo.delete(id)
  }
}
