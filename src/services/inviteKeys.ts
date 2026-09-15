import { container } from '@/infrastructure/di/container'
import { asServiceError } from '@/application/utils/asServiceError'
import type { ChaveConvite } from '@/types/database'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import type { Usuario as UsuarioProfile } from '@/types/database'
import type { CriarEmpresaOnboardingInput } from '@/application/use-cases/InviteKeyUseCases'
import { supabase } from '@/lib/supabase'
import { notifyDataRefresh } from '@/lib/dataRefresh'

export async function validarChaveConvite(token: string) {
  const result = await container.validarChaveConvite.execute(token)
  return { ...result, error: asServiceError(result.error) }
}

export async function getChavesConviteEmpresa(empresaId: string, profile: UsuarioProfile | null) {
  const usuario = UsuarioFactory.fromProfile(profile)
  if (!usuario.podeAprovarReserva() && !usuario.podeGerenciarEmpresas()) {
    return { data: null, error: { message: 'Sem permissão.' } }
  }
  const { data, error } = await container.chaveConviteRepository.findByEmpresa(empresaId)
  return { data, error: asServiceError(error) }
}

export async function criarEmpresaComOnboarding(
  input: CriarEmpresaOnboardingInput,
  profile: UsuarioProfile | null,
) {
  const usuario = UsuarioFactory.fromProfile(profile)
  const result = await container.criarEmpresaComChaves.execute(usuario, input)
  if (result.error || !result.data) {
    return { data: null, error: asServiceError(result.error) }
  }

  const { gestorEmail, gestorNome, gestorSenha, empresa, chaves } = result.data

  const { error: gestorError } = await supabase.auth.signUp({
    email: gestorEmail,
    password: gestorSenha,
    options: {
      data: {
        nome: gestorNome,
        perfil: 'gestor',
        empresa_id: empresa.id,
      },
    },
  })

  if (gestorError) {
    return {
      data: { empresa, chaves, gestorCriado: false },
      error: asServiceError(new Error(`Empresa criada, mas falha ao criar gestor: ${gestorError.message}`)),
    }
  }

  notifyDataRefresh()
  return { data: { empresa, chaves, gestorCriado: true }, error: null }
}

export type { ChaveConvite, CriarEmpresaOnboardingInput }
