import type { SolicitacaoRelatorio, StatusSolicitacaoRelatorio } from '@/types/database'
import type { TenantFilter } from '@/domain/types/enums'

export interface ISolicitacaoRelatorioRepository {
  findAll(filter?: TenantFilter & { status?: StatusSolicitacaoRelatorio; solicitanteId?: string }): Promise<{ data: SolicitacaoRelatorio[] | null; error: unknown }>
  create(input: { empresa_id: string; veiculo_id: string; solicitante_id: string }): Promise<{ data: SolicitacaoRelatorio | null; error: unknown }>
  updateStatus(id: string, status: StatusSolicitacaoRelatorio, observacaoGestor?: string | null): Promise<{ data: SolicitacaoRelatorio | null; error: unknown }>
  findVeiculosAprovados(solicitanteId: string): Promise<{ data: string[] | null; error: unknown }>
  findPendente(solicitanteId: string, veiculoId: string): Promise<{ data: SolicitacaoRelatorio | null; error: unknown }>
}
