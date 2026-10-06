import { describe, it, expect, vi } from 'vitest'
import { AtualizarStatusReservaUseCase } from '@/application/use-cases/ReservaUseCases'
import { Reserva } from '@/domain/entities/Reserva'

const gestor = {
  id: 'gestor-1',
  nome: 'Gestor',
  email: 'g@test.com',
  perfil: 'gestor' as const,
  empresa_id: 'emp-1',
  created_at: '2026-01-01T00:00:00.000Z',
}

function pendente() {
  return new Reserva({
    id: 'r1',
    empresaId: 'emp-1',
    veiculoId: 'veh-1',
    motoristaId: 'mot-1',
    dataViagem: '2026-10-01T10:00:00.000Z',
    destino: 'Campinas',
    kmIdaVolta: 120,
    status: 'PENDENTE',
    observacaoGestor: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  })
}

describe('AtualizarStatusReservaUseCase', () => {
  it('aprova sem exigir justificativa e coloca o veículo em viagem', async () => {
    const reserva = pendente()
    const updateStatus = vi.fn().mockResolvedValue({ data: reserva.withStatus('APROVADO'), error: null })
    const updateVeiculo = vi.fn().mockResolvedValue({ data: null, error: null })

    const useCase = new AtualizarStatusReservaUseCase(
      {
        findById: vi.fn().mockResolvedValue({ data: reserva, error: null }),
        updateStatus,
      } as never,
      { update: updateVeiculo } as never,
    )

    const result = await useCase.execute(gestor, 'r1', 'APROVADO')

    expect(result.error).toBeNull()
    expect(updateStatus).toHaveBeenCalledWith('r1', 'APROVADO', null, 'emp-1', null)
    expect(updateVeiculo).toHaveBeenCalledWith('veh-1', { status: 'em_viagem' }, 'emp-1')
  })

  it('recusa reserva sem motivo', async () => {
    const updateStatus = vi.fn()
    const useCase = new AtualizarStatusReservaUseCase(
      {
        findById: vi.fn().mockResolvedValue({ data: pendente(), error: null }),
        updateStatus,
      } as never,
    )

    const result = await useCase.execute(gestor, 'r1', 'REJEITADO', '   ')

    expect(result.error).toBeInstanceOf(Error)
    expect((result.error as Error).message).toContain('motivo da recusa')
    expect(updateStatus).not.toHaveBeenCalled()
  })

  it('salva o motivo e libera o veículo ao recusar', async () => {
    const reserva = pendente()
    const recusada = reserva.recusar('Agenda indisponível')
    const updateStatus = vi.fn().mockResolvedValue({ data: recusada, error: null })
    const updateVeiculo = vi.fn().mockResolvedValue({ data: null, error: null })

    const useCase = new AtualizarStatusReservaUseCase(
      {
        findById: vi.fn().mockResolvedValue({ data: reserva, error: null }),
        updateStatus,
      } as never,
      { update: updateVeiculo } as never,
    )

    const result = await useCase.execute(gestor, 'r1', 'REJEITADO', 'Agenda indisponível')

    expect(result.error).toBeNull()
    expect(updateStatus).toHaveBeenCalledWith(
      'r1',
      'REJEITADO',
      'Agenda indisponível',
      'emp-1',
      'Agenda indisponível',
    )
    expect(updateVeiculo).toHaveBeenCalledWith('veh-1', { status: 'disponivel' }, 'emp-1')
  })
})
