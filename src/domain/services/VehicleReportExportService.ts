import type { TipoManutencao } from '@/types/database'
import { toCsv } from '@/lib/csvFile'

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

/** Domain Service — gera conteúdo CSV do histórico operacional do veículo. */
export class VehicleReportExportService {
  static gerarCsv(rows: VehicleReportExportRow[]): string {
    return toCsv(
      CSV_HEADERS,
      rows.map(row => [
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
      ]),
    )
  }

  static nomeArquivo(placa: string, ext: 'csv' | 'xlsx' = 'csv'): string {
    const safePlaca = placa.replace(/[^a-zA-Z0-9-]/g, '_')
    const date = new Date().toISOString().slice(0, 10)
    return `relatorio_${safePlaca}_${date}.${ext}`
  }
}
