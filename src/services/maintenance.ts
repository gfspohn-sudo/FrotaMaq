import { container } from '@/infrastructure/di/container'
import { asServiceError } from '@/application/utils/asServiceError'
import { notifyDataRefresh } from '@/lib/dataRefresh'
import { TenantScopeService } from '@/domain/services/TenantScopeService'
import type { Manutencao, NovaManutencao, StatusManutencao, Usuario } from '@/types/database'
import type { TenantQueryOptions } from '@/lib/tenantFilter'

type ManutencaoFilters = TenantQueryOptions & {
  veiculoId?: string
}

/** Facade — mantém compatibilidade com a camada de apresentação. */
export async function getManutencoes(filters?: ManutencaoFilters, profile?: Usuario | null) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile, filters)
  if (scopeError) return { data: null, error: asServiceError(scopeError) }

  const result = await container.listManutencoes.execute(scoped)
  const data = result.data
    ? TenantScopeService.filterRecordsByTenant(profile, result.data)
    : null
  return { data, error: asServiceError(result.error) }
}

export async function getProximasManutencoes(
  limit = 5,
  options?: TenantQueryOptions,
  profile?: Usuario | null,
) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile, options)
  if (scopeError) return { data: null, error: asServiceError(scopeError) }

  const result = await container.listProximasManutencoes.execute(limit, scoped)
  const data = result.data
    ? TenantScopeService.filterRecordsByTenant(profile, result.data)
    : null
  return { data, error: asServiceError(result.error) }
}

export async function createManutencao(manutencao: NovaManutencao, profile?: Usuario | null) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile)
  if (scopeError) return { data: null, error: asServiceError(scopeError) }

  const payload = {
    ...manutencao,
    empresa_id: scoped.empresaId ?? manutencao.empresa_id,
  }
  const result = await container.createManutencao.execute(payload, profile)
  return { ...result, error: asServiceError(result.error) }
}

export async function updateManutencaoStatus(id: string, status: StatusManutencao, profile?: Usuario | null) {
  const result = await container.updateManutencaoStatus.execute(id, status, profile)
  return { ...result, error: asServiceError(result.error) }
}

export async function updateManutencao(id: string, updates: Partial<NovaManutencao>, profile?: Usuario | null) {
  const result = await container.updateManutencao.execute(id, updates, profile)
  return { ...result, error: asServiceError(result.error) }
}

export async function concluirManutencao(id: string, profile?: Usuario | null) {
  const result = await container.concluirManutencao.execute(id, profile)
  if (!result.error) notifyDataRefresh()
  return { ...result, error: asServiceError(result.error) }
}

export type { Manutencao, NovaManutencao, StatusManutencao }
