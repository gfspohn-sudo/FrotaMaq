import type { MaintenanceUrgency, StatusManutencao } from '@/domain/types/enums'
import type { Manutencao } from '@/domain/entities/Manutencao'

const MS_PER_DAY = 1000 * 60 * 60 * 24
const WARNING_DAYS = 30
const WARNING_KM = 1000

/** Domain Service — regras de urgência de manutenção. */
export class MaintenanceUrgencyService {
  private static daysUntil(dateStr: string): number {
    const target = new Date(dateStr)
    target.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.ceil((target.getTime() - today.getTime()) / MS_PER_DAY)
  }

  static calcular(m: Manutencao, veiculoKm?: number): MaintenanceUrgency {
    return MaintenanceUrgencyService.calcularFromFields({
      status: m.status,
      dataHora: m.dataHora,
      proximaManutencaoData: m.proximaManutencaoData,
      proximaManutencaoKm: m.proximaManutencaoKm,
      veiculoKm: veiculoKm ?? m.veiculoResumo?.kmAtual,
    })
  }

  static calcularFromFields(fields: {
    status: StatusManutencao
    dataHora: string
    proximaManutencaoData: string | null
    proximaManutencaoKm: number | null
    veiculoKm?: number
  }): MaintenanceUrgency {
    const { status, dataHora, proximaManutencaoData, proximaManutencaoKm, veiculoKm } = fields

    if (['agendada', 'em_andamento'].includes(status)) {
      const days = MaintenanceUrgencyService.daysUntil(dataHora)
      if (days < 0) return 'overdue'
      if (days <= WARNING_DAYS) return 'warning'
      return 'ok'
    }

    if (status === 'concluida') {
      let dateUrgency: MaintenanceUrgency = 'ok'
      let kmUrgency: MaintenanceUrgency = 'ok'

      if (proximaManutencaoData) {
        const days = MaintenanceUrgencyService.daysUntil(proximaManutencaoData)
        if (days < 0) dateUrgency = 'overdue'
        else if (days <= WARNING_DAYS) dateUrgency = 'warning'
      }

      if (proximaManutencaoKm != null && veiculoKm != null) {
        const remaining = proximaManutencaoKm - veiculoKm
        if (remaining <= 0) kmUrgency = 'overdue'
        else if (remaining <= WARNING_KM) kmUrgency = 'warning'
      }

      if (dateUrgency === 'overdue' || kmUrgency === 'overdue') return 'overdue'
      if (dateUrgency === 'warning' || kmUrgency === 'warning') return 'warning'
      return 'ok'
    }

    return 'ok'
  }
}
