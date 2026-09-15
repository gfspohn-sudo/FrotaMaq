import type { ISolicitacaoRelatorioRepository } from '@/domain/repositories/ISolicitacaoRelatorioRepository'
import type { IVeiculoRepository } from '@/domain/repositories/IVeiculoRepository'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import type { Usuario as UsuarioProfile, StatusSolicitacaoRelatorio } from '@/types/database'

export class SolicitarAcessoRelatorioUseCase {
  private readonly solicitacaoRepo: ISolicitacaoRelatorioRepository
  private readonly veiculoRepo: IVeiculoRepository

  constructor(solicitacaoRepo: ISolicitacaoRelatorioRepository, veiculoRepo: IVeiculoRepository) {
    this.solicitacaoRepo = solicitacaoRepo
    this.veiculoRepo = veiculoRepo
  }

  async execute(profile: UsuarioProfile | null, veiculoId: string) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!usuario.podeSolicitarAcessoRelatorio()) {
      return { data: null, error: new Error('Sem permissão para solicitar acesso ao relatório.') }
    }
    if (!profile?.id || !profile.empresa_id) {
      return { data: null, error: new Error('Perfil incompleto.') }
    }

    const veiculoRes = await this.veiculoRepo.findById(veiculoId)
    if (veiculoRes.error || !veiculoRes.data) {
      return { data: null, error: veiculoRes.error ?? new Error('Veículo não encontrado.') }
    }
    if (!veiculoRes.data.pertenceAoEscopo(usuario)) {
      return { data: null, error: new Error('Veículo fora do seu escopo.') }
    }

    const pendente = await this.solicitacaoRepo.findPendente(profile.id, veiculoId)
    if (pendente.data) {
      return { data: pendente.data, error: new Error('Já existe solicitação pendente para este veículo.') }
    }

    const aprovados = await this.solicitacaoRepo.findVeiculosAprovados(profile.id)
    if (aprovados.data?.includes(veiculoId)) {
      return { data: null, error: new Error('Acesso já aprovado para este veículo.') }
    }

    return this.solicitacaoRepo.create({
      empresa_id: profile.empresa_id,
      veiculo_id: veiculoId,
      solicitante_id: profile.id,
    })
  }
}

export class ListSolicitacoesRelatorioUseCase {
  private readonly solicitacaoRepo: ISolicitacaoRelatorioRepository

  constructor(solicitacaoRepo: ISolicitacaoRelatorioRepository) {
    this.solicitacaoRepo = solicitacaoRepo
  }

  async execute(
    profile: UsuarioProfile | null,
    filter?: { empresaId?: string; status?: StatusSolicitacaoRelatorio },
  ) {
    const usuario = UsuarioFactory.fromProfile(profile)
    const solicitanteId = usuario.podeAprovarAcessoRelatorio() ? undefined : profile?.id

    return this.solicitacaoRepo.findAll({
      empresaId: filter?.empresaId,
      status: filter?.status,
      solicitanteId,
    })
  }
}

export class AtualizarSolicitacaoRelatorioUseCase {
  private readonly solicitacaoRepo: ISolicitacaoRelatorioRepository

  constructor(solicitacaoRepo: ISolicitacaoRelatorioRepository) {
    this.solicitacaoRepo = solicitacaoRepo
  }

  async execute(
    profile: UsuarioProfile | null,
    id: string,
    status: StatusSolicitacaoRelatorio,
    observacaoGestor?: string,
  ) {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!usuario.podeAprovarAcessoRelatorio()) {
      return { data: null, error: new Error('Sem permissão para aprovar solicitações.') }
    }

    return this.solicitacaoRepo.updateStatus(id, status, observacaoGestor)
  }
}
