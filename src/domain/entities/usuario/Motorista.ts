import { Usuario } from '@/domain/entities/usuario/Usuario'

/** Motorista — somente leitura na própria empresa. */
export class Motorista extends Usuario {
  get perfil() {
    return 'motorista' as const
  }

  podeVisualizarDashboard() { return true }
  podeVisualizarRelatorios() { return false }
  podeGerenciarVeiculos() { return false }
  podeAtualizarKm() { return false }
  podeRegistrarManutencao() { return false }
  podeConcluirManutencao() { return false }
  podeGerenciarAlertas() { return false }
  podeVisualizarEmpresa(empresaId: string) {
    return this.empresaId != null && this.empresaId === empresaId
  }
  isSomenteLeitura() { return true }
  podeSeedTestData() { return false }
  podeExcluirTodosVeiculos() { return false }
  podeGerenciarEmpresas() { return false }
  podeCriarEmpresa() { return false }
  podeExcluirEmpresa() { return false }
  podeSolicitarReserva() { return true }
  podeAprovarReserva() { return false }
  podeVisualizarRelatorioIndividual() { return true }
  podeVisualizarMetricasFinanceirasGlobais() { return false }
  podeVisualizarHistoricoGeral() { return false }
  podeVisualizarAlertasGlobais() { return false }
  podeSolicitarAcessoRelatorio() { return false }
  podeAprovarAcessoRelatorio() { return false }
  podeAbrirRelatorioIndividualDireto() { return false }
}
