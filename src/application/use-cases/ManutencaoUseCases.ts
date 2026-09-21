import type { IManutencaoRepository } from '@/domain/repositories/IManutencaoRepository'
import type { IVeiculoRepository } from '@/domain/repositories/IVeiculoRepository'
import { TenantScopeService } from '@/domain/services/TenantScopeService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import { ManutencaoMapper } from '@/infrastructure/mappers/ManutencaoMapper'
import type { NovaManutencao, StatusManutencao, Usuario as UsuarioProfile } from '@/types/database'

export class CreateManutencaoUseCase {
  private readonly manutencaoRepo: IManutencaoRepository

  constructor(manutencaoRepo: IManutencaoRepository) {
    this.manutencaoRepo = manutencaoRepo
  }

  async execute(input: NovaManutencao, profile?: UsuarioProfile | null) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!usuario.podeRegistrarManutencao()) {
      return { data: null, error: new Error('Sem permissão para registrar manutenções.') }
    }

    const { data, error } = await this.manutencaoRepo.create(input)
    return { data: data ? ManutencaoMapper.toDTO(data) : null, error }
  }
}

export class UpdateManutencaoStatusUseCase {
  private readonly manutencaoRepo: IManutencaoRepository

  constructor(manutencaoRepo: IManutencaoRepository) {
    this.manutencaoRepo = manutencaoRepo
  }

  async execute(id: string, status: StatusManutencao, profile?: UsuarioProfile | null) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!usuario.podeRegistrarManutencao()) {
      return { data: null, error: new Error('Sem permissão para atualizar manutenções.') }
    }

    const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile)
    if (scopeError) return { data: null, error: scopeError }

    const { data, error } = await this.manutencaoRepo.updateStatus(id, status, scoped.empresaId)
    return { data: data ? ManutencaoMapper.toDTO(data) : null, error }
  }
}

export class UpdateManutencaoUseCase {
  private readonly manutencaoRepo: IManutencaoRepository

  constructor(manutencaoRepo: IManutencaoRepository) {
    this.manutencaoRepo = manutencaoRepo
  }

  async execute(id: string, input: Partial<NovaManutencao>, profile?: UsuarioProfile | null) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!usuario.podeRegistrarManutencao()) {
      return { data: null, error: new Error('Sem permissão para atualizar manutenções.') }
    }

    const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile)
    if (scopeError) return { data: null, error: scopeError }

    const { data, error } = await this.manutencaoRepo.update(id, input, scoped.empresaId)
    return { data: data ? ManutencaoMapper.toDTO(data) : null, error }
  }
}

export class ConcluirManutencaoUseCase {
  private readonly manutencaoRepo: IManutencaoRepository
  private readonly veiculoRepo: IVeiculoRepository

  constructor(manutencaoRepo: IManutencaoRepository, veiculoRepo: IVeiculoRepository) {
    this.manutencaoRepo = manutencaoRepo
    this.veiculoRepo = veiculoRepo
  }

  async execute(id: string, profile?: UsuarioProfile | null) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!usuario.podeConcluirManutencao()) {
      return { data: null, error: new Error('Sem permissão para concluir manutenções.') }
    }

    const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile)
    if (scopeError) return { data: null, error: scopeError }

    const { data: manutencao, error: updateError } = await this.manutencaoRepo.updateStatus(
      id,
      'concluida',
      scoped.empresaId,
    )

    if (updateError || !manutencao) {
      return { data: null, error: updateError ?? new Error('Manutenção não encontrada.') }
    }

    if (!manutencao.podeSerConcluidaPor(usuario)) {
      return { data: null, error: new Error('Acesso negado a esta manutenção.') }
    }

    const { error: veiculoError } = await this.veiculoRepo.update(
      manutencao.veiculoId,
      { status: 'em_operacao' },
      scoped.empresaId,
    )

    if (veiculoError) {
      return { data: null, error: veiculoError }
    }

    return { data: ManutencaoMapper.toDTO(manutencao), error: null }
  }
}
