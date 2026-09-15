import type { Reserva } from '@/domain/entities/Reserva'
import type { NovaReserva, StatusReserva } from '@/types/database'
import type { TenantFilter } from '@/domain/types/enums'

export interface ReservaListFilter extends TenantFilter {
  status?: StatusReserva
  motoristaId?: string
  veiculoId?: string
}

export interface IReservaRepository {
  findAll(filter?: ReservaListFilter): Promise<{ data: Reserva[] | null; error: unknown }>
  findById(id: string): Promise<{ data: Reserva | null; error: unknown }>
  create(input: NovaReserva & { motorista_id: string; empresa_id: string }): Promise<{ data: Reserva | null; error: unknown }>
  updateStatus(id: string, status: StatusReserva, observacaoGestor?: string | null): Promise<{ data: Reserva | null; error: unknown }>
  findVeiculosComReservaAprovada(motoristaId: string): Promise<{ data: string[] | null; error: unknown }>
  /** Histórico de uso: reservas aprovadas ou pendentes (não rejeitadas). */
  findVeiculosEscopoMotorista(motoristaId: string): Promise<{ data: string[] | null; error: unknown }>
  countPendentes(filter?: TenantFilter): Promise<{ count: number; error: unknown }>
}
