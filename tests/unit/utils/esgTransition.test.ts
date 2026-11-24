import { describe, expect, it } from 'vitest'
import { calculateTripEmissions } from '@/utils/esgCalculator'
import {
  CUSTO_KWH_BRL,
  KWH_POR_KM,
  PRECO_LITRO_BRL,
  custoCombustivelReais,
  custoMedioPorKm,
  simulateEnergyTransition,
} from '@/utils/esgTransition'

describe('custoMedioPorKm', () => {
  it('usa preço médio do litro para diesel e gasolina', () => {
    expect(custoMedioPorKm('diesel')).toBeCloseTo(0.25 * PRECO_LITRO_BRL.diesel, 5)
    expect(custoMedioPorKm('gasolina')).toBeCloseTo(0.1 * PRECO_LITRO_BRL.gasolina, 5)
  })

  it('usa kWh para o cenário elétrico', () => {
    expect(custoMedioPorKm('eletrico')).toBeCloseTo(KWH_POR_KM * CUSTO_KWH_BRL, 5)
  })
})

describe('simulateEnergyTransition', () => {
  it('compara combustão atual com 100% elétrico', () => {
    const result = simulateEnergyTransition({
      kmMes: 1000,
      combustivelAtual: 'diesel',
      alvo: 'eletrico',
      percentual: 100,
    })

    expect(result.atual.custoMes).toBe(custoCombustivelReais(1000, 'diesel'))
    expect(result.atual.kgCo2).toBe(calculateTripEmissions(1000, 'diesel').kgCo2)
    expect(result.alternativo.custoMes).toBe(custoCombustivelReais(1000, 'eletrico'))
    expect(result.alternativo.kgCo2).toBe(0)
    expect(result.economiaMes).toBeCloseTo(result.atual.custoMes - result.alternativo.custoMes, 5)
    expect(result.economiaAno).toBeCloseTo(result.economiaMes * 12, 5)
    expect(result.reducaoCo2Pct).toBe(100)
  })

  it('aplica o percentual da rota convertida', () => {
    const result = simulateEnergyTransition({
      kmMes: 800,
      combustivelAtual: 'gasolina',
      alvo: 'etanol',
      percentual: 50,
    })

    const expectedKg = calculateTripEmissions(400, 'gasolina').kgCo2 + calculateTripEmissions(400, 'etanol').kgCo2
    expect(result.kmConvertido).toBe(400)
    expect(result.alternativo.kgCo2).toBeCloseTo(expectedKg, 5)
    expect(result.reducaoCo2Pct).toBeGreaterThan(0)
    expect(result.reducaoCo2Pct).toBeLessThan(100)
  })

  it('não quebra com KM zero ou percentual fora da faixa', () => {
    const empty = simulateEnergyTransition({
      kmMes: 0,
      combustivelAtual: 'diesel',
      alvo: 'eletrico',
      percentual: 40,
    })
    expect(empty.atual.custoMes).toBe(0)
    expect(empty.economiaMes).toBe(0)
    expect(empty.reducaoCo2Pct).toBe(0)

    const clamped = simulateEnergyTransition({
      kmMes: 100,
      combustivelAtual: 'diesel',
      alvo: 'eletrico',
      percentual: 140,
    })
    expect(clamped.percentual).toBe(100)
    expect(clamped.kmConvertido).toBe(100)
  })
})
