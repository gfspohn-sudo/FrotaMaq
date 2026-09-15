export interface PreventiveAlertInput {
  veiculoId: string
  placa: string
  proximaManutencaoData: string | null
  proximaManutencaoKm: number | null
  kmAtual: number
}

export interface PreventiveAlert {
  veiculoId: string
  placa: string
  mensagem: string
  tipo: 'dias' | 'km'
  diasRestantes?: number
  kmRestantes?: number
}

/** Domain Service — alertas preventivos (5 dias ou X km). */
export class PreventiveAlertService {
  static readonly DIAS_LIMITE = 5
  static readonly KM_LIMITE = 500

  static calcularAlertas(
    veiculos: PreventiveAlertInput[],
    diasLimite = PreventiveAlertService.DIAS_LIMITE,
    kmLimite = PreventiveAlertService.KM_LIMITE,
  ): PreventiveAlert[] {
    const alertas: PreventiveAlert[] = []
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    for (const v of veiculos) {
      if (v.proximaManutencaoData) {
        const dataManut = new Date(v.proximaManutencaoData)
        dataManut.setHours(0, 0, 0, 0)
        const diffMs = dataManut.getTime() - hoje.getTime()
        const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

        if (diasRestantes >= 0 && diasRestantes <= diasLimite) {
          alertas.push({
            veiculoId: v.veiculoId,
            placa: v.placa,
            mensagem: `Manutenção preventiva em ${diasRestantes} dia(s) — ${v.placa}`,
            tipo: 'dias',
            diasRestantes,
          })
        }
      }

      if (v.proximaManutencaoKm != null && Number.isFinite(v.proximaManutencaoKm)) {
        const kmRestantes = v.proximaManutencaoKm - v.kmAtual
        if (kmRestantes >= 0 && kmRestantes <= kmLimite) {
          alertas.push({
            veiculoId: v.veiculoId,
            placa: v.placa,
            mensagem: `Faltam ${kmRestantes.toLocaleString('pt-BR')} km para manutenção — ${v.placa}`,
            tipo: 'km',
            kmRestantes,
          })
        }
      }
    }

    return alertas
  }
}
