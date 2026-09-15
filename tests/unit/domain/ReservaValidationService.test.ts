import { describe, it, expect } from 'vitest'
import { ReservaValidationService } from '@/domain/services/ReservaValidationService'

describe('ReservaValidationService', () => {
  it('bloqueia reserva quando viagem excede limite antes da manutenção', () => {
    const result = ReservaValidationService.validarQuilometragemViagem(
      48_000,
      3_000,
      50_000,
      500,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('Viagem excede o limite antes da próxima manutenção')
    }
  })

  it('permite reserva quando há margem de segurança', () => {
    const result = ReservaValidationService.validarQuilometragemViagem(
      40_000,
      2_000,
      50_000,
      500,
    )

    expect(result.ok).toBe(true)
  })

  it('permite reserva quando não há km de próxima manutenção', () => {
    const result = ReservaValidationService.validarQuilometragemViagem(40_000, 10_000, null)
    expect(result.ok).toBe(true)
  })
})
