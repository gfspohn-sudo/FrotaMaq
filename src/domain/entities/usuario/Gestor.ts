import { Usuario } from '@/domain/entities/usuario/Usuario'

/** Gestor de empresa — CRUD completo na própria empresa. */
export class Gestor extends Usuario {
  get perfil() {
    return 'gestor' as const
  }

  constructor(
    id: string,
    nome: string,
    email: string,
    empresaId: string | null,
  ) {
    super(id, nome, email, empresaId)
  }

  podeVisualizarDashboard() { return true }
  podeVisualizarRelatorios() { return true }
  podeGerenciarVeiculos() { return true }
  podeAtualizarKm() { return true }
  podeRegistrarManutencao() { return true }
  podeConcluirManutencao() { return true }
  podeGerenciarAlertas() { return true }
  podeVisualizarEmpresa(empresaId: string) {
    return this.empresaId != null && this.empresaId === empresaId
  }
  isSomenteLeitura() { return false }
  podeSeedTestData() { return true }
  podeExcluirTodosVeiculos() { return true }
  podeGerenciarEmpresas() { return false }
  podeCriarEmpresa() { return false }
  podeExcluirEmpresa() { return false }
  podeSolicitarReserva() { return false }
  podeAprovarReserva() { return true }
  podeVisualizarRelatorioIndividual() { return true }
  podeVisualizarMetricasFinanceirasGlobais() { return true }
  podeVisualizarHistoricoGeral() { return true }
  podeVisualizarAlertasGlobais() { return true }
  podeSolicitarAcessoRelatorio() { return false }
  podeAprovarAcessoRelatorio() { return true }
  podeAbrirRelatorioIndividualDireto() { return true }
}
