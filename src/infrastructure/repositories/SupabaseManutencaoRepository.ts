import { supabase } from '@/lib/supabase'
import { runSupabaseQuery } from '@/lib/supabaseQuery'
import type { IManutencaoRepository, ManutencaoListFilter } from '@/domain/repositories/IManutencaoRepository'
import type { TenantFilter } from '@/domain/types/enums'
import type { Manutencao as ManutencaoDTO, NovaManutencao, StatusManutencao } from '@/types/database'
import { ManutencaoMapper, MANUTENCAO_VEICULO_SELECT } from '@/infrastructure/mappers/ManutencaoMapper'

const SELECT = `*, veiculos(${MANUTENCAO_VEICULO_SELECT})`
const ACTIVE_DB_STATUSES = ['PENDENTE', 'EM_ANDAMENTO', 'pendente', 'em_andamento', 'AGENDADA', 'agendada']

export class SupabaseManutencaoRepository implements IManutencaoRepository {
  async findAll(filter?: ManutencaoListFilter) {
    return runSupabaseQuery('manutencoes.findAll', async () => {
      let query = supabase
        .from('manutencoes')
        .select(SELECT)
        .order('data_manutencao', { ascending: false })

      if (filter?.veiculoId) query = query.eq('veiculo_id', filter.veiculoId)
      if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)

      const { data, error } = await query
      return { data: ManutencaoMapper.toDomainList(data as ManutencaoDTO[] | null), error }
    })
  }

  async findProximas(limit: number, filter?: TenantFilter) {
    return runSupabaseQuery('manutencoes.findProximas', async () => {
      let query = supabase
        .from('manutencoes')
        .select(SELECT)
        .in('status', ACTIVE_DB_STATUSES)
        .order('data_manutencao', { ascending: true })
        .limit(limit)

      if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)

      const { data, error } = await query
      return { data: ManutencaoMapper.toDomainList(data as ManutencaoDTO[] | null), error }
    })
  }

  async findWithFinancialValue(filter?: TenantFilter) {
    return runSupabaseQuery('manutencoes.findWithFinancialValue', async () => {
      let query = supabase
        .from('manutencoes')
        .select(SELECT)
        .gt('valor_total', 0)

      if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)

      const { data, error } = await query
      return { data: ManutencaoMapper.toDomainList(data as ManutencaoDTO[] | null), error }
    })
  }

  async create(input: NovaManutencao) {
    return runSupabaseQuery('manutencoes.create', async () => {
      const payload = ManutencaoMapper.toDbPayload(input)
      const { data, error } = await supabase
        .from('manutencoes')
        .insert(payload)
        .select(SELECT)
        .single()

      return {
        data: data ? ManutencaoMapper.toDomain(data as ManutencaoDTO) : null,
        error,
      }
    })
  }

  async updateStatus(id: string, status: StatusManutencao, empresaId?: string) {
    return runSupabaseQuery('manutencoes.updateStatus', async () => {
      let query = supabase
        .from('manutencoes')
        .update({ status: ManutencaoMapper.statusToDb(status) })
        .eq('id', id)

      if (empresaId) query = query.eq('empresa_id', empresaId)

      const { data, error } = await query.select(SELECT).single()

      return {
        data: data ? ManutencaoMapper.toDomain(data as ManutencaoDTO) : null,
        error,
      }
    })
  }

  async update(id: string, input: Partial<NovaManutencao>, empresaId?: string) {
    const payload = ManutencaoMapper.toDbUpdate(input)
    if (Object.keys(payload).length === 0) {
      return { data: null, error: new Error('Nenhum campo para atualizar.') }
    }

    return runSupabaseQuery('manutencoes.update', async () => {
      let query = supabase.from('manutencoes').update(payload).eq('id', id)
      if (empresaId) query = query.eq('empresa_id', empresaId)
      const { data, error } = await query.select(SELECT).single()

      return {
        data: data ? ManutencaoMapper.toDomain(data as ManutencaoDTO) : null,
        error,
      }
    })
  }
}
