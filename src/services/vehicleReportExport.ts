import {
  VehicleReportExportService,
  type VehicleReportExportRow,
} from '@/domain/services/VehicleReportExportService'
import { downloadTextFile } from '@/lib/downloadFile'
import { formatDate } from '@/lib/maintenanceStatus'
import { TIPO_MANUTENCAO_LABELS, STATUS_MANUTENCAO_LABELS } from '@/types/database'
import {
  getManutencaoData,
  getManutencaoLocal,
  getManutencaoProximaData,
  getManutencaoStatus,
  getManutencaoValor,
  getVeiculoModelo,
  normalizeTipoManutencao,
} from '@/lib/dbCompat'
import type { Manutencao, Veiculo } from '@/types/database'

export function buildVehicleReportRows(veiculo: Veiculo, manutencoes: Manutencao[]): VehicleReportExportRow[] {
  return manutencoes.map(m => {
    const tipo = normalizeTipoManutencao(m.tipo_normalizado ?? m.tipo)
    return {
      modelo: getVeiculoModelo(veiculo),
      placa: veiculo.placa,
      dataManutencao: formatDate(getManutencaoData(m)),
      tipo: TIPO_MANUTENCAO_LABELS[tipo],
      descricao: m.descricao,
      pecasServicos: getManutencaoProximaData(m) ?? m.descricao,
      local: getManutencaoLocal(m) ?? '',
      responsavel: m.responsavel ?? '',
      custo: getManutencaoValor(m),
      status: STATUS_MANUTENCAO_LABELS[getManutencaoStatus(m)],
    }
  })
}

export function downloadVehicleReportCsv(veiculo: Veiculo, manutencoes: Manutencao[]) {
  const rows = buildVehicleReportRows(veiculo, manutencoes)
  const csv = VehicleReportExportService.gerarCsv(rows)
  const filename = VehicleReportExportService.nomeArquivo(veiculo.placa, 'csv')
  downloadTextFile(csv, filename)
}
