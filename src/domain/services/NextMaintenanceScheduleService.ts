import type { TipoManutencao } from '@/domain/types/enums'

export interface NextMaintenanceInput {
  tipo: TipoManutencao | string
  kmAtual: number
  dataManutencao: Date | string
  intervaloKm?: number | null
  intervaloDias?: number | null
}

export interface NextMaintenanceSchedule {
  proximaManutencaoKm: number
  dataProximaManutencao: string
  intervaloKm: number
  intervaloDias: number
}

/** Domain Service — calcula a próxima manutenção a partir do tipo e intervalo do veículo. */
export class NextMaintenanceScheduleService {
  static readonly INTERVALO_PADRAO_KM = 10000
  static readonly INTERVALO_PADRAO_DIAS = 180

  static intervaloPorTipo(tipo: TipoManutencao | string): { km: number; dias: number } {
    switch (String(tipo).trim().toLowerCase()) {
      case 'corretiva':
        return { km: 5000, dias: 90 }
      case 'preditiva':
        return { km: 15000, dias: 365 }
      case 'preventiva':
      default:
        return { km: NextMaintenanceScheduleService.INTERVALO_PADRAO_KM, dias: NextMaintenanceScheduleService.INTERVALO_PADRAO_DIAS }
    }
  }

  static calcular(input: NextMaintenanceInput): NextMaintenanceSchedule {
    const fallback = NextMaintenanceScheduleService.intervaloPorTipo(input.tipo)
    const intervaloKm = input.intervaloKm && input.intervaloKm > 0 ? input.intervaloKm : fallback.km
    const intervaloDias = input.intervaloDias && input.intervaloDias > 0 ? input.intervaloDias : fallback.dias
    const data = input.dataManutencao instanceof Date
      ? input.dataManutencao
      : new Date(input.dataManutencao)
    const base = Number.isNaN(data.getTime()) ? new Date() : data
    const proxima = new Date(base)
    proxima.setDate(proxima.getDate() + intervaloDias)

    return {
      proximaManutencaoKm: Math.max(0, Math.round(input.kmAtual)) + intervaloKm,
      dataProximaManutencao: proxima.toISOString(),
      intervaloKm,
      intervaloDias,
    }
  }
}
