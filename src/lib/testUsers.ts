import type { PerfilUsuario } from '@/types/database'

export interface TestUser {
  email: string
  nome: string
  perfil: PerfilUsuario
  label: string
  description: string
}

export const TEST_USERS: TestUser[] = [
  {
    email: 'admin@frotamaq.com',
    nome: 'Admin Global',
    perfil: 'super_admin',
    label: 'Super Admin',
    description: 'Visão global multi-empresa',
  },
  {
    email: 'gestor1@frotamaq.com',
    nome: 'Gestor Empresa 1',
    perfil: 'gestor',
    label: 'Gestor (Empresa 1)',
    description: 'Gestão da Empresa 1',
  },
  {
    email: 'mecanico1@frotamaq.com',
    nome: 'Mecânico Empresa 1',
    perfil: 'mecanico',
    label: 'Mecânico (Empresa 1)',
    description: 'Manutenções Empresa 1',
  },
  {
    email: 'motorista1@frotamaq.com',
    nome: 'Motorista Empresa 1',
    perfil: 'motorista',
    label: 'Motorista (Empresa 1)',
    description: 'Somente leitura',
  },
]

export const PERFIL_OPTIONS: { value: PerfilUsuario; label: string }[] = [
  { value: 'motorista', label: 'Motorista' },
  { value: 'mecanico', label: 'Mecânico' },
  { value: 'gestor', label: 'Gestor' },
]
