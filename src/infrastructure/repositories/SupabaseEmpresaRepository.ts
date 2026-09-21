import { supabase } from '@/lib/supabase'
import type { IEmpresaRepository, NovaEmpresaInput, EmpresaDependencies } from '@/domain/repositories/IEmpresaRepository'
import type { Empresa as EmpresaDTO } from '@/types/database'
import { EmpresaMapper } from '@/infrastructure/mappers/EmpresaMapper'

export class SupabaseEmpresaRepository implements IEmpresaRepository {
  async findAll() {
    const { data, error } = await supabase.from('empresas').select('*').order('nome')
    return { data: EmpresaMapper.toDomainList(data as EmpresaDTO[] | null), error }
  }

  async findById(id: string) {
    const { data, error } = await supabase.from('empresas').select('*').eq('id', id).single()
    return {
      data: data ? EmpresaMapper.toDomain(data as EmpresaDTO) : null,
      error,
    }
  }

  async create(input: NovaEmpresaInput) {
    const { data, error } = await supabase
      .from('empresas')
      .insert({
        nome: input.nome.trim(),
        cnpj: input.cnpj?.trim() || null,
        slug: input.slug.trim().toLowerCase().slice(0, 48),
      })
      .select('*')
      .single()

    return {
      data: data ? EmpresaMapper.toDomain(data as EmpresaDTO) : null,
      error,
    }
  }

  async delete(id: string) {
    const { error } = await supabase.from('empresas').delete().eq('id', id)
    return { error }
  }

  async countDependencies(id: string): Promise<{ data: EmpresaDependencies | null; error: unknown }> {
    const [usuariosRes, veiculosRes, manutencoesRes] = await Promise.all([
      supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('empresa_id', id),
      supabase.from('veiculos').select('*', { count: 'exact', head: true }).eq('empresa_id', id),
      supabase.from('manutencoes').select('*', { count: 'exact', head: true }).eq('empresa_id', id),
    ])

    if (usuariosRes.error || veiculosRes.error || manutencoesRes.error) {
      return {
        data: null,
        error: usuariosRes.error ?? veiculosRes.error ?? manutencoesRes.error,
      }
    }

    return {
      data: {
        usuarios: usuariosRes.count ?? 0,
        veiculos: veiculosRes.count ?? 0,
        manutencoes: manutencoesRes.count ?? 0,
      },
      error: null,
    }
  }
}
