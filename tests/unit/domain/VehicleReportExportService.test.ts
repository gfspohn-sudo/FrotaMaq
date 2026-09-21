import { describe, it, expect } from 'vitest'
import { VehicleReportExportService } from '@/domain/services/VehicleReportExportService'

describe('VehicleReportExportService', () => {
  it('gera CSV com cabeçalho e linhas estruturadas', () => {
    const csv = VehicleReportExportService.gerarCsv([
      {
        modelo: 'Sprinter',
        placa: 'ABC-1234',
        dataManutencao: '15/09/2026',
        tipo: 'Preventiva',
        descricao: 'Troca de óleo',
        pecasServicos: 'Óleo 5W30, filtro',
        local: 'Oficina Central',
        responsavel: 'João',
        custo: 450.5,
        status: 'Concluída',
      },
    ])

    expect(csv.startsWith('\uFEFFModelo;Placa;')).toBe(true)
    expect(csv).toContain('Sprinter')
    expect(csv).toContain('ABC-1234')
    expect(csv).toContain('450,50')
    expect(csv).toContain('Troca de óleo')
  })

  it('gera nome de arquivo seguro a partir da placa', () => {
    const name = VehicleReportExportService.nomeArquivo('ABC-1234', 'csv')
    expect(name).toMatch(/^relatorio_ABC-1234_\d{4}-\d{2}-\d{2}\.csv$/)
  })
})
