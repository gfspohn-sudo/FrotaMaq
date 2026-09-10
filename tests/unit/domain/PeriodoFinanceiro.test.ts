import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'

describe('PeriodoFinanceiro', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('monta o período do mês atual', () => {
    const periodo = PeriodoFinanceiro.mesAtual()

    expect(periodo.startDate).toBe('2026-09-01')
    expect(periodo.endDate).toBe('2026-09-30')
    expect(periodo.label).toContain('setembro')
  })

  it('monta o período dos últimos 30 dias', () => {
    const periodo = PeriodoFinanceiro.ultimos30Dias()

    expect(periodo.label).toContain('últimos 30 dias')

    const start = new Date(periodo.startDateTime).getTime()
    const end = new Date(periodo.endDateTime).getTime()
    const spanDays = Math.round((end - start) / (1000 * 60 * 60 * 24))
    expect(spanDays).toBe(30)
  })

  it('filtra timestamps dentro do intervalo', () => {
    const periodo = PeriodoFinanceiro.mesAtual()

    expect(periodo.contemTimestamp('2026-09-05T10:00:00.000Z')).toBe(true)
    expect(periodo.contemTimestamp('2026-08-31T23:59:59.000Z')).toBe(false)
    expect(periodo.contemTimestamp(undefined)).toBe(false)
  })
})
