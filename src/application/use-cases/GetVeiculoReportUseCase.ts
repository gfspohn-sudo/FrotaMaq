import type { IVeiculoRepository } from '@/domain/repositories/IVeiculoRepository'
import type { IManutencaoRepository } from '@/domain/repositories/IManutencaoRepository'
import type { IReservaRepository } from '@/domain/repositories/IReservaRepository'
import type { ISolicitacaoRelatorioRepository } from '@/domain/repositories/ISolicitacaoRelatorioRepository'
import { VehicleReportAuthorizationService } from '@/domain/services/VehicleReportAuthorizationService'
import { TenantScopeService } from '@/domain/services/TenantScopeService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import { ManutencaoMapper } from '@/infrastructure/mappers/ManutencaoMapper'
import type { Usuario as UsuarioProfile } from '@/types/database'
import { sumMaintenanceValues } from '@/lib/financialUtils'

export interface VeiculoReportResult {
  veiculoId: string
  nomeExibicao: string
  totalGeral: number
  quantidadeManutencoes: number
  manutencoes: ReturnType<typeof ManutencaoMapper.toDTOList>
}

export class GetVeiculoReportUseCase {
  private readonly veiculoRepo: IVeiculoRepository
  private readonly manutencaoRepo: IManutencaoRepository
  private readonly reservaRepo: IReservaRepository
  private readonly solicitacaoRepo: ISolicitacaoRelatorioRepository

  constructor(
    veiculoRepo: IVeiculoRepository,
    manutencaoRepo: IManutencaoRepository,
    reservaRepo: IReservaRepository,
    solicitacaoRepo: ISolicitacaoRelatorioRepository,
  ) {
    this.veiculoRepo = veiculoRepo
    this.manutencaoRepo = manutencaoRepo
    this.reservaRepo = reservaRepo
    this.solicitacaoRepo = solicitacaoRepo
  }

  async execute(profile: UsuarioProfile | null, veiculoId: string) {
    const usuario = UsuarioFactory.fromProfile(profile)
    const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile)
    if (scopeError) return { data: null, error: scopeError }

    const veiculoRes = await this.veiculoRepo.findById(veiculoId, scoped.empresaId)
    if (veiculoRes.error || !veiculoRes.data) {
      return { data: null, error: veiculoRes.error ?? new Error('Veículo não encontrado.') }
    }

    const veiculo = veiculoRes.data
    const motoristaId = profile?.id ?? ''
    const [{ data: escopoMotorista }, { data: relatorioMecanico }] = await Promise.all([
      this.reservaRepo.findVeiculosEscopoMotorista(motoristaId),
      this.solicitacaoRepo.findVeiculosAprovados(motoristaId),
    ])

    const autorizado = VehicleReportAuthorizationService.podeAcessar(usuario, {
      veiculoId,
      empresaId: veiculo.empresaId,
      veiculosEscopoMotorista: escopoMotorista ?? [],
      veiculosRelatorioAprovadoMecanico: relatorioMecanico ?? [],
    })

    if (!autorizado) {
      return { data: null, error: new Error('Sem permissão para visualizar relatório deste veículo.') }
    }

    const { data: manutencoes, error } = await this.manutencaoRepo.findAll({
      veiculoId,
      empresaId: scoped.empresaId ?? veiculo.empresaId ?? undefined,
    })
    if (error || !manutencoes) return { data: null, error }

    const financeiras = manutencoes.filter(m => m.entraEmRelatorioFinanceiro() && m.possuiValorFinanceiro())
    const totalGeral = sumMaintenanceValues(financeiras.map(m => ({ valor: m.valor.value })))
    const empresaNome = veiculo.empresaNome ?? 'Frota'

    return {
      data: {
        veiculoId,
        nomeExibicao: veiculo.nomeExibicao(empresaNome),
        totalGeral,
        quantidadeManutencoes: financeiras.length,
        manutencoes: ManutencaoMapper.toDTOList(financeiras),
      } satisfies VeiculoReportResult,
      error: null,
    }
  }
}
