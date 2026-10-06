import { describe, it, expect } from 'vitest'
import { NextMaintenanceScheduleService } from '@/domain/services/NextMaintenanceScheduleService'

describe('NextMaintenanceScheduleService', () => {
  it('usa intervalo do veículo quando informado', () => {
    const result = NextMaintenanceScheduleService.calcular({
      tipo: 'preventiva',
      kmAtual: 10000,
      dataManutencao: '2026-01-01T00:00:00.000Z',
      intervaloKm: 8000,
      intervaloDias: 120,
    })

    expect(result.proximaManutencaoKm).toBe(18000)
    expect(result.intervaloKm).toBe(8000)
    expect(result.intervaloDias).toBe(120)
  })

  it('aplica intervalo menor para corretiva quando o veículo não tem regra própria', () => {
    const preventiva = NextMaintenanceScheduleService.calcular({
      tipo: 'preventiva',
      kmAtual: 0,
      dataManutencao: '2026-01-01T00:00:00.000Z',
    })
    const corretiva = NextMaintenanceScheduleService.calcular({
      tipo: 'corretiva',
      kmAtual: 0,
      dataManutencao: '2026-01-01T00:00:00.000Z',
    })

    expect(corretiva.intervaloKm).toBeLessThan(preventiva.intervaloKm)
    expect(corretiva.intervaloDias).toBeLessThan(preventiva.intervaloDias)
  })
})
