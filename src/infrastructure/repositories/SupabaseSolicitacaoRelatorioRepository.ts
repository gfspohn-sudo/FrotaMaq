import { supabase } from '@/lib/supabase'
import type { ISolicitacaoRelatorioRepository } from '@/domain/repositories/ISolicitacaoRelatorioRepository'
import type { SolicitacaoRelatorio, StatusSolicitacaoRelatorio } from '@/types/database'
import type { TenantFilter } from '@/domain/types/enums'

const SELECT = '*, veiculos(placa, modelo)'

export class SupabaseSolicitacaoRelatorioRepository implements ISolicitacaoRelatorioRepository {
  async findAll(filter?: TenantFilter & { status?: StatusSolicitacaoRelatorio; solicitanteId?: string }) {
    let query = supabase.from('solicitacoes_relatorio').select(SELECT).order('created_at', { ascending: false })

    if (filter?.empresaId) query = query.eq('empresa_id', filter.empresaId)
    if (filter?.status) query = query.eq('status', filter.status)
    if (filter?.solicitanteId) query = query.eq('solicitante_id', filter.solicitanteId)

    const { data, error } = await query
    return { data: data as SolicitacaoRelatorio[] | null, error }
  }

  async create(input: { empresa_id: string; veiculo_id: string; solicitante_id: string }) {
    const { data, error } = await supabase
      .from('solicitacoes_relatorio')
      .insert({ ...input, status: 'PENDENTE' })
      .select(SELECT)
      .single()

    return { data: data as SolicitacaoRelatorio | null, error }
  }

  async updateStatus(id: string, status: StatusSolicitacaoRelatorio, observacaoGestor?: string | null) {
    const { data, error } = await supabase
      .from('solicitacoes_relatorio')
      .update({
        status,
        observacao_gestor: observacaoGestor ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(SELECT)
      .single()

    return { data: data as SolicitacaoRelatorio | null, error }
  }

  async findVeiculosAprovados(solicitanteId: string) {
    const { data, error } = await supabase
      .from('solicitacoes_relatorio')
      .select('veiculo_id')
      .eq('solicitante_id', solicitanteId)
      .eq('status', 'APROVADO')

    if (error) return { data: null, error }
    return { data: [...new Set((data ?? []).map(r => r.veiculo_id as string))], error: null }
  }

  async findPendente(solicitanteId: string, veiculoId: string) {
    const { data, error } = await supabase
      .from('solicitacoes_relatorio')
      .select('*')
      .eq('solicitante_id', solicitanteId)
      .eq('veiculo_id', veiculoId)
      .eq('status', 'PENDENTE')
      .maybeSingle()

    return { data: data as SolicitacaoRelatorio | null, error }
  }
}
