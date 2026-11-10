import { describe, expect, it } from 'vitest'
import { createExecutivePdf } from '@/lib/pdfExecutiveReport'

describe('createExecutivePdf', () => {
  it('gera PDF com pelo menos uma página e conteúdo binário', () => {
    const doc = createExecutivePdf(
      {
        title: 'Relatório Geral da Frota',
        periodLabel: 'Período: 01/11/2026 a 30/11/2026',
        emittedAt: new Date('2026-11-04T12:00:00.000Z'),
        userName: 'Gabriel',
        userRole: 'Gestor',
        tenantName: 'Frota Demo',
      },
      {
        orientation: 'landscape',
        headers: ['Placa', 'Status', 'Saúde'],
        rows: [
          ['ABC-1D23', 'Disponível', 'Em dia'],
          ['XYZ-9876', 'Em viagem', 'Atenção'],
        ],
        kpis: [
          { label: 'Veículos', value: '2', tone: 'navy' },
          { label: 'Disponíveis', value: '1', tone: 'success' },
        ],
      },
    )

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    const bytes = doc.output('arraybuffer')
    expect(bytes.byteLength).toBeGreaterThan(500)
  })

  it('mantém página e rodapé mesmo sem linhas', () => {
    const doc = createExecutivePdf(
      {
        title: 'Relatório ESG e Emissões',
        periodLabel: 'Período: 01/11/2026 a 30/11/2026',
        emittedAt: new Date('2026-11-04T12:00:00.000Z'),
        userName: 'Gabriel',
        userRole: 'Gestor',
        tenantName: 'Frota Demo',
      },
      {
        headers: ['Combustível', 'KM'],
        rows: [],
        emptyMessage: 'Nenhuma viagem no período.',
      },
    )

    expect(doc.getNumberOfPages()).toBe(1)
  })
})
