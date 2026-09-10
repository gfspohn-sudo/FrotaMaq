import type { Manutencao } from '@/domain/entities/Manutencao'
import type { NovaManutencao, StatusManutencao } from '@/types/database'
import type { TenantFilter } from '@/domain/types/enums'

export interface ManutencaoListFilter extends TenantFilter {
  veiculoId?: string
}

export interface IManutencaoRepository {
  findAll(filter?: ManutencaoListFilter): Promise<{ data: Manutencao[] | null; error: unknown }>
  findProximas(limit: number, filter?: TenantFilter): Promise<{ data: Manutencao[] | null; error: unknown }>
  findWithFinancialValue(filter?: TenantFilter): Promise<{ data: Manutencao[] | null; error: unknown }>
  create(input: NovaManutencao): Promise<{ data: Manutencao | null; error: unknown }>
  updateStatus(id: string, status: StatusManutencao): Promise<{ data: Manutencao | null; error: unknown }>
  update(id: string, input: Partial<NovaManutencao>): Promise<{ data: Manutencao | null; error: unknown }>
}
