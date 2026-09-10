import type { PerfilUsuario } from '@/domain/types/enums'

/** Classe base — hierarquia de usuários do sistema. */
export abstract class Usuario {
  readonly id: string
  readonly nome: string
  readonly email: string
  readonly empresaId: string | null

  constructor(id: string, nome: string, email: string, empresaId: string | null) {
    this.id = id
    this.nome = nome
    this.email = email
    this.empresaId = empresaId
  }

  abstract get perfil(): PerfilUsuario

  abstract podeVisualizarDashboard(): boolean
  abstract podeVisualizarRelatorios(): boolean
  abstract podeGerenciarVeiculos(): boolean
  abstract podeAtualizarKm(): boolean
  abstract podeRegistrarManutencao(): boolean
  abstract podeConcluirManutencao(): boolean
  abstract podeGerenciarAlertas(): boolean
  abstract podeVisualizarEmpresa(empresaId: string): boolean
  abstract isSomenteLeitura(): boolean
  abstract podeSeedTestData(): boolean
  abstract podeExcluirTodosVeiculos(): boolean
  abstract podeGerenciarEmpresas(): boolean
  abstract podeCriarEmpresa(): boolean
  abstract podeExcluirEmpresa(): boolean

  get iniciais(): string {
    return this.nome
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }
}
