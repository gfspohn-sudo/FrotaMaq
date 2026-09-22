import type { Veiculo } from '@/domain/entities/Veiculo'
import type { NovoVeiculo, StatusVeiculo } from '@/types/database'
import type { TenantFilter } from '@/domain/types/enums'

export interface VeiculoListFilter extends TenantFilter {
  status?: StatusVeiculo
  search?: string
  /** Apenas veículos em operação (disponíveis para reserva). */
  disponivelParaReserva?: boolean
}

export interface IVeiculoRepository {
  findAll(filter?: VeiculoListFilter): Promise<{ data: Veiculo[] | null; error: unknown }>
  findById(id: string, empresaId?: string): Promise<{ data: Veiculo | null; error: unknown }>
  create(input: NovoVeiculo): Promise<{ data: Veiculo | null; error: unknown }>
  update(id: string, input: Partial<NovoVeiculo>, empresaId?: string): Promise<{ data: Veiculo | null; error: unknown }>
  delete(id: string, empresaId?: string): Promise<{ error: unknown }>
  deleteAll(empresaId?: string): Promise<{ error: unknown }>
}
