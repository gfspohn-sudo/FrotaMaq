import { container } from '@/infrastructure/di/container'
import { asServiceError } from '@/application/utils/asServiceError'
import { TenantScopeService } from '@/domain/services/TenantScopeService'
import type { Alerta, Usuario } from '@/types/database'
import type { TenantQueryOptions } from '@/lib/tenantFilter'

/** Facade — alertas derivados client-side (tabela `alertas` não existe no schema). */
export async function getAlertas(_onlyActive = true, options?: TenantQueryOptions, profile?: Usuario | null) {
  const { error: scopeError } = TenantScopeService.resolveQueryScope(profile, options)
  if (scopeError) return { data: null, error: asServiceError(scopeError) }

  const result = await container.alertaRepository.findActive(options)
  const data = result.data
    ? TenantScopeService.filterRecordsByTenant(profile, result.data)
    : ([] as Alerta[])
  return { data, error: result.error }
}

export async function getAlertasCount(options?: TenantQueryOptions, profile?: Usuario | null) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile, options)
  if (scopeError) return { count: 0, error: scopeError }

  return container.alertaRepository.countActive(scoped)
}

export async function resolveAlerta(id: string, profile?: Usuario | null) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile)
  if (scopeError) return { error: asServiceError(scopeError) }

  return container.alertaRepository.resolve(id, scoped.empresaId)
}

export async function gerarAlertas() {
  return { error: null }
}
