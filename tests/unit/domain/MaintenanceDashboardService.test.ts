import { describe, it, expect } from 'vitest'
import { MaintenanceDashboardService } from '@/domain/services/MaintenanceDashboardService'
import { VeiculoMapper } from '@/infrastructure/mappers/VeiculoMapper'
import { createManutencao, createVeiculo } from '../../helpers/fixtures'

describe('VeiculoMapper.normalizeStatusFromDb', () => {
  it.each([
    ['EM_MANUTENCAO', 'em_manutencao'],
    ['em_manutencao', 'em_manutencao'],
    ['MANUTENCAO', 'em_manutencao'],
    ['Em manutenção', 'em_manutencao'],
    ['ATIVO', 'em_operacao'],
    ['INATIVO', 'fora_de_operacao'],
  ])('normaliza %s para %s', (input, expected) => {
    expect(VeiculoMapper.normalizeStatusFromDb(input)).toBe(expected)
  })
})

describe('MaintenanceDashboardService', () => {
  it('lista veículos em manutenção pelo status do veículo', () => {
    const veiculos = [
      createVeiculo({ id: 'veh-1', status: 'em_manutencao', placa: 'TST-001' }),
      createVeiculo({ id: 'veh-2', status: 'em_operacao', placa: 'TST-002' }),
    ]
    const manutencoes = [
      createManutencao({ veiculoId: 'veh-1', status: 'concluida' }),
    ]

    const result = MaintenanceDashboardService.montar(manutencoes, veiculos)

    expect(result.emManutencao).toHaveLength(1)
    expect(result.emManutencao[0].veiculo_id).toBe('veh-1')
  })

  it('inclui veículo com OS em andamento mesmo sem status em_manutencao', () => {
    const veiculos = [
      createVeiculo({ id: 'veh-1', status: 'em_operacao', placa: 'TST-001' }),
    ]
    const manutencoes = [
      createManutencao({ veiculoId: 'veh-1', status: 'em_andamento' }),
    ]

    const result = MaintenanceDashboardService.montar(manutencoes, veiculos)

    expect(result.emManutencao).toHaveLength(1)
  })

  it('marca manutenções pendentes vencidas', () => {
    const manutencoes = [
      createManutencao({
        status: 'pendente',
        dataHora: '2020-01-01T10:00:00.000Z',
      }),
    ]

    const result = MaintenanceDashboardService.montar(manutencoes, [])

    expect(result.vencidas).toHaveLength(1)
  })

  it('prioriza manutenção aberta do veículo em manutenção', () => {
    const veiculos = [createVeiculo({ id: 'veh-1', status: 'em_manutencao' })]
    const manutencoes = [
      createManutencao({
        id: 'mnt-old',
        veiculoId: 'veh-1',
        status: 'concluida',
        dataHora: '2026-01-01T10:00:00.000Z',
      }),
      createManutencao({
        id: 'mnt-open',
        veiculoId: 'veh-1',
        status: 'pendente',
        dataHora: '2026-09-20T10:00:00.000Z',
      }),
    ]

    const result = MaintenanceDashboardService.montar(manutencoes, veiculos)

    expect(result.emManutencao[0].id).toBe('mnt-open')
  })
})
