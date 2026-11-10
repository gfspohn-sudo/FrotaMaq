import { describe, expect, it } from 'vitest'
import {
  ARVORES_POR_TONELADA_CO2,
  FATORES_EMISSAO_KG_POR_LITRO,
  calculateFleetEmissions,
  calculateTripEmissions,
  parseKmInput,
  resolveVehicleFuelType,
} from '@/utils/esgCalculator'

describe('calculateTripEmissions', () => {
  it('estima CO2 a partir da distância OSM e do combustível diesel', () => {
    const estimate = calculateTripEmissions(100, 'diesel')
    expect(estimate.litros).toBe(25)
    expect(estimate.kgCo2).toBe(67)
    expect(estimate.zeroEmissao).toBe(false)
    expect(estimate.arvores).toBe(0.47)
    expect(ARVORES_POR_TONELADA_CO2).toBe(7)
    expect(estimate.label).toMatch(/CO₂/)
  })

  it('mostra 0 kg CO2 para veículo elétrico', () => {
    const estimate = calculateTripEmissions(320, 'eletrico')
    expect(estimate.kgCo2).toBe(0)
    expect(estimate.litros).toBe(0)
    expect(estimate.zeroEmissao).toBe(true)
    expect(estimate.label).toBe('0 kg CO2 (Veículo Zero Emissão)')
  })

  it('usa fatores diferentes para gasolina e etanol', () => {
    const gasolina = calculateTripEmissions(80, 'gasolina')
    const etanol = calculateTripEmissions(80, 'etanol')
    expect(gasolina.kgCo2).toBeGreaterThan(0)
    expect(etanol.kgCo2).toBeGreaterThan(0)
    expect(gasolina.kgCo2).not.toBe(etanol.kgCo2)
    expect(gasolina.kgCo2).toBeCloseTo(80 * 0.1 * FATORES_EMISSAO_KG_POR_LITRO.gasolina, 5)
  })

  it('atualiza a emissão quando a quilometragem muda', () => {
    const curta = calculateTripEmissions(40, 'diesel')
    const longa = calculateTripEmissions(80, 'diesel')
    expect(longa.kgCo2).toBe(curta.kgCo2 * 2)
  })
})

describe('resolveVehicleFuelType', () => {
  it('respeita o combustível registrado no veículo', () => {
    expect(resolveVehicleFuelType({ tipo_combustivel: 'eletrico', modelo: 'FH 540' })).toBe('eletrico')
  })

  it('infere elétrico pelo modelo', () => {
    expect(resolveVehicleFuelType({ marca: 'BYD', modelo: 'Dolphin Mini' })).toBe('eletrico')
  })

  it('assume diesel para caminhão da frota', () => {
    expect(resolveVehicleFuelType({ marca: 'Volvo', modelo: 'FH 540' })).toBe('diesel')
  })

  it('não quebra quando o combustível do veículo é nulo', () => {
    expect(resolveVehicleFuelType({ tipo_combustivel: null, modelo: 'FH 540' })).toBe('diesel')
    const estimate = calculateTripEmissions(100, null)
    expect(estimate.combustivel).toBe('diesel')
    expect(Number.isNaN(estimate.kgCo2)).toBe(false)
    expect(estimate.kgCo2).toBeGreaterThan(0)
  })
})

describe('parseKmInput', () => {
  it('converte string de km para número, inclusive com vírgula', () => {
    expect(parseKmInput('240')).toBe(240)
    expect(parseKmInput('240,5')).toBe(240.5)
    expect(parseKmInput('  80 ')).toBe(80)
    expect(parseKmInput('')).toBe(0)
    expect(parseKmInput('abc')).toBe(0)
  })
})

describe('calculateFleetEmissions', () => {
  it('soma o CO2 do mês e calcula árvores de compensação', () => {
    const summary = calculateFleetEmissions([
      { km: 100, combustivel: 'diesel' },
      { km: 50, combustivel: 'eletrico' },
    ])
    expect(summary.viagens).toBe(2)
    expect(summary.zeroEmissao).toBe(1)
    expect(summary.kgCo2).toBe(67)
    expect(summary.compensacao).toMatch(/árvore/)
    expect(summary.compensacao).toMatch(/este mês/)
  })
})
