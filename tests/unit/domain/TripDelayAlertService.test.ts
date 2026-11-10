import { describe, expect, it } from 'vitest'
import { TripDelayAlertService } from '@/domain/services/TripDelayAlertService'
import { createReserva, createVeiculo } from '../../helpers/fixtures'

const now = new Date('2026-11-09T18:00:00.000Z')

describe('TripDelayAlertService', () => {
  it('alerta quando o retorno previsto passou e o veículo segue em viagem', () => {
    const reserva = createReserva({
      dataViagem: '2026-11-09T08:00:00.000Z',
      kmIdaVolta: 100,
      destino: 'Santos',
    })
    const veiculo = createVeiculo({ status: 'em_viagem' })

    const alertas = TripDelayAlertService.calcularAlertas([reserva], [veiculo], now)

    expect(alertas).toHaveLength(1)
    expect(alertas[0].placa).toBe('ABC-1D23')
    expect(alertas[0].atrasoMinutos).toBeGreaterThan(0)
    expect(alertas[0].mensagem).toMatch(/Santos/)
  })

  it('não alerta se o horário de retorno ainda não passou', () => {
    const reserva = createReserva({
      dataViagem: '2026-11-09T17:00:00.000Z',
      kmIdaVolta: 50,
    })
    const veiculo = createVeiculo({ status: 'em_viagem' })

    expect(TripDelayAlertService.calcularAlertas([reserva], [veiculo], now)).toEqual([])
  })

  it('não alerta se o veículo já não está em viagem', () => {
    const reserva = createReserva({ dataViagem: '2026-11-09T08:00:00.000Z' })
    const veiculo = createVeiculo({ status: 'disponivel' })

    expect(TripDelayAlertService.calcularAlertas([reserva], [veiculo], now)).toEqual([])
  })
})
