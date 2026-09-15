import type { Usuario } from '@/domain/entities/usuario/Usuario'

export interface VehicleReportAuthContext {
  veiculoId: string
  empresaId: string | null
  /** Veículos com reserva aprovada ou histórico de uso (Motorista). */
  veiculosEscopoMotorista: string[]
  /** Veículos com solicitação de relatório aprovada (Mecânico). */
  veiculosRelatorioAprovadoMecanico: string[]
}

/** Domain Service — autorização de relatórios individuais por veículo. */
export class VehicleReportAuthorizationService {
  static podeAcessar(usuario: Usuario, ctx: VehicleReportAuthContext): boolean {
    if (usuario.podeAbrirRelatorioIndividualDireto()) {
      if (!ctx.empresaId) return true
      return usuario.podeVisualizarEmpresa(ctx.empresaId)
    }

    if (usuario.perfil === 'motorista') {
      return ctx.veiculosEscopoMotorista.includes(ctx.veiculoId)
    }

    if (usuario.perfil === 'mecanico') {
      return ctx.veiculosRelatorioAprovadoMecanico.includes(ctx.veiculoId)
    }

    return false
  }

  static filtrarVeiculosMotorista<T extends { id: string }>(
    veiculos: T[],
    veiculosEscopo: string[],
  ): T[] {
    if (veiculosEscopo.length === 0) return []
    const set = new Set(veiculosEscopo)
    return veiculos.filter(v => set.has(v.id))
  }
}
