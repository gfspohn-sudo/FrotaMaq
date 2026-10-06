import type { PrioridadeAlerta } from '@/domain/types/enums'
import type { Manutencao } from '@/domain/entities/Manutencao'
import type { Veiculo } from '@/domain/entities/Veiculo'

export interface FleetPriorityAlert {
  veiculoId: string
  placa: string
  modelo: string
  prioridade: PrioridadeAlerta
  mensagem: string
  motivo: 'atrasada' | 'km' | 'data'
  diasRestantes: number | null
  kmRestantes: number | null
  atrasada: boolean
}

interface VehicleDue {
  veiculo: Veiculo
  proximaData: string | null
  proximaKm: number | null
}

/** Domain Service — alertas priorizados ANTES do vencimento (km/dias). */
export class FleetPriorityAlertService {
  static readonly DIAS_MEDIA = 7
  static readonly DIAS_ALTA = 3
  static readonly KM_MEDIA = 500
  static readonly KM_ALTA = 200

  static montar(veiculos: Veiculo[], manutencoes: Manutencao[], now = new Date()): FleetPriorityAlert[] {
    const byVehicle = new Map<string, Manutencao[]>()
    for (const m of manutencoes) {
      const list = byVehicle.get(m.veiculoId) ?? []
      list.push(m)
      byVehicle.set(m.veiculoId, list)
    }

    const dues: VehicleDue[] = veiculos.map(veiculo => {
      const related = (byVehicle.get(veiculo.id) ?? [])
        .slice()
        .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())
      const latest = related[0]
      return {
        veiculo,
        proximaData: latest?.proximaManutencaoData ?? null,
        proximaKm: latest?.proximaManutencaoKm ?? null,
      }
    })

    const alerts: FleetPriorityAlert[] = []
    const hoje = new Date(now)
    hoje.setHours(0, 0, 0, 0)

    for (const due of dues) {
      const alert = FleetPriorityAlertService.avaliar(due, hoje)
      if (alert) alerts.push(alert)
    }

    const order: Record<PrioridadeAlerta, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2 }
    return alerts.sort((a, b) => {
      const p = order[a.prioridade] - order[b.prioridade]
      if (p !== 0) return p
      const da = a.diasRestantes ?? Number.POSITIVE_INFINITY
      const db = b.diasRestantes ?? Number.POSITIVE_INFINITY
      return da - db
    })
  }

  private static avaliar(due: VehicleDue, hoje: Date): FleetPriorityAlert | null {
    const { veiculo, proximaData, proximaKm } = due
    let diasRestantes: number | null = null
    let kmRestantes: number | null = null

    if (proximaData) {
      const data = new Date(proximaData)
      if (!Number.isNaN(data.getTime())) {
        data.setHours(0, 0, 0, 0)
        diasRestantes = Math.ceil((data.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
      }
    }

    if (proximaKm != null && Number.isFinite(proximaKm)) {
      kmRestantes = proximaKm - veiculo.kmAtual.value
    }

    if (diasRestantes == null && kmRestantes == null) return null

    const atrasada = (diasRestantes != null && diasRestantes < 0)
      || (kmRestantes != null && kmRestantes < 0)

    let prioridade: PrioridadeAlerta | null = null
    let motivo: FleetPriorityAlert['motivo'] = 'data'

    if (atrasada) {
      prioridade = 'CRITICA'
      motivo = (kmRestantes != null && kmRestantes < 0) ? 'km' : 'atrasada'
    } else if (
      (diasRestantes != null && diasRestantes <= FleetPriorityAlertService.DIAS_ALTA)
      || (kmRestantes != null && kmRestantes <= FleetPriorityAlertService.KM_ALTA)
    ) {
      prioridade = 'ALTA'
      motivo = (kmRestantes != null && kmRestantes <= FleetPriorityAlertService.KM_ALTA) ? 'km' : 'data'
    } else if (
      (diasRestantes != null && diasRestantes <= FleetPriorityAlertService.DIAS_MEDIA)
      || (kmRestantes != null && kmRestantes <= FleetPriorityAlertService.KM_MEDIA)
    ) {
      prioridade = 'MEDIA'
      motivo = (kmRestantes != null && kmRestantes <= FleetPriorityAlertService.KM_MEDIA) ? 'km' : 'data'
    }

    if (!prioridade) return null

    const placa = veiculo.placa
    let mensagem: string
    if (atrasada) {
      mensagem = `Manutenção atrasada — ${placa}`
    } else if (motivo === 'km' && kmRestantes != null) {
      mensagem = `Faltam ${kmRestantes.toLocaleString('pt-BR')} km para a manutenção — ${placa}`
    } else {
      mensagem = `Manutenção em ${diasRestantes} dia(s) — ${placa}`
    }

    return {
      veiculoId: veiculo.id,
      placa,
      modelo: veiculo.modelo,
      prioridade,
      mensagem,
      motivo,
      diasRestantes,
      kmRestantes,
      atrasada,
    }
  }
}
