import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import type { Usuario as UsuarioProfile } from '@/types/database'
import type { Usuario } from '@/domain/entities/usuario/Usuario'

/** Application Service — expõe permissões do usuário autenticado para a UI. */
export class PermissionService {
  static resolve(profile: UsuarioProfile | null | undefined): Usuario {
    return UsuarioFactory.fromProfile(profile)
  }

  static toViewModel(usuario: Usuario) {
    return {
      perfil: usuario.perfil,
      empresaId: usuario.empresaId,

      isSuperAdmin: usuario.perfil === 'super_admin',
      isGestor: usuario.perfil === 'gestor' || usuario.perfil === 'gerente',
      isGerente: usuario.perfil === 'gestor' || usuario.perfil === 'gerente',
      isMecanico: usuario.perfil === 'mecanico',
      isMotorista: usuario.perfil === 'motorista',
      isReadOnly: usuario.isSomenteLeitura(),

      canViewDashboard: usuario.podeVisualizarDashboard(),
      canViewReports: usuario.podeVisualizarRelatorios(),
      canViewFinancialReports: usuario.podeVisualizarRelatorios(),

      canManageVehicles: usuario.podeGerenciarVeiculos(),
      canUpdateKm: usuario.podeAtualizarKm(),

      canCreateMaintenance: usuario.podeRegistrarManutencao(),
      canCompleteMaintenance: usuario.podeConcluirManutencao(),

      canManageAlerts: usuario.podeGerenciarAlertas(),

      canSeedTestData: usuario.podeSeedTestData(),
      canDeleteAllVehicles: usuario.podeExcluirTodosVeiculos(),

      canManageEmpresas: usuario.podeGerenciarEmpresas(),
      canCreateEmpresa: usuario.podeCriarEmpresa(),
      canDeleteEmpresa: usuario.podeExcluirEmpresa(),
    }
  }
}

export type PermissionViewModel = ReturnType<typeof PermissionService.toViewModel>
