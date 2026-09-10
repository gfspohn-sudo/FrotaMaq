import { SupabaseVeiculoRepository } from '@/infrastructure/repositories/SupabaseVeiculoRepository'
import { SupabaseManutencaoRepository } from '@/infrastructure/repositories/SupabaseManutencaoRepository'
import { SupabaseEmpresaRepository } from '@/infrastructure/repositories/SupabaseEmpresaRepository'
import { SupabaseAlertaRepository } from '@/infrastructure/repositories/SupabaseAlertaRepository'
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
} from '@/application/use-cases/VeiculoUseCases'
import {
  CreateManutencaoUseCase,
  UpdateManutencaoStatusUseCase,
  UpdateManutencaoUseCase,
} from '@/application/use-cases/ManutencaoUseCases'

/** Composition Root — injeção de dependências da aplicação. */
class AppContainer {
  readonly veiculoRepository = new SupabaseVeiculoRepository()
  readonly manutencaoRepository = new SupabaseManutencaoRepository()
  readonly empresaRepository = new SupabaseEmpresaRepository()
  readonly alertaRepository = new SupabaseAlertaRepository()

  readonly getFinancialReport = new GetFinancialReportUseCase(this.manutencaoRepository)
  readonly getMaintenanceDashboard = new GetMaintenanceDashboardUseCase(this.manutencaoRepository)
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
  readonly createManutencao = new CreateManutencaoUseCase(this.manutencaoRepository)
  readonly updateManutencaoStatus = new UpdateManutencaoStatusUseCase(this.manutencaoRepository)
  readonly updateManutencao = new UpdateManutencaoUseCase(this.manutencaoRepository)
}

export const container = new AppContainer()
