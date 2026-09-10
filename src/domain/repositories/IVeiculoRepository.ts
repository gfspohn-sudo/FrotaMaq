import type { Veiculo } from '@/domain/entities/Veiculo'
import type { NovoVeiculo, StatusVeiculo } from '@/types/database'
import type { TenantFilter } from '@/domain/types/enums'

export interface VeiculoListFilter extends TenantFilter {
  status?: StatusVeiculo
  search?: string
}

export interface IVeiculoRepository {
  findAll(filter?: VeiculoListFilter): Promise<{ data: Veiculo[] | null; error: unknown }>
  findById(id: string): Promise<{ data: Veiculo | null; error: unknown }>
  create(input: NovoVeiculo): Promise<{ data: Veiculo | null; error: unknown }>
  update(id: string, input: Partial<NovoVeiculo>): Promise<{ data: Veiculo | null; error: unknown }>
  delete(id: string): Promise<{ error: unknown }>
  deleteAll(empresaId?: string): Promise<{ error: unknown }>
}
