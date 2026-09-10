import { Usuario } from '@/domain/entities/usuario/Usuario'

/** Gestor de empresa — CRUD completo na própria empresa. */
export class Gestor extends Usuario {
  private readonly _perfil: 'gestor' | 'gerente'

  constructor(
    id: string,
    nome: string,
    email: string,
    empresaId: string | null,
    perfil: 'gestor' | 'gerente' = 'gestor',
  ) {
    super(id, nome, email, empresaId)
    this._perfil = perfil
  }

  get perfil() {
    return this._perfil
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
}
