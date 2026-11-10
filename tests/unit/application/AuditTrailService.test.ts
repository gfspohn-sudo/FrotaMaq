import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuditLog,
  configureAuditTrail,
  recordAuditEvent,
} from '@/application/services/AuditTrailService'
import {
  HybridAuditLogRepository,
  matchesAuditFilter,
  mergeAuditLogs,
  persistLocalAuditLog,
  readLocalAuditLogs,
  AUDIT_LOG_STORAGE_KEY,
} from '@/infrastructure/repositories/HybridAuditLogRepository'
import type { AuditLog } from '@/types/database'
import type { IAuditLogRepository } from '@/domain/repositories/IAuditLogRepository'

const profile = {
  id: 'user-1',
  nome: 'Gabriel',
  email: 'gabriel@test.com',
  perfil: 'gestor' as const,
  empresa_id: 'emp-1',
  created_at: '2026-01-01T00:00:00.000Z',
}

function makeLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'evt-1',
    empresa_id: 'emp-1',
    usuario_id: 'user-1',
    usuario_nome: 'Gabriel',
    veiculo_id: 'veh-1',
    reserva_id: 'res-1',
    acao: 'viagem_criada',
    descricao: 'Viagem Criada',
    created_at: '2026-11-04T20:00:00.000Z',
    ...overrides,
  }
}

describe('buildAuditLog', () => {
  it('monta evento com usuário, timestamp implícito e ação legível', () => {
    const payload = buildAuditLog({
      acao: 'veiculo_em_manutencao',
      profile,
      veiculoId: 'veh-1',
      empresaId: 'emp-1',
    })

    expect(payload.acao).toBe('veiculo_em_manutencao')
    expect(payload.descricao).toBe('Status do Veículo Alterado para Em Manutenção')
    expect(payload.usuario_id).toBe('user-1')
    expect(payload.usuario_nome).toBe('Gabriel')
    expect(payload.veiculo_id).toBe('veh-1')
  })

  it('anexa detalhe operacional na descrição', () => {
    const payload = buildAuditLog({
      acao: 'viagem_criada',
      profile,
      reservaId: 'res-1',
      detalhe: 'Campinas',
    })
    expect(payload.descricao).toBe('Viagem Criada — Campinas')
    expect(payload.reserva_id).toBe('res-1')
  })
})

describe('merge e filtro de audit logs', () => {
  it('deduplica por id e ordena do mais recente para o mais antigo', () => {
    const merged = mergeAuditLogs(
      [makeLog({ id: 'a', created_at: '2026-11-01T10:00:00.000Z' })],
      [
        makeLog({ id: 'a', descricao: 'atualizado', created_at: '2026-11-01T10:00:00.000Z' }),
        makeLog({ id: 'b', acao: 'veiculo_liberado', created_at: '2026-11-04T10:00:00.000Z' }),
      ],
    )

    expect(merged.map(item => item.id)).toEqual(['b', 'a'])
  })

  it('filtra por veículo e reserva', () => {
    const log = makeLog()
    expect(matchesAuditFilter(log, { veiculoId: 'veh-1' })).toBe(true)
    expect(matchesAuditFilter(log, { veiculoId: 'veh-2' })).toBe(false)
    expect(matchesAuditFilter(log, { reservaId: 'res-1' })).toBe(true)
    expect(matchesAuditFilter(log, { reservaId: 'res-9' })).toBe(false)
  })
})

afterEach(() => {
  configureAuditTrail(new HybridAuditLogRepository())
})

describe('recordAuditEvent', () => {
  it('grava no repositório configurado sem quebrar a operação', async () => {
    const create = vi.fn().mockResolvedValue({
      data: makeLog({ acao: 'veiculo_liberado', descricao: 'Veículo Liberado' }),
      error: null,
    })
    configureAuditTrail({ create, findAll: vi.fn() } as unknown as IAuditLogRepository)

    const saved = await recordAuditEvent({
      acao: 'veiculo_liberado',
      profile,
      veiculoId: 'veh-1',
    })

    expect(create).toHaveBeenCalledOnce()
    expect(saved?.acao).toBe('veiculo_liberado')
  })
})

describe('fallback local', () => {
  it('persiste eventos no localStorage', () => {
    const memory = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value) },
      removeItem: (key: string) => { memory.delete(key) },
      clear: () => memory.clear(),
      key: () => null,
      get length() { return memory.size },
    })

    persistLocalAuditLog(makeLog({ id: 'local-1' }))
    const stored = readLocalAuditLogs()
    expect(stored).toHaveLength(1)
    expect(stored[0]?.id).toBe('local-1')
    expect(memory.get(AUDIT_LOG_STORAGE_KEY)).toContain('Viagem Criada')

    vi.unstubAllGlobals()
  })
})
