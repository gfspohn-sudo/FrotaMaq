import { container } from '@/infrastructure/di/container'
import { asServiceError } from '@/application/utils/asServiceError'
import { notifyDataRefresh } from '@/lib/dataRefresh'
import { seedMockFleet } from '@/services/mockSeed'
import { TenantScopeService } from '@/domain/services/TenantScopeService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import type { Veiculo, NovoVeiculo, StatusVeiculo, Usuario } from '@/types/database'
import type { TenantQueryOptions } from '@/lib/tenantFilter'

type VeiculoFilters = TenantQueryOptions & {
  status?: StatusVeiculo
  search?: string
}

function denyCrossTenant<T extends { empresa_id?: string | null }>(
  profile: Usuario | null | undefined,
  record: T | null,
): Error | null {
  if (!record) return null
  if (!TenantScopeService.canAccessRecord(profile, record.empresa_id)) {
    return new Error('Acesso negado: registro pertence a outra empresa.')
  }
  return null
}

/** Facade — mantém compatibilidade com a camada de apresentação. */
export async function getVeiculos(filters?: VeiculoFilters, profile?: Usuario | null) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile, filters)
  if (scopeError) return { data: null, error: asServiceError(scopeError) }

  const result = await container.listVeiculos.execute(scoped)
  const data = result.data
    ? TenantScopeService.filterRecordsByTenant(profile, result.data)
    : null
  return { data, error: asServiceError(result.error) }
}

export async function getVeiculoById(id: string, profile?: Usuario | null) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile)
  if (scopeError) return { data: null, error: asServiceError(scopeError) }

  const result = await container.getVeiculoById.execute(id, scoped.empresaId)
  const denied = denyCrossTenant(profile, result.data)
  if (denied) return { data: null, error: asServiceError(denied) }
  return { ...result, error: asServiceError(result.error) }
}

export async function createVeiculo(veiculo: NovoVeiculo, profile?: Usuario | null) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile)
  if (scopeError) return { data: null, error: asServiceError(scopeError) }

  const payload = {
    ...veiculo,
    empresa_id: scoped.empresaId ?? veiculo.empresa_id,
  }
  const result = await container.createVeiculo.execute(payload, profile)
  return { ...result, error: asServiceError(result.error) }
}

export async function updateVeiculo(id: string, updates: Partial<NovoVeiculo>, profile?: Usuario | null) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile)
  if (scopeError) return { data: null, error: asServiceError(scopeError) }

  const result = await container.updateVeiculo.execute(id, updates, scoped.empresaId, profile)
  return { ...result, error: asServiceError(result.error) }
}

export async function deleteVeiculo(id: string, profile?: Usuario | null) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile)
  if (scopeError) return { error: asServiceError(scopeError) }

  const { error } = await container.deleteVeiculo.execute(id, scoped.empresaId, profile)
  return { error: asServiceError(error) }
}

export async function deleteAllVeiculos(empresaId: string | undefined, profile?: Usuario | null) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile, { empresaId })
  if (scopeError) return { error: asServiceError(scopeError) }
  if (!scoped.empresaId) {
    return { error: asServiceError(new Error('Selecione uma empresa para excluir veículos.')) }
  }

  const { error } = await container.deleteAllVeiculos.execute(scoped.empresaId, profile)
  if (!error) notifyDataRefresh()
  return { error: asServiceError(error) }
}

export async function getFleetSummary(options?: TenantQueryOptions, profile?: Usuario | null) {
  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile, options)
  if (scopeError) return { data: null, error: scopeError }

  return container.getFleetSummary.execute(scoped)
}

export async function seedTestVeiculos(empresaId?: string, profile?: Usuario | null) {
  const usuario = UsuarioFactory.fromProfile(profile)
  if (!usuario.podeSeedTestData()) {
    return {
      data: null,
      error: 'Sem permissão para popular veículos de teste.',
      inserted: 0,
      skipped: 0,
      maintenancesInserted: 0,
      totalVehicles: 0,
    }
  }

  const { scoped, error: scopeError } = TenantScopeService.resolveQueryScope(profile, { empresaId })
  if (scopeError) {
    return {
      data: null,
      error: scopeError.message,
      inserted: 0,
      skipped: 0,
      maintenancesInserted: 0,
      totalVehicles: 0,
    }
  }

  if (!scoped.empresaId) {
    return {
      data: null,
      error: 'Selecione uma empresa no seletor antes de popular veículos de teste.',
      inserted: 0,
      skipped: 0,
      maintenancesInserted: 0,
      totalVehicles: 0,
    }
  }

  const result = await seedMockFleet(scoped.empresaId)
  return {
    data: null,
    error: result.error?.message ?? null,
    inserted: result.vehiclesInserted,
    skipped: result.vehiclesSkipped,
    maintenancesInserted: result.maintenancesInserted,
    totalVehicles: result.totalVehicles,
  }
}

export type { Veiculo, NovoVeiculo, StatusVeiculo }
