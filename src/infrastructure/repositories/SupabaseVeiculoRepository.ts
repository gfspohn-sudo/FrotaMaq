import { supabase } from '@/lib/supabase'
import { runSupabaseQuery } from '@/lib/supabaseQuery'
import type { IVeiculoRepository, VeiculoListFilter } from '@/domain/repositories/IVeiculoRepository'
import type { NovoVeiculo } from '@/types/database'
import { VeiculoMapper } from '@/infrastructure/mappers/VeiculoMapper'
import type { Veiculo as VeiculoDTO } from '@/types/database'

export class SupabaseVeiculoRepository implements IVeiculoRepository {
  async findAll(filter?: VeiculoListFilter) {
    return runSupabaseQuery('veiculos.findAll', async () => {
      let query = supabase.from('veiculos').select('*, empresas(nome)').order('created_at', { ascending: false })

      if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)
      if (filter?.disponivelParaReserva) {
        query = query.in('status', VeiculoMapper.statusDbValuesForFilter('disponivel'))
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
    })
  }

  async findById(id: string, empresaId?: string) {
    return runSupabaseQuery('veiculos.findById', async () => {
      let query = supabase.from('veiculos').select('*, empresas(nome)').eq('id', id)
      if (empresaId) query = query.eq('empresa_id', empresaId)
      const { data, error } = await query.single()
      return {
        data: data ? VeiculoMapper.toDomain(data as VeiculoDTO) : null,
        error,
      }
    })
  }

  async create(input: NovoVeiculo) {
    return runSupabaseQuery('veiculos.create', async () => {
      const payload = VeiculoMapper.toDbPayload(input)
      const { data, error } = await supabase.from('veiculos').insert(payload).select('*, empresas(nome)').single()
      return {
        data: data ? VeiculoMapper.toDomain(data as VeiculoDTO) : null,
        error,
      }
    })
  }

  async update(id: string, input: Partial<NovoVeiculo>, empresaId?: string) {
    return runSupabaseQuery('veiculos.update', async () => {
      const payload = VeiculoMapper.toDbUpdate(input)
      let query = supabase.from('veiculos').update(payload).eq('id', id)
      if (empresaId) query = query.eq('empresa_id', empresaId)
      const { data, error } = await query.select('*, empresas(nome)').single()
      return {
        data: data ? VeiculoMapper.toDomain(data as VeiculoDTO) : null,
        error,
      }
    })
  }

  async delete(id: string, empresaId?: string) {
    return runSupabaseQuery('veiculos.delete', async () => {
      let query = supabase.from('veiculos').delete().eq('id', id)
      if (empresaId) query = query.eq('empresa_id', empresaId)
      const { error } = await query
      return { error }
    })
  }

  async deleteAll(empresaId?: string) {
    if (!empresaId) {
      return { error: new Error('empresa_id obrigatório para exclusão em lote.') }
    }

    return runSupabaseQuery('veiculos.deleteAll', async () => {
      const { data: veiculos, error: fetchError } = await supabase
        .from('veiculos')
        .select('id')
        .eq('empresa_id', empresaId)

      if (fetchError) return { error: fetchError }

      const veiculoIds = (veiculos ?? []).map(v => v.id as string)

      const { error: manutencoesError } = await supabase
        .from('manutencoes')
        .delete()
        .eq('empresa_id', empresaId)
      if (manutencoesError) return { error: manutencoesError }

      const { error: reservasError } = await supabase
        .from('reservas')
        .delete()
        .eq('empresa_id', empresaId)
      if (reservasError) return { error: reservasError }

      const { error: solicitacoesError } = await supabase
        .from('solicitacoes_relatorio')
        .delete()
        .eq('empresa_id', empresaId)
      if (solicitacoesError) return { error: solicitacoesError }

      if (veiculoIds.length > 0) {
        const { error: veiculosError } = await supabase
          .from('veiculos')
          .delete()
          .eq('empresa_id', empresaId)
          .in('id', veiculoIds)
        return { error: veiculosError }
      }

      const { error } = await supabase.from('veiculos').delete().eq('empresa_id', empresaId)
      return { error }
    })
  }
}
