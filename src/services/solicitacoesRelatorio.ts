import { container } from '@/infrastructure/di/container'
import { asServiceError } from '@/application/utils/asServiceError'
import { notifyDataRefresh } from '@/lib/dataRefresh'
import type { Usuario, StatusSolicitacaoRelatorio, SolicitacaoRelatorio } from '@/types/database'

export async function solicitarAcessoRelatorio(profile: Usuario | null, veiculoId: string) {
  const result = await container.solicitarAcessoRelatorio.execute(profile, veiculoId)
  if (result.data) notifyDataRefresh()
  return { ...result, error: asServiceError(result.error) }
}

export async function getSolicitacoesRelatorio(
  profile: Usuario | null,
  filter?: { empresaId?: string; status?: StatusSolicitacaoRelatorio },
) {
  const result = await container.listSolicitacoesRelatorio.execute(profile, filter)
  return { ...result, error: asServiceError(result.error) }
}

export async function aprovarSolicitacaoRelatorio(profile: Usuario | null, id: string, observacao?: string) {
  const result = await container.atualizarSolicitacaoRelatorio.execute(profile, id, 'APROVADO', observacao)
  if (result.data) notifyDataRefresh()
  return { ...result, error: asServiceError(result.error) }
}

export async function rejeitarSolicitacaoRelatorio(profile: Usuario | null, id: string, observacao?: string) {
  const result = await container.atualizarSolicitacaoRelatorio.execute(profile, id, 'REJEITADO', observacao)
  if (result.data) notifyDataRefresh()
  return { ...result, error: asServiceError(result.error) }
}

export async function getVeiculosEscopoMotorista(motoristaId: string) {
  return container.reservaRepository.findVeiculosEscopoMotorista(motoristaId)
}

export type { SolicitacaoRelatorio }
