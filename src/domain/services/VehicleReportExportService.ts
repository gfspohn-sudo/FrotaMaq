import type { TipoManutencao } from '@/types/database'

export interface VehicleReportExportRow {
  modelo: string
  placa: string
  dataManutencao: string
  tipo: TipoManutencao | string
  descricao: string
  pecasServicos: string
  local: string
  responsavel: string
  custo: number
  status: string
}

const CSV_HEADERS = [
  'Modelo',
  'Placa',
  'Data Manutenção',
  'Tipo',
  'Descrição',
  'Peças/Serviços',
  'Local/Oficina',
  'Responsável',
  'Custo (R$)',
  'Status',
] as const

function escapeCsvField(value: string | number): string {
  const str = String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Domain Service — gera conteúdo CSV do histórico operacional do veículo. */
export class VehicleReportExportService {
  static gerarCsv(rows: VehicleReportExportRow[]): string {
    const headerLine = CSV_HEADERS.join(';')
    const body = rows.map(row =>
      [
        row.modelo,
        row.placa,
        row.dataManutencao,
        row.tipo,
        row.descricao,
        row.pecasServicos,
        row.local,
        row.responsavel,
        row.custo.toFixed(2).replace('.', ','),
        row.status,
      ].map(escapeCsvField).join(';'),
    )
    return `\uFEFF${headerLine}\n${body.join('\n')}`
  }

  static nomeArquivo(placa: string, ext: 'csv' | 'xlsx' = 'csv'): string {
    const safePlaca = placa.replace(/[^a-zA-Z0-9-]/g, '_')
    const date = new Date().toISOString().slice(0, 10)
    return `relatorio_${safePlaca}_${date}.${ext}`
  }
}
