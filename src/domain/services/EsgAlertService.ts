export interface EsgMilestoneAlert {
  marcoKg: number
  kgCo2: number
  arvores: number
  mensagem: string
}

/** Domain Service — alerta ESG quando a frota cruza um marco de emissão. */
export class EsgAlertService {
  static readonly MARCOS_KG = [50, 100, 500, 1000, 2500] as const

  static marcoAtingido(kgCo2: number): number | null {
    if (!Number.isFinite(kgCo2) || kgCo2 <= 0) return null
    let atingido: number | null = null
    for (const marco of EsgAlertService.MARCOS_KG) {
      if (kgCo2 >= marco) atingido = marco
    }
    return atingido
  }

  static calcularAlerta(kgCo2: number, arvores: number): EsgMilestoneAlert | null {
    const marcoKg = EsgAlertService.marcoAtingido(kgCo2)
    if (marcoKg == null) return null

    const massa = kgCo2 >= 1000
      ? `${(kgCo2 / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t`
      : `${kgCo2.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`

    const arvoresLabel = arvores < 1
      ? `${arvores.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} árvore`
      : `${Math.round(arvores).toLocaleString('pt-BR')} ${Math.round(arvores) === 1 ? 'árvore' : 'árvores'}`

    return {
      marcoKg,
      kgCo2,
      arvores,
      mensagem: `A frota atingiu ${massa} de CO₂ neste mês (marco de ${marcoKg >= 1000 ? `${marcoKg / 1000} t` : `${marcoKg} kg`}). São necessárias ${arvoresLabel} para compensar.`,
    }
  }
}
