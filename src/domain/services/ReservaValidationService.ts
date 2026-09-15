/** Domain Service — validações de reserva vs. manutenção preventiva. */
export class ReservaValidationService {
  /** Margem de segurança padrão antes da próxima manutenção (km). */
  static readonly MARGEM_KM_PADRAO = 500

  static validarQuilometragemViagem(
    kmAtual: number,
    kmIdaVolta: number,
    proximaManutencaoKm: number | null | undefined,
    margemKm = ReservaValidationService.MARGEM_KM_PADRAO,
  ): { ok: true } | { ok: false; message: string } {
    if (!Number.isFinite(kmIdaVolta) || kmIdaVolta <= 0) {
      return { ok: false, message: 'Informe a quilometragem total da viagem (ida e volta).' }
    }

    if (proximaManutencaoKm == null || !Number.isFinite(proximaManutencaoKm)) {
      return { ok: true }
    }

    const kmProjetado = kmAtual + kmIdaVolta
    const limiteSeguro = proximaManutencaoKm - margemKm

    if (kmProjetado > limiteSeguro) {
      return {
        ok: false,
        message:
          'Viagem excede o limite antes da próxima manutenção. ' +
          `Projeção: ${kmProjetado.toLocaleString('pt-BR')} km · ` +
          `Limite seguro: ${limiteSeguro.toLocaleString('pt-BR')} km.`,
      }
    }

    return { ok: true }
  }
}
