import type { Usuario as UsuarioProfile } from '@/types/database'

export interface TenantQueryScope {
  empresaId?: string
}

/** Domain Service — escopo de tenant para consultas multi-empresa. */
export class TenantScopeService {
  static isSuperAdmin(profile: UsuarioProfile | null | undefined): boolean {
    return profile?.perfil === 'super_admin'
  }

  /**
   * Non-super_admin: força empresa_id do perfil (ignora tentativa de cross-tenant).
   * Super_admin: usa empresaId opcional do filtro (undefined = visão global).
   */
  static resolveQueryScope(
    profile: UsuarioProfile | null | undefined,
    requested?: TenantQueryScope,
  ): { scoped: TenantQueryScope; error: Error | null } {
    if (!profile) {
      return { scoped: {}, error: new Error('Usuário não autenticado.') }
    }

    if (profile.perfil === 'super_admin') {
      return { scoped: requested ?? {}, error: null }
    }

    if (!profile.empresa_id) {
      return { scoped: {}, error: new Error('Usuário sem empresa vinculada.') }
    }

    return {
      scoped: { ...requested, empresaId: profile.empresa_id },
      error: null,
    }
  }

  static canAccessRecord(
    profile: UsuarioProfile | null | undefined,
    recordEmpresaId: string | null | undefined,
  ): boolean {
    if (!profile) return false
    if (profile.perfil === 'super_admin') return true
    if (!profile.empresa_id || !recordEmpresaId) return false
    return profile.empresa_id === recordEmpresaId
  }

  static filterRecordsByTenant<T extends { empresa_id?: string | null }>(
    profile: UsuarioProfile | null | undefined,
    records: T[],
  ): T[] {
    if (!profile || profile.perfil === 'super_admin') return records
    const empresaId = profile.empresa_id
    if (!empresaId) return []
    return records.filter(r => r.empresa_id === empresaId)
  }
}
