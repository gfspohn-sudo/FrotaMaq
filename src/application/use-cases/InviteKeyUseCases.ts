import type { IChaveConviteRepository } from '@/domain/repositories/IChaveConviteRepository'
import type { IEmpresaRepository, NovaEmpresaInput } from '@/domain/repositories/IEmpresaRepository'
import { InviteKeyService } from '@/domain/services/InviteKeyService'
import type { Usuario } from '@/domain/entities/usuario/Usuario'
import type { ChaveConvite, Empresa } from '@/types/database'

export interface CriarEmpresaOnboardingInput extends NovaEmpresaInput {
  gestor_nome: string
  gestor_email: string
  gestor_senha: string
}

export interface CriarEmpresaOnboardingResult {
  empresa: Empresa
  chaves: ChaveConvite[]
  gestorEmail: string
  gestorNome: string
  gestorSenha: string
}

export class ValidarChaveConviteUseCase {
  private readonly chaveRepo: IChaveConviteRepository

  constructor(chaveRepo: IChaveConviteRepository) {
    this.chaveRepo = chaveRepo
  }

  async execute(token: string) {
    if (!InviteKeyService.validarFormato(token)) {
      return { data: null, error: new Error('Formato de chave inválido.') }
    }

    const { data, error } = await this.chaveRepo.findByToken(token)
    if (error || !data) {
      return { data: null, error: new Error('Chave de convite inválida ou inativa.') }
    }

    const validation = InviteKeyService.validarCadastro(token, {
      empresaId: data.empresa_id,
      perfil: data.perfil,
    })

    if (!validation.ok) {
      return { data: null, error: new Error(validation.message) }
    }

    return { data: validation.data, error: null }
  }
}

export class CriarEmpresaComChavesUseCase {
  private readonly empresaRepo: IEmpresaRepository
  private readonly chaveRepo: IChaveConviteRepository

  constructor(empresaRepo: IEmpresaRepository, chaveRepo: IChaveConviteRepository) {
    this.empresaRepo = empresaRepo
    this.chaveRepo = chaveRepo
  }

  async execute(
    usuario: Usuario,
    input: CriarEmpresaOnboardingInput,
  ): Promise<{ data: CriarEmpresaOnboardingResult | null; error: unknown }> {
    if (!usuario.podeCriarEmpresa()) {
      return { data: null, error: new Error('Sem permissão.') }
    }

    const { data: empresa, error } = await this.empresaRepo.create({
      nome: input.nome,
      cnpj: input.cnpj,
      slug: input.slug,
    })

    if (error || !empresa) return { data: null, error }

    const chaves: ChaveConvite[] = []
    for (const perfil of ['motorista', 'mecanico'] as const) {
      const token = InviteKeyService.gerarToken(perfil)
      const created = await this.chaveRepo.create(empresa.id, token, perfil)
      if (created.data) chaves.push(created.data)
    }

    return {
      data: {
        empresa: empresa.toDTO(),
        chaves,
        gestorEmail: input.gestor_email,
        gestorNome: input.gestor_nome,
        gestorSenha: input.gestor_senha,
      },
      error: null,
    }
  }
}
