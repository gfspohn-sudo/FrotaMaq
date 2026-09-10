import type { PerfilUsuario } from '@/types/database'

export const ALL_EMPRESAS = '__all__'
export const ALL_EMPRESAS_LABEL = 'TODAS AS EMPRESAS - Visão Geral Super Admin'
export const TENANT_STORAGE_KEY = 'frotalog_tenant'

export interface TenantQueryOptions {
  empresaId?: string
}

export const PERFIL_LABELS: Record<PerfilUsuario, string> = {
  super_admin: 'Super Admin',
  gestor: 'Gestor',
  gerente: 'Gestor',
  mecanico: 'Mecânico',
  motorista: 'Motorista',
}

/** @deprecated Use UsuarioFactory + métodos da entidade Usuario */
export function isSuperAdmin(perfil?: PerfilUsuario | null) {
  return perfil === 'super_admin'
}

/** @deprecated Use UsuarioFactory + métodos da entidade Usuario */
export function isGestorRole(perfil?: PerfilUsuario | null) {
  return perfil === 'gerente' || perfil === 'gestor'
}

/** @deprecated Use UsuarioFactory + métodos da entidade Usuario */
export function isGestor(perfil?: PerfilUsuario | null) {
  return isGestorRole(perfil) || isSuperAdmin(perfil)
}

/** @deprecated Use usuario.podeVisualizarRelatorios() */
export function canAccessReports(perfil?: PerfilUsuario | null) {
  return isGestor(perfil)
}

/** @deprecated Use usuario.podeGerenciarVeiculos() */
export function canWriteVehicles(perfil?: PerfilUsuario | null) {
  return isGestor(perfil)
}

/** @deprecated Use usuario.podeRegistrarManutencao() */
export function canWriteMaintenance(perfil?: PerfilUsuario | null) {
  return isGestor(perfil) || perfil === 'mecanico'
}

/** @deprecated Use usuario.isSomenteLeitura() */
export function isReadOnlyRole(perfil?: PerfilUsuario | null) {
  return perfil === 'motorista'
}
