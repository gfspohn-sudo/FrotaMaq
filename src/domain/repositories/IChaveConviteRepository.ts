import type { ChaveConvite, PerfilChaveConvite } from '@/types/database'

export interface IChaveConviteRepository {
  findByToken(token: string): Promise<{ data: ChaveConvite | null; error: unknown }>
  findByEmpresa(empresaId: string): Promise<{ data: ChaveConvite[] | null; error: unknown }>
  create(empresaId: string, token: string, perfil: PerfilChaveConvite): Promise<{ data: ChaveConvite | null; error: unknown }>
}
