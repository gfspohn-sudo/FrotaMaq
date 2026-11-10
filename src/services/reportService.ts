import type { Usuario } from '@/types/database'
import { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'
import { Money } from '@/domain/value-objects/Money'
import {
  ExecutiveReportService,
  REPORT_TITLES,
  formatPeriodRange,
  type ExecutiveReportKind,
  type ExecutiveReportMeta,
} from '@/domain/services/ExecutiveReportService'
import { createExecutivePdf, pdfToBlob } from '@/lib/pdfExecutiveReport'
import { downloadPdfBlob, downloadTextFile } from '@/lib/downloadFile'
import { formatErrorMessage } from '@/lib/formatError'
import { PERFIL_LABELS } from '@/lib/tenantFilter'
import { getVeiculos } from '@/services/vehicles'
import { getReservas } from '@/services/reservas'
import { getManutencoes } from '@/services/maintenance'

export type ReportExportFormat = 'pdf' | 'csv'

export interface ReportExportInput {
  kind: ExecutiveReportKind
  format: ReportExportFormat
  profile: Usuario | null
  empresaId?: string
  tenantName: string
  period: PeriodoFinanceiro
  veiculoId?: string
  motoristaId?: string
  includeCosts?: boolean
}

export interface ReportExportResult {
  filename: string
  kind: ExecutiveReportKind
  format: ReportExportFormat
}

function buildMeta(
  kind: ExecutiveReportKind,
  input: ReportExportInput,
  emittedAt = new Date(),
): ExecutiveReportMeta {
  const profile = input.profile
  return {
    title: REPORT_TITLES[kind],
    periodLabel: `Período: ${formatPeriodRange(input.period)}`,
    emittedAt,
    userName: profile?.nome?.trim() || profile?.email || 'Usuário',
    userRole: profile?.perfil ? PERFIL_LABELS[profile.perfil] : 'Operador',
    tenantName: input.tenantName || 'FrotaMaq',
  }
}

async function loadOperationalData(input: ReportExportInput) {
  const tenant = { empresaId: input.empresaId }
  const [veiculosRes, reservasRes, manutencoesRes] = await Promise.all([
    getVeiculos(tenant, input.profile),
    getReservas(input.profile, { empresaId: input.empresaId }),
    getManutencoes(tenant, input.profile),
  ])

  const firstError = veiculosRes.error ?? reservasRes.error ?? manutencoesRes.error
  if (firstError) {
    throw new Error(formatErrorMessage(firstError))
  }

  return {
    veiculos: veiculosRes.data ?? [],
    reservas: reservasRes.data ?? [],
    manutencoes: manutencoesRes.data ?? [],
  }
}

function downloadCsv(content: string, filename: string) {
  downloadTextFile(content, filename, 'text/csv;charset=utf-8')
}

function exportFleet(input: ReportExportInput, data: Awaited<ReturnType<typeof loadOperationalData>>, meta: ExecutiveReportMeta) {
  const report = ExecutiveReportService.buildFleetReport(
    data.veiculos,
    data.manutencoes,
    data.reservas,
    { veiculoId: input.veiculoId, motoristaId: input.motoristaId },
  )
  const filename = ExecutiveReportService.fileName('frota', input.format)

  if (input.format === 'csv') {
    downloadCsv(ExecutiveReportService.fleetToCsv(report, meta), filename)
    return filename
  }

  const doc = createExecutivePdf(meta, {
    orientation: 'landscape',
    headers: ['Placa', 'Modelo', 'Status', 'KM acumulado', 'Combustível', 'Saúde', 'Resumo de saúde'],
    rows: report.rows.map(row => [
      row.placa,
      `${row.marca} ${row.modelo}`.trim(),
      row.status,
      row.kmLabel,
      row.combustivel,
      row.saude,
      row.resumo,
    ]),
    kpis: report.kpis,
    emptyMessage: 'Nenhum veículo encontrado para os filtros selecionados.',
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 48 },
      2: { cellWidth: 32 },
      3: { cellWidth: 30 },
      4: { cellWidth: 28 },
      5: { cellWidth: 26 },
      6: { cellWidth: 'auto' },
    },
    foot: report.rows.length
      ? [[{ content: `Total: ${report.rows.length} veículo(s)`, colSpan: 7 }]]
      : undefined,
  })
  downloadPdfBlob(pdfToBlob(doc), filename)
  return filename
}

function exportEsg(input: ReportExportInput, data: Awaited<ReturnType<typeof loadOperationalData>>, meta: ExecutiveReportMeta) {
  const report = ExecutiveReportService.buildEsgReport(data.veiculos, data.reservas, {
    period: input.period,
    veiculoId: input.veiculoId,
    motoristaId: input.motoristaId,
  })
  const filename = ExecutiveReportService.fileName('esg', input.format)

  if (input.format === 'csv') {
    downloadCsv(ExecutiveReportService.esgToCsv(report, meta), filename)
    return filename
  }

  const doc = createExecutivePdf(meta, {
    orientation: 'portrait',
    headers: ['Combustível', 'Viagens', 'KM rodados', 'CO2 emitido', 'Árvores p/ compensar'],
    rows: report.rows.map(row => [
      row.combustivel,
      String(row.viagens),
      row.kmLabel,
      row.co2Label,
      row.arvoresLabel,
    ]),
    kpis: report.kpis,
    emptyMessage: 'Nenhuma viagem no período selecionado para calcular emissões.',
    foot: report.rows.length
      ? [[
          'Total da frota',
          String(report.totals.viagens),
          `${Math.round(report.totals.kmTotal).toLocaleString('pt-BR')} km`,
          report.kpis[2]?.value ?? '',
          report.kpis[3]?.value ?? '',
        ]]
      : undefined,
  })
  downloadPdfBlob(pdfToBlob(doc), filename)
  return filename
}

function exportMaintenance(input: ReportExportInput, data: Awaited<ReturnType<typeof loadOperationalData>>, meta: ExecutiveReportMeta) {
  const includeCosts = input.includeCosts !== false
  const report = ExecutiveReportService.buildMaintenanceReport(
    data.manutencoes,
    data.veiculos,
    data.reservas,
    {
      period: input.period,
      veiculoId: input.veiculoId,
      motoristaId: input.motoristaId,
      includeCosts,
    },
  )
  const filename = ExecutiveReportService.fileName('manutencoes', input.format)

  if (input.format === 'csv') {
    downloadCsv(ExecutiveReportService.maintenanceToCsv(report, meta, includeCosts), filename)
    return filename
  }

  const headers = includeCosts
    ? ['OS', 'Data', 'Placa', 'Tipo', 'Descrição', 'Peças trocadas', 'Custo', 'Preventiva', 'Status']
    : ['OS', 'Data', 'Placa', 'Tipo', 'Descrição', 'Peças trocadas', 'Preventiva', 'Status']

  const rows = report.rows.map(row => includeCosts
    ? [row.os, row.data, row.placa, row.tipo, row.descricao, row.pecas, row.custoLabel, row.preventiva, row.status]
    : [row.os, row.data, row.placa, row.tipo, row.descricao, row.pecas, row.preventiva, row.status])

  const foot = report.rows.length
    ? [includeCosts
        ? [
            { content: 'Total', colSpan: 2 },
            String(report.rows.length),
            '',
            '',
            '',
            Money.from(report.totalCusto).format(),
            '',
            '',
          ]
        : [{ content: `Total: ${report.rows.length} OS`, colSpan: 8 }]]
    : undefined

  const doc = createExecutivePdf(meta, {
    orientation: 'landscape',
    headers,
    rows,
    kpis: report.kpis,
    emptyMessage: 'Nenhuma ordem de serviço no período selecionado.',
    columnStyles: includeCosts
      ? {
          0: { cellWidth: 18 },
          1: { cellWidth: 24 },
          2: { cellWidth: 26 },
          3: { cellWidth: 24 },
          4: { cellWidth: 48 },
          5: { cellWidth: 46 },
          6: { cellWidth: 26 },
          7: { cellWidth: 26 },
          8: { cellWidth: 'auto' },
        }
      : {
          0: { cellWidth: 18 },
          4: { cellWidth: 56 },
          5: { cellWidth: 52 },
        },
    foot,
  })
  downloadPdfBlob(pdfToBlob(doc), filename)
  return filename
}

/** Facade unificado — exporta relatórios executivos em PDF e CSV/Excel. */
export async function exportExecutiveReport(input: ReportExportInput): Promise<ReportExportResult> {
  const meta = buildMeta(input.kind, input)
  const data = await loadOperationalData(input)

  const filename = input.kind === 'frota'
    ? exportFleet(input, data, meta)
    : input.kind === 'esg'
      ? exportEsg(input, data, meta)
      : exportMaintenance(input, data, meta)

  return { filename, kind: input.kind, format: input.format }
}

export const reportService = {
  exportExecutiveReport,
  fileName: ExecutiveReportService.fileName,
  titles: REPORT_TITLES,
}
