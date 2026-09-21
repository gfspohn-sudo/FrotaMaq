import type { Manutencao } from '@/domain/entities/Manutencao'
import type { Veiculo } from '@/domain/entities/Veiculo'
import type { Manutencao as ManutencaoDTO, TipoManutencao } from '@/types/database'
import { isManutencaoAtiva, isManutencaoVencida } from '@/lib/dbCompat'

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
  static montar(manutencoes: Manutencao[], veiculos: Veiculo[] = []): MaintenanceDashboardResult {
    const now = new Date()
    const in30Days = new Date()
    in30Days.setDate(in30Days.getDate() + 30)

    const active = manutencoes.filter(m => isManutencaoAtiva(m.status))
    const concluidasList = manutencoes.filter(m => m.status === 'concluida')

    const vencidas = active.filter(m => isManutencaoVencida(m.toDTO()))
    const emManutencao = MaintenanceDashboardService.listarVeiculosEmManutencao(veiculos, manutencoes)

    const proximas30 = active.filter(m => {
      if (isManutencaoVencida(m.toDTO())) return false
      const d = new Date(m.dataHora)
      return d >= now && d <= in30Days
    })

    let statusConcluidas = 0
    let statusProximas = 0
    let statusVencidas = 0

    for (const m of manutencoes) {
      if (m.status === 'cancelada') continue
      const dto = m.toDTO()
      if (isManutencaoVencida(dto)) {
        statusVencidas++
      } else if (m.status === 'concluida') {
        statusConcluidas++
      } else if (isManutencaoAtiva(m.status)) {
        statusProximas++
      } else {
        statusConcluidas++
      }
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
      emManutencao,
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

  /** Veículos em manutenção ou com OS ativa (PENDENTE / EM_ANDAMENTO). */
  private static listarVeiculosEmManutencao(
    veiculos: Veiculo[],
    manutencoes: Manutencao[],
  ): ManutencaoDTO[] {
    const veiculoIdsComOsAtiva = new Set(
      manutencoes.filter(m => isManutencaoAtiva(m.status)).map(m => m.veiculoId),
    )

    const veiculosRelevantes = veiculos.filter(
      v => v.estaEmManutencao() || veiculoIdsComOsAtiva.has(v.id),
    )

    const seen = new Set<string>()

    return veiculosRelevantes
      .map(veiculo => {
        const related = manutencoes
          .filter(m => m.veiculoId === veiculo.id)
          .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())

        const open = related.find(m => isManutencaoAtiva(m.status))
        if (open) return open.toDTO()

        const latest = related[0]
        if (latest) return latest.toDTO()

        return MaintenanceDashboardService.manutencaoPlaceholderVeiculo(veiculo)
      })
      .filter(item => {
        if (seen.has(item.veiculo_id)) return false
        seen.add(item.veiculo_id)
        return true
      })
  }

  private static manutencaoPlaceholderVeiculo(veiculo: Veiculo): ManutencaoDTO {
    return {
      id: `veiculo-em-manutencao-${veiculo.id}`,
      empresa_id: veiculo.empresaId,
      veiculo_id: veiculo.id,
      descricao: 'Veículo com status em manutenção',
      valor_total: 0,
      data_manutencao: new Date().toISOString(),
      tipo: 'CORRETIVA',
      created_at: veiculo.createdAt,
      status: 'em_andamento',
      veiculos: {
        placa: veiculo.placa,
        nome_exibicao: `${veiculo.marca} ${veiculo.modelo}`.trim(),
        modelo: veiculo.modelo,
        marca: veiculo.marca,
        quilometragem_atual: veiculo.kmAtual.value,
        km_atual: veiculo.kmAtual.value,
      },
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
