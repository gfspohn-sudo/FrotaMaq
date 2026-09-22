import type { Veiculo } from '@/domain/entities/Veiculo'
import type { Usuario } from '@/domain/entities/usuario/Usuario'

/** Domain Service — disponibilidade de veículos para reserva. */
export class VeiculoDisponibilidadeService {
  static estaDisponivelParaReserva(veiculo: Veiculo): boolean {
    return veiculo.estaEmOperacao()
  }

  static motoristaDeveVerApenasDisponiveis(usuario: Usuario): boolean {
    return usuario.perfil === 'motorista'
  }

  static podeMotoristaAcessarVeiculo(usuario: Usuario, veiculo: Veiculo): boolean {
    if (!VeiculoDisponibilidadeService.motoristaDeveVerApenasDisponiveis(usuario)) {
      return true
    }
    return VeiculoDisponibilidadeService.estaDisponivelParaReserva(veiculo)
  }
}
