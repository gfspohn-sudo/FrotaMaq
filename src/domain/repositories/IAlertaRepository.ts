import type { Alerta } from '@/types/database'
import type { TenantFilter } from '@/domain/types/enums'

export interface IAlertaRepository {
  findActive(filter?: TenantFilter): Promise<{ data: Alerta[] | null; error: unknown }>
  countActive(filter?: TenantFilter): Promise<{ count: number; error: unknown }>
  resolve(id: string, empresaId?: string): Promise<{ error: unknown }>
}
