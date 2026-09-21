import { supabase } from '@/lib/supabase'
import type { IReservaRepository, ReservaListFilter } from '@/domain/repositories/IReservaRepository'
import type { Reserva as ReservaDTO, StatusReserva } from '@/types/database'
import { ReservaMapper } from '@/infrastructure/mappers/ReservaMapper'
import type { TenantFilter } from '@/domain/types/enums'

const RESERVA_SELECT = '*, veiculos(placa, nome_exibicao)'

export class SupabaseReservaRepository implements IReservaRepository {
  async findAll(filter?: ReservaListFilter) {
    let query = supabase
      .from('reservas')
      .select(RESERVA_SELECT)
      .order('created_at', { ascending: false })

    if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)
    if (filter?.status) query = query.eq('status', filter.status)
    if (filter?.motoristaId) query = query.eq('motorista_id', filter.motoristaId)
    if (filter?.veiculoId) query = query.eq('veiculo_id', filter.veiculoId)

    const { data, error } = await query
    return { data: ReservaMapper.toDomainList(data as ReservaDTO[] | null), error }
  }

  async findById(id: string, empresaId?: string) {
    let query = supabase.from('reservas').select(RESERVA_SELECT).eq('id', id)
    if (empresaId) query = query.eq('empresa_id', empresaId)
    const { data, error } = await query.single()

    return {
      data: data ? ReservaMapper.toDomain(data as ReservaDTO) : null,
      error,
    }
  }

  async create(input: {
    veiculo_id: string
    motorista_id: string
    empresa_id: string
    data_viagem: string
    destino: string
    km_ida_volta: number
  }) {
    const { data, error } = await supabase
      .from('reservas')
      .insert({ ...input, status: 'PENDENTE' })
      .select(RESERVA_SELECT)
      .single()

    return {
      data: data ? ReservaMapper.toDomain(data as ReservaDTO) : null,
      error,
    }
  }

  async updateStatus(id: string, status: StatusReserva, observacaoGestor?: string | null, empresaId?: string) {
    let query = supabase
      .from('reservas')
      .update({
        status,
        observacao_gestor: observacaoGestor ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (empresaId) query = query.eq('empresa_id', empresaId)
    const { data, error } = await query.select(RESERVA_SELECT).single()

    return {
      data: data ? ReservaMapper.toDomain(data as ReservaDTO) : null,
      error,
    }
  }

  async findVeiculosComReservaAprovada(motoristaId: string) {
    const { data, error } = await supabase
      .from('reservas')
      .select('veiculo_id')
      .eq('motorista_id', motoristaId)
      .eq('status', 'APROVADO')

    if (error) return { data: null, error }

    const ids = [...new Set((data ?? []).map(r => r.veiculo_id as string))]
    return { data: ids, error: null }
  }

  async findVeiculosEscopoMotorista(motoristaId: string) {
    const { data, error } = await supabase
      .from('reservas')
      .select('veiculo_id')
      .eq('motorista_id', motoristaId)
      .in('status', ['APROVADO', 'PENDENTE'])

    if (error) return { data: null, error }

    const ids = [...new Set((data ?? []).map(r => r.veiculo_id as string))]
    return { data: ids, error: null }
  }

  async countPendentes(filter?: TenantFilter) {
    let query = supabase
      .from('reservas')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDENTE')

    if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)

    const { count, error } = await query
    return { count: count ?? 0, error }
  }
}
