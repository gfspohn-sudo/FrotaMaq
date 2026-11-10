import { describe, expect, it } from 'vitest'
import {
  MOCK_VEICULOS,
  generateMockManutencoes,
  generateMockReservas,
  estimateMockCount,
  estimateMockReservaCount,
} from '@/lib/mockFleetData'

const PLACA_PATTERN = /^[A-Z]{3}-[A-Z0-9]{4}$/

describe('mockFleetData', () => {
  it('inclui todos os status e placas no formato completo', () => {
    const statuses = new Set(MOCK_VEICULOS.map(v => v.status))
    expect(statuses).toEqual(new Set(['disponivel', 'em_viagem', 'em_manutencao', 'parado']))
    expect(MOCK_VEICULOS.every(v => PLACA_PATTERN.test(v.placa))).toBe(true)
    expect(MOCK_VEICULOS.some(v => v.km_atual === 45000)).toBe(true)
    expect(MOCK_VEICULOS.some(v => v.km_atual === 82000)).toBe(true)
    expect(MOCK_VEICULOS.some(v => v.km_atual === 120000)).toBe(true)
  })

  it('gera manutenções com os campos do schema atual para alguns veículos', () => {
    const records = MOCK_VEICULOS.flatMap((v, i) =>
      generateMockManutencoes('veh-1', v.km_atual, i, 'emp-1', v.status),
    )

    expect(records.length).toBe(estimateMockCount())
    expect(records.length).toBeGreaterThan(0)
    expect(records.every(m => m.empresa_id === 'emp-1')).toBe(true)
    expect(records.some(m => m.tipo === 'preventiva')).toBe(true)
    expect(records.some(m => m.tipo === 'corretiva')).toBe(true)
    expect(records.every(m => m.valor_pecas === 350)).toBe(true)
    expect(records.every(m => m.valor_mao_de_obra === 200)).toBe(true)
    expect(records.every(m => (m.observacao ?? '').length > 0)).toBe(true)
    expect(records.every(m => (m.pecas_trocadas ?? []).length > 0)).toBe(true)
    expect(records.every(m => m.data_proxima_manutencao)).toBe(true)
    expect(records.every(m => (m.proxima_manutencao_km ?? 0) > 0)).toBe(true)
  })

  it('gera reservas/viagens com motorista, KM e recusa justificada', () => {
    const records = MOCK_VEICULOS.flatMap((v, i) =>
      generateMockReservas({
        veiculoId: 'veh-1',
        kmAtual: v.km_atual,
        vehicleIndex: i,
        empresaId: 'emp-1',
        motoristaId: 'mot-1',
        status: v.status,
      }),
    )

    expect(records.length).toBe(estimateMockReservaCount())
    expect(records.every(r => r.empresa_id === 'emp-1' && r.motorista_id === 'mot-1')).toBe(true)
    expect(records.some(r => r.status === 'APROVADO')).toBe(true)
    expect(records.some(r => r.status === 'CONCLUIDA' && r.km_final != null && r.km_inicial != null)).toBe(true)

    const recusadas = records.filter(r => r.status === 'REJEITADO')
    expect(recusadas.length).toBeGreaterThan(0)
    expect(recusadas.every(r => (r.motivo_recusa ?? '').trim().length > 0)).toBe(true)
  })
})
