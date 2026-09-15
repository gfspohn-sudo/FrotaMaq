import { describe, it, expect } from 'vitest'
import { PermissionService } from '@/application/services/PermissionService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'

describe('PermissionService — integração com entidades Usuario', () => {
  it('expõe permissões corretas para Super Admin', () => {
    const usuario = UsuarioFactory.fromProps('1', 'Admin', 'a@test.com', null, 'super_admin')
    const vm = PermissionService.toViewModel(usuario)

    expect(vm.isSuperAdmin).toBe(true)
    expect(vm.canManageEmpresas).toBe(true)
    expect(vm.canManageVehicles).toBe(true)
    expect(vm.canViewReports).toBe(true)
  })

  it('expõe permissões corretas para Gestor', () => {
    const usuario = UsuarioFactory.fromProps('2', 'Gestor', 'g@test.com', 'emp-1', 'gestor')
    const vm = PermissionService.toViewModel(usuario)

    expect(vm.isGestor).toBe(true)
    expect(vm.canManageVehicles).toBe(true)
    expect(vm.canManageEmpresas).toBe(false)
    expect(vm.canCreateMaintenance).toBe(true)
  })

  it('expõe permissões corretas para Mecânico', () => {
    const usuario = UsuarioFactory.fromProps('3', 'Mec', 'm@test.com', 'emp-1', 'mecanico')
    const vm = PermissionService.toViewModel(usuario)

    expect(vm.isMecanico).toBe(true)
    expect(vm.canCreateMaintenance).toBe(true)
    expect(vm.canManageVehicles).toBe(false)
    expect(vm.canUpdateKm).toBe(true)
    expect(vm.canViewReports).toBe(false)
    expect(vm.canViewIndividualReports).toBe(true)
    expect(vm.canViewGlobalFinancialMetrics).toBe(false)
    expect(vm.canRequestReportAccess).toBe(true)
    expect(vm.canOpenReportDirectly).toBe(false)
  })

  it('expõe permissões corretas para Motorista (somente leitura)', () => {
    const usuario = UsuarioFactory.fromProps('4', 'Mot', 'mot@test.com', 'emp-1', 'motorista')
    const vm = PermissionService.toViewModel(usuario)

    expect(vm.isMotorista).toBe(true)
    expect(vm.isReadOnly).toBe(true)
    expect(vm.canManageVehicles).toBe(false)
    expect(vm.canCreateMaintenance).toBe(false)
    expect(vm.canViewDashboard).toBe(true)
    expect(vm.canViewGlobalFinancialMetrics).toBe(false)
    expect(vm.canViewGeneralHistory).toBe(false)
    expect(vm.canViewGlobalAlerts).toBe(false)
    expect(vm.canViewScopedReports).toBe(true)
  })

  it('bloqueia métricas financeiras globais para Motorista e Mecânico', () => {
    const motorista = PermissionService.toViewModel(
      UsuarioFactory.fromProps('4', 'Mot', 'mot@test.com', 'emp-1', 'motorista'),
    )
    const mecanico = PermissionService.toViewModel(
      UsuarioFactory.fromProps('3', 'Mec', 'm@test.com', 'emp-1', 'mecanico'),
    )
    const gestor = PermissionService.toViewModel(
      UsuarioFactory.fromProps('2', 'Gestor', 'g@test.com', 'emp-1', 'gestor'),
    )

    expect(motorista.canViewGlobalFinancialMetrics).toBe(false)
    expect(mecanico.canViewGlobalFinancialMetrics).toBe(false)
    expect(gestor.canViewGlobalFinancialMetrics).toBe(true)
  })

  it('gestor pode aprovar acesso a relatórios', () => {
    const gestor = PermissionService.toViewModel(
      UsuarioFactory.fromProps('2', 'Gestor', 'g@test.com', 'emp-1', 'gestor'),
    )
    expect(gestor.canApproveReportAccess).toBe(true)
    expect(gestor.canOpenReportDirectly).toBe(true)
  })

  it('resolve perfil a partir do profile DTO', () => {
    const usuario = PermissionService.resolve({
      id: '5',
      nome: 'Gestor',
      email: 'g@test.com',
      perfil: 'gerente',
      empresa_id: 'emp-1',
      created_at: '2026-01-01T00:00:00.000Z',
    })

    expect(usuario.perfil).toBe('gerente')
    expect(usuario.podeGerenciarVeiculos()).toBe(true)
  })
})
