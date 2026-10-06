import { describe, it, expect } from 'vitest'
import { VeiculoDisponibilidadeService } from '@/domain/services/VeiculoDisponibilidadeService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import { createVeiculo } from '../../helpers/fixtures'

describe('VeiculoDisponibilidadeService', () => {
  it('considera disponível apenas veículos com status disponivel', () => {
    expect(VeiculoDisponibilidadeService.estaDisponivelParaReserva(
      createVeiculo({ status: 'disponivel' }),
    )).toBe(true)
    expect(VeiculoDisponibilidadeService.estaDisponivelParaReserva(
      createVeiculo({ status: 'em_manutencao' }),
    )).toBe(false)
    expect(VeiculoDisponibilidadeService.estaDisponivelParaReserva(
      createVeiculo({ status: 'parado' }),
    )).toBe(false)
    expect(VeiculoDisponibilidadeService.estaDisponivelParaReserva(
      createVeiculo({ status: 'em_viagem' }),
    )).toBe(false)
  })

  it('motorista só pode acessar veículos disponíveis', () => {
    const motorista = UsuarioFactory.fromProps('u1', 'Motorista', 'm@test.com', 'emp-1', 'motorista')
    const gestor = UsuarioFactory.fromProps('u2', 'Gestor', 'g@test.com', 'emp-1', 'gestor')

    const emManutencao = createVeiculo({ status: 'em_manutencao' })
    const emOperacao = createVeiculo({ status: 'disponivel' })

    expect(VeiculoDisponibilidadeService.podeMotoristaAcessarVeiculo(motorista, emOperacao)).toBe(true)
    expect(VeiculoDisponibilidadeService.podeMotoristaAcessarVeiculo(motorista, emManutencao)).toBe(false)
    expect(VeiculoDisponibilidadeService.podeMotoristaAcessarVeiculo(gestor, emManutencao)).toBe(true)
  })
})
