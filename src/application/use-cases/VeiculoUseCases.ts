import type { IVeiculoRepository, VeiculoListFilter } from '@/domain/repositories/IVeiculoRepository'
import { VeiculoMapper } from '@/infrastructure/mappers/VeiculoMapper'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import type { NovoVeiculo, Usuario as UsuarioProfile } from '@/types/database'

const KM_ONLY_FIELDS = new Set(['km_atual'])

function isKmOnlyUpdate(input: Partial<NovoVeiculo>): boolean {
  const keys = Object.keys(input).filter(key => input[key as keyof NovoVeiculo] !== undefined)
  return keys.length > 0 && keys.every(key => KM_ONLY_FIELDS.has(key))
}

function deny(message: string) {
  return { data: null, error: new Error(message) }
}

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

  async execute(id: string, empresaId?: string) {
    const { data, error } = await this.veiculoRepo.findById(id, empresaId)
    return { data: data?.toDTO() ?? null, error }
  }
}

export class CreateVeiculoUseCase {
  private readonly veiculoRepo: IVeiculoRepository

  constructor(veiculoRepo: IVeiculoRepository) {
    this.veiculoRepo = veiculoRepo
  }

  async execute(input: NovoVeiculo, profile?: UsuarioProfile | null) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!usuario.podeGerenciarVeiculos()) {
      return deny('Sem permissão para cadastrar veículos.')
    }

    const { data, error } = await this.veiculoRepo.create(input)
    return { data: data?.toDTO() ?? null, error }
  }
}

export class UpdateVeiculoUseCase {
  private readonly veiculoRepo: IVeiculoRepository

  constructor(veiculoRepo: IVeiculoRepository) {
    this.veiculoRepo = veiculoRepo
  }

  async execute(
    id: string,
    input: Partial<NovoVeiculo>,
    empresaId?: string,
    profile?: UsuarioProfile | null,
  ) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (isKmOnlyUpdate(input)) {
      if (!usuario.podeAtualizarKm()) {
        return deny('Sem permissão para atualizar quilometragem.')
      }
    } else if (!usuario.podeGerenciarVeiculos()) {
      return deny('Sem permissão para alterar veículos.')
    }

    const { data, error } = await this.veiculoRepo.update(id, input, empresaId)
    return { data: data?.toDTO() ?? null, error }
  }
}

export class DeleteVeiculoUseCase {
  private readonly veiculoRepo: IVeiculoRepository

  constructor(veiculoRepo: IVeiculoRepository) {
    this.veiculoRepo = veiculoRepo
  }

  async execute(id: string, empresaId?: string, profile?: UsuarioProfile | null) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!usuario.podeGerenciarVeiculos()) {
      return { error: new Error('Sem permissão para excluir veículos.') }
    }
    return this.veiculoRepo.delete(id, empresaId)
  }
}

export class DeleteAllVeiculosUseCase {
  private readonly veiculoRepo: IVeiculoRepository

  constructor(veiculoRepo: IVeiculoRepository) {
    this.veiculoRepo = veiculoRepo
  }

  async execute(empresaId: string, profile?: UsuarioProfile | null) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!usuario.podeExcluirTodosVeiculos()) {
      return { error: new Error('Sem permissão para excluir todos os veículos.') }
    }
    return this.veiculoRepo.deleteAll(empresaId)
  }
}
