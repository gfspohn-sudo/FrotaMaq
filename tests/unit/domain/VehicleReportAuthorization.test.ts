import { describe, it, expect } from 'vitest'
import { VehicleReportAuthorizationService } from '@/domain/services/VehicleReportAuthorizationService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'

describe('VehicleReportAuthorizationService', () => {
  const gestor = UsuarioFactory.fromProps('1', 'Gestor', 'g@test.com', 'emp-1', 'gestor')
  const motorista = UsuarioFactory.fromProps('2', 'Motorista', 'm@test.com', 'emp-1', 'motorista')
  const mecanico = UsuarioFactory.fromProps('3', 'Mecânico', 'mc@test.com', 'emp-1', 'mecanico')

  it('gestor acessa relatório de qualquer veículo da empresa', () => {
    expect(
      VehicleReportAuthorizationService.podeAcessar(gestor, {
        veiculoId: 'v-1',
        empresaId: 'emp-1',
        veiculosEscopoMotorista: [],
        veiculosRelatorioAprovadoMecanico: [],
      }),
    ).toBe(true)
  })

  it('motorista não acessa veículo fora do escopo de reservas', () => {
    expect(
      VehicleReportAuthorizationService.podeAcessar(motorista, {
        veiculoId: 'v-1',
        empresaId: 'emp-1',
        veiculosEscopoMotorista: [],
        veiculosRelatorioAprovadoMecanico: [],
      }),
    ).toBe(false)
  })

  it('motorista acessa veículo no escopo de reservas', () => {
    expect(
      VehicleReportAuthorizationService.podeAcessar(motorista, {
        veiculoId: 'v-1',
        empresaId: 'emp-1',
        veiculosEscopoMotorista: ['v-1'],
        veiculosRelatorioAprovadoMecanico: [],
      }),
    ).toBe(true)
  })

  it('mecânico não acessa relatório sem aprovação do gestor', () => {
    expect(
      VehicleReportAuthorizationService.podeAcessar(mecanico, {
        veiculoId: 'v-1',
        empresaId: 'emp-1',
        veiculosEscopoMotorista: [],
        veiculosRelatorioAprovadoMecanico: [],
      }),
    ).toBe(false)
  })

  it('mecânico acessa relatório após aprovação do gestor', () => {
    expect(
      VehicleReportAuthorizationService.podeAcessar(mecanico, {
        veiculoId: 'v-1',
        empresaId: 'emp-1',
        veiculosEscopoMotorista: [],
        veiculosRelatorioAprovadoMecanico: ['v-1'],
      }),
    ).toBe(true)
  })

  it('filtrarVeiculosMotorista retorna apenas veículos do escopo', () => {
    const veiculos = [
      { id: 'v-1', placa: 'ABC' },
      { id: 'v-2', placa: 'DEF' },
      { id: 'v-3', placa: 'GHI' },
    ]
    const filtered = VehicleReportAuthorizationService.filtrarVeiculosMotorista(veiculos, ['v-1', 'v-3'])
    expect(filtered.map(v => v.id)).toEqual(['v-1', 'v-3'])
  })

  it('filtrarVeiculosMotorista retorna vazio quando escopo vazio', () => {
    const veiculos = [{ id: 'v-1', placa: 'ABC' }]
    expect(VehicleReportAuthorizationService.filtrarVeiculosMotorista(veiculos, [])).toEqual([])
  })
})
