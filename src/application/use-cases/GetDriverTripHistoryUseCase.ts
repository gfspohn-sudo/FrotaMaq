import type { IReservaRepository } from '@/domain/repositories/IReservaRepository'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import type { Usuario as UsuarioProfile, Reserva as ReservaDTO } from '@/types/database'

export interface DriverTripHistoryItem extends ReservaDTO {
  periodo: string
}

export class GetDriverTripHistoryUseCase {
  private readonly reservaRepo: IReservaRepository

  constructor(reservaRepo: IReservaRepository) {
    this.reservaRepo = reservaRepo
  }

  async execute(profile: UsuarioProfile | null): Promise<{
    data: DriverTripHistoryItem[] | null
    error: unknown
  }> {
    const usuario = UsuarioFactory.fromProfile(profile)
    if (!profile?.id) {
      return { data: null, error: new Error('Perfil não autenticado.') }
    }

    const motoristaId = usuario.perfil === 'motorista' ? profile.id : undefined
    const { data, error } = await this.reservaRepo.findAll({
      empresaId: profile.empresa_id ?? undefined,
      motoristaId,
    })

    if (error || !data) return { data: null, error }

    const visiveis = data.filter(r => r.podeSerVisualizadaPor(usuario) && r.status !== 'REJEITADO')
    const items: DriverTripHistoryItem[] = visiveis.map(r => {
      const dto = r.toDTO()
      const inicio = new Date(r.dataViagem).toLocaleString('pt-BR')
      const fim = r.dataFim ? new Date(r.dataFim).toLocaleString('pt-BR') : 'em andamento'
      return {
        ...dto,
        periodo: `${inicio} — ${fim}`,
      }
    })

    return { data: items, error: null }
  }
}
