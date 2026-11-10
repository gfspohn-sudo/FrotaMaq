import type { Reserva } from '@/domain/entities/Reserva'
import type { Veiculo } from '@/domain/entities/Veiculo'

export interface TripDelayAlert {
  reservaId: string
  veiculoId: string
  placa: string
  destino: string
  horarioRetorno: string
  atrasoMinutos: number
  mensagem: string
}

/** Domain Service — viagem em atraso: retorno previsto passou e o veículo segue em viagem. */
export class TripDelayAlertService {
  static readonly VELOCIDADE_MEDIA_KMH = 50
  static readonly DURACAO_MINIMA_HORAS = 2

  static horarioRetornoPrevisto(reserva: Pick<Reserva, 'dataViagem' | 'kmIdaVolta'>): Date | null {
    const start = new Date(reserva.dataViagem)
    if (Number.isNaN(start.getTime())) return null
    const horas = Math.max(
      TripDelayAlertService.DURACAO_MINIMA_HORAS,
      reserva.kmIdaVolta / TripDelayAlertService.VELOCIDADE_MEDIA_KMH,
    )
    return new Date(start.getTime() + horas * 3_600_000)
  }

  static calcularAlertas(
    reservas: Reserva[],
    veiculos: Veiculo[],
    now = new Date(),
  ): TripDelayAlert[] {
    const byId = new Map(veiculos.map(veiculo => [veiculo.id, veiculo]))
    const alertas: TripDelayAlert[] = []

    for (const reserva of reservas) {
      if (reserva.status !== 'APROVADO' || reserva.dataFim) continue
      const veiculo = byId.get(reserva.veiculoId)
      if (!veiculo || veiculo.status !== 'em_viagem') continue

      const retorno = TripDelayAlertService.horarioRetornoPrevisto(reserva)
      if (!retorno || now.getTime() <= retorno.getTime()) continue

      const atrasoMinutos = Math.max(1, Math.round((now.getTime() - retorno.getTime()) / 60_000))
      const placa = veiculo.placa
      alertas.push({
        reservaId: reserva.id,
        veiculoId: veiculo.id,
        placa,
        destino: reserva.destino,
        horarioRetorno: retorno.toISOString(),
        atrasoMinutos,
        mensagem: `${placa} segue em viagem para ${reserva.destino} com retorno previsto às ${retorno.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
      })
    }

    return alertas
  }
}
