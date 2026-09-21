import { describe, it, expect } from 'vitest'
import { TenantScopeService } from '@/domain/services/TenantScopeService'
import type { Usuario } from '@/types/database'

const gestorEmpresaA: Usuario = {
  id: 'u1',
  nome: 'Gestor A',
  email: 'gestor-a@test.com',
  perfil: 'gestor',
  empresa_id: 'emp-a',
  created_at: '2026-01-01T00:00:00.000Z',
}

const gestorEmpresaB: Usuario = {
  id: 'u2',
  nome: 'Gestor B',
  email: 'gestor-b@test.com',
  perfil: 'gestor',
  empresa_id: 'emp-b',
  created_at: '2026-01-01T00:00:00.000Z',
}

const superAdmin: Usuario = {
  id: 'admin',
  nome: 'Admin',
  email: 'admin@test.com',
  perfil: 'super_admin',
  empresa_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

describe('TenantScopeService', () => {
  describe('resolveQueryScope', () => {
    it('força empresa_id do perfil para gestor, ignorando filtro de outra empresa', () => {
      const { scoped, error } = TenantScopeService.resolveQueryScope(gestorEmpresaA, {
        empresaId: 'emp-b',
      })

      expect(error).toBeNull()
      expect(scoped.empresaId).toBe('emp-a')
    })

    it('retorna erro quando usuário não autenticado', () => {
      const { error } = TenantScopeService.resolveQueryScope(null)
      expect(error?.message).toContain('não autenticado')
    })

    it('retorna erro quando perfil sem empresa_id (non super_admin)', () => {
      const semEmpresa: Usuario = { ...gestorEmpresaA, empresa_id: null }
      const { error } = TenantScopeService.resolveQueryScope(semEmpresa)
      expect(error?.message).toContain('sem empresa')
    })

    it('super_admin pode consultar visão global (sem empresaId)', () => {
      const { scoped, error } = TenantScopeService.resolveQueryScope(superAdmin)
      expect(error).toBeNull()
      expect(scoped.empresaId).toBeUndefined()
    })

    it('super_admin pode filtrar por empresa específica', () => {
      const { scoped, error } = TenantScopeService.resolveQueryScope(superAdmin, { empresaId: 'emp-b' })
      expect(error).toBeNull()
      expect(scoped.empresaId).toBe('emp-b')
    })
  })

  describe('canAccessRecord', () => {
    it('gestor da Empresa A não acessa registro da Empresa B', () => {
      expect(TenantScopeService.canAccessRecord(gestorEmpresaA, 'emp-b')).toBe(false)
    })

    it('gestor acessa registro da própria empresa', () => {
      expect(TenantScopeService.canAccessRecord(gestorEmpresaA, 'emp-a')).toBe(true)
    })

    it('super_admin acessa qualquer registro', () => {
      expect(TenantScopeService.canAccessRecord(superAdmin, 'emp-b')).toBe(true)
    })
  })

  describe('filterRecordsByTenant', () => {
    const records = [
      { id: '1', empresa_id: 'emp-a' },
      { id: '2', empresa_id: 'emp-b' },
      { id: '3', empresa_id: 'emp-a' },
    ]

    it('filtra registros de outras empresas para gestor', () => {
      const filtered = TenantScopeService.filterRecordsByTenant(gestorEmpresaA, records)
      expect(filtered).toHaveLength(2)
      expect(filtered.every(r => r.empresa_id === 'emp-a')).toBe(true)
    })

    it('gestor da Empresa B nunca vê registros da Empresa A', () => {
      const filtered = TenantScopeService.filterRecordsByTenant(gestorEmpresaB, records)
      expect(filtered.every(r => r.empresa_id !== 'emp-a')).toBe(true)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].empresa_id).toBe('emp-b')
    })

    it('super_admin vê todos os registros', () => {
      expect(TenantScopeService.filterRecordsByTenant(superAdmin, records)).toHaveLength(3)
    })
  })
})
