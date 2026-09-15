import type { IReservaRepository } from '@/domain/repositories/IReservaRepository'
import type { IVeiculoRepository } from '@/domain/repositories/IVeiculoRepository'
import type { IManutencaoRepository } from '@/domain/repositories/IManutencaoRepository'
import { ReservaMapper } from '@/infrastructure/mappers/ReservaMapper'
import { ReservaValidationService } from '@/domain/services/ReservaValidationService'
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
    const motoristaId = usuario.podeAprovarReserva() ? undefined : profile?.id

    const { data, error } = await this.reservaRepo.findAll({
      empresaId: filter?.empresaId,
      status: filter?.status,
      motoristaId,
    })

    return { data: ReservaMapper.toDTOList(data), error }
  }
}

export class SolicitarReservaUseCase {
  private readonly reservaRepo: IReservaRepository
  private readonly veiculoRepo: IVeiculoRepository
  private readonly manutencaoRepo: IManutencaoRepository

  constructor(
    reservaRepo: IReservaRepository,
    veiculoRepo: IVeiculoRepository,
    manutencaoRepo: IManutencaoRepository,
  ) {
    this.reservaRepo = reservaRepo
    this.veiculoRepo = veiculoRepo
    this.manutencaoRepo = manutencaoRepo
  }

  async execute(profile: UsuarioProfile | null, input: NovaReserva) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!usuario.podeSolicitarReserva()) {
      return { data: null, error: new Error('Sem permissão para solicitar reservas.') }
    }

    if (!profile?.id || !profile.empresa_id) {
      return { data: null, error: new Error('Perfil incompleto para reserva.') }
    }

    const veiculoRes = await this.veiculoRepo.findById(input.veiculo_id)
    if (veiculoRes.error || !veiculoRes.data) {
      return { data: null, error: veiculoRes.error ?? new Error('Veículo não encontrado.') }
    }

    const veiculo = veiculoRes.data
    if (!veiculo.pertenceAoEscopo(usuario)) {
      return { data: null, error: new Error('Veículo fora do seu escopo.') }
    }

    const { data: manutencoes } = await this.manutencaoRepo.findAll({ veiculoId: input.veiculo_id })
    const proximaKm = manutencoes
      ?.filter(m => m.proximaManutencaoKm != null)
      .map(m => m.proximaManutencaoKm!)
      .sort((a, b) => a - b)[0] ?? null

    const validation = ReservaValidationService.validarQuilometragemViagem(
      veiculo.kmAtual.value,
      input.km_ida_volta,
      proximaKm,
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

    const existing = await this.reservaRepo.findById(reservaId)
    if (existing.error || !existing.data) {
      return { data: null, error: existing.error ?? new Error('Reserva não encontrada.') }
    }

    if (!existing.data.podeSerAprovadaPor(usuario)) {
      return { data: null, error: new Error('Reserva fora do seu escopo.') }
    }

    const { data, error } = await this.reservaRepo.updateStatus(reservaId, status, observacaoGestor)
    return { data: data?.toDTO() ?? null, error }
  }
}
