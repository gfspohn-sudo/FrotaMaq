import type { Manutencao } from '@/domain/entities/Manutencao'
import type { Reserva } from '@/domain/entities/Reserva'
import type { PeriodoFinanceiro } from '@/domain/value-objects/PeriodoFinanceiro'

export interface FleetReportFilters {
  periodo?: PeriodoFinanceiro
  veiculoId?: string
  motoristaId?: string
}

/** Domain Service — filtros globais de relatórios (período, veículo, motorista). */
export class FleetReportFilterService {
  static filtrarManutencoes(
    manutencoes: Manutencao[],
    filtros: FleetReportFilters,
    reservas: Reserva[] = [],
  ): Manutencao[] {
    let rows = manutencoes

    if (filtros.veiculoId) {
      rows = rows.filter(m => m.veiculoId === filtros.veiculoId)
    }

    if (filtros.motoristaId) {
      const veiculoIds = new Set(
        reservas
          .filter(r => r.motoristaId === filtros.motoristaId)
          .map(r => r.veiculoId),
      )
      rows = rows.filter(m => veiculoIds.has(m.veiculoId))
    }

    if (filtros.periodo) {
      rows = rows.filter(m => m.estaNoPeriodo(m.dataHora, m.createdAt, filtros.periodo!))
    }

    return rows
  }

  static motoristasDe(reservas: Reserva[]): { id: string; nome: string }[] {
    const map = new Map<string, string>()
    for (const r of reservas) {
      if (!map.has(r.motoristaId)) {
        map.set(r.motoristaId, r.motoristaNome ?? r.motoristaId)
      }
    }
    return [...map.entries()].map(([id, nome]) => ({ id, nome }))
  }
}
