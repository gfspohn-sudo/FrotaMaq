import { describe, it, expect } from 'vitest'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'

const EMPRESA = 'empresa-1'

describe('Hierarquia Usuario — permissões', () => {
  const superAdmin = UsuarioFactory.fromProps('1', 'Admin', 'admin@test.com', null, 'super_admin')
  const gestor = UsuarioFactory.fromProps('2', 'Gestor', 'gestor@test.com', EMPRESA, 'gestor')
  const mecanico = UsuarioFactory.fromProps('3', 'Mecânico', 'mec@test.com', EMPRESA, 'mecanico')
  const motorista = UsuarioFactory.fromProps('4', 'Motorista', 'mot@test.com', EMPRESA, 'motorista')

  describe('podeRegistrarManutencao()', () => {
    it.each([
      ['SuperAdmin', superAdmin, true],
      ['Gestor', gestor, true],
      ['Mecanico', mecanico, true],
      ['Motorista', motorista, false],
    ] as const)('%s', (_label, usuario, expected) => {
      expect(usuario.podeRegistrarManutencao()).toBe(expected)
    })
  })

  describe('podeGerenciarVeiculos()', () => {
    it.each([
      ['SuperAdmin', superAdmin, true],
      ['Gestor', gestor, true],
      ['Mecanico', mecanico, false],
      ['Motorista', motorista, false],
    ] as const)('%s', (_label, usuario, expected) => {
      expect(usuario.podeGerenciarVeiculos()).toBe(expected)
    })
  })

  describe('podeSolicitarReserva()', () => {
    it.each([
      ['SuperAdmin', superAdmin, false],
      ['Gestor', gestor, false],
      ['Motorista', motorista, true],
    ] as const)('%s', (_label, usuario, expected) => {
      expect(usuario.podeSolicitarReserva()).toBe(expected)
    })
  })

  describe('podeAprovarReserva()', () => {
    it.each([
      ['SuperAdmin', superAdmin, true],
      ['Gestor', gestor, true],
      ['Motorista', motorista, false],
    ] as const)('%s', (_label, usuario, expected) => {
      expect(usuario.podeAprovarReserva()).toBe(expected)
    })
  })

  describe('podeGerenciarEmpresas()', () => {
    it.each([
      ['SuperAdmin', superAdmin, true],
      ['Gestor', gestor, false],
      ['Mecanico', mecanico, false],
      ['Motorista', motorista, false],
    ] as const)('%s', (_label, usuario, expected) => {
      expect(usuario.podeGerenciarEmpresas()).toBe(expected)
    })
  })

  describe('podeVisualizarEmpresa()', () => {
    it('SuperAdmin visualiza qualquer empresa', () => {
      expect(superAdmin.podeVisualizarEmpresa('qualquer')).toBe(true)
    })

    it('Gestor visualiza apenas a própria empresa', () => {
      expect(gestor.podeVisualizarEmpresa(EMPRESA)).toBe(true)
      expect(gestor.podeVisualizarEmpresa('outra')).toBe(false)
    })

    it('Motorista é somente leitura mas pode solicitar reserva e ver relatório individual', () => {
      expect(motorista.isSomenteLeitura()).toBe(true)
      expect(motorista.podeAtualizarKm()).toBe(false)
      expect(motorista.podeSolicitarReserva()).toBe(true)
      expect(motorista.podeVisualizarRelatorioIndividual()).toBe(true)
      expect(motorista.podeVisualizarRelatorios()).toBe(false)
    })
  })
})
