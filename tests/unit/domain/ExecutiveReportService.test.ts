import { describe, expect, it } from 'vitest'
import { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'
import {
  ExecutiveReportService,
  type ExecutiveReportMeta,
} from '@/domain/services/ExecutiveReportService'
import type { Manutencao, Reserva, Veiculo } from '@/types/database'

const NOW = new Date('2026-11-04T12:00:00.000Z')

function makeVeiculo(overrides: Partial<Veiculo> = {}): Veiculo {
  return {
    id: 'veh-1',
    empresa_id: 'emp-1',
    nome_exibicao: 'Volvo FH 540',
    placa: 'ABC-1D23',
    marca: 'Volvo',
    modelo: 'FH 540',
    ano: 2024,
    ano_modelo: 2024,
    quilometragem_atual: 12_000,
    km_atual: 12_000,
    intervalo_manutencao_km: 10_000,
    intervalo_manutencao_dias: 180,
    status: 'disponivel',
    tipo_combustivel: 'diesel',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeReserva(overrides: Partial<Reserva> = {}): Reserva {
  return {
    id: 'res-1',
    empresa_id: 'emp-1',
    veiculo_id: 'veh-1',
    motorista_id: 'usr-1',
    data_viagem: '2026-11-02T08:00:00.000Z',
    destino: 'Campinas',
    km_ida_volta: 200,
    status: 'CONCLUIDA',
    observacao_gestor: null,
    created_at: '2026-11-02T08:00:00.000Z',
    updated_at: '2026-11-02T18:00:00.000Z',
    ...overrides,
  }
}

function makeManutencao(overrides: Partial<Manutencao> = {}): Manutencao {
  return {
    id: 'mnt-1',
    empresa_id: 'emp-1',
    veiculo_id: 'veh-1',
    descricao: 'Troca de óleo',
    valor_total: 800,
    data_manutencao: '2026-11-03T10:00:00.000Z',
    data_proxima_manutencao: '2026-12-03T10:00:00.000Z',
    tipo: 'preventiva',
    status: 'concluida',
    km_atual_veiculo: 8_000,
    pecas_trocadas: [{ descricao: 'Filtro de óleo', quantidade: 1, valor_unitario: 80 }],
    created_at: '2026-11-03T10:00:00.000Z',
    ...overrides,
  }
}

const META: ExecutiveReportMeta = {
  title: 'Relatório Geral da Frota',
  periodLabel: 'Período: 01/11/2026 a 30/11/2026',
  emittedAt: NOW,
  userName: 'Gabriel',
  userRole: 'Gestor',
  tenantName: 'Frota Demo',
}

const PERIOD = PeriodoFinanceiro.fromDates('2026-11-01', '2026-11-30')

describe('ExecutiveReportService', () => {
  it('monta o relatório geral com status, km, combustível e saúde', () => {
    const report = ExecutiveReportService.buildFleetReport(
      [
        makeVeiculo(),
        makeVeiculo({ id: 'veh-2', placa: 'XYZ-9876', status: 'em_viagem', tipo_combustivel: 'eletrico' }),
      ],
      [makeManutencao()],
      [makeReserva()],
      undefined,
      NOW,
    )

    expect(report.rows).toHaveLength(2)
    expect(report.statusCounts.disponivel).toBe(1)
    expect(report.statusCounts.em_viagem).toBe(1)
    expect(report.rows[0]?.combustivel).toBe('Diesel')
    expect(report.rows[1]?.combustivel).toBe('Elétrico')
    expect(report.rows[0]?.km).toBe(12_000)
    expect(['Em dia', 'Atenção', 'Crítico']).toContain(report.rows[0]?.saude)
    expect(report.kpis[0]?.value).toBe('2')
  })

  it('consolida ESG por combustível e calcula CO2 e árvores no período', () => {
    const report = ExecutiveReportService.buildEsgReport(
      [
        makeVeiculo(),
        makeVeiculo({ id: 'veh-2', placa: 'EV-0001', tipo_combustivel: 'eletrico' }),
      ],
      [
        makeReserva({ km_ida_volta: 100 }),
        makeReserva({ id: 'res-2', veiculo_id: 'veh-2', km_ida_volta: 80 }),
        makeReserva({ id: 'res-out', data_viagem: '2026-10-01T08:00:00.000Z', km_ida_volta: 999 }),
        makeReserva({ id: 'res-rej', status: 'REJEITADO', km_ida_volta: 500 }),
      ],
      { period: PERIOD },
    )

    expect(report.totals.viagens).toBe(2)
    expect(report.totals.kmTotal).toBe(180)
    expect(report.rows.find(row => row.combustivelKey === 'diesel')?.viagens).toBe(1)
    expect(report.rows.find(row => row.combustivelKey === 'eletrico')?.kgCo2).toBe(0)
    expect(report.totals.kgCo2).toBeGreaterThan(0)
    expect(report.totals.arvores).toBeGreaterThan(0)
    expect(report.compensacao).toMatch(/árvore/i)
  })

  it('monta histórico de OS com peças, custo e preventiva', () => {
    const report = ExecutiveReportService.buildMaintenanceReport(
      [
        makeManutencao(),
        makeManutencao({
          id: 'mnt-2',
          descricao: 'Freio',
          tipo: 'corretiva',
          valor_total: 1200,
          pecas_trocadas: [{ descricao: 'Pastilha de freio', quantidade: 2, valor_unitario: 150 }],
        }),
        makeManutencao({ id: 'mnt-old', data_manutencao: '2026-09-01T10:00:00.000Z' }),
      ],
      [makeVeiculo()],
      [makeReserva()],
      { period: PERIOD, includeCosts: true },
    )

    expect(report.rows).toHaveLength(2)
    expect(report.rows[0]?.os).toBe('OS-001')
    expect(report.rows[0]?.pecas).toContain('Filtro de óleo')
    expect(report.rows[1]?.pecas).toContain('Pastilha de freio (2x)')
    expect(report.totalCusto).toBe(2000)
    expect(report.rows[0]?.preventiva).not.toBe('—')
    expect(report.kpis.some(kpi => kpi.label === 'Custo total')).toBe(true)
  })

  it('omite custos de manutenção quando includeCosts é false', () => {
    const report = ExecutiveReportService.buildMaintenanceReport(
      [makeManutencao()],
      [makeVeiculo()],
      [],
      { period: PERIOD, includeCosts: false },
    )
    expect(report.rows[0]?.custoLabel).toBe('—')
    expect(report.kpis.some(kpi => kpi.label === 'Custo total')).toBe(false)
  })

  it('gera CSV de frota com BOM, metadados e colunas', () => {
    const report = ExecutiveReportService.buildFleetReport(
      [makeVeiculo()],
      [],
      [],
      undefined,
      NOW,
    )
    const csv = ExecutiveReportService.fleetToCsv(report, META)

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('Relatório;Relatório Geral da Frota')
    expect(csv).toContain('Usuário;Gabriel (Gestor)')
    expect(csv).toContain('Placa;Modelo;Marca;Status')
    expect(csv).toContain('ABC-1D23')
    expect(csv).toContain('Diesel')
  })

  it('gera CSV ESG e de manutenções com valores em pt-BR', () => {
    const esg = ExecutiveReportService.buildEsgReport(
      [makeVeiculo()],
      [makeReserva({ km_ida_volta: 100 })],
      { period: PERIOD },
    )
    const maintenance = ExecutiveReportService.buildMaintenanceReport(
      [makeManutencao({ valor_total: 450.5 })],
      [makeVeiculo()],
      [],
      { period: PERIOD },
    )

    const esgCsv = ExecutiveReportService.esgToCsv(esg, { ...META, title: 'Relatório ESG e Emissões' })
    const osCsv = ExecutiveReportService.maintenanceToCsv(maintenance, { ...META, title: 'Histórico de Manutenções' })

    expect(esgCsv).toContain('Combustível;Viagens;KM rodados')
    expect(esgCsv).toContain('Diesel')
    expect(osCsv).toContain('OS-001')
    expect(osCsv).toContain('450,50')
    expect(osCsv).toContain('Filtro de óleo (1x)')
  })

  it('gera nome de arquivo padronizado', () => {
    expect(ExecutiveReportService.fileName('frota', 'pdf', NOW)).toBe('FrotaMaq_Frota_Geral_2026-11-04.pdf')
    expect(ExecutiveReportService.fileName('esg', 'csv', NOW)).toBe('FrotaMaq_ESG_Emissoes_2026-11-04.csv')
    expect(ExecutiveReportService.fileName('manutencoes', 'pdf', NOW)).toBe('FrotaMaq_Historico_Manutencoes_2026-11-04.pdf')
  })
})
