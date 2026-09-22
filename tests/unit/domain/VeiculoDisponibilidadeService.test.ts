import { describe, it, expect } from 'vitest'
import { VeiculoDisponibilidadeService } from '@/domain/services/VeiculoDisponibilidadeService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import { createVeiculo } from '../../helpers/fixtures'

describe('VeiculoDisponibilidadeService', () => {
  it('considera disponível apenas veículos em operação', () => {
    expect(VeiculoDisponibilidadeService.estaDisponivelParaReserva(
      createVeiculo({ status: 'em_operacao' }),
    )).toBe(true)
    expect(VeiculoDisponibilidadeService.estaDisponivelParaReserva(
      createVeiculo({ status: 'em_manutencao' }),
    )).toBe(false)
    expect(VeiculoDisponibilidadeService.estaDisponivelParaReserva(
      createVeiculo({ status: 'fora_de_operacao' }),
    )).toBe(false)
  })

  it('motorista só pode acessar veículos em operação', () => {
    const motorista = UsuarioFactory.fromProps('u1', 'Motorista', 'm@test.com', 'emp-1', 'motorista')
    const gestor = UsuarioFactory.fromProps('u2', 'Gestor', 'g@test.com', 'emp-1', 'gestor')

    const emManutencao = createVeiculo({ status: 'em_manutencao' })
    const emOperacao = createVeiculo({ status: 'em_operacao' })

    expect(VeiculoDisponibilidadeService.podeMotoristaAcessarVeiculo(motorista, emOperacao)).toBe(true)
    expect(VeiculoDisponibilidadeService.podeMotoristaAcessarVeiculo(motorista, emManutencao)).toBe(false)
    expect(VeiculoDisponibilidadeService.podeMotoristaAcessarVeiculo(gestor, emManutencao)).toBe(true)
  })
})
