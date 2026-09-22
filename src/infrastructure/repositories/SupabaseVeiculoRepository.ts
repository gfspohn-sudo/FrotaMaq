import { supabase } from '@/lib/supabase'
import type { IVeiculoRepository, VeiculoListFilter } from '@/domain/repositories/IVeiculoRepository'
import type { NovoVeiculo } from '@/types/database'
import { VeiculoMapper } from '@/infrastructure/mappers/VeiculoMapper'
import type { Veiculo as VeiculoDTO } from '@/types/database'

export class SupabaseVeiculoRepository implements IVeiculoRepository {
  async findAll(filter?: VeiculoListFilter) {
    let query = supabase.from('veiculos').select('*, empresas(nome)').order('created_at', { ascending: false })

    if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)
    if (filter?.disponivelParaReserva) {
      query = query.in('status', VeiculoMapper.statusDbValuesForFilter('em_operacao'))
    } else if (filter?.status) {
      query = query.in('status', VeiculoMapper.statusDbValuesForFilter(filter.status))
    }
    if (filter?.search) {
      query = query.or(
        `placa.ilike.%${filter.search}%,nome_exibicao.ilike.%${filter.search}%`,
      )
    }

    const { data, error } = await query
    return { data: VeiculoMapper.toDomainList(data as VeiculoDTO[] | null), error }
  }

  async findById(id: string, empresaId?: string) {
    let query = supabase.from('veiculos').select('*, empresas(nome)').eq('id', id)
    if (empresaId) query = query.eq('empresa_id', empresaId)
    const { data, error } = await query.single()
    return {
      data: data ? VeiculoMapper.toDomain(data as VeiculoDTO) : null,
      error,
    }
  }

  async create(input: NovoVeiculo) {
    const payload = VeiculoMapper.toDbPayload(input)
    const { data, error } = await supabase.from('veiculos').insert(payload).select('*, empresas(nome)').single()
    return {
      data: data ? VeiculoMapper.toDomain(data as VeiculoDTO) : null,
      error,
    }
  }

  async update(id: string, input: Partial<NovoVeiculo>, empresaId?: string) {
    const payload = VeiculoMapper.toDbUpdate(input)
    let query = supabase.from('veiculos').update(payload).eq('id', id)
    if (empresaId) query = query.eq('empresa_id', empresaId)
    const { data, error } = await query.select('*, empresas(nome)').single()
    return {
      data: data ? VeiculoMapper.toDomain(data as VeiculoDTO) : null,
      error,
    }
  }

  async delete(id: string, empresaId?: string) {
    let query = supabase.from('veiculos').delete().eq('id', id)
    if (empresaId) query = query.eq('empresa_id', empresaId)
    const { error } = await query
    return { error }
  }

  async deleteAll(empresaId?: string) {
    let query = supabase.from('veiculos').delete()
    if (empresaId) {
      query = query.eq('empresa_id', empresaId)
    }
    if (!empresaId) {
      return { error: new Error('empresa_id obrigatório para exclusão em lote.') }
    }
    const { error } = await query
    return { error }
  }
}
