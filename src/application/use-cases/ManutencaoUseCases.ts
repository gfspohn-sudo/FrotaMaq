import type { IManutencaoRepository } from '@/domain/repositories/IManutencaoRepository'
import type { IVeiculoRepository } from '@/domain/repositories/IVeiculoRepository'
import { TenantScopeService } from '@/domain/services/TenantScopeService'
import { NextMaintenanceScheduleService } from '@/domain/services/NextMaintenanceScheduleService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import { ManutencaoMapper } from '@/infrastructure/mappers/ManutencaoMapper'
import type { NovaManutencao, StatusManutencao, Usuario as UsuarioProfile } from '@/types/database'

export class CreateManutencaoUseCase {
  private readonly manutencaoRepo: IManutencaoRepository
  private readonly veiculoRepo?: IVeiculoRepository

  constructor(manutencaoRepo: IManutencaoRepository, veiculoRepo?: IVeiculoRepository) {
    this.manutencaoRepo = manutencaoRepo
    this.veiculoRepo = veiculoRepo
  }

  async execute(input: NovaManutencao, profile?: UsuarioProfile | null) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!usuario.podeRegistrarManutencao()) {
      return { data: null, error: new Error('Sem permissão para registrar manutenções.') }
    }

    const payload: NovaManutencao = { ...input }

    if (this.veiculoRepo) {
      const { scoped } = TenantScopeService.resolveQueryScope(profile)
      const veiculoRes = await this.veiculoRepo.findById(input.veiculo_id, scoped.empresaId ?? input.empresa_id)
      const veiculo = veiculoRes.data
      if (veiculo) {
        const kmAtual = payload.km_atual_veiculo ?? veiculo.kmAtual.value
        const schedule = NextMaintenanceScheduleService.calcular({
          tipo: payload.tipo,
          kmAtual,
          dataManutencao: payload.data_hora,
          intervaloKm: veiculo.intervaloManutencaoKm,
          intervaloDias: veiculo.intervaloManutencaoDias,
        })
        payload.km_atual_veiculo = kmAtual
        payload.proxima_manutencao_km = payload.proxima_manutencao_km ?? schedule.proximaManutencaoKm
        payload.data_proxima_manutencao = payload.data_proxima_manutencao ?? schedule.dataProximaManutencao
      }
    }

    const mao = payload.valor_mao_de_obra ?? 0
    const pecas = payload.valor_pecas ?? 0
    if (mao > 0 || pecas > 0) {
      payload.valor = mao + pecas
    }

    const { data, error } = await this.manutencaoRepo.create(payload)
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
      { status: 'disponivel' },
      scoped.empresaId,
    )

    if (veiculoError) {
      return { data: null, error: veiculoError }
    }

    return { data: ManutencaoMapper.toDTO(manutencao), error: null }
  }
}
