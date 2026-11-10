import { describe, expect, it, vi } from 'vitest'
import { GetNotificationsUseCase } from '@/application/use-cases/GetNotificationsUseCase'
import { createManutencao, createReserva, createVeiculo } from '../../helpers/fixtures'
import type { Usuario } from '@/types/database'

function profile(perfil: Usuario['perfil'], id = 'user-1'): Usuario {
  return {
    id,
    email: `${perfil}@test.com`,
    nome: perfil,
    perfil,
    empresa_id: 'emp-1',
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

function repos(overrides?: {
  veiculos?: ReturnType<typeof createVeiculo>[]
  reservas?: ReturnType<typeof createReserva>[]
  manutencoes?: ReturnType<typeof createManutencao>[]
}) {
  return {
    alerta: { findActive: vi.fn().mockResolvedValue({ data: [] }) },
    reserva: {
      findAll: vi.fn().mockResolvedValue({ data: overrides?.reservas ?? [] }),
      findVeiculosEscopoMotorista: vi.fn().mockResolvedValue({ data: ['veh-1'] }),
    },
    manutencao: { findAll: vi.fn().mockResolvedValue({ data: overrides?.manutencoes ?? [] }) },
    veiculo: { findAll: vi.fn().mockResolvedValue({ data: overrides?.veiculos ?? [] }) },
  }
}

function useCase(r: ReturnType<typeof repos>) {
  return new GetNotificationsUseCase(r.alerta as never, r.reserva as never, r.manutencao as never, r.veiculo as never)
}

const now = new Date('2026-11-09T18:00:00.000Z')

describe('GetNotificationsUseCase', () => {
  it('gera alerta de manutenção vencida quando a preventiva passou do prazo', async () => {
    const r = repos({
      veiculos: [createVeiculo({ kmAtual: 12_000 })],
      manutencoes: [createManutencao({
        proximaManutencaoData: '2026-10-01',
        proximaManutencaoKm: 10_000,
      })],
    })

    const result = await useCase(r).execute(profile('gestor'), 'emp-1', now)
    const preventiva = result.data.filter(item => item.tipo === 'preventiva')

    expect(preventiva.length).toBeGreaterThan(0)
    expect(preventiva.some(item => item.titulo === 'Manutenção vencida')).toBe(true)
    expect(preventiva.some(item => item.severidade === 'critica')).toBe(true)
  })

  it('gera alerta de viagem em atraso', async () => {
    const r = repos({
      veiculos: [createVeiculo({ status: 'em_viagem' })],
      reservas: [createReserva({
        dataViagem: '2026-11-09T08:00:00.000Z',
        kmIdaVolta: 80,
        destino: 'Jundiaí',
      })],
    })

    const result = await useCase(r).execute(profile('gestor'), 'emp-1', now)
    const atraso = result.data.find(item => item.tipo === 'viagem_atraso')

    expect(atraso).toBeTruthy()
    expect(atraso?.titulo).toBe('Viagem em atraso')
    expect(atraso?.severidade).toBe('critica')
    expect(atraso?.mensagem).toMatch(/Jundiaí/)
  })

  it('gera alerta ESG quando a frota cruza um marco de emissão no mês', async () => {
    const r = repos({
      veiculos: [createVeiculo({ marca: 'Volvo', modelo: 'FH 540' })],
      reservas: [createReserva({
        status: 'CONCLUIDA',
        dataViagem: '2026-11-02T08:00:00.000Z',
        kmIdaVolta: 200,
        kmPercorrido: 200,
      })],
    })

    const result = await useCase(r).execute(profile('gestor'), 'emp-1', now)
    const esg = result.data.find(item => item.tipo === 'esg')

    expect(esg).toBeTruthy()
    expect(esg?.titulo).toBe('Alerta ESG')
    expect(esg?.mensagem).toMatch(/compensar/i)
  })

  it('não envia preventiva nem ESG para motorista', async () => {
    const r = repos({
      veiculos: [createVeiculo({ kmAtual: 12_000, status: 'em_viagem' })],
      reservas: [createReserva({
        motoristaId: 'mot-1',
        dataViagem: '2026-11-09T08:00:00.000Z',
        kmPercorrido: 200,
      })],
      manutencoes: [createManutencao({ proximaManutencaoData: '2026-10-01' })],
    })

    const result = await useCase(r).execute(profile('motorista', 'mot-1'), 'emp-1', now)

    expect(result.data.some(item => item.tipo === 'preventiva')).toBe(false)
    expect(result.data.some(item => item.tipo === 'esg')).toBe(false)
    expect(result.data.some(item => item.tipo === 'viagem_atraso')).toBe(true)
    expect(r.manutencao.findAll).not.toHaveBeenCalled()
  })
})
