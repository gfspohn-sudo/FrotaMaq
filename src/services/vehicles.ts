import { container } from '@/infrastructure/di/container'
import { asServiceError } from '@/application/utils/asServiceError'
import { notifyDataRefresh } from '@/lib/dataRefresh'
import { seedMockFleet } from '@/services/mockSeed'
import type { Veiculo, NovoVeiculo, StatusVeiculo } from '@/types/database'
import type { TenantQueryOptions } from '@/lib/tenantFilter'

type VeiculoFilters = TenantQueryOptions & {
  status?: StatusVeiculo
  search?: string
}

/** Facade — mantém compatibilidade com a camada de apresentação. */
export async function getVeiculos(filters?: VeiculoFilters) {
  const result = await container.listVeiculos.execute(filters)
  return { ...result, error: asServiceError(result.error) }
}

export async function getVeiculoById(id: string) {
  const result = await container.getVeiculoById.execute(id)
  return { ...result, error: asServiceError(result.error) }
}

export async function createVeiculo(veiculo: NovoVeiculo) {
  const result = await container.createVeiculo.execute(veiculo)
  return { ...result, error: asServiceError(result.error) }
}

export async function updateVeiculo(id: string, updates: Partial<NovoVeiculo>) {
  const result = await container.updateVeiculo.execute(id, updates)
  return { ...result, error: asServiceError(result.error) }
}

export async function deleteVeiculo(id: string) {
  const result = await container.deleteVeiculo.execute(id)
  return { error: asServiceError(result.error) }
}

export async function deleteAllVeiculos(empresaId?: string) {
  const { error } = await container.veiculoRepository.deleteAll(empresaId)
  if (!error) notifyDataRefresh()
  return { error }
}

export async function getFleetSummary(options?: TenantQueryOptions) {
  return container.getFleetSummary.execute(options)
}

export async function seedTestVeiculos(empresaId?: string) {
  const result = await seedMockFleet(empresaId)
  return {
    data: null,
    error: result.error,
    inserted: result.vehiclesInserted,
    skipped: result.vehiclesSkipped,
    maintenancesInserted: result.maintenancesInserted,
    totalVehicles: result.totalVehicles,
  }
}

export type { Veiculo, NovoVeiculo, StatusVeiculo }
