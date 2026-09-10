import { container } from '@/infrastructure/di/container'
import { supabase } from '@/lib/supabase'
import type { Alerta } from '@/types/database'
import type { TenantQueryOptions } from '@/lib/tenantFilter'

/** Facade — alertas via repositório. */
export async function getAlertas(onlyActive = true, options?: TenantQueryOptions) {
  if (!onlyActive) {
    let query = supabase
      .from('alertas')
      .select('*, veiculos(placa, modelo, marca)')
      .order('data_vencimento', { ascending: true })
    if (options?.empresaId) query = query.eq('empresa_id', options.empresaId)
    const { data, error } = await query
    return { data: data as Alerta[] | null, error }
  }
  return container.alertaRepository.findActive(options)
}

export async function getAlertasCount(options?: TenantQueryOptions) {
  return container.alertaRepository.countActive(options)
}

export async function resolveAlerta(id: string) {
  return container.alertaRepository.resolve(id)
}

export async function gerarAlertas() {
  const { error } = await supabase.rpc('gerar_alertas_manutencao')
  return { error }
}
