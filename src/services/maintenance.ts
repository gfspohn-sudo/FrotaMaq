import { container } from '@/infrastructure/di/container'
import { asServiceError } from '@/application/utils/asServiceError'
import type { Manutencao, NovaManutencao, StatusManutencao } from '@/types/database'
import type { TenantQueryOptions } from '@/lib/tenantFilter'

type ManutencaoFilters = TenantQueryOptions & {
  veiculoId?: string
}

/** Facade — mantém compatibilidade com a camada de apresentação. */
export async function getManutencoes(filters?: ManutencaoFilters) {
  const result = await container.listManutencoes.execute(filters)
  return { ...result, error: asServiceError(result.error) }
}

export async function getProximasManutencoes(limit = 5, options?: TenantQueryOptions) {
  const result = await container.listProximasManutencoes.execute(limit, options)
  return { ...result, error: asServiceError(result.error) }
}

export async function createManutencao(manutencao: NovaManutencao) {
  const result = await container.createManutencao.execute(manutencao)
  return { ...result, error: asServiceError(result.error) }
}

export async function updateManutencaoStatus(id: string, status: StatusManutencao) {
  const result = await container.updateManutencaoStatus.execute(id, status)
  return { ...result, error: asServiceError(result.error) }
}

export async function updateManutencao(id: string, updates: Partial<NovaManutencao>) {
  const result = await container.updateManutencao.execute(id, updates)
  return { ...result, error: asServiceError(result.error) }
}

export type { Manutencao, NovaManutencao, StatusManutencao }
