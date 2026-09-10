import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GetFinancialReportUseCase } from '@/application/use-cases/GetFinancialReportUseCase'
import { FinancialReportService } from '@/domain/services/FinancialReportService'
import type { IManutencaoRepository } from '@/domain/repositories/IManutencaoRepository'
import { createManutencao } from '../helpers/fixtures'

function createMockRepo(data: ReturnType<typeof createManutencao>[]): IManutencaoRepository {
  return {
    findAll: async () => ({ data: null, error: null }),
    findProximas: async () => ({ data: null, error: null }),
    findWithFinancialValue: async () => ({ data, error: null }),
    create: async () => ({ data: null, error: null }),
    updateStatus: async () => ({ data: null, error: null }),
    update: async () => ({ data: null, error: null }),
  }
}

describe('Relatório financeiro — fallback de 30 dias', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-10T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('FinancialReportService usa últimos 30 dias quando o mês atual está vazio', () => {
    const manutencoes = [
      createManutencao({
        id: 'm1',
        dataHora: '2026-08-20T10:00:00.000Z',
        createdAt: '2026-08-20T10:00:00.000Z',
        valor: 2500,
      }),
    ]

    const { periodo, rows, usedFallback } = FinancialReportService.resolverPeriodoComFallback(manutencoes)

    expect(rows).toHaveLength(1)
    expect(usedFallback).toBe(true)
    expect(periodo.label).toContain('últimos 30 dias')
  })

  it('FinancialReportService mantém o mês atual quando há registros', () => {
    const manutencoes = [
      createManutencao({
        id: 'm2',
        dataHora: '2026-09-05T10:00:00.000Z',
        createdAt: '2026-09-05T10:00:00.000Z',
        valor: 1800,
      }),
    ]

    const { periodo, rows, usedFallback } = FinancialReportService.resolverPeriodoComFallback(manutencoes)

    expect(rows).toHaveLength(1)
    expect(usedFallback).toBe(false)
    expect(periodo.label).toContain('setembro')
  })

  it('GetFinancialReportUseCase propaga fallback via repositório mockado', async () => {
    const manutencoes = [
      createManutencao({
        id: 'm3',
        dataHora: '2026-08-25T08:00:00.000Z',
        createdAt: '2026-08-25T08:00:00.000Z',
        valor: 3200,
      }),
    ]

    const useCase = new GetFinancialReportUseCase(createMockRepo(manutencoes))
    const { data, error } = await useCase.execute()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.usedFallbackPeriod).toBe(true)
    expect(data!.totalGeral).toBeCloseTo(3200)
    expect(data!.periodLabel).toContain('últimos 30 dias')
    expect(data!.recordCount).toBe(1)
  })
})
