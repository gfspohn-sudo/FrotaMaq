import { container } from '@/infrastructure/di/container'
import { asServiceError } from '@/application/utils/asServiceError'
import { notifyDataRefresh } from '@/lib/dataRefresh'
import type { Usuario, NovaReserva, StatusReserva, Reserva } from '@/types/database'

export async function getReservas(
  profile: Usuario | null,
  filter?: { empresaId?: string; status?: StatusReserva },
) {
  const result = await container.listReservas.execute(profile, filter)
  return { ...result, error: asServiceError(result.error) }
}

export async function solicitarReserva(profile: Usuario | null, input: NovaReserva) {
  const result = await container.solicitarReserva.execute(profile, input)
  if (result.data) notifyDataRefresh()
  return { ...result, error: asServiceError(result.error) }
}

export async function aprovarReserva(profile: Usuario | null, id: string, observacao?: string) {
  const result = await container.atualizarStatusReserva.execute(profile, id, 'APROVADO', observacao)
  if (result.data) notifyDataRefresh()
  return { ...result, error: asServiceError(result.error) }
}

export async function rejeitarReserva(profile: Usuario | null, id: string, observacao?: string) {
  const result = await container.atualizarStatusReserva.execute(profile, id, 'REJEITADO', observacao)
  if (result.data) notifyDataRefresh()
  return { ...result, error: asServiceError(result.error) }
}

export type { Reserva }
