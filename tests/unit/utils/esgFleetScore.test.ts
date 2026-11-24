import { describe, expect, it } from 'vitest'
import { calculateEsgFleetScore, classifyEsgScore, isPreventivaEmDia } from '@/utils/esgFleetScore'

const now = new Date('2026-11-24T12:00:00.000Z')

describe('isPreventivaEmDia', () => {
  it('considera em dia quando a próxima data e o KM ainda não venceram', () => {
    expect(isPreventivaEmDia({
      id: 'v1',
      kmAtual: 80_000,
      proximaManutencaoData: '2026-12-10',
      proximaManutencaoKm: 85_000,
    }, now)).toBe(true)
  })

  it('marca como atrasado se o KM da preventiva já passou', () => {
    expect(isPreventivaEmDia({
      id: 'v1',
      kmAtual: 90_000,
      proximaManutencaoData: '2026-12-10',
      proximaManutencaoKm: 85_000,
    }, now)).toBe(false)
  })

  it('não conta veículo sem agenda de preventiva', () => {
    expect(isPreventivaEmDia({
      id: 'v1',
      kmAtual: 10_000,
      proximaManutencaoData: null,
      proximaManutencaoKm: null,
    }, now)).toBe(false)
  })
})

describe('calculateEsgFleetScore', () => {
  it('sobe a nota com preventiva em dia, mix preventivo e baixa emissão', () => {
    const score = calculateEsgFleetScore({
      now,
      veiculos: [
        { id: 'v1', kmAtual: 40_000 },
        { id: 'v2', kmAtual: 12_000 },
      ],
      manutencoes: [
        {
          veiculoId: 'v1',
          tipo: 'preventiva',
          status: 'concluida',
          dataHora: '2026-11-01',
          proximaManutencaoData: '2027-01-10',
          proximaManutencaoKm: 50_000,
        },
        {
          veiculoId: 'v2',
          tipo: 'preventiva',
          status: 'concluida',
          dataHora: '2026-11-02',
          proximaManutencaoData: '2027-02-01',
          proximaManutencaoKm: 20_000,
        },
      ],
      trips: [
        { km: 100, combustivel: 'eletrico' },
        { km: 20, combustivel: 'etanol' },
      ],
    })

    expect(score.veiculosEmDia).toBe(2)
    expect(score.preventivaEmDiaPct).toBe(100)
    expect(score.preventivaVsCorretivaPct).toBe(100)
    expect(score.nota).toBeGreaterThanOrEqual(80)
    expect(score.classificacao).toBe('Excelente — Operação Sustentável')
    expect(score.tom).toBe('excelente')
  })

  it('cai para crítico com preventiva atrasada, corretivas e diesel pesado', () => {
    const score = calculateEsgFleetScore({
      now,
      veiculos: [
        { id: 'v1', kmAtual: 90_000 },
        { id: 'v2', kmAtual: 70_000 },
      ],
      manutencoes: [
        {
          veiculoId: 'v1',
          tipo: 'corretiva',
          status: 'concluida',
          dataHora: '2026-10-01',
          proximaManutencaoData: '2026-10-15',
          proximaManutencaoKm: 80_000,
        },
        {
          veiculoId: 'v2',
          tipo: 'corretiva',
          status: 'concluida',
          dataHora: '2026-09-01',
          proximaManutencaoData: '2026-09-20',
          proximaManutencaoKm: 60_000,
        },
      ],
      trips: [
        { km: 400, combustivel: 'diesel' },
        { km: 400, combustivel: 'diesel' },
      ],
    })

    expect(score.veiculosEmDia).toBe(0)
    expect(score.preventivaVsCorretivaPct).toBe(0)
    expect(score.nota).toBeLessThan(50)
    expect(score.classificacao).toBe('Crítico — Alto Passivo')
  })

  it('fica neutro quando não há frota nem OS', () => {
    const score = calculateEsgFleetScore({
      veiculos: [],
      manutencoes: [],
      trips: [],
    })
    expect(score.nota).toBe(50)
    expect(score.classificacao).toBe('Atenção — Oportunidade de Otimização')
  })
})

describe('classifyEsgScore', () => {
  it('usa as faixas 80 e 50', () => {
    expect(classifyEsgScore(80).classificacao).toBe('Excelente — Operação Sustentável')
    expect(classifyEsgScore(50).classificacao).toBe('Atenção — Oportunidade de Otimização')
    expect(classifyEsgScore(49.9).classificacao).toBe('Crítico — Alto Passivo')
  })
})
