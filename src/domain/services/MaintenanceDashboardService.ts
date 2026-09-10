import type { Manutencao } from '@/domain/entities/Manutencao'
import type { Veiculo } from '@/domain/entities/Veiculo'
import type { Manutencao as ManutencaoDTO, TipoManutencao } from '@/types/database'

export interface MaintenanceDashboardResult {
  vencidas: ManutencaoDTO[]
  emManutencao: ManutencaoDTO[]
  proximas30: ManutencaoDTO[]
  concluidas: ManutencaoDTO[]
  statusCounts: { concluidas: number; proximas: number; vencidas: number }
  typeCounts: { preventiva: number; corretiva: number; preditiva: number }
}

/** Domain Service — agregações do dashboard de manutenções. */
export class MaintenanceDashboardService {
  static montar(manutencoes: Manutencao[]): MaintenanceDashboardResult {
    const now = new Date()
    const in30Days = new Date()
    in30Days.setDate(in30Days.getDate() + 30)

    const active = manutencoes.filter(m => ['agendada', 'em_andamento'].includes(m.status))
    const concluidasList = manutencoes.filter(m => m.status === 'concluida')

    const vencidas = active.filter(m => m.calcularUrgencia() === 'overdue')
    const emManutencao = manutencoes.filter(m => m.status === 'em_andamento')

    const proximas30 = active.filter(m => {
      const d = new Date(m.dataHora)
      return d >= now && d <= in30Days
    })

    let statusConcluidas = 0
    let statusProximas = 0
    let statusVencidas = 0

    for (const m of manutencoes) {
      if (m.status === 'cancelada') continue
      const urgency = m.calcularUrgencia(m.veiculoResumo?.kmAtual)
      if (m.status === 'concluida' && urgency === 'ok') statusConcluidas++
      else if (urgency === 'overdue') statusVencidas++
      else if (urgency === 'warning') statusProximas++
      else if (['agendada', 'em_andamento'].includes(m.status)) statusProximas++
      else statusConcluidas++
    }

    const typeCounts = manutencoes.reduce(
      (acc, m) => {
        acc[m.tipo as TipoManutencao]++
        return acc
      },
      { preventiva: 0, corretiva: 0, preditiva: 0 },
    )

    return {
      vencidas: vencidas.map(m => m.toDTO()),
      emManutencao: emManutencao.map(m => m.toDTO()),
      proximas30: proximas30.map(m => m.toDTO()),
      concluidas: concluidasList.slice(0, 20).map(m => m.toDTO()),
      statusCounts: {
        concluidas: statusConcluidas,
        proximas: statusProximas,
        vencidas: statusVencidas,
      },
      typeCounts,
    }
  }
}

export interface FleetSummaryResult {
  ativos: number
  emManutencao: number
  parados: number
  total: number
}

/** Domain Service — resumo da frota. */
export class FleetSummaryService {
  static calcular(veiculos: Veiculo[]): FleetSummaryResult {
    return {
      ativos: veiculos.filter(v => v.estaEmOperacao()).length,
      emManutencao: veiculos.filter(v => v.estaEmManutencao()).length,
      parados: veiculos.filter(v => v.estaParado()).length,
      total: veiculos.length,
    }
  }
}
