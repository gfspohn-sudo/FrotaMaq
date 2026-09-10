export interface NovaEmpresaInput {
  nome: string
  cnpj?: string | null
  slug: string
}

export interface EmpresaDependencies {
  usuarios: number
  veiculos: number
  manutencoes: number
}

export interface IEmpresaRepository {
  findAll(): Promise<{ data: import('@/domain/entities/Empresa').Empresa[] | null; error: unknown }>
  findById(id: string): Promise<{ data: import('@/domain/entities/Empresa').Empresa | null; error: unknown }>
  create(input: NovaEmpresaInput): Promise<{ data: import('@/domain/entities/Empresa').Empresa | null; error: unknown }>
  delete(id: string): Promise<{ error: unknown }>
  countDependencies(id: string): Promise<{ data: EmpresaDependencies | null; error: unknown }>
}
