import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TenantScopeService } from '@/domain/services/TenantScopeService'
import {
  FOREIGN_EMPRESA_ID,
  FOREIGN_RECORD_ID,
  assertZeroRows,
  createAnonClient,
  isLiveSupabaseConfigured,
  isTransportError,
} from './helpers'
import type { Usuario } from '@/types/database'

const live = isLiveSupabaseConfigured()
const schemaSql = readFileSync(resolve(process.cwd(), 'supabase/frota_maq_recreate_complete.sql'), 'utf8')

const gestorEmpresaA: Usuario = {
  id: 'gestor-a',
  nome: 'Gestor A',
  email: 'ga@test.com',
  perfil: 'gestor',
  empresa_id: 'emp-a',
  created_at: '2026-01-01T00:00:00.000Z',
}

describe('IDOR — isolamento de tenant (RLS)', () => {
  it('políticas RLS de veículos e reservas filtram por empresa_id', () => {
    expect(schemaSql).toMatch(/ALTER TABLE public\.veiculos ENABLE ROW LEVEL SECURITY/)
    expect(schemaSql).toMatch(/ALTER TABLE public\.reservas ENABLE ROW LEVEL SECURITY/)
    expect(schemaSql).toMatch(/veiculos_select[\s\S]*empresa_id = public\.auth_user_empresa_id\(\)/)
    expect(schemaSql).toMatch(/reservas_select[\s\S]*empresa_id = public\.auth_user_empresa_id\(\)/)
    expect(schemaSql).toMatch(/veiculos_update[\s\S]*empresa_id = public\.auth_user_empresa_id\(\)/)
    expect(schemaSql).toMatch(/reservas_update[\s\S]*empresa_id = public\.auth_user_empresa_id\(\)/)
  })

  it('camada de aplicação recusa consulta e atualização cross-tenant', () => {
    const leaked = TenantScopeService.resolveQueryScope(gestorEmpresaA, { empresaId: 'emp-b' })
    expect(leaked.error).toBeNull()
    expect(leaked.scoped.empresaId).toBe('emp-a')
    expect(TenantScopeService.canAccessRecord(gestorEmpresaA, 'emp-b')).toBe(false)

    const rows = TenantScopeService.filterRecordsByTenant(gestorEmpresaA, [
      { id: 'v1', empresa_id: 'emp-a' },
      { id: 'v2', empresa_id: 'emp-b' },
    ])
    expect(rows).toEqual([{ id: 'v1', empresa_id: 'emp-a' }])
  })

  it.skipIf(!live)('cliente anônimo não lê veículos nem reservas de outro tenant', async ({ skip }) => {
    try {
      const client = createAnonClient()

      const veiculos = await client.from('veiculos').select('id, empresa_id')
      const reservas = await client.from('reservas').select('id, empresa_id')

      assertZeroRows(veiculos.data)
      assertZeroRows(reservas.data)
    } catch (error) {
      if (isTransportError(error)) {
        skip()
        return
      }
      throw error
    }
  }, 30_000)

  it.skipIf(!live)('UPDATE em veículo e reserva de outra empresa retorna 0 linhas', async ({ skip }) => {
    try {
      const client = createAnonClient()

      const veiculo = await client
        .from('veiculos')
        .update({ nome_exibicao: 'idor-probe' })
        .eq('id', FOREIGN_RECORD_ID)
        .eq('empresa_id', FOREIGN_EMPRESA_ID)
        .select('id')

      const reserva = await client
        .from('reservas')
        .update({ destino: 'idor-probe' })
        .eq('id', FOREIGN_RECORD_ID)
        .eq('empresa_id', FOREIGN_EMPRESA_ID)
        .select('id')

      assertZeroRows(veiculo.data)
      assertZeroRows(reserva.data)
    } catch (error) {
      if (isTransportError(error)) {
        skip()
        return
      }
      throw error
    }
  }, 30_000)

  it.skipIf(!live)('gestor autenticado não lista registros de outra empresa_id', async ({ skip }) => {
    const email = process.env.SECURITY_TEST_EMAIL?.trim()
    const password = process.env.SECURITY_TEST_PASSWORD?.trim()
    if (!email || !password) return

    const client = createAnonClient()
    let session
    try {
      const result = await client.auth.signInWithPassword({ email, password })
      session = result.data
      if (result.error || !session.user) return
    } catch (error) {
      if (isTransportError(error)) {
        skip()
        return
      }
      throw error
    }

    if (!session?.user) return

    try {
      const { data: profile } = await client
        .from('usuarios')
        .select('empresa_id, perfil')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!profile || profile.perfil === 'super_admin' || !profile.empresa_id) {
        await client.auth.signOut()
        return
      }

      const veiculos = await client
        .from('veiculos')
        .select('id, empresa_id')
        .eq('empresa_id', FOREIGN_EMPRESA_ID)

      const reservas = await client
        .from('reservas')
        .select('id, empresa_id')
        .eq('empresa_id', FOREIGN_EMPRESA_ID)

      assertZeroRows(veiculos.data)
      assertZeroRows(reservas.data)
      expect((veiculos.data ?? []).every(row => row.empresa_id !== FOREIGN_EMPRESA_ID)).toBe(true)

      await client.auth.signOut()
    } catch (error) {
      if (isTransportError(error)) {
        skip()
        return
      }
      throw error
    }
  }, 30_000)
})
