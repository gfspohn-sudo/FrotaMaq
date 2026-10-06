import { describe, it, expect } from 'vitest'
import { Reserva } from '@/domain/entities/Reserva'

function createReserva() {
  return new Reserva({
    id: 'r1',
    empresaId: 'emp-1',
    veiculoId: 'veh-1',
    motoristaId: 'mot-1',
    dataViagem: '2026-10-01T10:00:00.000Z',
    destino: 'Campinas',
    kmIdaVolta: 120,
    kmInicial: 1000,
    status: 'APROVADO',
    observacaoGestor: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  })
}

describe('Reserva.finalizar', () => {
  it('calcula a distância e marca CONCLUIDA', () => {
    const reserva = createReserva().finalizar(1120)

    expect(reserva.status).toBe('CONCLUIDA')
    expect(reserva.kmPercorrido).toBe(120)
    expect(reserva.kmFinal).toBe(1120)
  })

  it('rejeita km final menor que o inicial', () => {
    expect(() => createReserva().finalizar(900)).toThrow(/não pode ser menor/)
  })
})
