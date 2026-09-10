import type { PerfilUsuario } from '@/domain/types/enums'
import type { Usuario as UsuarioProfile } from '@/types/database'
import { Usuario } from '@/domain/entities/usuario/Usuario'
import { SuperAdmin } from '@/domain/entities/usuario/SuperAdmin'
import { Gestor } from '@/domain/entities/usuario/Gestor'
import { Mecanico } from '@/domain/entities/usuario/Mecanico'
import { Motorista } from '@/domain/entities/usuario/Motorista'

/** Factory — instancia a subclasse correta de Usuario a partir do perfil. */
export class UsuarioFactory {
  static fromProfile(profile: UsuarioProfile | null | undefined): Usuario {
    if (!profile) return UsuarioFactory.anonimo()
    return UsuarioFactory.fromProps(
      profile.id,
      profile.nome,
      profile.email,
      profile.empresa_id,
      profile.perfil,
    )
  }

  static fromProps(
    id: string,
    nome: string,
    email: string,
    empresaId: string | null,
    perfil: PerfilUsuario,
  ): Usuario {
    switch (perfil) {
      case 'super_admin':
        return new SuperAdmin(id, nome, email, empresaId)
      case 'gestor':
      case 'gerente':
        return new Gestor(id, nome, email, empresaId, perfil)
      case 'mecanico':
        return new Mecanico(id, nome, email, empresaId)
      case 'motorista':
      default:
        return new Motorista(id, nome, email, empresaId)
    }
  }

  /** Usuário anônimo / não autenticado — permissões mínimas. */
  static anonimo(): Usuario {
    return new Motorista('anon', 'Visitante', '', null)
  }
}
