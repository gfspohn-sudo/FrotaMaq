import { supabase } from '@/lib/supabase'
import type { IManutencaoRepository, ManutencaoListFilter } from '@/domain/repositories/IManutencaoRepository'
import type { TenantFilter } from '@/domain/types/enums'
import type { Manutencao as ManutencaoDTO, NovaManutencao, StatusManutencao } from '@/types/database'
import { ManutencaoMapper } from '@/infrastructure/mappers/ManutencaoMapper'

export class SupabaseManutencaoRepository implements IManutencaoRepository {
  async findAll(filter?: ManutencaoListFilter) {
    let query = supabase
      .from('manutencoes')
      .select('*, veiculos(placa, modelo, marca, km_atual)')
      .order('data_hora', { ascending: false })

    if (filter?.veiculoId) query = query.eq('veiculo_id', filter.veiculoId)
    if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)

    const { data, error } = await query
    return { data: ManutencaoMapper.toDomainList(data as ManutencaoDTO[] | null), error }
  }

  async findProximas(limit: number, filter?: TenantFilter) {
    let query = supabase
      .from('manutencoes')
      .select('*, veiculos(placa, modelo, marca, km_atual)')
      .in('status', ['agendada', 'em_andamento'])
      .gte('data_hora', new Date().toISOString())
      .order('data_hora', { ascending: true })
      .limit(limit)

    if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)

    const { data, error } = await query
    return { data: ManutencaoMapper.toDomainList(data as ManutencaoDTO[] | null), error }
  }

  async findWithFinancialValue(filter?: TenantFilter) {
    let query = supabase
      .from('manutencoes')
      .select('*, veiculos(placa, modelo, marca, km_atual)')
      .gt('valor', 0)

    if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)

    const { data, error } = await query
    return { data: ManutencaoMapper.toDomainList(data as ManutencaoDTO[] | null), error }
  }

  async create(input: NovaManutencao) {
    const { data, error } = await supabase
      .from('manutencoes')
      .insert({ ...input, valor: input.valor ?? 0 })
      .select('*, veiculos(placa, modelo, marca, km_atual)')
      .single()

    return {
      data: data ? ManutencaoMapper.toDomain(data as ManutencaoDTO) : null,
      error,
    }
  }

  async updateStatus(id: string, status: StatusManutencao) {
    const { data, error } = await supabase
      .from('manutencoes')
      .update({ status })
      .eq('id', id)
      .select('*, veiculos(placa, modelo, marca, km_atual)')
      .single()

    return {
      data: data ? ManutencaoMapper.toDomain(data as ManutencaoDTO) : null,
      error,
    }
  }

  async update(id: string, input: Partial<NovaManutencao>) {
    const { data, error } = await supabase
      .from('manutencoes')
      .update(input)
      .eq('id', id)
      .select('*, veiculos(placa, modelo, marca, km_atual)')
      .single()

    return {
      data: data ? ManutencaoMapper.toDomain(data as ManutencaoDTO) : null,
      error,
    }
  }
}
