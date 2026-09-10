import { Usuario } from '@/domain/entities/usuario/Usuario'

/** Super Admin — visão global multi-empresa. */
export class SuperAdmin extends Usuario {
  get perfil() {
    return 'super_admin' as const
  }

  podeVisualizarDashboard() { return true }
  podeVisualizarRelatorios() { return true }
  podeGerenciarVeiculos() { return true }
  podeAtualizarKm() { return true }
  podeRegistrarManutencao() { return true }
  podeConcluirManutencao() { return true }
  podeGerenciarAlertas() { return true }
  podeVisualizarEmpresa(_empresaId: string) { return true }
  isSomenteLeitura() { return false }
  podeSeedTestData() { return true }
  podeExcluirTodosVeiculos() { return true }
  podeGerenciarEmpresas() { return true }
  podeCriarEmpresa() { return true }
  podeExcluirEmpresa() { return true }
}
