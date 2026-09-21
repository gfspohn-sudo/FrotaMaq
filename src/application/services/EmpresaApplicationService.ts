import type { IEmpresaRepository, NovaEmpresaInput, EmpresaDependencies } from '@/domain/repositories/IEmpresaRepository'
import type { Usuario } from '@/domain/entities/usuario/Usuario'
import type { Empresa as EmpresaDTO } from '@/types/database'

export class EmpresaDomainService {
  static slugify(nome: string): string {
    return nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'empresa'
  }

  static validarCriacao(input: NovaEmpresaInput): string | null {
    if (!input.nome.trim()) return 'Informe o nome da empresa.'
    const slug = input.slug.trim() || EmpresaDomainService.slugify(input.nome)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.toLowerCase())) {
      return 'Slug inválido. Use letras minúsculas, números e hífens.'
    }
    return null
  }

  static perfilRequerEmpresa(perfil: string): boolean {
    return perfil !== 'super_admin'
  }

  static validarVinculoEmpresa(perfil: string, empresaId: string | null | undefined): string | null {
    if (EmpresaDomainService.perfilRequerEmpresa(perfil) && !empresaId) {
      return 'Selecione a empresa para este perfil.'
    }
    return null
  }
}

/** Application Service — operações de empresa com validação de permissão. */
export class EmpresaApplicationService {
  private readonly empresaRepo: IEmpresaRepository

  constructor(empresaRepo: IEmpresaRepository) {
    this.empresaRepo = empresaRepo
  }

  async listarTodas(usuario: Usuario): Promise<{ data: EmpresaDTO[] | null; error: unknown }> {
    if (!usuario.podeGerenciarEmpresas()) {
      return { data: null, error: new Error('Sem permissão para listar empresas.') }
    }

    const { data, error } = await this.empresaRepo.findAll()
    return { data: data?.map(e => e.toDTO()) ?? null, error }
  }

  /** Lista pública para formulário de cadastro (somente id + nome). */
  async listarParaCadastro(): Promise<{ data: EmpresaDTO[] | null; error: unknown }> {
    const { data, error } = await this.empresaRepo.findAll()
    return { data: data?.map(e => e.toDTO()) ?? null, error }
  }

  async criarEmpresa(
    usuario: Usuario,
    input: NovaEmpresaInput,
  ): Promise<{ data: EmpresaDTO | null; error: unknown }> {
    if (!usuario.podeCriarEmpresa()) {
      return { data: null, error: new Error('Sem permissão para criar empresas.') }
    }

    const payload: NovaEmpresaInput = {
      ...input,
      slug: input.slug.trim() || EmpresaDomainService.slugify(input.nome),
    }

    const validationError = EmpresaDomainService.validarCriacao(payload)
    if (validationError) {
      return { data: null, error: new Error(validationError) }
    }

    const { data, error } = await this.empresaRepo.create(payload)
    return { data: data?.toDTO() ?? null, error }
  }

  async obterDependencias(
    usuario: Usuario,
    empresaId: string,
  ): Promise<{ data: EmpresaDependencies | null; error: unknown }> {
    if (!usuario.podeExcluirEmpresa()) {
      return { data: null, error: new Error('Sem permissão.') }
    }
    return this.empresaRepo.countDependencies(empresaId)
  }

  async excluirEmpresa(
    usuario: Usuario,
    empresaId: string,
  ): Promise<{ error: unknown; deleted: boolean }> {
    if (!usuario.podeExcluirEmpresa()) {
      return { error: new Error('Sem permissão para excluir empresas.'), deleted: false }
    }

    const exists = await this.empresaRepo.findById(empresaId)
    if (exists.error || !exists.data) {
      return { error: exists.error ?? new Error('Empresa não encontrada.'), deleted: false }
    }

    const { error } = await this.empresaRepo.delete(empresaId)
    return { error, deleted: !error }
  }
}
