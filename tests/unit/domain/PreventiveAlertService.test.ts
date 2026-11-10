import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PreventiveAlertService } from '@/domain/services/PreventiveAlertService'

describe('PreventiveAlertService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dispara alerta quando faltam 5 dias ou menos para manutenção', () => {
    const alertas = PreventiveAlertService.calcularAlertas([
      {
        veiculoId: 'v1',
        placa: 'ABC1D23',
        proximaManutencaoData: '2026-09-14',
        proximaManutencaoKm: null,
        kmAtual: 10_000,
      },
    ])

    expect(alertas.some(a => a.tipo === 'dias')).toBe(true)
  })

  it('dispara alerta quando faltam X km para manutenção', () => {
    const alertas = PreventiveAlertService.calcularAlertas([
      {
        veiculoId: 'v2',
        placa: 'XYZ9K88',
        proximaManutencaoData: null,
        proximaManutencaoKm: 10_400,
        kmAtual: 10_000,
      },
    ])

    expect(alertas.some(a => a.tipo === 'km')).toBe(true)
  })

  it('dispara alerta crítico quando a preventiva já venceu por dias ou km', () => {
    const alertas = PreventiveAlertService.calcularAlertas([
      {
        veiculoId: 'v3',
        placa: 'DEF2G34',
        proximaManutencaoData: '2026-09-01',
        proximaManutencaoKm: 9_000,
        kmAtual: 10_000,
      },
    ])

    const porDias = alertas.find(a => a.tipo === 'dias')
    const porKm = alertas.find(a => a.tipo === 'km')
    expect(porDias?.atrasada).toBe(true)
    expect(porKm?.atrasada).toBe(true)
    expect(porDias?.mensagem).toMatch(/vencida/i)
  })
})
