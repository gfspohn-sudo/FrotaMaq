import type { IAlertaRepository } from '@/domain/repositories/IAlertaRepository'
import type { TenantFilter } from '@/domain/types/enums'
import type { Alerta } from '@/types/database'

/** Tabela `alertas` não existe no schema atual — repositório stub. */
export class SupabaseAlertaRepository implements IAlertaRepository {
  async findActive(_filter?: TenantFilter) {
    return { data: [] as Alerta[], error: null }
  }

  async countActive(_filter?: TenantFilter) {
    return { count: 0, error: null }
  }

  async resolve(_id: string, _empresaId?: string) {
    return { error: null }
  }
}
