import { container } from '@/infrastructure/di/container'
import { EmpresaApplicationService } from '@/application/services/EmpresaApplicationService'
import { UsuarioFactory } from '@/domain/entities/usuario/UsuarioFactory'
import { asServiceError } from '@/application/utils/asServiceError'
import type { Usuario as UsuarioProfile } from '@/types/database'
import type { NovaEmpresaInput, EmpresaDependencies } from '@/domain/repositories/IEmpresaRepository'
import type { Empresa } from '@/types/database'
import { notifyDataRefresh } from '@/lib/dataRefresh'

const empresaService = new EmpresaApplicationService(container.empresaRepository)

function resolveUsuario(profile: UsuarioProfile | null | undefined) {
  return UsuarioFactory.fromProfile(profile)
}

/** Lista empresas — Super Admin vê todas; cadastro público usa RLS anon. */
export async function getEmpresas(profile?: UsuarioProfile | null) {
  const usuario = profile ? resolveUsuario(profile) : null
  if (usuario?.podeGerenciarEmpresas()) {
    const result = await empresaService.listarTodas(usuario)
    return { ...result, error: asServiceError(result.error) }
  }
  const result = await empresaService.listarParaCadastro()
  return { ...result, error: asServiceError(result.error) }
}

export async function getEmpresaById(id: string, profile: UsuarioProfile | null) {
  const usuario = resolveUsuario(profile)
  if (!usuario.podeGerenciarEmpresas()) {
    return { data: null, error: { message: 'Sem permissão.' } }
  }
  const { data, error } = await container.empresaRepository.findById(id)
  return { data: data?.toDTO() ?? null, error: asServiceError(error) }
}

export async function criarEmpresa(
  input: NovaEmpresaInput,
  profile: UsuarioProfile | null,
): Promise<{ data: Empresa | null; error: { message: string } | null }> {
  const result = await empresaService.criarEmpresa(resolveUsuario(profile), input)
  if (result.data) notifyDataRefresh()
  return { ...result, error: asServiceError(result.error) }
}

export async function excluirEmpresa(
  id: string,
  profile: UsuarioProfile | null,
): Promise<{ error: { message: string } | null; deleted: boolean }> {
  const result = await empresaService.excluirEmpresa(resolveUsuario(profile), id)
  if (result.deleted) notifyDataRefresh()
  return { error: asServiceError(result.error), deleted: result.deleted }
}

export async function getEmpresaDependencies(
  id: string,
  profile: UsuarioProfile | null,
): Promise<{ data: EmpresaDependencies | null; error: { message: string } | null }> {
  const result = await empresaService.obterDependencias(resolveUsuario(profile), id)
  return { ...result, error: asServiceError(result.error) }
}

export { EmpresaDomainService } from '@/application/services/EmpresaApplicationService'
export type { NovaEmpresaInput, EmpresaDependencies }
