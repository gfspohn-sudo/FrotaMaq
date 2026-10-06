import { describe, it, expect } from 'vitest'
import { FleetPriorityAlertService } from '@/domain/services/FleetPriorityAlertService'
import { FleetSummaryService } from '@/domain/services/MaintenanceDashboardService'
import { createManutencao, createVeiculo } from '../../helpers/fixtures'

describe('FleetPriorityAlertService', () => {
  it('marca manutenção atrasada como CRÍTICA', () => {
    const veiculo = createVeiculo({ kmAtual: 12000 })
    const manutencao = createManutencao({
      proximaManutencaoData: '2020-01-01T00:00:00.000Z',
      proximaManutencaoKm: 5000,
    })

    const alerts = FleetPriorityAlertService.montar([veiculo], [manutencao], new Date('2026-10-06'))

    expect(alerts[0].prioridade).toBe('CRITICA')
    expect(alerts[0].atrasada).toBe(true)
  })

  it('gera alerta MÉDIA antes do vencimento por antecedência de km', () => {
    const veiculo = createVeiculo({ kmAtual: 9600 })
    const manutencao = createManutencao({
      proximaManutencaoKm: 10000,
      proximaManutencaoData: '2027-01-01T00:00:00.000Z',
    })

    const alerts = FleetPriorityAlertService.montar([veiculo], [manutencao], new Date('2026-10-06'))

    expect(alerts[0].prioridade).toBe('MEDIA')
    expect(alerts[0].atrasada).toBe(false)
  })
})

describe('FleetSummaryService', () => {
  it('conta KPIs pelos novos status da frota', () => {
    const summary = FleetSummaryService.calcular([
      createVeiculo({ id: '1', status: 'disponivel' }),
      createVeiculo({ id: '2', status: 'em_viagem' }),
      createVeiculo({ id: '3', status: 'em_manutencao' }),
      createVeiculo({ id: '4', status: 'parado' }),
    ], 2)

    expect(summary.total).toBe(4)
    expect(summary.disponiveis).toBe(1)
    expect(summary.emViagem).toBe(1)
    expect(summary.emManutencao).toBe(1)
    expect(summary.parados).toBe(1)
    expect(summary.comAlerta).toBe(2)
    expect(summary.ativos).toBe(1)
  })
})
