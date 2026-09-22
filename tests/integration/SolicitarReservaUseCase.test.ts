import { describe, it, expect, vi } from 'vitest'
import { SolicitarReservaUseCase } from '@/application/use-cases/ReservaUseCases'
import { createVeiculo } from '../helpers/fixtures'

const profile = {
  id: 'motorista-1',
  nome: 'Motorista',
  email: 'm@test.com',
  perfil: 'motorista' as const,
  empresa_id: 'emp-1',
  created_at: '2026-01-01T00:00:00.000Z',
}

describe('SolicitarReservaUseCase', () => {
  it('recusa reserva de veículo em manutenção', async () => {
    const veiculoEmManutencao = createVeiculo({
      id: 'veh-1',
      empresaId: 'emp-1',
      status: 'em_manutencao',
    })

    const reservaRepo = {
      create: vi.fn(),
    }
    const veiculoRepo = {
      findById: vi.fn().mockResolvedValue({ data: veiculoEmManutencao, error: null }),
    }

    const useCase = new SolicitarReservaUseCase(
      reservaRepo as never,
      veiculoRepo as never,
    )

    const result = await useCase.execute(profile, {
      veiculo_id: 'veh-1',
      data_viagem: '2026-10-01T10:00:00.000Z',
      destino: 'São Paulo',
      km_ida_volta: 200,
    })

    expect(result.data).toBeNull()
    expect(result.error).toBeInstanceOf(Error)
    expect((result.error as Error).message).toContain('indisponível')
    expect(reservaRepo.create).not.toHaveBeenCalled()
  })

  it('permite reserva de veículo em operação', async () => {
    const veiculoOk = createVeiculo({
      id: 'veh-2',
      empresaId: 'emp-1',
      status: 'em_operacao',
    })

    const reservaRepo = {
      create: vi.fn().mockResolvedValue({
        data: { toDTO: () => ({ id: 'res-1' }) },
        error: null,
      }),
    }
    const veiculoRepo = {
      findById: vi.fn().mockResolvedValue({ data: veiculoOk, error: null }),
    }

    const useCase = new SolicitarReservaUseCase(
      reservaRepo as never,
      veiculoRepo as never,
    )

    const result = await useCase.execute(profile, {
      veiculo_id: 'veh-2',
      data_viagem: '2026-10-01T10:00:00.000Z',
      destino: 'São Paulo',
      km_ida_volta: 200,
    })

    expect(result.error).toBeNull()
    expect(reservaRepo.create).toHaveBeenCalledOnce()
  })
})
