import type { PerfilUsuario } from '@/types/database'

export interface InviteKeyValidationResult {
  empresaId: string
  perfil: 'motorista' | 'mecanico'
}

/** Domain Service — geração e validação de chaves de convite multi-tenant. */
export class InviteKeyService {
  static gerarToken(perfil: 'motorista' | 'mecanico'): string {
    const hash = crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()
    const prefix = perfil === 'motorista' ? 'Chave_Motorista' : 'Chave_Mecanico'
    return `${prefix}_${hash}`
  }

  static validarFormato(token: string): boolean {
    return /^Chave_(Motorista|Mecanico)_[A-F0-9]{16}$/.test(token.trim())
  }

  static perfilFromToken(token: string): 'motorista' | 'mecanico' | null {
    if (token.startsWith('Chave_Motorista_')) return 'motorista'
    if (token.startsWith('Chave_Mecanico_')) return 'mecanico'
    return null
  }

  static validarCadastro(
    token: string,
    resolved: InviteKeyValidationResult | null,
  ): { ok: true; data: InviteKeyValidationResult } | { ok: false; message: string } {
    if (!token.trim()) {
      return { ok: false, message: 'Informe a Chave de Acesso da Empresa.' }
    }
    if (!InviteKeyService.validarFormato(token)) {
      return { ok: false, message: 'Formato de chave inválido.' }
    }
    if (!resolved) {
      return { ok: false, message: 'Chave de convite inválida ou inativa.' }
    }
    const perfilToken = InviteKeyService.perfilFromToken(token)
    if (perfilToken !== resolved.perfil) {
      return { ok: false, message: 'A chave não corresponde ao perfil esperado.' }
    }
    return { ok: true, data: resolved }
  }
}

export type { PerfilUsuario }
