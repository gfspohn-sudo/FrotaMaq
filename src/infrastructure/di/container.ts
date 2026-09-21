import { SupabaseVeiculoRepository } from '@/infrastructure/repositories/SupabaseVeiculoRepository'
import { SupabaseManutencaoRepository } from '@/infrastructure/repositories/SupabaseManutencaoRepository'
import { SupabaseEmpresaRepository } from '@/infrastructure/repositories/SupabaseEmpresaRepository'
import { SupabaseAlertaRepository } from '@/infrastructure/repositories/SupabaseAlertaRepository'
import { SupabaseReservaRepository } from '@/infrastructure/repositories/SupabaseReservaRepository'
import { SupabaseChaveConviteRepository } from '@/infrastructure/repositories/SupabaseChaveConviteRepository'
import { SupabaseSolicitacaoRelatorioRepository } from '@/infrastructure/repositories/SupabaseSolicitacaoRelatorioRepository'
import { GetFinancialReportUseCase } from '@/application/use-cases/GetFinancialReportUseCase'
import { GetMaintenanceDashboardUseCase } from '@/application/use-cases/GetMaintenanceDashboardUseCase'
import { GetFleetSummaryUseCase } from '@/application/use-cases/GetFleetSummaryUseCase'
import { GetEmpresaSummariesUseCase } from '@/application/use-cases/GetEmpresaSummariesUseCase'
import {
  ListManutencoesUseCase,
  ListProximasManutencoesUseCase,
} from '@/application/use-cases/ListManutencoesUseCase'
import {
  ListVeiculosUseCase,
  GetVeiculoByIdUseCase,
  CreateVeiculoUseCase,
  UpdateVeiculoUseCase,
  DeleteVeiculoUseCase,
  DeleteAllVeiculosUseCase,
} from '@/application/use-cases/VeiculoUseCases'
import {
  CreateManutencaoUseCase,
  UpdateManutencaoStatusUseCase,
  UpdateManutencaoUseCase,
  ConcluirManutencaoUseCase,
} from '@/application/use-cases/ManutencaoUseCases'
import {
  ListReservasUseCase,
  SolicitarReservaUseCase,
  AtualizarStatusReservaUseCase,
} from '@/application/use-cases/ReservaUseCases'
import { GetVeiculoReportUseCase } from '@/application/use-cases/GetVeiculoReportUseCase'
import { GetNotificationsUseCase } from '@/application/use-cases/GetNotificationsUseCase'
import {
  SolicitarAcessoRelatorioUseCase,
  ListSolicitacoesRelatorioUseCase,
  AtualizarSolicitacaoRelatorioUseCase,
} from '@/application/use-cases/SolicitacaoRelatorioUseCases'
import {
  ValidarChaveConviteUseCase,
  CriarEmpresaComChavesUseCase,
} from '@/application/use-cases/InviteKeyUseCases'

/** Composition Root — injeção de dependências da aplicação. */
class AppContainer {
  readonly veiculoRepository = new SupabaseVeiculoRepository()
  readonly manutencaoRepository = new SupabaseManutencaoRepository()
  readonly empresaRepository = new SupabaseEmpresaRepository()
  readonly alertaRepository = new SupabaseAlertaRepository()
  readonly reservaRepository = new SupabaseReservaRepository()
  readonly chaveConviteRepository = new SupabaseChaveConviteRepository()
  readonly solicitacaoRelatorioRepository = new SupabaseSolicitacaoRelatorioRepository()

  readonly getFinancialReport = new GetFinancialReportUseCase(this.manutencaoRepository)
  readonly getMaintenanceDashboard = new GetMaintenanceDashboardUseCase(
    this.manutencaoRepository,
    this.veiculoRepository,
  )
  readonly getFleetSummary = new GetFleetSummaryUseCase(this.veiculoRepository)
  readonly getEmpresaSummaries = new GetEmpresaSummariesUseCase(
    this.empresaRepository,
    this.veiculoRepository,
    this.manutencaoRepository,
  )
  readonly listManutencoes = new ListManutencoesUseCase(this.manutencaoRepository)
  readonly listProximasManutencoes = new ListProximasManutencoesUseCase(this.manutencaoRepository)
  readonly listVeiculos = new ListVeiculosUseCase(this.veiculoRepository)
  readonly getVeiculoById = new GetVeiculoByIdUseCase(this.veiculoRepository)
  readonly createVeiculo = new CreateVeiculoUseCase(this.veiculoRepository)
  readonly updateVeiculo = new UpdateVeiculoUseCase(this.veiculoRepository)
  readonly deleteVeiculo = new DeleteVeiculoUseCase(this.veiculoRepository)
  readonly deleteAllVeiculos = new DeleteAllVeiculosUseCase(this.veiculoRepository)
  readonly createManutencao = new CreateManutencaoUseCase(this.manutencaoRepository)
  readonly updateManutencaoStatus = new UpdateManutencaoStatusUseCase(this.manutencaoRepository)
  readonly updateManutencao = new UpdateManutencaoUseCase(this.manutencaoRepository)
  readonly concluirManutencao = new ConcluirManutencaoUseCase(
    this.manutencaoRepository,
    this.veiculoRepository,
  )
  readonly listReservas = new ListReservasUseCase(this.reservaRepository)
  readonly solicitarReserva = new SolicitarReservaUseCase(
    this.reservaRepository,
    this.veiculoRepository,
  )
  readonly atualizarStatusReserva = new AtualizarStatusReservaUseCase(this.reservaRepository)
  readonly getVeiculoReport = new GetVeiculoReportUseCase(
    this.veiculoRepository,
    this.manutencaoRepository,
    this.reservaRepository,
    this.solicitacaoRelatorioRepository,
  )
  readonly solicitarAcessoRelatorio = new SolicitarAcessoRelatorioUseCase(
    this.solicitacaoRelatorioRepository,
    this.veiculoRepository,
  )
  readonly listSolicitacoesRelatorio = new ListSolicitacoesRelatorioUseCase(this.solicitacaoRelatorioRepository)
  readonly atualizarSolicitacaoRelatorio = new AtualizarSolicitacaoRelatorioUseCase(this.solicitacaoRelatorioRepository)
  readonly validarChaveConvite = new ValidarChaveConviteUseCase(this.chaveConviteRepository)
  readonly criarEmpresaComChaves = new CriarEmpresaComChavesUseCase(
    this.empresaRepository,
    this.chaveConviteRepository,
  )
  readonly getNotifications = new GetNotificationsUseCase(
    this.alertaRepository,
    this.reservaRepository,
    this.manutencaoRepository,
    this.veiculoRepository,
  )
}

export const container = new AppContainer()
