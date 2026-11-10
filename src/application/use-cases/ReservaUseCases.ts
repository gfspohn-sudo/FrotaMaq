import type { IReservaRepository } from '@/domain/repositories/IReservaRepository'
import type { IVeiculoRepository } from '@/domain/repositories/IVeiculoRepository'
import { ReservaMapper } from '@/infrastructure/mappers/ReservaMapper'
import { ReservaValidationService } from '@/domain/services/ReservaValidationService'
import { VeiculoDisponibilidadeService } from '@/domain/services/VeiculoDisponibilidadeService'
import { TenantScopeService } from '@/domain/services/TenantScopeService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import type { Usuario as UsuarioProfile, NovaReserva, StatusReserva } from '@/types/database'
import { recordAuditEvent } from '@/application/services/AuditTrailService'

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

    if (!input.veiculo_id) {
      return { data: null, error: new Error('Selecione o veículo da viagem.') }
    }
    if (!input.destino?.trim()) {
      return { data: null, error: new Error('Informe o destino da viagem.') }
    }
    if (!input.data_viagem || Number.isNaN(Date.parse(input.data_viagem))) {
      return { data: null, error: new Error('Informe uma data da viagem válida.') }
    }

    const empresaId = input.empresa_id || profile?.empresa_id
    if (!profile?.id || !empresaId) {
      return { data: null, error: new Error('Perfil incompleto: empresa não identificada para gravar a viagem.') }
    }

    const veiculoRes = await this.veiculoRepo.findById(input.veiculo_id, empresaId)
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
      empresa_id: empresaId,
      data_viagem: input.data_viagem,
      destino: input.destino.trim(),
      km_ida_volta: input.km_ida_volta,
      km_inicial: veiculo.kmAtual.value,
    })

    const dto = data?.toDTO() ?? null
    if (dto) {
      await recordAuditEvent({
        acao: 'viagem_criada',
        profile,
        empresaId,
        veiculoId: dto.veiculo_id,
        reservaId: dto.id,
        detalhe: dto.destino,
      })
    }

    return { data: dto, error }
  }
}

export class AtualizarStatusReservaUseCase {
  private readonly reservaRepo: IReservaRepository
  private readonly veiculoRepo?: IVeiculoRepository

  constructor(reservaRepo: IReservaRepository, veiculoRepo?: IVeiculoRepository) {
    this.reservaRepo = reservaRepo
    this.veiculoRepo = veiculoRepo
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

    if (!existing.data.estaPendente()) {
      return { data: null, error: new Error('Somente reservas pendentes podem ser aprovadas ou recusadas.') }
    }

    let motivoRecusa: string | null = null
    if (status === 'REJEITADO') {
      const validation = ReservaValidationService.validarMotivoRecusa(observacaoGestor)
      if (!validation.ok) {
        return { data: null, error: new Error(validation.message) }
      }
      motivoRecusa = validation.value
      observacaoGestor = validation.value
    }

    const { data, error } = await this.reservaRepo.updateStatus(
      reservaId,
      status,
      status === 'REJEITADO' ? motivoRecusa : null,
      scoped.empresaId,
      motivoRecusa,
    )

    if (!error && data && this.veiculoRepo) {
      if (status === 'APROVADO') {
        await this.veiculoRepo.update(
          data.veiculoId,
          { status: 'em_viagem' },
          scoped.empresaId,
        )
      }
      if (status === 'REJEITADO') {
        await this.veiculoRepo.update(
          data.veiculoId,
          { status: 'disponivel' },
          scoped.empresaId,
        )
      }
    }

    return { data: data?.toDTO() ?? null, error }
  }
}

export class FinalizarViagemUseCase {
  private readonly reservaRepo: IReservaRepository
  private readonly veiculoRepo: IVeiculoRepository

  constructor(reservaRepo: IReservaRepository, veiculoRepo: IVeiculoRepository) {
    this.reservaRepo = reservaRepo
    this.veiculoRepo = veiculoRepo
  }

  async execute(profile: UsuarioProfile | null, reservaId: string, kmFinal: number) {
    const usuario = UsuarioFactory.fromProfile(profile)
    const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile)
    if (scopeError) return { data: null, error: scopeError }

    const existing = await this.reservaRepo.findById(reservaId, scoped.empresaId)
    if (existing.error || !existing.data) {
      return { data: null, error: existing.error ?? new Error('Reserva não encontrada.') }
    }

    const reserva = existing.data
    if (!reserva.podeSerFinalizadaPor(usuario)) {
      return { data: null, error: new Error('Sem permissão para finalizar esta viagem.') }
    }

    const veiculoRes = await this.veiculoRepo.findById(reserva.veiculoId, scoped.empresaId)
    const veiculo = veiculoRes.data
    const kmInicial = reserva.kmInicial ?? veiculo?.kmAtual.value ?? 0
    const validation = reserva.validarKmFinal(kmFinal, kmInicial)
    if (!validation.ok) {
      return { data: null, error: new Error(validation.message) }
    }

    const { data, error } = await this.reservaRepo.finalizarViagem(
      reservaId,
      kmFinal,
      kmInicial,
      scoped.empresaId,
    )

    if (error || !data) {
      return { data: null, error: error ?? new Error('Não foi possível finalizar a viagem.') }
    }

    const distancia = data.calcularKmPercorrido(kmFinal, kmInicial)
    if (veiculo) {
      const novaKm = Math.max(veiculo.kmAtual.value, kmFinal)
      await this.veiculoRepo.update(
        veiculo.id,
        { km_atual: novaKm, status: 'disponivel' },
        scoped.empresaId,
      )
      await recordAuditEvent({
        acao: 'veiculo_liberado',
        profile,
        empresaId: scoped.empresaId ?? data.empresaId,
        veiculoId: veiculo.id,
        reservaId: data.id,
        detalhe: `Viagem finalizada · ${distancia.toLocaleString('pt-BR')} km`,
      })
    }

    return { data: { ...data.toDTO(), km_percorrido: distancia }, error: null }
  }
}
