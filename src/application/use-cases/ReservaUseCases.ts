import type { IReservaRepository } from '@/domain/repositories/IReservaRepository'
import type { IVeiculoRepository } from '@/domain/repositories/IVeiculoRepository'
import { ReservaMapper } from '@/infrastructure/mappers/ReservaMapper'
import { ReservaValidationService } from '@/domain/services/ReservaValidationService'
import { VeiculoDisponibilidadeService } from '@/domain/services/VeiculoDisponibilidadeService'
import { TenantScopeService } from '@/domain/services/TenantScopeService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import type { Usuario as UsuarioProfile, NovaReserva, StatusReserva } from '@/types/database'

export class ListReservasUseCase {
  private readonly reservaRepo: IReservaRepository

  constructor(reservaRepo: IReservaRepository) {
    this.reservaRepo = reservaRepo
  }

  async execute(
    profile: UsuarioProfile | null,
    filter?: { empresaId?: string; status?: StatusReserva },
  ) {
    const usuario = UsuarioFactory.fromProfile(profile)
    const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile, filter)
    if (scopeError) return { data: null, error: scopeError }

    const motoristaId = usuario.podeAprovarReserva() ? undefined : profile?.id

    const { data, error } = await this.reservaRepo.findAll({
      empresaId: scoped.empresaId,
      status: filter?.status,
      motoristaId,
    })

    return { data: ReservaMapper.toDTOList(data), error }
  }
}

export class SolicitarReservaUseCase {
  private readonly reservaRepo: IReservaRepository
  private readonly veiculoRepo: IVeiculoRepository

  constructor(
    reservaRepo: IReservaRepository,
    veiculoRepo: IVeiculoRepository,
  ) {
    this.reservaRepo = reservaRepo
    this.veiculoRepo = veiculoRepo
  }

  async execute(profile: UsuarioProfile | null, input: NovaReserva) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!usuario.podeSolicitarReserva()) {
      return { data: null, error: new Error('Sem permissão para solicitar reservas.') }
    }

    if (!profile?.id || !profile.empresa_id) {
      return { data: null, error: new Error('Perfil incompleto para reserva.') }
    }

    const veiculoRes = await this.veiculoRepo.findById(input.veiculo_id, profile.empresa_id)
    if (veiculoRes.error || !veiculoRes.data) {
      return { data: null, error: veiculoRes.error ?? new Error('Veículo não encontrado.') }
    }

    const veiculo = veiculoRes.data
    if (!veiculo.pertenceAoEscopo(usuario)) {
      return { data: null, error: new Error('Veículo fora do seu escopo.') }
    }

    if (!VeiculoDisponibilidadeService.estaDisponivelParaReserva(veiculo)) {
      return {
        data: null,
        error: new Error('Veículo indisponível para reserva. Selecione um veículo em operação.'),
      }
    }

    const validation = ReservaValidationService.validarQuilometragemViagem(
      veiculo.kmAtual.value,
      input.km_ida_volta,
      null,
    )

    if (!validation.ok) {
      return { data: null, error: new Error(validation.message) }
    }

    const { data, error } = await this.reservaRepo.create({
      veiculo_id: input.veiculo_id,
      motorista_id: profile.id,
      empresa_id: profile.empresa_id,
      data_viagem: input.data_viagem,
      destino: input.destino,
      km_ida_volta: input.km_ida_volta,
    })

    return { data: data?.toDTO() ?? null, error }
  }
}

export class AtualizarStatusReservaUseCase {
  private readonly reservaRepo: IReservaRepository

  constructor(reservaRepo: IReservaRepository) {
    this.reservaRepo = reservaRepo
  }

  async execute(
    profile: UsuarioProfile | null,
    reservaId: string,
    status: StatusReserva,
    observacaoGestor?: string,
  ) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!usuario.podeAprovarReserva()) {
      return { data: null, error: new Error('Sem permissão para aprovar/rejeitar reservas.') }
    }

    const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile)
    if (scopeError) return { data: null, error: scopeError }

    const existing = await this.reservaRepo.findById(reservaId, scoped.empresaId)
    if (existing.error || !existing.data) {
      return { data: null, error: existing.error ?? new Error('Reserva não encontrada.') }
    }

    if (!existing.data.podeSerAprovadaPor(usuario)) {
      return { data: null, error: new Error('Reserva fora do seu escopo.') }
    }

    const { data, error } = await this.reservaRepo.updateStatus(reservaId, status, observacaoGestor, scoped.empresaId)
    return { data: data?.toDTO() ?? null, error }
  }
}
