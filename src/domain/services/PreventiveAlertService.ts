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
  atrasada: boolean
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

        if (diasRestantes <= diasLimite) {
          const atrasada = diasRestantes < 0
          alertas.push({
            veiculoId: v.veiculoId,
            placa: v.placa,
            mensagem: atrasada
              ? `Manutenção vencida há ${Math.abs(diasRestantes)} dia(s) — ${v.placa}`
              : diasRestantes === 0
                ? `Manutenção preventiva vence hoje — ${v.placa}`
                : `Manutenção preventiva em ${diasRestantes} dia(s) — ${v.placa}`,
            tipo: 'dias',
            diasRestantes,
            atrasada,
          })
        }
      }

      if (v.proximaManutencaoKm != null && Number.isFinite(v.proximaManutencaoKm)) {
        const kmRestantes = v.proximaManutencaoKm - v.kmAtual
        if (kmRestantes <= kmLimite) {
          const atrasada = kmRestantes < 0
          alertas.push({
            veiculoId: v.veiculoId,
            placa: v.placa,
            mensagem: atrasada
              ? `Quilometragem da preventiva ultrapassada em ${Math.abs(kmRestantes).toLocaleString('pt-BR')} km — ${v.placa}`
              : kmRestantes === 0
                ? `Quilometragem da preventiva atingida — ${v.placa}`
                : `Faltam ${kmRestantes.toLocaleString('pt-BR')} km para manutenção — ${v.placa}`,
            tipo: 'km',
            kmRestantes,
            atrasada,
          })
        }
      }
    }

    return alertas
  }
}
