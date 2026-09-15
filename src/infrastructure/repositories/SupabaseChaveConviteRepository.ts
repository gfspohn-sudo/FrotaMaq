import { supabase } from '@/lib/supabase'
import type { IChaveConviteRepository } from '@/domain/repositories/IChaveConviteRepository'
import type { ChaveConvite, PerfilChaveConvite } from '@/types/database'

export class SupabaseChaveConviteRepository implements IChaveConviteRepository {
  async findByToken(token: string) {
    const { data, error } = await supabase
      .from('chaves_convite')
      .select('*')
      .eq('token', token.trim())
      .eq('ativa', true)
      .maybeSingle()

    return { data: data as ChaveConvite | null, error }
  }

  async findByEmpresa(empresaId: string) {
    const { data, error } = await supabase
      .from('chaves_convite')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('perfil')

    return { data: data as ChaveConvite[] | null, error }
  }

  async create(empresaId: string, token: string, perfil: PerfilChaveConvite) {
    const { data, error } = await supabase
      .from('chaves_convite')
      .insert({ empresa_id: empresaId, token, perfil })
      .select('*')
      .single()

    return { data: data as ChaveConvite | null, error }
  }
}
