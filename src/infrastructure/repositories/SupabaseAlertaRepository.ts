import { supabase } from '@/lib/supabase'
import type { IAlertaRepository } from '@/domain/repositories/IAlertaRepository'
import type { TenantFilter } from '@/domain/types/enums'
import type { Alerta } from '@/types/database'

export class SupabaseAlertaRepository implements IAlertaRepository {
  async findActive(filter?: TenantFilter) {
    let query = supabase
      .from('alertas')
      .select('*, veiculos(placa, modelo, marca)')
      .eq('status', 'ativo')
      .order('data_vencimento', { ascending: true })

    if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)

    const { data, error } = await query
    return { data: data as Alerta[] | null, error }
  }

  async countActive(filter?: TenantFilter) {
    let query = supabase
      .from('alertas')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ativo')

    if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)

    const { count, error } = await query
    return { count: count ?? 0, error }
  }

  async resolve(id: string) {
    const { error } = await supabase.from('alertas').update({ status: 'resolvido' }).eq('id', id)
    return { error }
  }
}
