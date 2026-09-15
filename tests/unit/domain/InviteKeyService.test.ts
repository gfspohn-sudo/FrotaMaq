import { describe, it, expect } from 'vitest'
import { InviteKeyService } from '@/domain/services/InviteKeyService'

describe('InviteKeyService', () => {
  it('gera token com prefixo correto para motorista', () => {
    const token = InviteKeyService.gerarToken('motorista')
    expect(token.startsWith('Chave_Motorista_')).toBe(true)
    expect(InviteKeyService.validarFormato(token)).toBe(true)
  })

  it('gera token com prefixo correto para mecânico', () => {
    const token = InviteKeyService.gerarToken('mecanico')
    expect(token.startsWith('Chave_Mecanico_')).toBe(true)
    expect(InviteKeyService.validarFormato(token)).toBe(true)
  })

  it('rejeita formato inválido', () => {
    expect(InviteKeyService.validarFormato('token-invalido')).toBe(false)
    expect(InviteKeyService.validarFormato('Chave_Motorista_curto')).toBe(false)
  })

  it('validarCadastro vincula perfil e empresa da chave resolvida', () => {
    const token = 'Chave_Motorista_AABBCCDDEEFF0011'
    const result = InviteKeyService.validarCadastro(token, {
      empresaId: 'emp-1',
      perfil: 'motorista',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.empresaId).toBe('emp-1')
      expect(result.data.perfil).toBe('motorista')
    }
  })

  it('validarCadastro rejeita chave inexistente', () => {
    const result = InviteKeyService.validarCadastro('Chave_Motorista_AABBCCDDEEFF0011', null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('inválida')
    }
  })

  it('validarCadastro rejeita mismatch de perfil no token', () => {
    const token = 'Chave_Mecanico_AABBCCDDEEFF0011'
    const result = InviteKeyService.validarCadastro(token, {
      empresaId: 'emp-1',
      perfil: 'motorista',
    })
    expect(result.ok).toBe(false)
  })
})
