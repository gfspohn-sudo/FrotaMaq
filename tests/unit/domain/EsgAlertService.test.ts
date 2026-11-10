import { describe, expect, it } from 'vitest'
import { EsgAlertService } from '@/domain/services/EsgAlertService'

describe('EsgAlertService', () => {
  it('não dispara abaixo do primeiro marco', () => {
    expect(EsgAlertService.calcularAlerta(49, 0.3)).toBeNull()
  })

  it('dispara o maior marco atingido', () => {
    const alerta = EsgAlertService.calcularAlerta(120, 0.84)
    expect(alerta?.marcoKg).toBe(100)
    expect(alerta?.mensagem).toMatch(/compensar/i)
  })

  it('usa o marco de 1 t quando a frota cruza 1000 kg', () => {
    const alerta = EsgAlertService.calcularAlerta(1100, 7.7)
    expect(alerta?.marcoKg).toBe(1000)
    expect(alerta?.mensagem).toMatch(/1 t/)
  })
})
