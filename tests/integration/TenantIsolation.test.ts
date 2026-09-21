import { describe, it, expect } from 'vitest'
import { ListReservasUseCase } from '@/application/use-cases/ReservaUseCases'
import { ListSolicitacoesRelatorioUseCase } from '@/application/use-cases/SolicitacaoRelatorioUseCases'
import { Reserva } from '@/domain/entities/Reserva'
import type { IReservaRepository } from '@/domain/repositories/IReservaRepository'
import type { ISolicitacaoRelatorioRepository } from '@/domain/repositories/ISolicitacaoRelatorioRepository'
import type { Usuario, SolicitacaoRelatorio } from '@/types/database'
import { TenantScopeService } from '@/domain/services/TenantScopeService'

const gestorEmpresaA: Usuario = {
  id: 'gestor-a',
  nome: 'Gestor A',
  email: 'ga@test.com',
  perfil: 'gestor',
  empresa_id: 'emp-a',
  created_at: '2026-01-01T00:00:00.000Z',
}

const reservaEmpresaA = new Reserva({
  id: 'r1',
  empresaId: 'emp-a',
  veiculoId: 'v1',
  motoristaId: 'm1',
  dataViagem: '2026-09-20',
  destino: 'SP',
  kmIdaVolta: 100,
  status: 'PENDENTE',
  observacaoGestor: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

function createReservaRepoSpy(): IReservaRepository & { lastFilter?: { empresaId?: string } } {
  const spy = {
    lastFilter: undefined as { empresaId?: string } | undefined,
    findAll: async (filter?: { empresaId?: string }) => {
      spy.lastFilter = filter
      if (filter?.empresaId === 'emp-a') {
        return { data: [reservaEmpresaA], error: null }
      }
      return { data: [], error: null }
    },
    findById: async () => ({ data: null, error: null }),
    create: async () => ({ data: null, error: null }),
    updateStatus: async () => ({ data: null, error: null }),
    findVeiculosComReservaAprovada: async () => ({ data: [], error: null }),
    findVeiculosEscopoMotorista: async () => ({ data: [], error: null }),
    countPendentes: async () => ({ count: 0, error: null }),
  }
  return spy
}

function createSolicitacaoRepoSpy(): ISolicitacaoRelatorioRepository & { lastFilter?: { empresaId?: string } } {
  const spy = {
    lastFilter: undefined as { empresaId?: string } | undefined,
    findAll: async (filter?: { empresaId?: string }) => {
      spy.lastFilter = filter
      return { data: [] as SolicitacaoRelatorio[], error: null }
    },
    create: async () => ({ data: null, error: null }),
    updateStatus: async () => ({ data: null, error: null }),
    findVeiculosAprovados: async () => ({ data: [], error: null }),
    findPendente: async () => ({ data: null, error: null }),
  }
  return spy
}

describe('Isolamento multi-tenant — integração', () => {
  it('ListReservasUseCase consulta apenas empresa_id do gestor, mesmo pedindo outra empresa', async () => {
    const repo = createReservaRepoSpy()
    const useCase = new ListReservasUseCase(repo)

    const { data, error } = await useCase.execute(gestorEmpresaA, { empresaId: 'emp-b' })

    expect(error).toBeNull()
    expect(repo.lastFilter?.empresaId).toBe('emp-a')
    expect(data).toHaveLength(1)
    expect(data![0].empresa_id).toBe('emp-a')
    expect(data!.every(r => r.empresa_id !== 'emp-b')).toBe(true)
  })

  it('ListSolicitacoesRelatorioUseCase aplica escopo de tenant na consulta', async () => {
    const repo = createSolicitacaoRepoSpy()
    const useCase = new ListSolicitacoesRelatorioUseCase(repo, {} as never)

    const { error } = await useCase.execute(gestorEmpresaA, { empresaId: 'emp-b' })

    expect(error).toBeNull()
    expect(repo.lastFilter?.empresaId).toBe('emp-a')
  })

  it('filterRecordsByTenant garante que Empresa A nunca retorna empresa_id da Empresa B', () => {
    const mixed = [
      { id: 'v1', empresa_id: 'emp-a' },
      { id: 'v2', empresa_id: 'emp-b' },
    ]

    const result = TenantScopeService.filterRecordsByTenant(gestorEmpresaA, mixed)

    expect(result.some(r => r.empresa_id === 'emp-b')).toBe(false)
    expect(result).toEqual([{ id: 'v1', empresa_id: 'emp-a' }])
  })
})
