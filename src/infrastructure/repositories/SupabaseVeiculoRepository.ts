import { supabase } from '@/lib/supabase'
import type { IVeiculoRepository, VeiculoListFilter } from '@/domain/repositories/IVeiculoRepository'
import type { NovoVeiculo } from '@/types/database'
import { VeiculoMapper } from '@/infrastructure/mappers/VeiculoMapper'
import type { Veiculo as VeiculoDTO } from '@/types/database'

export class SupabaseVeiculoRepository implements IVeiculoRepository {
  async findAll(filter?: VeiculoListFilter) {
    let query = supabase.from('veiculos').select('*, empresas(nome)').order('created_at', { ascending: false })

    if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)
    if (filter?.status) query = query.eq('status', filter.status)
    if (filter?.search) {
      query = query.or(
        `placa.ilike.%${filter.search}%,modelo.ilike.%${filter.search}%,marca.ilike.%${filter.search}%`,
      )
    }

    const { data, error } = await query
    return { data: VeiculoMapper.toDomainList(data as VeiculoDTO[] | null), error }
  }

  async findById(id: string) {
    const { data, error } = await supabase.from('veiculos').select('*, empresas(nome)').eq('id', id).single()
    return {
      data: data ? VeiculoMapper.toDomain(data as VeiculoDTO) : null,
      error,
    }
  }

  async create(input: NovoVeiculo) {
    const payload = {
      ...input,
      ano: input.ano_modelo ?? input.ano,
      ano_modelo: input.ano_modelo ?? input.ano,
      ano_carroceria: input.ano_carroceria ?? null,
    }
    const { data, error } = await supabase.from('veiculos').insert(payload).select('*, empresas(nome)').single()
    return {
      data: data ? VeiculoMapper.toDomain(data as VeiculoDTO) : null,
      error,
    }
  }

  async update(id: string, input: Partial<NovoVeiculo>) {
    const payload = { ...input }
    if (input.ano_modelo != null) payload.ano = input.ano_modelo
    const { data, error } = await supabase.from('veiculos').update(payload).eq('id', id).select('*, empresas(nome)').single()
    return {
      data: data ? VeiculoMapper.toDomain(data as VeiculoDTO) : null,
      error,
    }
  }

  async delete(id: string) {
    const { error } = await supabase.from('veiculos').delete().eq('id', id)
    return { error }
  }

  async deleteAll(empresaId?: string) {
    let query = supabase.from('veiculos').delete()
    if (empresaId) {
      query = query.eq('empresa_id', empresaId)
    } else {
      query = query.not('id', 'is', null)
    }
    const { error } = await query
    return { error }
  }
}
