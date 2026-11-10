import { describe, expect, it } from 'vitest'
import { parseVehicleStatusParam } from '@/lib/vehicleDisplay'

describe('parseVehicleStatusParam', () => {
  it('aceita status válidos da frota', () => {
    expect(parseVehicleStatusParam('disponivel')).toBe('disponivel')
    expect(parseVehicleStatusParam('em_viagem')).toBe('em_viagem')
    expect(parseVehicleStatusParam('em_manutencao')).toBe('em_manutencao')
    expect(parseVehicleStatusParam('parado')).toBe('parado')
  })

  it('ignora valores inválidos', () => {
    expect(parseVehicleStatusParam(null)).toBe('')
    expect(parseVehicleStatusParam('APROVADO')).toBe('')
    expect(parseVehicleStatusParam('xyz')).toBe('')
  })
})
