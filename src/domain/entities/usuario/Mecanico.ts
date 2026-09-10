import { Usuario } from '@/domain/entities/usuario/Usuario'

/** Mecânico — manutenções e medição de KM na própria empresa. */
export class Mecanico extends Usuario {
  get perfil() {
    return 'mecanico' as const
  }

  podeVisualizarDashboard() { return true }
  podeVisualizarRelatorios() { return false }
  podeGerenciarVeiculos() { return false }
  podeAtualizarKm() { return true }
  podeRegistrarManutencao() { return true }
  podeConcluirManutencao() { return true }
  podeGerenciarAlertas() { return true }
  podeVisualizarEmpresa(empresaId: string) {
    return this.empresaId != null && this.empresaId === empresaId
  }
  isSomenteLeitura() { return false }
  podeSeedTestData() { return false }
  podeExcluirTodosVeiculos() { return false }
  podeGerenciarEmpresas() { return false }
  podeCriarEmpresa() { return false }
  podeExcluirEmpresa() { return false }
}
